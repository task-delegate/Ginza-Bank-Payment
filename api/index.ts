import express from "express";
import cookieSession from "cookie-session";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();

// ================= SUPABASE CONFIG =================
const supabaseUrlRaw = process.env.SUPABASE_URL || "YOUR_PROJECT_ID";
const supabaseUrl = supabaseUrlRaw.includes("://")
  ? supabaseUrlRaw
  : `https://${supabaseUrlRaw}.supabase.co`;

const supabaseKey = process.env.SUPABASE_ANON_KEY || "YOUR_ANON_KEY";

const supabase = createClient(supabaseUrl, supabaseKey);

// ================= MIDDLEWARE =================
app.use(express.json());

app.set("trust proxy", 1);

app.use(
  cookieSession({
    name: "session",
    secret: "ginza-payment-system-secret-v4",
    maxAge: 24 * 60 * 60 * 1000,
    secure: true,
    sameSite: "none",
    httpOnly: true,
  })
);

// ================= AUTH ROUTES =================

// Register
app.post("/api/auth/register", async (req, res) => {
  const { firstName, lastName, email, password, units, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase.from("users").insert([
      {
        first_name: firstName,
        last_name: lastName,
        email: email.toLowerCase(),
        password: hashedPassword,
        units,
        role,
      },
    ]);

    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

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
      units: user.units,
    };

    res.json({ user: req.session!.user });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  req.session = null;
  res.json({ success: true });
});

// ================= ORDER CREATE =================

app.post("/api/submit", async (req, res) => {
  const { email, unit, beneficiaryName, accountNo, ifscCode, bills } =
    req.body;

  try {
    const orders = bills.map((bill: any) => ({
      email,
      unit,
      beneficiary_name: beneficiaryName,
      account_no: accountNo,
      ifsc_code: ifscCode,
      bill_date: bill.billDate,
      due_date: bill.dueDate,
      amount: parseFloat(bill.amount),
      approved_by_finance: false,
      processed_by_finance: false,
      payment_method: null,
    }));

    const { error } = await supabase.from("orders").insert(orders);

    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================= GET ORDERS =================

app.get("/api/orders", async (req, res) => {
  const sessionUser = req.session?.user;

  if (!sessionUser)
    return res.status(401).json({ error: "Unauthorized" });

  const { role, email, units } = sessionUser;

  let query = supabase.from("orders").select("*");

  // Unit Team → Only their own orders
  if (role === "Unit Team") {
    query = query.eq("email", email);
  }

  // Finance Team → Their selected units
  else if (role === "Finance Team") {
    query = query.in("unit", units);
  }

  // Master / Admin → Everything
  else if (role === "Master" || role === "Admin") {
    query = query;
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) return res.status(500).json({ error: error.message });

  res.json({ orders: data || [] });
});

// ================= APPROVE (Finance Only) =================

app.post("/api/orders/approve", async (req, res) => {
  const { orderIds } = req.body;
  const sessionUser = req.session?.user;

  if (!sessionUser)
    return res.status(401).json({ error: "Unauthorized" });

  if (sessionUser.role !== "Finance Team")
    return res.status(403).json({ error: "Only Finance can approve" });

  try {
    const { error } = await supabase
      .from("orders")
      .update({ approved_by_finance: true })
      .in("id", orderIds);

    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================= PAYMENT MODE (Finance Only) =================

app.post("/api/orders/set-payment-mode", async (req, res) => {
  const { orderIds, bank } = req.body;
  const sessionUser = req.session?.user;

  if (!sessionUser)
    return res.status(401).json({ error: "Unauthorized" });

  if (sessionUser.role !== "Finance Team")
    return res.status(403).json({ error: "Only Finance can process payment" });

  try {
    const { error } = await supabase
      .from("orders")
      .update({
        processed_by_finance: true,
        payment_method: bank,
      })
      .in("id", orderIds);

    if (error) throw error;

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================= EXPORT =================

export default app;
