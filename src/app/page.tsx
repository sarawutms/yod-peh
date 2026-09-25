"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import UploadSlip from "@/components/UploadSlip";
import Dashboard from "@/components/Dashboard";
import Auth from "@/components/Auth";
import { ReceiptText, LogOut, X } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setShowAuthModal(false);
      }
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
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 pb-12 font-sans transition-colors relative">
      {/* Auth Modal */}
      {showAuthModal && !session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-md animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 z-10 p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <Auth />
          </div>
        </div>
      )}

      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl py-4 px-4 sm:px-6 mb-4 sm:mb-8 shadow-[0_4px_30px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_30px_rgb(0,0,0,0.1)] border-b border-gray-100 dark:border-gray-800/50 sticky top-0 z-10 transition-colors">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-default group">
            <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20 text-white transform transition-transform group-hover:scale-105">
              <ReceiptText className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight flex items-baseline">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">Yod</span>
              <span className="text-gray-800 dark:text-gray-100">Peh</span>
              <span className="ml-3 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-100/50 dark:border-emerald-800/50 tracking-wider uppercase flex items-center hidden sm:flex shadow-sm">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                ยอดเป๊ะ
              </span>
            </h1>
          </div>
          
          <div className="flex items-center space-x-3 sm:space-x-4">
            <ThemeToggle />
            
            {session ? (
              <div className="flex items-center bg-gray-50 dark:bg-gray-800/80 p-1.5 rounded-full border border-gray-100 dark:border-gray-700/50 shadow-sm">
                <span className="text-sm text-gray-700 dark:text-gray-200 font-medium max-w-[100px] sm:max-w-[150px] truncate px-3">
                  {session.user.user_metadata?.display_name || session.user.email?.split('@')[0]}
                </span>
                <button 
                  onClick={handleLogout} 
                  className="text-gray-500 dark:text-gray-400 hover:text-white dark:hover:text-white hover:bg-rose-500 dark:hover:bg-rose-500 flex items-center justify-center p-2 rounded-full transition-all duration-200"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-5 py-2.5 rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                เข้าสู่ระบบ
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 sm:space-y-8">
        <div className="relative">
          {/* Click Interceptor Overlay for Unauthenticated Users */}
          {!session && (
            <div 
              className="absolute inset-0 z-20 cursor-pointer"
              onClick={() => setShowAuthModal(true)}
              title="กรุณาเข้าสู่ระบบเพื่อใช้งาน"
            />
          )}
          <UploadSlip user={session?.user || null} />
        </div>
        
        <Dashboard user={session?.user || null} />
      </div>
    </main>
  );
}
