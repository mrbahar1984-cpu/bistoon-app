
export const getShamsiDate = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
};
export const getShamsiTime = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(date);
};
export const getDayName = (date: Date): string => {
  return new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(date);
};
export const isHoliday = (shamsiDate: string, date: Date): boolean => {
  // جمعه‌ها در ایران تعطیل رسمی هستند
  return date.getDay() === 5;
};

// تبدیل اعداد فارسی به انگلیسی برای استانداردسازی ورودی‌های دستی ادمین
export const toEnglishDigits = (str: string): string => {
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  for (let i = 0; i < 10; i++) {
    str = str.replace(persianDigits[i], i.toString());
  }
  return str;
};
