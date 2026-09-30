"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { Trash2, Edit2, Check, X } from "lucide-react";

export default function Dashboard({ user }: { user: User | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryType, setSummaryType] = useState<'day' | 'week' | 'month' | 'year'>('day');

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: 0, category: '', note: '' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditClick = (t: any) => {
    setEditingId(t.id);
    setEditForm({ amount: t.amount || 0, category: t.category || '', note: t.note || '' });
  };

  const handleUpdate = async (id: string) => {
    try {
      if (!supabase) return;
      const { error } = await supabase
        .from('transactions')
        .update({
          amount: Number(editForm.amount),
          category: editForm.category,
          note: editForm.note
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

  const fetchTransactions = async () => {
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
        .limit(200);

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
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTransactions();

    const subscription = supabase
      .channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) {
      try {
        if (!supabase) return;
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
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

  // เตรียมข้อมูลสำหรับกราฟ (แสดงเฉพาะรายจ่าย)
  const chartDataMap = transactions.reduce((acc, t) => {
    if (!t.createdAt) return acc;
    const date = parseISO(t.createdAt);
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
    acc[keyStr].expense += t.amount;
    
    return acc;
  }, {} as Record<string, { name: string, expense: number }>);

  const chartData = Object.values(chartDataMap).reverse(); // เรียงจากเก่าไปใหม่สำหรับกราฟ

  const exportToCSV = () => {
    if (transactions.length === 0) {
      alert("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }
    
    // สร้าง Header ของ CSV
    const headers = ["วันที่", "เวลา", "หมวดหมู่", "รายการ", "จำนวนเงิน (บาท)"];
    
    // สร้างข้อมูล Row
    const rows = transactions.map(t => {
      const dateStr = t.createdAt ? format(parseISO(t.createdAt), "dd/MM/yyyy") : "";
      const timeStr = t.createdAt ? format(parseISO(t.createdAt), "HH:mm") : "";
      const catStr = `"${t.category || '-'}"`;
      const note = `"${(t.note || "").replace(/"/g, '""')}"`; // ป้องกันปัญหาลูกน้ำและคำพูดใน CSV
      const amount = t.amount || 0;
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
    return matchCategory && matchSearch;
  });

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* Total Expense Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 to-violet-900 dark:from-indigo-950 dark:to-violet-950 p-5 md:p-8 rounded-3xl shadow-xl shadow-indigo-900/20 dark:shadow-black/40 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          </div>
          <p className="text-indigo-200 dark:text-indigo-300 text-sm font-medium mb-1 relative z-10">ยอดใช้จ่ายทั้งหมด (ที่แสดง)</p>
          <p className="text-4xl font-black relative z-10 text-white">
            ฿{totalAmount.toLocaleString()}
          </p>
        </div>
        
        {/* Transaction Count Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-gray-100 dark:border-gray-700/50 flex flex-col justify-center transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">จำนวนรายการ</p>
          </div>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {transactions.length} <span className="text-base font-normal text-gray-500 dark:text-gray-400">รายการ</span>
          </p>
        </div>
      </div>

      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-gray-100 dark:border-gray-700/50 mb-6 sm:mb-8 transition-colors">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">กราฟสรุปยอดใช้จ่าย</h3>
          <div className="flex bg-gray-100/80 dark:bg-gray-900/80 p-1.5 rounded-2xl">
            <button 
              onClick={() => setSummaryType('day')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${summaryType === 'day' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              รายวัน
            </button>
            <button 
              onClick={() => setSummaryType('week')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${summaryType === 'week' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              รายสัปดาห์
            </button>
            <button 
              onClick={() => setSummaryType('month')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${summaryType === 'month' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              รายเดือน
            </button>
            <button 
              onClick={() => setSummaryType('year')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${summaryType === 'year' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              รายปี
            </button>
          </div>
        </div>
        
        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip cursor={{fill: '#f3f4f6'}} formatter={(value: any) => [`฿${Number(value).toLocaleString()}`, "ยอดใช้จ่าย"]} />
                <Bar dataKey="expense" name="รายจ่าย" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">ยังไม่มีข้อมูล</div>
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
              className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-800 dark:text-gray-200"
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-800 dark:text-gray-200"
            >
              <option value="all">ทุกหมวดหมู่</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button 
              onClick={exportToCSV}
              disabled={filteredTransactions.length === 0}
              className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="flex-1 pr-4">
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
