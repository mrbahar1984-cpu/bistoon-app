

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
  return result;
};

export const shamsiMonthNames = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

export const shamsiWeekDays = [
  { name: 'شنبه', short: 'ش' },
  { name: 'یکشنبه', short: 'ی' },
  { name: 'دوشنبه', short: 'د' },
  { name: 'سه‌شنبه', short: 'س' },
  { name: 'چهارشنبه', short: 'چ' },
  { name: 'پنج‌شنبه', short: 'پ' },
  { name: 'جمعه', short: 'ج', isWeekend: true },
];

export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let gy: number;
  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }

  let days = (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + 78 + jd;
  if (jm < 7) {
    days += (jm - 1) * 31;
  } else {
    days += ((jm - 7) * 30) + 186;
  }

  gy += 400 * Math.floor(days / 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && days >= sal_a[gm]) {
    days -= sal_a[gm];
    gm++;
  }
  return { gy, gm, gd: days + 1 };
}

export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }

  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

export const isLeapJalaliYear = (year: number): boolean => {
  const g = jalaliToGregorian(year, 12, 30);
  const j = gregorianToJalali(g.gy, g.gm, g.gd);
  return j.jy === year && j.jm === 12 && j.jd === 30;
};

export const getDaysInShamsiMonth = (year: number, month: number): number => {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isLeapJalaliYear(year) ? 30 : 29;
};

/**
 * Calculates Persian day of week index for day 1 of given year and month.
 * Returns 0 for Saturday (شنبه), 1 for Sunday (یکشنبه), ... 6 for Friday (جمعه).
 */
export const getFirstDayOfWeekInShamsiMonth = (year: number, month: number): number => {
  const g = jalaliToGregorian(year, month, 1);
  const gDate = new Date(g.gy, g.gm - 1, g.gd);
  const jsDay = gDate.getDay(); // 0 is Sunday, 6 is Saturday
  return (jsDay + 1) % 7; // Convert to Saturday = 0, Sunday = 1, ... Friday = 6
};

export const parseShamsiDate = (str: string): { year: number; month: number; day: number } | null => {
  if (!str) return null;
  const clean = toEnglishDigits(str).trim();
  const parts = clean.split(/[/-]/).map(p => parseInt(p, 10));
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const year = parts[0];
    const month = Math.min(12, Math.max(1, parts[1]));
    const maxDays = getDaysInShamsiMonth(year, month);
    const day = Math.min(maxDays, Math.max(1, parts[2]));
    return { year, month, day };
  }
  return null;
};

export const formatShamsiDate = (year: number, month: number, day: number): string => {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}/${m}/${d}`;
};

export const formatShamsiLong = (shamsiStr: string): string => {
  const parsed = parseShamsiDate(shamsiStr);
  if (!parsed) return shamsiStr;
  const g = jalaliToGregorian(parsed.year, parsed.month, parsed.day);
  const gDate = new Date(g.gy, g.gm - 1, g.gd);
  const dayName = getDayName(gDate);
  const monthName = shamsiMonthNames[parsed.month - 1];
  return `${dayName} ${parsed.day} ${monthName} ${parsed.year}`;
};

export const getCurrentMonthRange = (referenceDateStr?: string): { startDate: string; endDate: string; monthName: string; year: number; month: number } => {
  const today = referenceDateStr ? referenceDateStr : getShamsiDate();
  const parsed = parseShamsiDate(today) || { year: 1403, month: 1, day: 1 };
  const totalDays = getDaysInShamsiMonth(parsed.year, parsed.month);
  const startDate = formatShamsiDate(parsed.year, parsed.month, 1);
  const endDate = formatShamsiDate(parsed.year, parsed.month, totalDays);
  const monthName = shamsiMonthNames[parsed.month - 1] || '';
  return { startDate, endDate, monthName, year: parsed.year, month: parsed.month };
};
