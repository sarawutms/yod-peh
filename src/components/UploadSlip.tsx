"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Tesseract from "tesseract.js";
import { Loader2, CheckCircle, XCircle, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function UploadSlip({ user }: { user: User | null }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Form fields
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [transferTime, setTransferTime] = useState<string>(""); // เก็บแค่เวลา HH:mm
  const [ocrStatus, setOcrStatus] = useState<string>("");

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
      setOcrStatus("กำลังอ่านตัวหนังสือบนสลิป (OCR)...");
      const result = await Tesseract.recognize(
        selectedFile,
        'tha+eng',
        { logger: m => {
          if (m.status === 'recognizing text') {
            setOcrStatus(`กำลังอ่านตัวหนังสือ... ${Math.round(m.progress * 100)}%`);
          }
        }}
      );

      const text = result.data.text;
      console.log("OCR Text Result: ", text); // พิมพ์ค่าที่อ่านได้ให้ดูใน Console
      
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
    } finally {
      setIsProcessing(false);
    }
  }, []);

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
            user_id: user.id
          }
        ]);
        
      if (dbError) throw dbError;

      setIsSuccess(true);
      setFile(null);
      setPreviewUrl(null);
      setAmount("");
      setNote("");
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
    <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 transition-colors">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 text-center">บันทึกรายการโอนเงิน</h2>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Upload Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รูปสลิป</label>
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            }`}
          >
            <input {...getInputProps()} />
            {previewUrl ? (
              <div className="relative w-full h-40">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rounded" />
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex flex-col items-center justify-center rounded">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400 text-center px-4">{ocrStatus}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-2 py-4">
                <ImageIcon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isDragActive ? "วางรูปสลิปที่นี่..." : "ลากรูปสลิปมาวาง หรือคลิกเพื่อเลือกไฟล์"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Time Input */}
        <div>
          <label htmlFor="transferTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            เวลาที่โอน (ดึงจากรูปภาพ)
          </label>
          <input
            type="time"
            id="transferTime"
            className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 text-gray-900 dark:text-gray-100"
            value={transferTime}
            onChange={(e) => setTransferTime(e.target.value)}
            disabled={isProcessing}
            required
          />
        </div>

        {/* Amount Input */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ยอดเงิน (ดึงตัวเลขจากรูปภาพ)
          </label>
          <div className="relative">
            <input
              type="number"
              id="amount"
              step="0.01"
              placeholder="0.00"
              className={`w-full p-2.5 bg-white dark:bg-gray-900 border rounded-lg outline-none font-semibold text-lg transition-colors disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 ${ocrStatus.includes('สำเร็จ') ? 'border-green-400 dark:border-green-500 text-green-700 dark:text-green-400' : 'border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isProcessing}
            />
          </div>
          {ocrStatus && !ocrStatus.includes('กำลัง') && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">{ocrStatus}</p>
          )}
        </div>

        {/* Note Input */}
        <div>
          <label htmlFor="note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">จ่ายค่าอะไรไป?</label>
          <input
            type="text"
            id="note"
            placeholder="เช่น ค่าอาหาร, ค่าไฟ, โอนเงินให้ A"
            className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none transition-all disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg flex items-center text-sm border border-red-100 dark:border-red-900/50">
            <XCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            {error}
          </div>
        )}

        {isSuccess && (
          <div className="p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg flex items-center text-sm border border-green-100 dark:border-green-900/50">
            <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            บันทึกรายการสำเร็จ!
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || isProcessing}
          className={`w-full py-3 rounded-lg text-white font-medium flex justify-center items-center text-lg shadow-sm ${
            (isSubmitting || isProcessing) ? "bg-gray-400 dark:bg-gray-700 cursor-not-allowed text-gray-100 dark:text-gray-300" : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          } transition-colors`}
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
