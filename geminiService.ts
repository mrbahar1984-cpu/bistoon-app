
import { GoogleGenAI } from "@google/genai";

export const analyzeAttendance = async (logsJson: string) => {
  // استفاده مستقیم از کلید محیطی
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    به عنوان یک کارشناس منابع انسانی، این داده‌های ورود و خروج کارمندان را تحلیل کن:
    ${logsJson}
    
    لطفاً موارد زیر را با دقت محاسبه کن:
    1. مجموع ساعت حضور واقعی هر فرد.
    2. مقدار اضافه‌کاری (بیش از ۸ ساعت در روز).
    3. مقدار تعطیل‌کاری (اگر در روز جمعه یا تعطیل بوده است).
    4. مرخصی‌های ساعتی.
    
    پاسخ را به زبان فارسی، بسیار خوانا و با استفاده از ایموجی‌های مناسب ارائه بده.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "در حال حاضر امکان تحلیل هوشمند وجود ندارد. لطفاً ارتباط خود را بررسی کنید.";
  }
};
