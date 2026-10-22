"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, parseISO, isToday, isSameDay, isSameWeek, isSameMonth, isSameYear, subDays, addDays, subMonths, addMonths, subYears, addYears } from "date-fns";
import { th } from "date-fns/locale";
import { Trash2, Edit2, Check, X, Calendar, CalendarDays, CalendarRange, TrendingUp, Layers, ChevronLeft, ChevronRight, RotateCcw, Filter, PieChart as PieChartIcon } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  "อาหารและเครื่องดื่ม": "#f59e0b",
  "การเดินทาง": "#0ea5e9",
  "ช้อปปิ้ง": "#f43f5e",
  "บิลและค่าใช้จ่าย": "#6366f1",
  "สุขภาพ": "#10b981",
  "ความบันเทิง": "#a855f7",
  "โอนเงินให้คนอื่น": "#06b6d4",
  "อื่นๆ": "#64748b",
};

const FALLBACK_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", 
  "#06b6d4", "#8b5cf6", "#f97316", "#14b8a6"
];

const getCategoryColor = (category: string, index: number) => {
  return CATEGORY_COLORS[category] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CategoryTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center space-x-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{data.name}</p>
        </div>
        <p className="text-base font-black text-gray-900 dark:text-white">
          ฿{Number(data.value).toLocaleString()}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {data.percentage}% • {data.count} รายการ
        </p>
      </div>
    );
  }
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700/50 transform transition-all">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
          ฿{Number(payload[0].value).toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

const formatYAxis = (tickItem: number) => {
  if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)}M`;
  if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)}k`;
  return tickItem.toString();
};

export default function Dashboard({ user }: { user: User | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryType, setSummaryType] = useState<'day' | 'week' | 'month' | 'year'>('day');

  // Period navigation states
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterByPeriod, setFilterByPeriod] = useState(false);
  const [categoryTimeScope, setCategoryTimeScope] = useState<'period' | 'all'>('period');

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  const handlePrev = () => {
    setSelectedDate((prev) => {
      if (summaryType === 'day') return subDays(prev, 1);
      if (summaryType === 'week') return subDays(prev, 7);
      if (summaryType === 'month') return subMonths(prev, 1);
      if (summaryType === 'year') return subYears(prev, 1);
      return prev;
    });
  };

  const handleNext = () => {
    setSelectedDate((prev) => {
      if (summaryType === 'day') return addDays(prev, 1);
      if (summaryType === 'week') return addDays(prev, 7);
      if (summaryType === 'month') return addMonths(prev, 1);
      if (summaryType === 'year') return addYears(prev, 1);
      return prev;
    });
  };

  const handleResetToday = () => {
    setSelectedDate(new Date());
  };

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: 0, category: '', note: '' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditClick = (t: any) => {
    setEditingId(t.id);
    setEditForm({ amount: t.amount || 0, category: t.category || '', note: t.note || '' });
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.amount || isNaN(Number(editForm.amount)) || Number(editForm.amount) <= 0) {
      alert("กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    if (!editForm.note.trim()) {
      alert("กรุณากรอกรายละเอียดรายการ");
      return;
    }
    try {
      if (!supabase) return;
      const { error } = await supabase
        .from('transactions')
        .update({
          amount: Number(editForm.amount),
          category: editForm.category,
          note: editForm.note.trim()
        })
        .eq('id', id);
        
      if (error) throw error;
      setEditingId(null);
      fetchTransactions();
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("เกิดข้อผิดพลาดในการแก้ไขรายการ");
    }
  };

  const fetchTransactions = useCallback(async () => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('createdAt', { ascending: false })
        .limit(1000);

      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setTransactions(data || []);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTransactions();

    if (!supabase) return;

    const subscription = supabase
      .channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchTransactions]);

  const handleDelete = async (id: string) => {
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) {
      try {
        if (!supabase) return;
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        fetchTransactions();
      } catch (error) {
        console.error("Error deleting document: ", error);
        alert("เกิดข้อผิดพลาดในการลบรายการ");
      }
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400">กำลังโหลดข้อมูลสรุป...</div>;
  }

  const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  // คำนวณยอดแยก รายวัน, รายสัปดาห์, รายเดือน, รายปี อิงจาก selectedDate (สามารถดูย้อนหลังได้)
  const periodStats = transactions.reduce(
    (acc, t) => {
      if (!t.createdAt) return acc;
      try {
        const date = parseISO(t.createdAt);
        if (isNaN(date.getTime())) return acc;
        const amt = Number(t.amount) || 0;

        if (isSameDay(date, selectedDate)) {
          acc.day.total += amt;
          acc.day.count += 1;
        }
        if (isSameWeek(date, selectedDate, { weekStartsOn: 1 })) {
          acc.week.total += amt;
          acc.week.count += 1;
        }
        if (isSameMonth(date, selectedDate)) {
          acc.month.total += amt;
          acc.month.count += 1;
        }
        if (isSameYear(date, selectedDate)) {
          acc.year.total += amt;
          acc.year.count += 1;
        }
      } catch {
        // ignore date parse errors
      }
      return acc;
    },
    {
      day: { total: 0, count: 0 },
      week: { total: 0, count: 0 },
      month: { total: 0, count: 0 },
      year: { total: 0, count: 0 },
    }
  );

  // เตรียมข้อมูลสำหรับกราฟ (แสดงเฉพาะรายจ่าย)
  const chartDataMap = transactions.reduce((acc, t) => {
    if (!t.createdAt) return acc;
    try {
      const date = parseISO(t.createdAt);
      if (isNaN(date.getTime())) return acc;
      let keyStr = "";
      
      if (summaryType === 'day') {
        keyStr = format(date, "dd MMM", { locale: th });
      } else if (summaryType === 'week') {
        keyStr = `สัปดาห์ที่ ${format(date, "w", { locale: th })}`;
      } else if (summaryType === 'month') {
        keyStr = format(date, "MMM yy", { locale: th });
      } else if (summaryType === 'year') {
        // ใช้ ปี ค.ศ. หรือจะบวก 543 เป็น พ.ศ. ก็ได้ (ที่นี่ใช้ ค.ศ. ตามมาตรฐาน Date-fns ก่อน)
        keyStr = format(date, "yyyy", { locale: th });
      }

      if (!acc[keyStr]) acc[keyStr] = { name: keyStr, expense: 0 };
      acc[keyStr].expense += Number(t.amount) || 0;
    } catch {
      // ignore parse errors
    }
    
    return acc;
  }, {} as Record<string, { name: string, expense: number }>);

  const chartData = Object.values(chartDataMap).reverse(); // เรียงจากเก่าไปใหม่สำหรับกราฟ

  // คำนวณสัดส่วนค่าใช้จ่ายตามหมวดหมู่ (Category Donut Chart)
  const categorySourceTransactions = categoryTimeScope === 'all'
    ? transactions
    : transactions.filter((t) => {
        if (!t.createdAt) return false;
        try {
          const d = parseISO(t.createdAt);
          if (isNaN(d.getTime())) return false;
          if (summaryType === 'day') return isSameDay(d, selectedDate);
          if (summaryType === 'week') return isSameWeek(d, selectedDate, { weekStartsOn: 1 });
          if (summaryType === 'month') return isSameMonth(d, selectedDate);
          if (summaryType === 'year') return isSameYear(d, selectedDate);
        } catch {
          return false;
        }
        return false;
      });

  const categoryTotalAmount = categorySourceTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  interface CategoryStat {
    name: string;
    value: number;
    count: number;
  }

  const categoryMap = categorySourceTransactions.reduce<Record<string, CategoryStat>>((acc, t) => {
    const cat = t.category || "อื่นๆ";
    const amt = Number(t.amount) || 0;
    if (!acc[cat]) {
      acc[cat] = { name: cat, value: 0, count: 0 };
    }
    acc[cat].value += amt;
    acc[cat].count += 1;
    return acc;
  }, {});

  const categoryChartData = (Object.values(categoryMap) as CategoryStat[])
    .sort((a, b) => b.value - a.value)
    .map((item, idx) => ({
      ...item,
      percentage: categoryTotalAmount > 0 ? ((item.value / categoryTotalAmount) * 100).toFixed(1) : "0",
      color: getCategoryColor(item.name, idx),
    }));

  const exportToCSV = () => {
    if (transactions.length === 0) {
      alert("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }
    
    // สร้าง Header ของ CSV
    const headers = ["วันที่", "เวลา", "หมวดหมู่", "รายการ", "จำนวนเงิน (บาท)"];
    
    // สร้างข้อมูล Row
    const rows = transactions.map(t => {
      let dateStr = "";
      let timeStr = "";
      if (t.createdAt) {
        try {
          const d = parseISO(t.createdAt);
          if (!isNaN(d.getTime())) {
            dateStr = format(d, "dd/MM/yyyy");
            timeStr = format(d, "HH:mm");
          }
        } catch {
          // ignore date parse errors
        }
      }
      const catStr = `"${t.category || '-'}"`;
      const note = `"${(t.note || "").replace(/"/g, '""')}"`; // ป้องกันปัญหาลูกน้ำและคำพูดใน CSV
      const amount = Number(t.amount) || 0;
      return [dateStr, timeStr, catStr, note, amount].join(",");
    });
    
    // ประกอบเนื้อหา CSV และเติม BOM เพื่อให้ Excel เปิดภาษาไทยได้ถูกต้อง
    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    
    // สร้างและโหลดไฟล์
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `yod-peh-export-${format(new Date(), "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // กรองข้อมูลตามหมวดหมู่และคำค้นหา
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniqueCategories = Array.from(new Set(transactions.map((t: any) => t.category).filter(Boolean))) as string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredTransactions = transactions.filter((t: any) => {
    const matchCategory = filterCategory === "all" || t.category === filterCategory;
    const matchSearch = searchTerm === "" || (t.note && t.note.toLowerCase().includes(searchTerm.toLowerCase()));

    let matchPeriod = true;
    if (filterByPeriod && t.createdAt) {
      try {
        const d = parseISO(t.createdAt);
        if (summaryType === 'day') matchPeriod = isSameDay(d, selectedDate);
        else if (summaryType === 'week') matchPeriod = isSameWeek(d, selectedDate, { weekStartsOn: 1 });
        else if (summaryType === 'month') matchPeriod = isSameMonth(d, selectedDate);
        else if (summaryType === 'year') matchPeriod = isSameYear(d, selectedDate);
      } catch {
        matchPeriod = false;
      }
    }

    return matchCategory && matchSearch && matchPeriod;
  });

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6">
      {/* ส่วนหัวสรุปภาพรวม และ แถบควบคุมการดูย้อนหลัง */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight flex items-center space-x-2">
            <span>สรุปยอดใช้จ่าย</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            แตะที่กรอบเพื่อสลับดูกราฟ หรือใช้ปุ่ม &lt; &gt; เพื่อเรียกดูย้อนหลัง
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* แถบเลื่อนดูย้อนหลัง / ถัดไป */}
          <div className="flex items-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-1 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
            <button
              onClick={handlePrev}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-xl text-gray-600 dark:text-gray-300 transition-colors"
              title="ย้อนหลัง"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* ช่องแสดง/เลือกวันที่ */}
            <div className="relative flex items-center px-2 overflow-hidden">
              <input
                type="date"
                value={format(selectedDate, "yyyy-MM-dd")}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(parseISO(e.target.value));
                  }
                }}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                title="คลิกเพื่อเลือกวันที่ที่ต้องการดูย้อนหลัง"
              />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 cursor-pointer flex items-center space-x-1 select-none">
                <span>
                  {summaryType === 'day' && (isToday(selectedDate) ? `วันนี้ (${format(selectedDate, "d MMM", { locale: th })})` : format(selectedDate, "d MMM yyyy", { locale: th }))}
                  {summaryType === 'week' && `สัปดาห์ที่ ${format(selectedDate, "w", { locale: th })} (${format(selectedDate, "MMM yy", { locale: th })})`}
                  {summaryType === 'month' && format(selectedDate, "MMMM yyyy", { locale: th })}
                  {summaryType === 'year' && `ปี ${selectedDate.getFullYear() + 543} (${selectedDate.getFullYear()})`}
                </span>
                <Calendar className="w-3.5 h-3.5 text-indigo-500 ml-1 inline" />
              </span>
            </div>

            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-xl text-gray-600 dark:text-gray-300 transition-colors"
              title="ถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isToday(selectedDate) && (
              <button
                onClick={handleResetToday}
                className="ml-1 px-2.5 py-1 text-[11px] font-medium bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center space-x-1"
                title="กลับมาดูวันนี้"
              >
                <RotateCcw className="w-3 h-3 mr-0.5" />
                <span>วันนี้</span>
              </button>
            )}
          </div>

          <div className="hidden lg:inline-flex items-center space-x-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl px-3.5 py-1.5 rounded-2xl border border-gray-100 dark:border-gray-700/50 shadow-sm">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">รวมทั้งหมด:</span>
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">฿{totalAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* กรอบแสดงยอด รายวัน / รายสัปดาห์ / รายเดือน / รายปี แยกกัน 4 กรอบ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {/* กรอบรายวัน */}
        <button
          type="button"
          onClick={() => setSummaryType('day')}
          className={`text-left p-4 sm:p-5 rounded-3xl min-h-[160px] transition-all duration-200 relative overflow-hidden flex flex-col justify-between group cursor-pointer ${
            summaryType === 'day'
              ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 ring-2 ring-blue-500 dark:ring-blue-400 -translate-y-0.5'
              : 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-100 dark:border-gray-700/50 hover:border-blue-200 dark:hover:border-blue-800/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.1)] hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              summaryType === 'day'
                ? 'bg-white/20 text-white'
                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            }`}>
              รายวัน
            </span>
            <div className={`p-2 rounded-xl ${
              summaryType === 'day'
                ? 'bg-white/20 text-white'
                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
            }`}>
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className={`text-xs mb-1 ${summaryType === 'day' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
              {isToday(selectedDate) ? `วันนี้ (${format(selectedDate, "d MMM", { locale: th })})` : format(selectedDate, "d MMM yyyy", { locale: th })}
            </p>
            <p className={`text-xl sm:text-2xl font-black tracking-tight truncate ${
              summaryType === 'day' ? 'text-white' : 'text-gray-800 dark:text-gray-100'
            }`} title={`฿${periodStats.day.total.toLocaleString()}`}>
              ฿{periodStats.day.total.toLocaleString()}
            </p>
            <p className={`text-[11px] mt-1.5 ${summaryType === 'day' ? 'text-blue-100/80' : 'text-gray-400 dark:text-gray-500'}`}>
              {periodStats.day.count} รายการ
            </p>
          </div>
        </button>

        {/* กรอบรายสัปดาห์ */}
        <button
          type="button"
          onClick={() => setSummaryType('week')}
          className={`text-left p-4 sm:p-5 rounded-3xl min-h-[160px] transition-all duration-200 relative overflow-hidden flex flex-col justify-between group cursor-pointer ${
            summaryType === 'week'
              ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 ring-2 ring-violet-500 dark:ring-violet-400 -translate-y-0.5'
              : 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-100 dark:border-gray-700/50 hover:border-violet-200 dark:hover:border-violet-800/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.1)] hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              summaryType === 'week'
                ? 'bg-white/20 text-white'
                : 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
            }`}>
              รายสัปดาห์
            </span>
            <div className={`p-2 rounded-xl ${
              summaryType === 'week'
                ? 'bg-white/20 text-white'
                : 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
            }`}>
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className={`text-xs mb-1 ${summaryType === 'week' ? 'text-violet-100' : 'text-gray-500 dark:text-gray-400'}`}>
              {isSameWeek(new Date(), selectedDate, { weekStartsOn: 1 }) ? "สัปดาห์นี้" : `สัปดาห์ที่ ${format(selectedDate, "w", { locale: th })} (${format(selectedDate, "MMM yy", { locale: th })})`}
            </p>
            <p className={`text-xl sm:text-2xl font-black tracking-tight truncate ${
              summaryType === 'week' ? 'text-white' : 'text-gray-800 dark:text-gray-100'
            }`} title={`฿${periodStats.week.total.toLocaleString()}`}>
              ฿{periodStats.week.total.toLocaleString()}
            </p>
            <p className={`text-[11px] mt-1.5 ${summaryType === 'week' ? 'text-violet-100/80' : 'text-gray-400 dark:text-gray-500'}`}>
              {periodStats.week.count} รายการ
            </p>
          </div>
        </button>

        {/* กรอบรายเดือน */}
        <button
          type="button"
          onClick={() => setSummaryType('month')}
          className={`text-left p-4 sm:p-5 rounded-3xl min-h-[160px] transition-all duration-200 relative overflow-hidden flex flex-col justify-between group cursor-pointer ${
            summaryType === 'month'
              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500 dark:ring-emerald-400 -translate-y-0.5'
              : 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-100 dark:border-gray-700/50 hover:border-emerald-200 dark:hover:border-emerald-800/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.1)] hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              summaryType === 'month'
                ? 'bg-white/20 text-white'
                : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            }`}>
              รายเดือน
            </span>
            <div className={`p-2 rounded-xl ${
              summaryType === 'month'
                ? 'bg-white/20 text-white'
                : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            }`}>
              <CalendarRange className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className={`text-xs mb-1 ${summaryType === 'month' ? 'text-emerald-100' : 'text-gray-500 dark:text-gray-400'}`}>
              {isSameMonth(new Date(), selectedDate) ? `เดือนนี้ (${format(selectedDate, "MMMM", { locale: th })})` : format(selectedDate, "MMMM yyyy", { locale: th })}
            </p>
            <p className={`text-xl sm:text-2xl font-black tracking-tight truncate ${
              summaryType === 'month' ? 'text-white' : 'text-gray-800 dark:text-gray-100'
            }`} title={`฿${periodStats.month.total.toLocaleString()}`}>
              ฿{periodStats.month.total.toLocaleString()}
            </p>
            <p className={`text-[11px] mt-1.5 ${summaryType === 'month' ? 'text-emerald-100/80' : 'text-gray-400 dark:text-gray-500'}`}>
              {periodStats.month.count} รายการ
            </p>
          </div>
        </button>

        {/* กรอบรายปี */}
        <button
          type="button"
          onClick={() => setSummaryType('year')}
          className={`text-left p-4 sm:p-5 rounded-3xl min-h-[160px] transition-all duration-200 relative overflow-hidden flex flex-col justify-between group cursor-pointer ${
            summaryType === 'year'
              ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25 ring-2 ring-amber-500 dark:ring-amber-400 -translate-y-0.5'
              : 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-100 dark:border-gray-700/50 hover:border-amber-200 dark:hover:border-amber-800/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.1)] hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              summaryType === 'year'
                ? 'bg-white/20 text-white'
                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            }`}>
              รายปี
            </span>
            <div className={`p-2 rounded-xl ${
              summaryType === 'year'
                ? 'bg-white/20 text-white'
                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            }`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className={`text-xs mb-1 ${summaryType === 'year' ? 'text-amber-100' : 'text-gray-500 dark:text-gray-400'}`}>
              {isSameYear(new Date(), selectedDate) ? `ปีนี้ (${selectedDate.getFullYear() + 543})` : `ปี ${selectedDate.getFullYear() + 543} (${selectedDate.getFullYear()})`}
            </p>
            <p className={`text-xl sm:text-2xl font-black tracking-tight truncate ${
              summaryType === 'year' ? 'text-white' : 'text-gray-800 dark:text-gray-100'
            }`} title={`฿${periodStats.year.total.toLocaleString()}`}>
              ฿{periodStats.year.total.toLocaleString()}
            </p>
            <p className={`text-[11px] mt-1.5 ${summaryType === 'year' ? 'text-amber-100/80' : 'text-gray-400 dark:text-gray-500'}`}>
              {periodStats.year.count} รายการ
            </p>
          </div>
        </button>
      </div>

      {/* Charts Grid: Timeline Bar Chart + Category Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6 sm:mb-8">
        {/* Timeline Bar Chart */}
        <div className="lg:col-span-7 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-gray-100 dark:border-gray-700/50 flex flex-col justify-between transition-colors">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 space-y-3 sm:space-y-0">
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 tracking-tight">กราฟสรุปยอดใช้จ่าย</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">แนวโน้มการใช้จ่ายตามช่วงเวลา</p>
            </div>
            <div className="flex bg-gray-100/80 dark:bg-gray-900/80 p-1 rounded-2xl self-stretch sm:self-auto justify-between sm:justify-start">
              <button 
                onClick={() => setSummaryType('day')}
                className={`flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 sm:py-1 text-[11px] sm:text-xs font-medium rounded-xl transition-colors whitespace-nowrap text-center ${summaryType === 'day' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                รายวัน
              </button>
              <button 
                onClick={() => setSummaryType('week')}
                className={`flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 sm:py-1 text-[11px] sm:text-xs font-medium rounded-xl transition-colors whitespace-nowrap text-center ${summaryType === 'week' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                รายสัปดาห์
              </button>
              <button 
                onClick={() => setSummaryType('month')}
                className={`flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 sm:py-1 text-[11px] sm:text-xs font-medium rounded-xl transition-colors whitespace-nowrap text-center ${summaryType === 'month' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                รายเดือน
              </button>
              <button 
                onClick={() => setSummaryType('year')}
                className={`flex-1 sm:flex-initial px-2 sm:px-3 py-1.5 sm:py-1 text-[11px] sm:text-xs font-medium rounded-xl transition-colors whitespace-nowrap text-center ${summaryType === 'year' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                รายปี
              </button>
            </div>
          </div>
          
          <div className="h-60 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.1} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 11}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 11}} tickFormatter={formatYAxis} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: '#8b5cf6', opacity: 0.05}} />
                  <Bar 
                    dataKey="expense" 
                    name="รายจ่าย" 
                    fill="url(#colorExpense)" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={45} 
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">ยังไม่มีข้อมูล</div>
            )}
          </div>
        </div>

        {/* Category Donut Chart */}
        <div className="lg:col-span-5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-gray-100 dark:border-gray-700/50 flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 tracking-tight flex items-center space-x-1.5 truncate">
                <PieChartIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="truncate">สัดส่วนตามหมวดหมู่</span>
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {categoryTimeScope === 'period' ? 'อิงตามช่วงเวลาที่กำลังดู' : 'รวมทุกช่วงเวลา'}
              </p>
            </div>
            <div className="flex bg-gray-100/80 dark:bg-gray-900/80 p-0.5 rounded-xl flex-shrink-0">
              <button
                type="button"
                onClick={() => setCategoryTimeScope('period')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap ${categoryTimeScope === 'period' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold' : 'text-gray-500 dark:text-gray-400'}`}
              >
                ช่วงนี้
              </button>
              <button
                type="button"
                onClick={() => setCategoryTimeScope('all')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap ${categoryTimeScope === 'all' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold' : 'text-gray-500 dark:text-gray-400'}`}
              >
                ทั้งหมด
              </button>
            </div>
          </div>

          {categoryChartData.length > 0 ? (
            <>
              {/* Donut Chart with Center Total */}
              <div className="relative h-44 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<CategoryTooltip />} />
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                      cornerRadius={4}
                      animationDuration={1000}
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">ยอดรวม</span>
                  <span className="text-xs sm:text-sm font-black text-gray-800 dark:text-gray-100 truncate max-w-[85px]">
                    ฿{categoryTotalAmount >= 100000 ? `${(categoryTotalAmount / 1000).toFixed(0)}k` : categoryTotalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Category Breakdown List */}
              <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
                {categoryChartData.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs py-1 px-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[120px]">{cat.name}</span>
                      <span className="text-gray-400 text-[10px]">({cat.count})</span>
                    </div>
                    <div className="text-right flex items-center space-x-2 flex-shrink-0">
                      <span className="font-bold text-gray-800 dark:text-gray-200">฿{cat.value.toLocaleString()}</span>
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 rounded-md min-w-[36px] text-center">
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
              <PieChartIcon className="w-8 h-8 mb-2 opacity-30 text-indigo-400" />
              <span>ยังไม่มีรายการใน{categoryTimeScope === 'period' ? 'ช่วงเวลานี้' : 'ระบบ'}</span>
              {categoryTimeScope === 'period' && (
                <button
                  type="button"
                  onClick={() => setCategoryTimeScope('all')}
                  className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  คลิกเพื่อดูสัดส่วนทั้งหมด
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="p-4 sm:p-6 pb-4 sm:pb-4 border-b border-gray-50 dark:border-gray-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">รายการใช้จ่าย ({filteredTransactions.length})</h3>
          
          <div className="flex flex-col sm:flex-row w-full sm:w-auto space-y-2 sm:space-y-0 sm:space-x-2">
            <input 
              type="text" 
              placeholder="ค้นหารายการ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 px-3 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-800 dark:text-gray-200"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-9 px-3 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-800 dark:text-gray-200"
            >
              <option value="all">ทุกหมวดหมู่</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button
              onClick={() => setFilterByPeriod(!filterByPeriod)}
              className={`h-9 text-sm px-3 rounded-md font-medium transition-colors flex items-center justify-center border ${
                filterByPeriod
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={filterByPeriod ? "กำลังแสดงเฉพาะรายการในช่วงเวลานี้ (คลิกเพื่อแสดงทั้งหมด)" : "คลิกเพื่อแสดงเฉพาะรายการในช่วงเวลานี้"}
            >
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              {filterByPeriod ? "เฉพาะช่วงเวลานี้" : "ทุกช่วงเวลา"}
            </button>
            <button 
              onClick={exportToCSV}
              disabled={filteredTransactions.length === 0}
              className="h-9 text-sm px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>
        </div>
        {/* Mobile View (Card List) */}
        <div className="block md:hidden">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((t) => (
              <div key={t.id} className="p-4 border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors flex justify-between items-center">
                {editingId === t.id ? (
                  <div className="w-full flex flex-col space-y-2">
                    <input 
                      type="number" 
                      value={editForm.amount} 
                      onChange={e => setEditForm({...editForm, amount: Number(e.target.value)})}
                      className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="จำนวนเงิน"
                    />
                    <input 
                      type="text" 
                      value={editForm.note} 
                      onChange={e => setEditForm({...editForm, note: e.target.value})}
                      className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="รายละเอียด"
                    />
                    <select
                      value={editForm.category}
                      onChange={e => setEditForm({...editForm, category: e.target.value})}
                      className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      {!uniqueCategories.includes(editForm.category) && <option value={editForm.category}>{editForm.category}</option>}
                    </select>
                    <div className="flex space-x-2 justify-end mt-2">
                      <button onClick={() => setEditingId(null)} className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                        <X className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleUpdate(t.id)} className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded text-indigo-600 dark:text-indigo-400">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 pr-3 sm:pr-4">
                      <div className="flex items-center space-x-2 mb-1">
                        {t.category && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                            {t.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2">{t.note}</p>
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 space-x-2">
                        <span>{t.createdAt ? format(parseISO(t.createdAt), "dd MMM yy", { locale: th }) : "-"}</span>
                        <span>•</span>
                        <span>{t.createdAt ? format(parseISO(t.createdAt), "HH:mm", { locale: th }) : "-"}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className="font-medium whitespace-nowrap text-rose-600 dark:text-rose-400">
                        -฿{t.amount?.toLocaleString()}
                      </span>
                      <div className="flex space-x-1">
                        <button 
                          onClick={() => handleEditClick(t)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">ยังไม่มีรายการ</div>
          )}
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm">
                <th className="p-4 font-medium">วันที่</th>
                <th className="p-4 font-medium">เวลา</th>
                <th className="p-4 font-medium">หมวดหมู่</th>
                <th className="p-4 font-medium">รายการ (รายละเอียด)</th>
                <th className="p-4 font-medium text-right">จำนวนเงิน</th>
                <th className="p-4 font-medium text-center w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    {editingId === t.id ? (
                      <>
                        <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                          {t.createdAt ? format(parseISO(t.createdAt), "dd MMM yy", { locale: th }) : "-"}
                        </td>
                        <td className="p-4 text-sm text-gray-500 dark:text-gray-500">
                          {t.createdAt ? format(parseISO(t.createdAt), "HH:mm", { locale: th }) : "-"}
                        </td>
                        <td className="p-4">
                          <select
                            value={editForm.category}
                            onChange={e => setEditForm({...editForm, category: e.target.value})}
                            className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            {uniqueCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            {!uniqueCategories.includes(editForm.category) && <option value={editForm.category}>{editForm.category}</option>}
                          </select>
                        </td>
                        <td className="p-4">
                          <input 
                            type="text" 
                            value={editForm.note} 
                            onChange={e => setEditForm({...editForm, note: e.target.value})}
                            className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="p-4 text-right">
                          <input 
                            type="number" 
                            value={editForm.amount} 
                            onChange={e => setEditForm({...editForm, amount: Number(e.target.value)})}
                            className="w-24 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-right"
                          />
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center space-x-1">
                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                              <X className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleUpdate(t.id)} className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded text-indigo-600 dark:text-indigo-400">
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                          {t.createdAt ? format(parseISO(t.createdAt), "dd MMM yy", { locale: th }) : "-"}
                        </td>
                        <td className="p-4 text-sm text-gray-500 dark:text-gray-500">
                          {t.createdAt ? format(parseISO(t.createdAt), "HH:mm", { locale: th }) : "-"}
                        </td>
                        <td className="p-4">
                          {t.category ? (
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                              {t.category}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.note}</p>
                        </td>
                        <td className="p-4 text-right font-medium text-rose-600 dark:text-rose-400">
                          -฿{t.amount?.toLocaleString()}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center space-x-1">
                            <button 
                              onClick={() => handleEditClick(t)}
                              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="แก้ไขรายการ"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(t.id)}
                              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="ลบรายการ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400 dark:text-gray-500">ยังไม่มีรายการ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
