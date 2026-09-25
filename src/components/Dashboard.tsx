"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { Trash2 } from "lucide-react";

export default function Dashboard({ user }: { user: any }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryType, setSummaryType] = useState<'day' | 'week' | 'month'>('day');

  const fetchTransactions = async () => {
    if (!supabase) return;
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
    return <div className="p-8 text-center text-gray-500">กำลังโหลดข้อมูลสรุป...</div>;
  }

  const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  // เตรียมข้อมูลสำหรับกราฟตามประเภทที่เลือก
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

    if (!acc[keyStr]) acc[keyStr] = 0;
    acc[keyStr] += t.amount;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.keys(chartDataMap).map(key => ({
    name: key,
    amount: chartDataMap[key]
  })).reverse(); // เรียงจากเก่าไปใหม่สำหรับกราฟ

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <p className="text-gray-500 text-sm font-medium mb-1">ยอดใช้จ่ายทั้งหมด (ที่แสดง)</p>
          <p className="text-3xl font-bold text-blue-600">฿{totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <p className="text-gray-500 text-sm font-medium mb-1">จำนวนรายการ</p>
          <p className="text-3xl font-bold text-gray-800">{transactions.length} <span className="text-base font-normal text-gray-500">รายการ</span></p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
          <h3 className="text-lg font-semibold text-gray-800">กราฟสรุปยอดใช้จ่าย</h3>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setSummaryType('day')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${summaryType === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              รายวัน
            </button>
            <button 
              onClick={() => setSummaryType('week')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${summaryType === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              รายสัปดาห์
            </button>
            <button 
              onClick={() => setSummaryType('month')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${summaryType === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              รายเดือน
            </button>
          </div>
        </div>
        
        <div className="h-64 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f3f4f6'}} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">ยังไม่มีข้อมูล</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <h3 className="text-lg font-semibold p-6 pb-4 border-b border-gray-50 text-gray-800">รายการใช้จ่ายล่าสุด</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm">
                <th className="p-4 font-medium">วันที่</th>
                <th className="p-4 font-medium">เวลา</th>
                <th className="p-4 font-medium">รายการ (จ่ายค่าอะไร)</th>
                <th className="p-4 font-medium text-right">จำนวนเงิน</th>
                <th className="p-4 font-medium text-center w-16"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.length > 0 ? (
                transactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-4 text-sm text-gray-600">
                      {t.createdAt ? format(parseISO(t.createdAt), "dd MMM yy", { locale: th }) : "-"}
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {t.createdAt ? format(parseISO(t.createdAt), "HH:mm", { locale: th }) : "-"}
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium text-gray-800">{t.note}</p>
                    </td>
                    <td className="p-4 text-right font-medium text-red-600">
                      -฿{t.amount?.toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleDelete(t.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบรายการ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">ยังไม่มีรายการ</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
