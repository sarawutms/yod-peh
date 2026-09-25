"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import UploadSlip from "@/components/UploadSlip";
import Dashboard from "@/components/Dashboard";
import Auth from "@/components/Auth";
import { ReceiptText, LogOut } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
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
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors">กำลังโหลด...</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 pb-12 font-sans transition-colors">
      <header className="bg-white dark:bg-gray-800 py-5 px-6 mb-8 shadow-sm border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 transition-colors">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-default">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-xl shadow-sm text-white">
              <ReceiptText className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight flex items-baseline">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Yod</span>
              <span className="text-gray-800 dark:text-gray-100">Peh</span>
              <span className="ml-3 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-100 dark:border-emerald-800 tracking-wide uppercase flex items-center hidden sm:flex">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                ยอดเป๊ะ
              </span>
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            
            {session && (
              <>
                <span className="text-sm text-gray-600 dark:text-gray-300 font-medium hidden sm:inline-block">
                  สวัสดี, {session.user.user_metadata?.display_name || session.user.email}
                </span>
                <button 
                  onClick={handleLogout} 
                  className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 flex items-center text-sm font-medium transition-colors bg-gray-50 dark:bg-gray-800/50 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-lg"
                >
                  <LogOut className="w-4 h-4 mr-1.5" />
                  ออกจากระบบ
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 space-y-8">
        {!session && <Auth />}
        <UploadSlip user={session?.user || null} />
        <Dashboard user={session?.user || null} />
      </div>
    </main>
  );
}
