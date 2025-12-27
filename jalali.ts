
export const getShamsiDate = (date: Date = new Date()): string => {
  // اجبار به استفاده از اعداد انگلیسی و فرمت یکسان با جداکننده اسلش
  const formatted = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { 
    year: 'numeric', month: '2-digit', day: '2-digit', numberingSystem: 'latn' 
  }).format(date);
  return formatted;
};

export const getShamsiTime = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('fa-IR', { 
    hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' 
  }).format(date);
};

export const getDayName = (date: Date): string => {
  return new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(date);
};

export const isHoliday = (shamsiDate: string, date: Date): boolean => {
  return date.getDay() === 5;
};

export const toEnglishDigits = (str: string): string => {
  if (!str) return "";
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  let result = String(str);
  for (let i = 0; i < 10; i++) {
    result = result.replace(persianDigits[i], i.toString());
  }
  // حذف هرگونه کاراکتر غیر عددی بجای جداکننده استاندارد برای اطمینان در کوئری‌ها
  return result;
};

export const shamsiMonthNames = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

export const getDaysInShamsiMonth = (year: number, month: number): number => {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  const isLeap = [1, 5, 9, 13, 17, 22, 26, 30].includes(year % 33);
  return isLeap ? 30 : 29;
};
