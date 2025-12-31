
/**
 * سرویس ارتباط با تلگرام
 * این سرویس پیام‌ها را به لیست شناسه‌های مدیران ارسال می‌کند
 */

// توکن اختصاصی ربات تلگرام
const TELEGRAM_BOT_TOKEN: string = '8239909577:AAHu8frLlx9bm6VDTrUTpgpxbOLrdifSous'; 

/**
 * لیست شناسه‌های تلگرام مدیران
 */
const ADMIN_CHAT_IDS: string[] = [
  '192350979', // شناسه مدیر
];

/**
 * ارسال پیام به تلگرام با قابلیت افزودن دکمه
 */
export const sendTelegramMessage = async (message: string, inlineKeyboard?: any) => {
  console.log("🚀 شروع ارسال به تلگرام...");
  
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes('YOUR_BOT_TOKEN')) {
    console.error('❌ توکن تلگرام یافت نشد.');
    return [{ success: false, error: 'Token missing' }];
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const results = [];
  
  for (const chatId of ADMIN_CHAT_IDS) {
    try {
      console.log(`📡 ارسال به چت ID: ${chatId}`);
      
      const payload: any = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      };

      // اصلاح دقیق نام متغیر: استفاده از پارامتر ورودی تابع (inlineKeyboard)
      if (inlineKeyboard && Array.isArray(inlineKeyboard)) {
        payload.reply_markup = {
          inline_keyboard: inlineKeyboard
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!data.ok) {
        console.error(`❌ خطای API تلگرام برای ${chatId}:`, data.description);
        results.push({ success: false, chatId, error: data.description });
      } else {
        console.log(`✅ پیام با موفقیت به ${chatId} ارسال شد.`);
        results.push({ success: true, chatId });
      }
    } catch (error) {
      console.error(`🔥 خطای بحرانی در Fetch برای ${chatId}:`, error);
      results.push({ success: false, chatId, error: String(error) });
    }
  }
  return results;
};
