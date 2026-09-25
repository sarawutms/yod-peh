"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Tesseract from "tesseract.js";
import { Loader2, CheckCircle, XCircle, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

import imageCompression from "browser-image-compression";

export default function UploadSlip({ user }: { user: User | null }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Form fields
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [transferTime, setTransferTime] = useState<string>(""); // เก็บแค่เวลา HH:mm
  const [ocrStatus, setOcrStatus] = useState<string>("");
  // เก็บ Worker ไว้ใช้ซ้ำเพื่อไม่ต้องโหลดใหม่ทุกครั้ง
  const [tesseractWorker, setTesseractWorker] = useState<Tesseract.Worker | null>(null);

  const EXPENSE_CATEGORIES = ["อาหารและเครื่องดื่ม", "การเดินทาง", "ช้อปปิ้ง", "บิลและค่าใช้จ่าย", "สุขภาพ", "ความบันเทิง", "โอนเงินให้คนอื่น", "อื่นๆ"];

  // โหลด Worker ล่วงหน้าตอนเปิดแอป
  useEffect(() => {
    const loadWorker = async () => {
      try {
        const worker = await Tesseract.createWorker('tha+eng');
        setTesseractWorker(worker);
      } catch (e) {
        console.error("Failed to load worker", e);
      }
    };
    if (!tesseractWorker) {
      loadWorker();
    }
    
    return () => {
      if (tesseractWorker) {
        tesseractWorker.terminate();
      }
    };
  }, []);

  // ฟังก์ชันดึงยอดเงิน
  const extractAmountFromText = (text: string) => {
    const regex = /[0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2}/g;
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      const amounts = matches.map(m => parseFloat(m.replace(/,/g, '')));
      const maxAmount = Math.max(...amounts);
      return maxAmount > 0 ? maxAmount.toString() : "";
    }
    return "";
  };

  // ฟังก์ชันดึงเวลา (HH:mm)
  const extractTimeFromText = (text: string) => {
    // หาแพทเทิร์นเวลา HH:mm หรือ HH.mm (เผื่อ OCR อ่าน : เป็น . หรือเว้นวรรค)
    const regex = /\b([01]?[0-9]|2[0-3])\s*[:\.]\s*([0-5][0-9])\b/;
    const match = text.match(regex);
    if (match) {
      const hh = match[1].padStart(2, '0');
      const mm = match[2];
      return `${hh}:${mm}`;
    }
    return "";
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setIsSuccess(false);
    setError(null);
    setAmount("");
    setOcrStatus("");
    
    // เซ็ตเวลาปัจจุบันเป็นค่าเริ่มต้น (แค่ HH:mm)
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTransferTime(`${hh}:${mm}`);
    
    setIsProcessing(true);

    try {
      setOcrStatus("กำลังบีบอัดรูปภาพเพื่อความรวดเร็ว...");
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(selectedFile, options);

      setOcrStatus("กำลังอ่านตัวหนังสือบนสลิป (OCR)...");
      let text = "";
      if (tesseractWorker) {
        const result = await tesseractWorker.recognize(compressedFile);
        text = result.data.text;
      } else {
        const result = await Tesseract.recognize(
          compressedFile,
          'tha+eng',
          { logger: m => {
            if (m.status === 'recognizing text') {
              setOcrStatus(`กำลังอ่านตัวหนังสือ... ${Math.round(m.progress * 100)}%`);
            }
          }}
        );
        text = result.data.text;
      }
      
      const extractedAmount = extractAmountFromText(text);
      const extractedTime = extractTimeFromText(text);

      if (extractedAmount) {
        setAmount(extractedAmount);
      }
      
      // ถ้าหาเวลาเจอ ให้อัปเดตเฉพาะเวลา
      if (extractedTime) {
        setTransferTime(extractedTime);
      }

      if (extractedAmount || extractedTime) {
        setOcrStatus("ดึงข้อมูลสำเร็จ! (หากไม่ถูกต้องสามารถแก้ไขได้)");
      } else {
        setError("ไม่พบข้อมูลบนรูปภาพ กรุณากรอกด้วยตนเอง");
        setOcrStatus("");
      }
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการอ่านรูปภาพ (OCR)");
      setOcrStatus("");
  }, [tesseractWorker]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
    disabled: isProcessing
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError("กรุณาเข้าสู่ระบบก่อนบันทึกรายการ");
      return;
    }
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("กรุณากรอกยอดเงินให้ถูกต้อง");
      return;
    }
    if (!category) {
      setError("กรุณาเลือกหมวดหมู่");
      return;
    }
    if (!note.trim()) {
      setError("กรุณากรอกว่าจ่ายค่าอะไรไป");
      return;
    }
    if (!supabase) {
      setError("ยังไม่ได้ตั้งค่า Supabase .env.local");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setIsSuccess(false);

    try {
      // เอาวันที่ของวันนี้ มารวมกับเวลาที่เลือก
      const today = new Date();
      const [hours, minutes] = transferTime.split(':');
      today.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      // บันทึกข้อมูลลง Supabase
      const { error: dbError } = await supabase
        .from('transactions')
        .insert([
          {
            amount: Number(amount),
            note: note.trim(),
            createdAt: today.toISOString(),
            user_id: user.id,
            type: 'expense',
            category: category
          }
        ]);
        
      if (dbError) throw dbError;

      setIsSuccess(true);
      setFile(null);
      setPreviewUrl(null);
      setAmount("");
      setNote("");
      setCategory("");
      setTransferTime("");
      setOcrStatus("");

    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 md:p-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-gray-100 dark:border-gray-800 transition-colors">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 text-center tracking-tight">บันทึกรายการจ่าย</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">รูปสลิป (ไม่บังคับ)</label>
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDragActive ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20" : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            }`}
          >
            <input {...getInputProps()} />
            {previewUrl ? (
              <div className="relative w-full h-40">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rounded-xl" />
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                    <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400 text-center px-4">{ocrStatus}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 py-4">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-1">
                  <ImageIcon className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {isDragActive ? "วางรูปสลิปที่นี่..." : "แตะเพื่อถ่ายรูป หรือเลือกไฟล์"}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">รองรับระบบดึงตัวเลขจากสลิปอัตโนมัติ</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Amount Input */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ยอดเงิน
            </label>
            <div className="relative">
              <input
                type="number"
                id="amount"
                step="0.01"
                placeholder="0.00"
                className={`w-full p-3.5 bg-gray-50/50 dark:bg-gray-800/50 border rounded-2xl outline-none font-bold text-xl transition-all duration-200 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 ${ocrStatus.includes('สำเร็จ') ? 'border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-4 ring-emerald-50 dark:ring-emerald-900/20' : 'border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400'}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            {ocrStatus && !ocrStatus.includes('กำลัง') && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-2">{ocrStatus}</p>
            )}
          </div>

          {/* Time Input */}
          <div>
            <label htmlFor="transferTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              เวลา
            </label>
            <input
              type="time"
              id="transferTime"
              className="w-full p-3.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all duration-200 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 text-gray-900 dark:text-gray-100 font-medium text-lg"
              value={transferTime}
              onChange={(e) => setTransferTime(e.target.value)}
              disabled={isProcessing}
              required
            />
          </div>
        </div>

        {/* Category Input */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">หมวดหมู่</label>
          <select
            id="category"
            className="w-full p-3.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all duration-200 text-gray-900 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 font-medium"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isProcessing}
            required
          >
            <option value="" disabled>เลือกหมวดหมู่...</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Note Input */}
        <div>
          <label htmlFor="note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">รายละเอียดเพิ่มเติม</label>
          <input
            type="text"
            id="note"
            placeholder="เช่น ชาบู, ค่าไฟ, โอนเงินให้ A"
            className="w-full p-3.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-400/20 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none transition-all duration-200 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center text-sm font-medium border border-red-100 dark:border-red-900/30">
            <XCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            {error}
          </div>
        )}

        {isSuccess && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center text-sm font-medium border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            บันทึกรายการสำเร็จ!
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || isProcessing}
          className={`w-full py-4 rounded-2xl text-white font-bold flex justify-center items-center text-lg shadow-lg hover:shadow-xl transition-all duration-300 active:scale-[0.98] ${
            (isSubmitting || isProcessing) ? "bg-gray-400 dark:bg-gray-700 cursor-not-allowed text-gray-100 shadow-none" : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/25"
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              กำลังบันทึก...
            </>
          ) : (
            "บันทึกรายการ"
          )}
        </button>
      </form>
    </div>
  );
}
