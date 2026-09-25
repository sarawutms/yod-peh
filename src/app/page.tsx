"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import UploadSlip from "@/components/UploadSlip";
import Dashboard from "@/components/Dashboard";
import Auth from "@/components/Auth";
import { ReceiptText, LogOut } from "lucide-react";

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">กำลังโหลด...</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 pb-12 font-sans">
      <header className="bg-white py-5 px-6 mb-8 shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-default">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-xl shadow-sm text-white">
              <ReceiptText className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight flex items-baseline">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600">Yod</span>
              <span className="text-gray-800">Peh</span>
              <span className="ml-3 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-100 tracking-wide uppercase flex items-center hidden sm:flex">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                ยอดเป๊ะ
              </span>
            </h1>
          </div>
          
          {session && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 font-medium hidden sm:inline-block">
                สวัสดี, {session.user.user_metadata?.display_name || session.user.email}
              </span>
              <button 
                onClick={handleLogout} 
                className="text-gray-500 hover:text-red-600 flex items-center text-sm font-medium transition-colors bg-gray-50 hover:bg-red-50 px-3 py-1.5 rounded-lg"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 space-y-8">
        {!session ? (
          <Auth />
        ) : (
          <>
            <UploadSlip user={session.user} />
            <Dashboard user={session.user} />
          </>
        )}
      </div>
    </main>
  );
}
