import express from "express";
import { createServer as createViteServer } from "vite";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Supabase configuration
const supabaseUrlRaw = process.env.SUPABASE_URL || "vgvnahcunvwigwaniejg";
const supabaseUrl = supabaseUrlRaw.includes("://") 
  ? supabaseUrlRaw 
  : `https://${supabaseUrlRaw}.supabase.co`;
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndm5haGN1bnZ3aWd3YW5pZWpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ2MDgsImV4c[...]";

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

console.log(`Supabase URL: ${supabaseUrl}`);
console.log(`Supabase Key: ${supabaseKey ? supabaseKey.substring(0, 10) + "..." : "MISSING"}`);

if (!supabase) {
  console.warn("Supabase client failed to initialize. Check your credentials.");
}

// Google Sheets configuration (Using Apps Script Web App)
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbyKJhtxHZuaNb-5QEX2EmW5uzegW71gHB5FmAd_u7nCQVNxuUpJWlHxoZ6yg6wc3pE8/exec";

const ALL_UNITS = [
  "CKU", "WARP", "EMB", "HOOK & EYE", "TLU", "VAU", "CUP",
  "ALU", "MUM", "DMN", "ENH/ EHU", "DPU/ DPF", "APP", "LMN", "SUR", "SLU", "SUN", "TDU", "KDC", "Udhana", "BGU", "SGU", "CAD",
];

app.use(express.json());

// Fetch customers from "Master Sheet" via Apps Script
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
    console.error("Error fetching customers from Master Sheet:", error);
    res.json([]);
  }
});

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

// --- Auth Routes ---
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

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.session?.user || null });
});

app.post("/api/auth/logout", (req, res) => {
  req.session = null;
  res.json({ success: true });
});

// API Routes
app.get("/api/units", (req, res) => {
  res.json({ units: ALL_UNITS });
});

// ✅ FIXED Beneficiary Search Route
app.get("/api/beneficiaries/search", async (req, res) => {
  const name = req.query.name as string;
  if (!name || name.length < 2) {
    return res.json({ beneficiaries: [] });
  }

  let results: any[] = [];

  // 1. Try Supabase first
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from("beneficiary_details")
        .select("*")
        .ilike("name", `%${name}%`)
        .limit(10);
      
      if (!error && data && data.length > 0) {
        results = data.map(b => ({
          name: b.name,
          account_no: b.account_no,
          ifsc_code: b.ifsc_code,
          source: "supabase"
        }));
      } else {
        console.log("No results from Supabase or error:", error);
      }
    }
  } catch (sbErr) {
    console.error("Supabase search error:", sbErr);
  }

  // 2. If few results, try Google Sheets
  if (results.length < 5 && GOOGLE_SCRIPT_URL) {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL + "?action=read_sheet&sheetName=Master Sheet");
      const data = await response.json();
      
      if (data.success && data.data.length > 1) {
        const dataRows = data.data.slice(1);
        const searchLower = name.toLowerCase();

        const sheetResults = dataRows
          .filter((row: any) => {
            const rowName = (row[0] || "").toString().toLowerCase();
            return rowName.includes(searchLower);
          })
          .map((row: any) => ({
            name: row[0],
            account_no: row[1],
            ifsc_code: row[2],
            source: "sheets"
          }));

        // Merge and remove duplicates
        const existingNames = new Set(results.map(r => r.name.toLowerCase()));
        sheetResults.forEach((sr: any) => {
          if (!existingNames.has(sr.name.toLowerCase())) {
            results.push(sr);
          }
        });
      }
    } catch (error: any) {
      console.error("Google Sheets search error:", error.message);
    }
  }

  res.json({ beneficiaries: results.slice(0, 10) });
});

// Form Submission Route
app.post("/api/submit", async (req, res) => {
  const { email, unit, beneficiaryName, accountNo, ifscCode, bills } = req.body;

  if (!email || !unit || !beneficiaryName || !accountNo || !ifscCode || !bills) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // 1. Save to Supabase
    if (supabase) {
      // Save beneficiary (allow duplicates - no unique constraint)
      const { error: bError } = await supabase
        .from("beneficiary_details")
        .insert({ name: beneficiaryName, account_no: accountNo, ifsc_code: ifscCode });
      
      if (bError) {
        console.error("Supabase Beneficiary Error:", bError);
        // Continue anyway - beneficiary save is not critical
      }

      // Save orders
      const supabaseOrders = bills.map((bill: any) => ({
        email,
        unit,
        beneficiary_name: beneficiaryName,
        account_no: accountNo,
        ifsc_code: ifscCode,
        bill_date: bill.billDate,
        due_date: bill.dueDate,
        amount: parseFloat(bill.amount),
        approved_by_unit: false,
        processed_by_finance: false
      }));
      
      const { error: oError } = await supabase.from("orders").insert(supabaseOrders);
      if (oError) {
        console.error("Supabase Orders Insert Error:", oError);
        throw new Error(`Order save failed: ${oError.message}`);
      }
    }

    // 2. Save to Google Sheet via Apps Script
    if (GOOGLE_SCRIPT_URL) {
      try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({ 
            action: "submit_order",
            email, 
            unit, 
            beneficiaryName, 
            accountNo, 
            ifscCode, 
            bills 
          }),
          headers: { "Content-Type": "application/json" }
        });
        const result = await response.json();
        if (result.success) {
          console.log("Successfully saved to Google Sheets via Script URL");
        } else {
          console.error("Google Script Error:", result.error);
        }
      } catch (scriptError) {
        console.error("Google Script Fetch Error:", scriptError);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Submission Route Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// ✅ FIXED GET /api/orders - OPTION A WORKFLOW
app.get("/api/orders", async (req, res) => {
  const { role, email } = req.session?.user || {};
  if (!supabase) return res.json({ orders: [] });

  let query = supabase.from("orders").select("*");

  if (role === "Unit Team") {
    // Unit Team sees only their own entries from last 5 days
    query = query.eq("email", email);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    query = query.gte("created_at", fiveDaysAgo.toISOString());
    
  } else if (role === "Finance Team") {
    // ✅ OPTION A: Finance Team sees ALL unprocessed records (unit-wise)
    // They can approve, select payment, and mark as paid
    query = query.eq("processed_by_finance", false);
    
  } else if (role === "Master") {
    // ✅ Master sees EVERYTHING - no filter
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  
  if (error) {
    console.error("Orders fetch error:", error);
    return res.json({ orders: [] });
  }

  res.json({ orders: data || [] });
});

// ✅ Approve Orders Endpoint
app.post("/api/orders/approve", async (req, res) => {
  const { orderIds } = req.body;
  const sessionUser = req.session?.user;
  
  if (!sessionUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  try {
    // 1. Get orders from Supabase
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .in("id", orderIds);
    
    if (fetchError || !orders) throw new Error("Orders not found");

    // 2. Update Supabase
    const { error: updateError } = await supabase
      .from("orders")
      .update({ 
        approved_by_unit: true,
        approval_timestamp: new Date().toISOString(),
        approval_by_name: `${sessionUser.firstName} ${sessionUser.lastName}`
      })
      .in("id", orderIds);

    if (updateError) throw updateError;

    // 3. Update Google Sheets via Apps Script
    if (GOOGLE_SCRIPT_URL && orders) {
      const userName = (sessionUser.firstName || "") + " " + (sessionUser.lastName || "");
      const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

      for (const order of orders) {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_approval",
            email: order.email,
            beneficiaryName: order.beneficiary_name,
            billDate: order.bill_date,
            approval: {
              approval_timestamp: now,
              approval_by_name: userName.trim() || sessionUser.email,
              payment_mode: ""
            }
          })
        });
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Approve error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Set Payment Mode Endpoint
app.post("/api/orders/set-payment-mode", async (req, res) => {
  const { orderIds, bank } = req.body;
  const sessionUser = req.session?.user;

  if (!sessionUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  try {
    // 1. Get orders
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .in("id", orderIds);
    
    if (fetchError || !orders) throw new Error("Orders not found");

    // 2. Update Supabase
    const { error: updateError } = await supabase
      .from("orders")
      .update({ 
        processed_by_finance: true, 
        payment_method: bank
      })
      .in("id", orderIds);

    if (updateError) throw updateError;

    // 3. Update Google Sheets via Apps Script
    if (GOOGLE_SCRIPT_URL && orders) {
      const userName = (sessionUser.firstName || "") + " " + (sessionUser.lastName || "");
      const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

      // Create payment sheet
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_payment_sheet",
          paymentMode: bank,
          approval_by_name: userName.trim() || sessionUser.email,
          orders: orders.map(o => ({
            email: o.email,
            unit: o.unit,
            beneficiary_name: o.beneficiary_name,
            account_no: o.account_no,
            ifsc_code: o.ifsc_code,
            bill_date: o.bill_date,
            due_date: o.due_date,
            amount: o.amount
          }))
        })
      });

      // Update approval status with payment mode
      for (const order of orders) {
        await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_approval",
            email: order.email,
            beneficiaryName: order.beneficiary_name,
            billDate: order.bill_date,
            approval: {
              approval_timestamp: now,
              approval_by_name: userName.trim() || sessionUser.email,
              payment_mode: bank
            }
          })
        });
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Payment mode error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/history", async (req, res) => {
  const email = req.query.email as string;
  if (!email || !GOOGLE_SCRIPT_URL) {
    return res.json({ orders: [] });
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL + "?action=read_sheet&sheetName=Sheet1");
    const data = await response.json();
    
    if (!data.success) return res.json({ orders: [] });

    const rows = data.data;
    if (rows.length <= 1) return res.json({ orders: [] });

    const dataRows = rows.slice(1);

    // Filter by email and last 5 days
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const userOrders = dataRows
      .filter((row: any) => {
        const rowEmail = row[2];
        const rowTimestamp = new Date(row[1]);
        return rowEmail === email && rowTimestamp >= fiveDaysAgo;
      })
      .map((row: any) => ({
        timestamp: row[1],
        unit: row[3],
        beneficiary: row[4],
        account: row[5],
        amount: row[9],
      }))
      .reverse();

    res.json({ orders: userOrders });
  } catch (error) {
    console.error("History fetch error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  // Serve static files from dist
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// Export for Vercel
export default app;

// Only listen if not on Vercel
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
