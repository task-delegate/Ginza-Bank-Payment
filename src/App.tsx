/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  Trash2, 
  Send, 
  Building2, 
  User, 
  CreditCard, 
  Calendar, 
  IndianRupee, 
  LogOut, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  Shield,
  CheckSquare,
  Square,
  ArrowRight,
  Eye,
  EyeOff,
  Search,
  X
} from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const billSchema = z.object({
  billDate: z.string().min(1, "Bill date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
});

const formSchema = z.object({
  email: z.string().email("Valid company email is required"),
  unit: z.string().min(1, "Unit selection is required"),
  beneficiaryName: z.string().min(2, "Beneficiary name is required"),
  accountNo: z.string().min(5, "Account number is required"),
  ifscCode: z.string().min(11, "Valid IFSC code is required").max(11),
  bills: z.array(billSchema).min(1, "At least one bill is required"),
});

type FormData = z.infer<typeof formSchema>;

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'Unit Team' | 'Finance Team' | 'Master';
  units: string[];
}

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("ginza_token");
      try {
        const fetchOptions: any = { credentials: 'include' };
        if (token) {
          fetchOptions.headers = { 'Authorization': `Bearer ${token}` };
        }
        
        const res = await fetch("/api/auth/me", fetchOptions);
        if (res.ok) {
          const data = await res.json();
          if (data.user) setUser(data.user);
          else {
            setUser(null);
            localStorage.removeItem("ginza_token");
          }
        } else {
          setUser(null);
          localStorage.removeItem("ginza_token");
        }
      } catch (e) {
        setUser(null);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#673ab7]" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm onLogin={(u) => setUser(u)} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

function AuthForm({ onLogin }: { onLogin: (u: UserData) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<string[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("ginza_token");
    const fetchOptions: any = { credentials: 'include' };
    if (token) {
      fetchOptions.headers = { 'Authorization': `Bearer ${token}` };
    }
    fetch("/api/units", fetchOptions)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setUnits(d);
        else if (d && d.units) setUnits(d.units);
      })
      .catch(err => console.error("Units fetch error:", err));
  }, []);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<any>();

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      const result = await res.json();
      if (res.ok) {
        if (result.token) {
          localStorage.setItem("ginza_token", result.token);
        }
        if (isLogin) onLogin(result.user);
        else setIsLogin(true);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError("Connection error");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f0ebf8] flex items-center justify-center p-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-4"
      >
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-md border-t-[10px] border-[#673ab7] p-8 text-center space-y-4">
          <div className="flex justify-center">
            <img src="https://www.ginzalimited.com/cdn/shop/files/Ginza_logo.jpg?v=1668509673&width=500" className="h-10" alt="Logo" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {isLogin ? "Sign In" : "Create Account"}
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              {isLogin ? "Access the Ginza Advanced Order Entry Portal" : "Register for a new account"}
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-900">First Name</label>
                  <input {...register("firstName", { required: true })} className="w-full border-b border-slate-200 py-2 outline-none focus:border-[#673ab7] text-sm font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-900">Last Name</label>
                  <input {...register("lastName", { required: true })} className="w-full border-b border-slate-200 py-2 outline-none focus:border-[#673ab7] text-sm font-medium" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-900">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input {...register("email", { required: true })} type="email" placeholder="email@example.com" className="w-full border-b border-slate-200 py-2 pl-6 outline-none focus:border-[#673ab7] text-sm font-medium" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-900">Password</label>
              <div className="relative">
                <Lock className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  {...register("password", { required: true })} 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  className="w-full border-b border-slate-200 py-2 pl-6 pr-8 outline-none focus:border-[#673ab7] text-sm font-medium" 
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-900">Units (Select Multiple)</label>
                  <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {units.map(u => (
                      <label key={u} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          value={u} 
                          {...register("units", { required: true })} 
                          className="w-4 h-4 rounded border-slate-300 text-[#673ab7] focus:ring-[#673ab7]"
                        />
                        <span className="text-[10px] font-medium text-slate-700">{u}</span>
                      </label>
                    ))}
                  </div>
                  {errors.units && <p className="text-[10px] font-bold text-red-500">Please select at least one unit</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-900">Role</label>
                  <select {...register("role", { required: true })} className="w-full border-b border-slate-200 py-2 outline-none focus:border-[#673ab7] text-sm font-medium bg-transparent">
                    <option value="Unit Team">Unit Team</option>
                    <option value="Finance Team">Finance Team</option>
                    <option value="Master">Master</option>
                  </select>
                </div>
              </>
            )}

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold text-center border border-red-100">{error}</div>}

            <div className="flex flex-col gap-4">
              <button 
                disabled={loading}
                className="w-full bg-[#673ab7] text-white py-3 rounded-lg font-bold text-sm shadow-md hover:bg-[#5e35b1] transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isLogin ? "Sign In" : "Register")}
              </button>

              <button 
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-xs font-bold text-[#673ab7] hover:underline"
              >
                {isLogin ? "Create new Mail id - for Register" : "Already have an account? Sign In"}
              </button>
              
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                  If you experience automatic logouts, please open the app directly in a new tab:
                  <br />
                  <a 
                    href="https://ginza-bank-payment.vercel.app/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#673ab7] font-bold hover:underline break-all"
                  >
                    https://ginza-bank-payment.vercel.app/
                  </a>
                </p>
              </div>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function Dashboard({ user, onLogout }: { user: UserData, onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState(user.role === 'Unit Team' ? 'new' : 'history');
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [filterBeneficiary, setFilterBeneficiary] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const fetchOrders = async () => {
    try {
      let url = "/api/orders";
      if (user.role === 'Master') {
        url += `?view=${activeTab === 'finance' ? 'finance' : 'unit'}`;
      }
      
      const token = localStorage.getItem("ginza_token");
      const fetchOptions: any = { credentials: 'include' };
      if (token) {
        fetchOptions.headers = { 'Authorization': `Bearer ${token}` };
      }

      const res = await fetch(url, fetchOptions);
      if (res.status === 401) {
        // For background fetches, just logout quietly
        onLogout();
        localStorage.removeItem("ginza_token");
        return;
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.error("Fetch orders error:", e);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeTab]);

  const handleLogout = async () => {
    const token = localStorage.getItem("ginza_token");
    const fetchOptions: any = { method: "POST", credentials: 'include' };
    if (token) {
      fetchOptions.headers = { 'Authorization': `Bearer ${token}` };
    }
    await fetch("/api/auth/logout", fetchOptions);
    localStorage.removeItem("ginza_token");
    onLogout();
  };

  const toggleOrderSelection = (id: string) => {
    const next = new Set(selectedOrders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrders(next);
  };

  const handleApprove = async () => {
    if (selectedOrders.size === 0) return;
    setProcessing(true);
    try {
      const token = localStorage.getItem("ginza_token");
      const fetchOptions: any = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(selectedOrders) }),
        credentials: 'include'
      };
      if (token) {
        fetchOptions.headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch("/api/orders/approve", fetchOptions);
      if (res.status === 401) {
        alert("Session Expired. Please log in again.");
        onLogout();
        localStorage.removeItem("ginza_token");
        return;
      }
      if (res.ok) {
        setSelectedOrders(new Set());
        fetchOrders();
      }
    } catch (e) {
      console.error("Approve error:", e);
    }
    setProcessing(false);
  };

  const handleSetPaymentMode = async (bank: 'UBI' | 'SBI') => {
    if (selectedOrders.size === 0) return;
    setProcessing(true);
    try {
      const token = localStorage.getItem("ginza_token");
      const fetchOptions: any = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(selectedOrders), bank }),
        credentials: 'include'
      };
      if (token) {
        fetchOptions.headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch("/api/orders/set-payment-mode", fetchOptions);
      if (res.status === 401) {
        alert("Session Expired. Please log in again.");
        onLogout();
        localStorage.removeItem("ginza_token");
        return;
      }
      const data = await res.json();
      if (data.success) {
        setSelectedOrders(new Set());
        fetchOrders();
      }
    } catch (e) {
      console.error("Set payment mode error:", e);
    }
    setProcessing(false);
  };

  const formatDateSafe = (dateStr: string | number | Date) => {
    if (!dateStr) return "-";
    try {
      // Handle potential space instead of T in some date strings
      const normalizedDate = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr;
      const d = new Date(normalizedDate);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return "-";
    }
  };

  const filteredOrders = orders.filter(o => {
    let matchesDate = true;
    const submissionDate = o.created_at || o.timestamp || o.bill_date;
    const d = new Date(submissionDate);
    const isValidDate = !isNaN(d.getTime());

    if (startDate && isValidDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = endDate ? new Date(endDate) : new Date(startDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = d >= start && d <= end;
    }

    if (filterMonth && isValidDate) {
      matchesDate = matchesDate && (d.getMonth() + 1).toString() === filterMonth;
    }

    if (filterYear && isValidDate) {
      matchesDate = matchesDate && d.getFullYear().toString() === filterYear;
    }

    const matchesUnit = filterUnit ? (o.unit || "").toLowerCase().includes(filterUnit.toLowerCase()) : true;
    const matchesBeneficiary = filterBeneficiary ? (o.beneficiary_name || "").toLowerCase().includes(filterBeneficiary.toLowerCase()) : true;
    const status = (o.processed_by_finance || o.approved_by_unit) ? "Approved" : "Pending";
    const matchesStatus = filterStatus ? status === filterStatus : true;
    return matchesDate && matchesUnit && matchesBeneficiary && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#f0ebf8] font-sans">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-slate-200 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://www.ginzalimited.com/cdn/shop/files/Ginza_logo.jpg?v=1668509673&width=500" className="h-8" alt="Logo" />
            <div className="hidden sm:block">
              <p className="text-xs font-black text-slate-900 uppercase leading-none">Ginza Portal</p>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{user.role}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Session Active</span>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-slate-900">{user.firstName} {user.lastName}</p>
              <p className="text-[10px] font-bold text-slate-500">{user.email}</p>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {user.role === 'Unit Team' && (
            <TabButton active={activeTab === 'new'} onClick={() => setActiveTab('new')} icon={<Plus className="w-4 h-4" />} label="NEW ENTRY" />
          )}
          
          {user.role === 'Unit Team' && (
            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Calendar className="w-4 h-4" />} label="Database" />
          )}

          {user.role === 'Finance Team' && (
            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Calendar className="w-4 h-4" />} label="Pending Processing" />
          )}

          {user.role === 'Master' && (
            <>
              <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Calendar className="w-4 h-4" />} label="Unit Submissions" />
              <TabButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} icon={<IndianRupee className="w-4 h-4" />} label="Finance View" />
            </>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'new' && user.role === 'Unit Team' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <SubmissionForm user={user} onSuccess={() => setActiveTab('history')} />
            </motion.div>
          )}

          {(activeTab === 'history' || (activeTab === 'finance' && user.role === 'Master')) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    {activeTab === 'history' ? (user.role === 'Master' ? "All Submissions" : "Records Table") : "Finance Processing View"}
                  </h2>
                  <div className="flex gap-2">
                    {(user.role === 'Finance Team' || user.role === 'Master') && activeTab === 'history' && (
                      <>
                        <button 
                          onClick={handleApprove}
                          disabled={selectedOrders.size === 0 || processing}
                          className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-600 disabled:opacity-50 transition-all"
                        >
                          {processing ? "..." : "Approve Selected"}
                        </button>
                        <button onClick={() => handleSetPaymentMode('UBI')} disabled={selectedOrders.size === 0 || processing} className="bg-[#673ab7] text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#5e35b1] disabled:opacity-50 transition-all">UBI Payment</button>
                        <button onClick={() => handleSetPaymentMode('SBI')} disabled={selectedOrders.size === 0 || processing} className="bg-[#673ab7] text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-[#5e35b1] disabled:opacity-50 transition-all">SBI Payment</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <div className="space-y-1 col-span-1 sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Date Range (Start - End)</label>
                    <div className="relative datepicker-container">
                      <DatePicker
                        selectsRange={true}
                        startDate={startDate}
                        endDate={endDate}
                        onChange={(update: any) => setDateRange(update)}
                        isClearable={true}
                        placeholderText="DD/MM/YYYY - DD/MM/YYYY"
                        dateFormat="dd/MM/yyyy"
                        showYearDropdown
                        scrollableYearDropdown
                        yearDropdownItemNumber={10}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[10px] font-bold outline-none focus:border-[#673ab7]"
                      />
                      <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Month</label>
                    <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[10px] font-bold outline-none focus:border-[#673ab7]">
                      <option value="">All Months</option>
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                        <option key={m} value={(i + 1).toString()}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Year</label>
                    <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[10px] font-bold outline-none focus:border-[#673ab7]">
                      <option value="">All Years</option>
                      {[2023, 2024, 2025, 2026].map(y => (
                        <option key={y} value={y.toString()}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Filter Unit</label>
                    <input type="text" value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} placeholder="Unit..." className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[10px] font-bold outline-none focus:border-[#673ab7]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Filter Beneficiary</label>
                    <input type="text" value={filterBeneficiary} onChange={(e) => setFilterBeneficiary(e.target.value)} placeholder="Name..." className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[10px] font-bold outline-none focus:border-[#673ab7]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Filter Status</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-[10px] font-bold outline-none focus:border-[#673ab7]">
                      <option value="">All Status</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button 
                      onClick={() => {
                        setDateRange([null, null]);
                        setFilterMonth("");
                        setFilterYear("");
                        setFilterUnit("");
                        setFilterBeneficiary("");
                        setFilterStatus("");
                      }}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-4 border-b border-slate-100 w-10">
                        <Square className="w-4 h-4 text-slate-300" />
                      </th>
                      <th className="p-4 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="p-4 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Unit</th>
                      <th className="p-4 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Bill Date</th>
                      <th className="p-4 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Due Date</th>
                      <th className="p-4 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Beneficiary</th>
                      <th className="p-4 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Account</th>
                      <th className="p-4 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount</th>
                      <th className="p-4 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                      <th className="p-4 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Payment Mode</th>
                    </tr>
                  </thead>
                  <tbody>
    {filteredOrders.length === 0 ? (
      <tr><td colSpan={10} className="p-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">No records found matching your filters</td></tr>
    ) : (
                      filteredOrders.map((o) => (
                        <tr key={o.id} className={`transition-colors group ${o.processed_by_finance ? "bg-emerald-100/60" : o.approved_by_unit ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}>
                          <td className="p-4 border-b border-slate-50">
                            {((user.role === 'Finance Team' || user.role === 'Master') && !o.processed_by_finance) ? (
                              <button onClick={() => toggleOrderSelection(o.id)} className="text-[#673ab7]">
                                {selectedOrders.has(o.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                              </button>
                            ) : (
                              <div className="text-emerald-600">
                                <CheckCircle2 className="w-5 h-5 fill-emerald-50" />
                              </div>
                            )}
                          </td>
                          <td className="p-4 border-b border-slate-50 text-[10px] font-bold text-slate-600">
                            {formatDateSafe(o.created_at || o.timestamp || o.bill_date)}
                          </td>
                          <td className="p-4 border-b border-slate-50 text-[10px] font-black text-slate-900">{o.unit}</td>
                          <td className="p-4 border-b border-slate-50 text-[10px] font-bold text-slate-600">{formatDateSafe(o.bill_date)}</td>
                          <td className="p-4 border-b border-slate-50 text-[10px] font-bold text-slate-600">{formatDateSafe(o.due_date)}</td>
                          <td className="p-4 border-b border-slate-50 text-[10px] font-bold text-slate-900">{o.beneficiary_name}</td>
                          <td className="p-4 border-b border-slate-50 text-[10px] font-bold text-slate-500">{o.account_no}</td>
                          <td className="p-4 border-b border-slate-50 text-[10px] font-black text-[#673ab7]">₹{o.amount.toLocaleString()}</td>
                          <td className="p-4 border-b border-slate-50">
                            <span className={`text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest ${
                              (o.processed_by_finance || o.approved_by_unit) ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {(o.processed_by_finance || o.approved_by_unit) ? "Approved" : "Pending"}
                            </span>
                          </td>
                          <td className="p-4 border-b border-slate-50 text-[10px] font-black text-slate-900 uppercase">{o.payment_method || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
        active ? "bg-[#673ab7] text-white shadow-lg shadow-indigo-100" : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SubmissionForm({ user, onSuccess }: { user: UserData, onSuccess: () => void }) {
  const [units, setUnits] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [beneficiarySuggestions, setBeneficiarySuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      email: user.email,
      unit: user.units.length === 1 ? user.units[0] : "",
      bills: [{ billDate: "", dueDate: "", amount: "" as any }] 
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "bills" });
  const watchedBeneficiaryName = watch("beneficiaryName");

  useEffect(() => {
    const token = localStorage.getItem("ginza_token");
    const headers: any = { credentials: 'include' };
    if (token) {
      headers.headers = { 'Authorization': `Bearer ${token}` };
    }
    fetch("/api/units", headers)
      .then(r => r.json())
      .then(d => setUnits(d.units || d))
      .catch(e => console.error("Units fetch error:", e));
  }, []);

  useEffect(() => {
    const search = async () => {
      if (watchedBeneficiaryName?.length >= 2) {
        setSearching(true);
        try {
          const token = localStorage.getItem("ginza_token");
          const headers: any = { credentials: 'include' };
          if (token) {
            headers.headers = { 'Authorization': `Bearer ${token}` };
          }
          const res = await fetch(`/api/beneficiaries/search?name=${encodeURIComponent(watchedBeneficiaryName)}`, headers);
          const data = await res.json();
          // Only update if the current input still matches the search term
          if (watchedBeneficiaryName === watch("beneficiaryName")) {
            setBeneficiarySuggestions(data.beneficiaries || []);
            setShowSuggestions(true);
          }
        } catch (e) {
          console.error("Beneficiary search error:", e);
        } finally {
          setSearching(false);
        }
      } else {
        setBeneficiarySuggestions([]);
        setShowSuggestions(false);
      }
    };
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [watchedBeneficiaryName]);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem("ginza_token");
      const headers: any = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: 'include'
      };
      if (token) {
        headers.headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch("/api/submit", headers);
      if (res.ok) {
        setSubmitted(true);
        reset();
        setTimeout(onSuccess, 2000);
      } else {
        const d = await res.json();
        setError(d.error);
      }
    } catch (e) {
      setError("Submission error");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-xl p-12 text-center shadow-md border-t-[10px] border-[#673ab7]">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
        <h2 className="text-2xl font-black text-slate-900 uppercase">Success!</h2>
        <p className="text-slate-500 font-bold mt-2">Your submission has been recorded.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-4">
      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-md border-t-[10px] border-[#673ab7] p-6 space-y-3">
        <h1 className="text-3xl font-black text-slate-900">Payment Records</h1>
        <p className="text-sm font-black text-slate-600">Please fill out the beneficiary and bill details below.</p>
        <div className="h-[1px] bg-slate-100 w-full" />
        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">* Required</p>
      </div>

      {/* Basic Info Card */}
      <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-900">Email Address <span className="text-red-500 font-black">*</span></label>
            <input {...register("email")} placeholder="your.email@ginzalimited.com" className="w-full border-b border-slate-200 py-2 outline-none focus:border-[#673ab7] text-sm font-bold transition-all placeholder:text-slate-300 placeholder:font-normal" />
            {errors.email && <p className="text-[10px] font-bold text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-slate-900">Production Unit <span className="text-red-500 font-black">*</span></label>
            <select {...register("unit")} className="w-full border-b border-slate-200 py-2 outline-none focus:border-[#673ab7] text-sm font-bold transition-all bg-transparent">
              <option value="">Select Unit</option>
              {user.units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            {errors.unit && <p className="text-[10px] font-bold text-red-500">{errors.unit.message}</p>}
          </div>
        </div>
      </div>

      {/* Beneficiary Card */}
      <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2 relative">
            <label className="text-sm font-black text-slate-900">Beneficiary Name <span className="text-red-500 font-black">*</span></label>
            <div className="relative">
              <input 
                {...register("beneficiaryName")} 
                placeholder="Search or enter name" 
                autoComplete="off"
                className="w-full border-b border-slate-200 py-2 pr-8 outline-none focus:border-[#673ab7] text-sm font-bold transition-all placeholder:text-slate-300 placeholder:font-normal" 
              />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {searching && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                {watchedBeneficiaryName && (
                  <button 
                    type="button" 
                    onClick={() => {
                      setValue("beneficiaryName", "");
                      setBeneficiarySuggestions([]);
                      setShowSuggestions(false);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            {showSuggestions && beneficiarySuggestions.length > 0 && (
              <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-xl mt-1 overflow-hidden max-h-60 overflow-y-auto">
                {beneficiarySuggestions.map((b, i) => (
                  <button key={i} type="button" onClick={() => {
                    setValue("beneficiaryName", b.name);
                    setValue("accountNo", b.account_no);
                    setValue("ifscCode", b.ifsc_code);
                    setBeneficiarySuggestions([]);
                    setShowSuggestions(false);
                  }} className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-slate-900 group-hover:text-[#673ab7]">{b.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{b.account_no} | {b.ifsc_code}</p>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-200 group-hover:text-[#673ab7] transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            )}
            {errors.beneficiaryName && <p className="text-[10px] font-bold text-red-500">{errors.beneficiaryName.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-black text-slate-900">Account Number <span className="text-red-500 font-black">*</span></label>
              <input {...register("accountNo")} placeholder="Bank Account #" className="w-full border-b border-slate-200 py-2 outline-none focus:border-[#673ab7] text-sm font-bold transition-all placeholder:text-slate-300 placeholder:font-normal" />
              {errors.accountNo && <p className="text-[10px] font-bold text-red-500">{errors.accountNo.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-slate-900">IFSC Code <span className="text-red-500 font-black">*</span></label>
              <input {...register("ifscCode")} placeholder="11-character IFSC" className="w-full border-b border-slate-200 py-2 outline-none focus:border-[#673ab7] text-sm font-bold transition-all placeholder:text-slate-300 placeholder:font-normal" />
              {errors.ifscCode && <p className="text-[10px] font-bold text-red-500">{errors.ifscCode.message}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Bills Card */}
      <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase">Bill Details</h3>
          <button type="button" onClick={() => append({ billDate: "", dueDate: "", amount: "" as any })} className="text-[10px] font-black text-[#673ab7] uppercase tracking-widest hover:bg-indigo-50 px-2 py-1 rounded transition-all">+ADD NEW</button>
        </div>
        
        <div className="space-y-4">
          {fields.map((f, i) => (
            <div key={f.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100 relative group space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">Bill Date</label>
                  <input type="date" {...register(`bills.${i}.billDate`)} onClick={(e) => e.currentTarget.showPicker?.()} className="w-full bg-transparent border-b border-slate-200 py-1 text-xs font-black outline-none focus:border-[#673ab7]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">Due Date</label>
                  <input type="date" {...register(`bills.${i}.dueDate`)} onClick={(e) => e.currentTarget.showPicker?.()} className="w-full bg-transparent border-b border-slate-200 py-1 text-xs font-black outline-none focus:border-[#673ab7]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">Amount</label>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">₹</span>
                    <input type="number" step="0.01" {...register(`bills.${i}.amount`, { valueAsNumber: true })} className="w-full bg-transparent border-b border-slate-200 py-1 pl-3 text-xs font-black outline-none focus:border-[#673ab7]" />
                  </div>
                </div>
              </div>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(i)} className="absolute -right-2 -top-2 bg-white p-1.5 rounded-full shadow-md text-slate-300 hover:text-red-500 transition-all border border-slate-100">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[10px] font-black uppercase text-center border border-red-100">{error}</div>}

      <div className="flex items-center justify-between pt-4">
        <button type="button" onClick={() => { reset(); setError(null); }} className="text-xs font-black text-slate-500 hover:text-slate-700 px-4 py-2 uppercase tracking-widest transition-all">Clear Form</button>
        <button disabled={submitting} className="bg-[#673ab7] text-white px-10 py-3 rounded-lg font-black text-sm shadow-lg hover:bg-[#5e35b1] transition-all flex items-center gap-2 uppercase tracking-widest">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Submit Responses</>}
        </button>
      </div>
    </form>
  );
}
