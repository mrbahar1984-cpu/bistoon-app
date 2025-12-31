
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
 * @param message متن پیام
 * @param inlineKeyboard آرایه دکمه‌های شیشه‌ای (اختیاری)
 */
export const sendTelegramMessage = async (message: string, inlineKeyboard?: any) => {
  // Fix: Return an array of error objects instead of a single object to maintain return type consistency
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes('YOUR_BOT_TOKEN')) {
    console.warn('Telegram Bot Token is not properly set.');
    return [{ success: false, error: 'Token missing' }];
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const results = [];
  
  for (const chatId of ADMIN_CHAT_IDS) {
    try {
      const payload: any = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      };

      if (inlineKeyboard) {
        payload.reply_markup = JSON.stringify({
          inline_keyboard: inlineKeyboard
        });
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
        console.error('Telegram API Error:', data);
        results.push({ success: false, chatId, error: data.description });
      } else {
        results.push({ success: true, chatId });
      }
    } catch (error) {
      console.error(`Error sending Telegram message to ${chatId}:`, error);
      results.push({ success: false, chatId, error: String(error) });
    }
  }
  return results;
};
