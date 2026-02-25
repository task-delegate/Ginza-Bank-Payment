import express from "express";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();

// Supabase configuration
const supabaseUrlRaw = process.env.SUPABASE_URL || "vgvnahcunvwigwaniejg";
const supabaseUrl = supabaseUrlRaw.includes("://") 
  ? supabaseUrlRaw 
  : `https://${supabaseUrlRaw}.supabase.co`;
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndm5haGN1bnZ3aWd3YW5pZWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ2MDgsImV4cCI6MjA4NzQ4MDYwOH0.qvv-O8mhmcpL1gDmP7kpd6mUzDvN1DZsqawy1KK2qCY";

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Google Sheets configuration (Using Apps Script Web App)
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbyKJhtxHZuaNb-5QEX2EmW5uzegW71gHB5FmAd_u7nCQVNxuUpJWlHxoZ6yg6wc3pE8/exec";

const ALL_UNITS = [
  "CKU", "WARP", "EMB", "HOOK & EYE", "TLU", "VAU", "CUP",
  "ALU", "MUM", "DMN", "ENH/ EHU", "DPU/ DPF", "APP", "LMN", "SUR", "SLU", "SUN", "TDU", "KDC", "Udhana", "BGU", "SGU", "CAD",
];

app.use(express.json());

app.set("trust proxy", 1);

app.use(
  cookieSession({
    name: "session",
    keys: ["ginza-secret-key-v2"],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,
    sameSite: "none",
    httpOnly: true,
  })
);

// --- API Routes ---

app.get("/api/units", (req, res) => {
  res.json(ALL_UNITS);
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.session?.user || null });
});

app.post("/api/auth/register", async (req, res) => {
  const { firstName, lastName, email, password, units, role } = req.body;
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from("users")
      .insert([{ 
        first_name: firstName, 
        last_name: lastName, 
        email: email.toLowerCase(), 
        password: hashedPassword, 
        units, 
        role 
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    if (error || !user) throw new Error("User not found");

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new Error("Invalid password");

    req.session!.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      units: user.units
    };

    res.json({ user: req.session!.user });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session = null;
  res.json({ success: true });
});

app.get("/api/customers", async (req, res) => {
  if (!GOOGLE_SCRIPT_URL) return res.json([]);
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL + "?action=read_sheet&sheetName=Master Sheet");
    const data = await response.json();
    if (data.success) {
      const customers = data.data.slice(1).map((row: any) => ({
        name: row[0],
        account_no: row[1],
        ifsc_code: row[2]
      }));
      res.json(customers);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.json([]);
  }
});

app.get("/api/beneficiaries/search", async (req, res) => {
  const name = req.query.name as string;
  if (!name || name.length < 2) return res.json({ beneficiaries: [] });

  let results: any[] = [];
  try {
    if (supabase) {
      const { data, error: sbError } = await supabase
        .from("beneficiary_details")
        .select("*")
        .ilike("name", `%${name}%`)
        .limit(10);
      
      if (!sbError && data) {
        results = data.map(b => ({
          name: b.name,
          account_no: b.account_no,
          ifsc_code: b.ifsc_code,
          source: "supabase"
        }));
      }
    }
  } catch (sbErr) { console.error("Supabase search error:", sbErr); }

  if (results.length < 5 && GOOGLE_SCRIPT_URL) {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL + "?action=read_sheet&sheetName=Master Sheet");
      const data = await response.json();
      if (data.success && data.data.length > 1) {
        const dataRows = data.data.slice(1);
        const searchLower = name.toLowerCase();
        const sheetResults = dataRows
          .filter((row: any) => (row[0] || "").toString().toLowerCase().includes(searchLower))
          .map((row: any) => ({
            name: row[0],
            account_no: row[1],
            ifsc_code: row[2],
            source: "sheets"
          }));

        const existingNames = new Set(results.map(r => r.name.toLowerCase()));
        sheetResults.forEach((sr: any) => {
          if (!existingNames.has(sr.name.toLowerCase())) results.push(sr);
        });
      }
    } catch (error: any) { console.error("Sheets search error:", error.message); }
  }
  res.json({ beneficiaries: results.slice(0, 10) });
});

app.post("/api/submit", async (req, res) => {
  const { email, unit, beneficiaryName, accountNo, ifscCode, bills } = req.body;
  if (!email || !unit || !beneficiaryName || !accountNo || !ifscCode || !bills) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    if (supabase) {
      await supabase.from("beneficiary_details").upsert({ name: beneficiaryName, account_no: accountNo, ifsc_code: ifscCode }, { onConflict: "name" });
      const supabaseOrders = bills.map((bill: any) => ({
        email, unit, beneficiary_name: beneficiaryName, account_no: accountNo, ifsc_code: ifscCode,
        bill_date: bill.billDate, due_date: bill.dueDate, amount: parseFloat(bill.amount),
        approved_by_unit: false, processed_by_finance: false
      }));
      await supabase.from("orders").insert(supabaseOrders);
    }

    if (GOOGLE_SCRIPT_URL) {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "submit_order", email, unit, beneficiaryName, accountNo, ifscCode, bills }),
        headers: { "Content-Type": "application/json" }
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

app.get("/api/orders", async (req, res) => {
  const { role, email } = req.session?.user || {};
  const { view } = req.query;
  if (!supabase) return res.json({ orders: [] });

  let query = supabase.from("orders").select("*");
  if (role === "Unit Team") {
    query = query.eq("email", email);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    query = query.gte("created_at", fiveDaysAgo.toISOString());
  } else if (role === "Finance Team") {
    query = query.eq("approved_by_unit", true).eq("processed_by_finance", false);
  } else if (role === "Master") {
    if (view === "finance") query = query.eq("approved_by_unit", true).eq("processed_by_finance", false);
  }

  const { data } = await query.order("created_at", { ascending: false });
  res.json({ orders: data || [] });
});

app.post("/api/orders/approve", async (req, res) => {
  const { orderIds } = req.body;
  const sessionUser = req.session?.user;
  
  if (!sessionUser) return res.status(401).json({ error: "Unauthorized: No session found" });
  if (!supabase) return res.status(500).json({ error: "Server Configuration Error: Supabase not initialized" });

  try {
    const { data: orders } = await supabase.from("orders").select("*").in("id", orderIds);
    await supabase.from("orders").update({ approved_by_unit: true }).in("id", orderIds);

    if (GOOGLE_SCRIPT_URL && orders) {
      const userName = (sessionUser.firstName || "") + " " + (sessionUser.lastName || "");
      const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      for (const order of orders) {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_approval", email: order.email, beneficiaryName: order.beneficiary_name, billDate: order.bill_date,
            approval: { approval_timestamp: now, approval_by_name: userName.trim() || sessionUser.email, payment_mode: "" }
          })
        });
      }
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post("/api/orders/set-payment-mode", async (req, res) => {
  const { orderIds, bank } = req.body;
  const sessionUser = req.session?.user;
  
  if (!sessionUser) return res.status(401).json({ error: "Unauthorized: No session found" });
  if (!supabase) return res.status(500).json({ error: "Server Configuration Error: Supabase not initialized" });

  try {
    const { data: orders } = await supabase.from("orders").select("*").in("id", orderIds);
    await supabase.from("orders").update({ processed_by_finance: true, payment_method: bank }).in("id", orderIds);

    if (GOOGLE_SCRIPT_URL && orders) {
      const userName = (sessionUser.firstName || "") + " " + (sessionUser.lastName || "");
      const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_payment_sheet", paymentMode: bank, approval_by_name: userName.trim() || sessionUser.email,
          orders: orders.map(o => ({ email: o.email, unit: o.unit, beneficiary_name: o.beneficiary_name, account_no: o.account_no, ifsc_code: o.ifsc_code, bill_date: o.bill_date, due_date: o.due_date, amount: o.amount }))
        })
      });
      for (const order of orders) {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_approval", email: order.email, beneficiaryName: order.beneficiary_name, billDate: order.bill_date,
            approval: { approval_timestamp: now, approval_by_name: userName.trim() || sessionUser.email, payment_mode: bank }
          })
        });
      }
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get("/api/history", async (req, res) => {
  const email = req.query.email as string;
  if (!email || !GOOGLE_SCRIPT_URL) return res.json({ orders: [] });
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL + "?action=read_sheet&sheetName=Sheet1");
    const data = await response.json();
    if (!data.success || data.data.length <= 1) return res.json({ orders: [] });
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const userOrders = data.data.slice(1)
      .filter((row: any) => row[2] === email && new Date(row[1]) >= fiveDaysAgo)
      .map((row: any) => ({ timestamp: row[1], unit: row[3], beneficiary: row[4], account: row[5], amount: row[9] }))
      .reverse();
    res.json({ orders: userOrders });
  } catch (error) { res.status(500).json({ error: "Failed to fetch history" }); }
});

export default app;
