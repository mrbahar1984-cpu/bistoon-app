
/**
 * سرویس ارتباط با تلگرام
 * این سرویس پیام‌ها را به شناسه مدیر ارسال می‌کند
 */

// توکن اختصاصی کاربر
const TELEGRAM_BOT_TOKEN: string = '8239909577:AAHu8frLlx9bm6VDTrUTpgpxbOLrdifSous'; 
const ADMIN_CHAT_ID = '192350979';

export const sendTelegramMessage = async (message: string) => {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes('YOUR_BOT_TOKEN')) {
    console.warn('Telegram Bot Token is not properly set.');
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
};
