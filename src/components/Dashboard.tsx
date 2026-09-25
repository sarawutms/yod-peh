"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { Trash2 } from "lucide-react";

export default function Dashboard({ user }: { user: User | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryType, setSummaryType] = useState<'day' | 'week' | 'month'>('day');

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

  const totalExpense = transactions.filter(t => !t.type || t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
  const netBalance = totalIncome - totalExpense;

  // เตรียมข้อมูลสำหรับกราฟตามประเภทที่เลือก (แสดงรายรับและรายจ่าย)
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
    }

    if (!acc[keyStr]) acc[keyStr] = { name: keyStr, expense: 0, income: 0 };
    
    if (!t.type || t.type === 'expense') {
      acc[keyStr].expense += t.amount;
    } else {
      acc[keyStr].income += t.amount;
    }
    
    return acc;
  }, {} as Record<string, { name: string, expense: number, income: number }>);

  const chartData = Object.values(chartDataMap).reverse(); // เรียงจากเก่าไปใหม่สำหรับกราฟ

  const exportToCSV = () => {
    if (transactions.length === 0) {
      alert("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }
    
    // สร้าง Header ของ CSV
    const headers = ["วันที่", "เวลา", "ประเภท", "หมวดหมู่", "รายการ", "จำนวนเงิน (บาท)"];
    
    // สร้างข้อมูล Row
    const rows = transactions.map(t => {
      const dateStr = t.createdAt ? format(parseISO(t.createdAt), "dd/MM/yyyy") : "";
      const timeStr = t.createdAt ? format(parseISO(t.createdAt), "HH:mm") : "";
      const typeStr = t.type === 'income' ? 'รายรับ' : 'รายจ่าย';
      const catStr = `"${t.category || '-'}"`;
      const note = `"${(t.note || "").replace(/"/g, '""')}"`; // ป้องกันปัญหาลูกน้ำและคำพูดใน CSV
      const amount = (t.type === 'income' ? t.amount : -t.amount) || 0;
      return [dateStr, timeStr, typeStr, catStr, note, amount].join(",");
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

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center transition-colors">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">ยอดคงเหลือ</p>
          <p className={`text-3xl font-bold ${netBalance >= 0 ? 'text-gray-800 dark:text-gray-100' : 'text-red-600 dark:text-red-400'}`}>
            ฿{netBalance.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center transition-colors">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">รายรับทั้งหมด</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">฿{totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center transition-colors">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">รายจ่ายทั้งหมด</p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">฿{totalExpense.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8 transition-colors">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">กราฟสรุปยอดใช้จ่าย</h3>
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
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
          </div>
        </div>
        
        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                <Tooltip cursor={{fill: '#f3f4f6'}} formatter={(value: number) => [`฿${value.toLocaleString()}`, ""]} />
                <Bar dataKey="income" name="รายรับ" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="expense" name="รายจ่าย" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="b" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">ยังไม่มีข้อมูล</div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="p-6 pb-4 border-b border-gray-50 dark:border-gray-700/50 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">รายการใช้จ่ายล่าสุด ({transactions.length})</h3>
          <button 
            onClick={exportToCSV}
            disabled={transactions.length === 0}
            className="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
        {/* Mobile View (Card List) */}
        <div className="block md:hidden">
          {transactions.length > 0 ? (
            transactions.map((t) => (
              <div key={t.id} className="p-4 border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors flex justify-between items-center">
                <div className="flex-1 pr-4">
                  <div className="flex items-center space-x-2 mb-1">
                    {t.category && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.type === 'income' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
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
                <div className="flex items-center space-x-3 text-right">
                  <span className={`font-medium whitespace-nowrap ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {t.type === 'income' ? '+' : '-'}฿{t.amount?.toLocaleString()}
                  </span>
                  <button 
                    onClick={() => handleDelete(t.id)}
                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="ลบรายการ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
              {transactions.length > 0 ? (
                transactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                      {t.createdAt ? format(parseISO(t.createdAt), "dd MMM yy", { locale: th }) : "-"}
                    </td>
                    <td className="p-4 text-sm text-gray-500 dark:text-gray-500">
                      {t.createdAt ? format(parseISO(t.createdAt), "HH:mm", { locale: th }) : "-"}
                    </td>
                    <td className="p-4">
                      {t.category ? (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.type === 'income' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {t.category}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.note}</p>
                    </td>
                    <td className={`p-4 text-right font-medium ${t.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {t.type === 'income' ? '+' : '-'}฿{t.amount?.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleDelete(t.id)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="ลบรายการ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
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
