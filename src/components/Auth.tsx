"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!displayName.trim()) {
          throw new Error("กรุณากรอกชื่อผู้ใช้งาน");
        }
        if (password !== confirmPassword) {
          throw new Error("รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง");
        }
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              display_name: displayName.trim()
            }
          }
        });
        if (error) throw error;
        alert("สมัครสมาชิกสำเร็จ! ตอนนี้คุณเข้าสู่ระบบแล้ว");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("เกิดข้อผิดพลาด");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] border border-gray-100 dark:border-gray-800 transition-colors">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">
          {isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
          {isLogin ? "ยินดีต้อนรับกลับมา! กรุณาเข้าสู่ระบบเพื่อจัดการบัญชี" : "สร้างบัญชีใหม่เพื่อเริ่มต้นใช้งาน"}
        </p>
      </div>

      <form onSubmit={handleAuth} className="space-y-5">
        {!isLogin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ชื่อผู้ใช้งาน (Display Name)</label>
            <input
              type="text"
              required
              className="w-full p-3.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
              placeholder="เช่น ยอดชาย, A, Admin"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">อีเมล</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="email"
              required
              className="w-full pl-12 p-3.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">รหัสผ่าน</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="password"
              required
              minLength={6}
              className="w-full pl-12 p-3.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {!isLogin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ยืนยันรหัสผ่านอีกครั้ง</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                type="password"
                required
                minLength={6}
                className="w-full pl-12 p-3.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center text-sm font-medium border border-red-100 dark:border-red-900/30">
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white font-bold flex justify-center items-center text-lg shadow-lg hover:shadow-xl transition-all duration-300 active:scale-[0.98] bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isLogin ? (
            "เข้าสู่ระบบ"
          ) : (
            "สมัครสมาชิก"
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {isLogin ? "ยังไม่มีบัญชีใช่ไหม? " : "มีบัญชีอยู่แล้วใช่ไหม? "}
        </span>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
          type="button"
        >
          {isLogin ? "สมัครสมาชิกที่นี่" : "เข้าสู่ระบบที่นี่"}
        </button>
      </div>
    </div>
  );
}
