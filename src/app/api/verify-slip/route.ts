import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { payload } = await req.json();

    if (!payload) {
      return NextResponse.json(
        { error: "No QR payload provided" },
        { status: 400 }
      );
    }

    // TODO: ในสถานการณ์จริง คุณต้องนำ payload นี้ไปยิง API ของธนาคาร หรือบริการตรวจสอบสลิป 
    // เช่น SlipOK, EasySlip เพื่อดึงข้อมูลยอดเงินและชื่อผู้โอนของจริง
    // ตัวอย่าง:
    // const response = await fetch('https://api.slipok.com/api/line/webhook', { ... });
    
    // สำหรับโปรเจกต์นี้ เราจะ Mock ข้อมูลจำลองขึ้นมาเพื่อทดสอบระบบ
    const mockData = {
      transactionId: `TXN${Math.floor(Math.random() * 100000000)}`,
      amount: Math.floor(Math.random() * 1000) + 100, // สุ่มยอดเงิน 100 - 1100
      senderName: "นาย ทดสอบ ระบบโอนเงิน",
      bankName: "KBank",
      timestamp: new Date().toISOString(),
      status: "verified",
      rawPayload: payload,
    };

    return NextResponse.json(mockData);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
