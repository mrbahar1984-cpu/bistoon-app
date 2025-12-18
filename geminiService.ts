
import { GoogleGenAI } from "@google/genai";

export const analyzeAttendance = async (logsJson: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    به عنوان کارشناس قانون کار ایران، این گزارشات حضور و غیاب (JSON) را تحلیل کن:
    ${logsJson}
    
    خروجی باید شامل این موارد باشد:
    1. نام کارمند و مجموع ساعت حضور.
    2. میزان اضافه‌کاری (مازاد بر ۸ ساعت در روزهای عادی).
    3. میزان تعطیل‌کاری (جمعه‌ها).
    4. مجموع مرخصی‌های ساعتی.
    
    لحن پاسخ حرفه‌ای و کاملاً فارسی باشد. از ایموجی برای خوانایی استفاده کن.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "خطا در تحلیل هوشمند. لطفاً دوباره تلاش کنید.";
  }
};
