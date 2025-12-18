
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeAttendance = async (logsJson: string) => {
  const prompt = `
    به عنوان یک کارشناس حرفه‌ای منابع انسانی و قانون کار ایران، اطلاعات ورود و خروج کارمندان را که در قالب JSON ارسال شده است تحلیل کن.
    
    وظایف شما:
    1. محاسبه مجموع دقیق ساعات حضور برای هر کارمند.
    2. تشخیص اضافه‌کاری (مازاد بر کارکرد موظفی).
    3. شناسایی تعطیل‌کاری (ترددهایی که در روزهای جمعه یا تعطیل رسمی ثبت شده‌اند).
    4. محاسبه مجموع مرخصی‌های ساعتی.
    
    قوانین:
    - روزهای جمعه تعطیل رسمی هستند.
    - فرمت خروجی باید کاملاً فارسی، خوانا، با استفاده از ایموجی‌های مناسب و به صورت لیست باشد.
    
    اطلاعات ورودی (JSON):
    ${logsJson}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "متأسفانه در حال حاضر امکان تحلیل هوشمند وجود ندارد. لطفاً ارتباط اینترنت خود را چک کنید یا بعداً تلاش کنید.";
  }
};
