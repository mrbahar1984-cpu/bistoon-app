
/**
 * سرویس ارتباط با تلگرام
 * این سرویس پیام‌ها را به لیست شناسه‌های مدیران ارسال می‌کند
 */

// توکن اختصاصی کاربر (ثابت)
const TELEGRAM_BOT_TOKEN: string = '8239909577:AAHu8frLlx9bm6VDTrUTpgpxbOLrdifSous'; 

/**
 * لیست شناسه‌های تلگرام مدیران
 */
const ADMIN_CHAT_IDS: string[] = [
  '192350979', // شناسه شما (مدیر اول)
];

/**
 * وضعیت نهایی Webhook شما:
 * URL: https://ffbbykkvoqboofsrormb.supabase.co/functions/v1/telegram-handler
 * 
 * لینک فعال‌سازی نهایی (کافیست یکبار روی این لینک کلیک کنید):
 * https://api.telegram.org/bot8239909577:AAHu8frLlx9bm6VDTrUTpgpxbOLrdifSous/setWebhook?url=https://ffbbykkvoqboofsrormb.supabase.co/functions/v1/telegram-handler
 */

/**
 * ارسال پیام به تلگرام با قابلیت افزودن دکمه
 * @param message متن پیام
 * @param inlineKeyboard آرایه دکمه‌های شیشه‌ای (اختیاری)
 */
export const sendTelegramMessage = async (message: string, inlineKeyboard?: any) => {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes('YOUR_BOT_TOKEN')) {
    console.warn('Telegram Bot Token is not properly set.');
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  for (const chatId of ADMIN_CHAT_IDS) {
    try {
      const payload: any = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      };

      if (inlineKeyboard) {
        payload.reply_markup = {
          inline_keyboard: inlineKeyboard
        };
      }

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error(`Error sending Telegram message to ${chatId}:`, error);
    }
  }
};
