import { EmployeeScore, EmployeeMonthScoresSummary, ScoreType } from './types';
import { supabase } from './supabaseClient';
import { getShamsiDate, getShamsiTime, toEnglishDigits, shamsiMonthNames } from './jalali';

export const SCORE_STORAGE_KEY = 'bahar_employee_scores_v1';
export const SCORES_UPDATED_EVENT = 'bahar_scores_updated';

export const POSITIVE_CATEGORIES = [
  'نظم، انضباط و وقت‌شناسی عالی',
  'کیفیت بالا و دقت در انجام وظایف',
  'تعهد کاری و مسئولیت‌پذیری نمونه',
  'همکاری تیمی و کمک موثر به همکاران',
  'خلاقیت، نوآوری و ارائه راهکار برتر',
  'پاسخگویی سریع، پیگیری و حسن خلق',
  'اضافه کاری داوطلبانه در پروژه حساس',
  'سایر موارد تشویقی و تقدیر'
];

export const NEGATIVE_CATEGORIES = [
  'تاخیر غیرموجه در ورود یا جلسات',
  'ترک زودهنگام محل کار بدون هماهنگی',
  'عدم تکمیل وظایف محوله در موعد مقرر',
  'عدم رعایت استانداردهای کاری و دستورالعمل‌ها',
  'غیبت غیرموجه یا عدم پاسخگویی در شیفت',
  'نقص مکرر در ثبت ترددها',
  'سهل‌انگاری و افت کیفیت کار',
  'سایر موارد تذکر و کسر امتیاز انضباطی'
];

// استخراج سال و ماه از تاریخ شمسی
export const parseShamsiYearMonthDay = (dateStr: string): { year: number; month: number; day: number } | null => {
  if (!dateStr) return null;
  const clean = toEnglishDigits(dateStr).trim();
  const parts = clean.split(/[/-]/).map(p => parseInt(p, 10));
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return {
      year: parts[0],
      month: Math.min(12, Math.max(1, parts[1])),
      day: Math.min(31, Math.max(1, parts[2]))
    };
  }
  return null;
};

// دریافت امتیازات ذخیره‌شده در حافظه محلی
export const getLocalScores = (): EmployeeScore[] => {
  try {
    const raw = localStorage.getItem(SCORE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error reading scores from localStorage:', err);
  }
  return [];
};

// ذخیره در حافظه محلی و انتشار رویداد برای به روزرسانی فوری همه کامپوننت‌ها
export const saveLocalScores = (scores: EmployeeScore[]) => {
  try {
    localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(scores));
    window.dispatchEvent(new CustomEvent(SCORES_UPDATED_EVENT, { detail: scores }));
  } catch (err) {
    console.warn('Error saving scores to localStorage:', err);
  }
};

// بارگذاری امتیازات با بررسی سوبابیس و پشتیبان‌گیری محلی
export const fetchAllScores = async (): Promise<EmployeeScore[]> => {
  let remoteScores: EmployeeScore[] | null = null;
  try {
    const { data, error } = await supabase
      .from('employee_scores')
      .select('*')
      .order('timestamp', { ascending: false });

    if (!error && Array.isArray(data)) {
      remoteScores = data as EmployeeScore[];
      // ذخیره آخرین نسخه سوبابیس در لوکال استوریج
      saveLocalScores(remoteScores);
      return remoteScores;
    }
  } catch (e) {
    // در صورت عدم وجود جدول در سوبابیس، به لوکال استوریج مراجعه می‌شود
  }

  const local = getLocalScores();
  return local;
};

// ثبت امتیاز جدید (توسط مدیر)
export const recordEmployeeScore = async (
  scoreData: Omit<EmployeeScore, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): Promise<EmployeeScore> => {
  const now = Date.now();
  const newScore: EmployeeScore = {
    id: scoreData.id || `score_${now}_${Math.random().toString(36).substring(2, 7)}`,
    employee_id: scoreData.employee_id,
    employee_name: scoreData.employee_name || 'کارمند',
    national_id: scoreData.national_id,
    type: scoreData.type,
    points: Math.abs(Number(scoreData.points) || 1),
    category: scoreData.category || (scoreData.type === 'POSITIVE' ? 'تشویق' : 'تذکر'),
    description: (scoreData.description || '').trim(),
    shamsi_date: scoreData.shamsi_date || getShamsiDate(),
    time: scoreData.time || getShamsiTime(),
    registered_by: scoreData.registered_by || 'مدیر سیستم',
    timestamp: scoreData.timestamp || now
  };

  // ۱. ذخیره فوری در لوکال استوریج و اعلان رویداد
  const current = getLocalScores();
  const updated = [newScore, ...current.filter(s => s.id !== newScore.id)];
  saveLocalScores(updated);

  // ۲. تلاش برای ذخیره در پایگاه داده سوبابیس (در پس‌زمینه بدون بلاک کردن کاربر)
  try {
    await supabase.from('employee_scores').insert([newScore]);
  } catch (e) {
    console.info('Employee score saved locally. Supabase table sync fallback engaged.');
  }

  return newScore;
};

// حذف امتیاز (توسط مدیر)
export const deleteEmployeeScore = async (scoreId: string): Promise<boolean> => {
  const current = getLocalScores();
  const updated = current.filter(s => s.id !== scoreId);
  saveLocalScores(updated);

  try {
    await supabase.from('employee_scores').delete().eq('id', scoreId);
  } catch (e) {
    console.info('Employee score deleted locally.');
  }
  return true;
};

// محاسبه خلاصه امتیازات یک کارمند در یک ماه مشخص شمسی
export const getEmployeeMonthScoresSummary = (
  allScores: EmployeeScore[],
  employeeId: string,
  year: number,
  month: number
): EmployeeMonthScoresSummary => {
  const monthName = shamsiMonthNames[month - 1] || '';

  if (!employeeId) {
    return {
      year,
      month,
      monthName,
      positivePoints: 0,
      negativePoints: 0,
      netPoints: 0,
      positiveCount: 0,
      negativeCount: 0,
      totalCount: 0,
      scores: [],
      evaluationLabel: 'بدون امتیاز'
    };
  }

  const matchingScores = (allScores || []).filter(score => {
    if (score.employee_id !== employeeId) return false;
    const parsed = parseShamsiYearMonthDay(score.shamsi_date);
    if (!parsed) return false;
    return parsed.year === year && parsed.month === month;
  }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  let positivePoints = 0;
  let negativePoints = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  matchingScores.forEach(s => {
    const pts = Math.abs(Number(s.points) || 0);
    if (s.type === 'POSITIVE') {
      positivePoints += pts;
      positiveCount++;
    } else {
      negativePoints += pts;
      negativeCount++;
    }
  });

  const netPoints = positivePoints - negativePoints;

  // سطح ارزیابی کیفی
  let evaluationLabel = 'عادی';
  if (netPoints >= 30) {
    evaluationLabel = 'عملکرد درخشان (A+)';
  } else if (netPoints >= 15) {
    evaluationLabel = 'بسیار خوب و فعال (A)';
  } else if (netPoints > 0) {
    evaluationLabel = 'مثبت و رضایت‌بخش (B)';
  } else if (netPoints === 0) {
    evaluationLabel = matchingScores.length > 0 ? 'خنثی (تراز)' : 'هنوز امتیازی ثبت نشده';
  } else if (netPoints >= -10) {
    evaluationLabel = 'نیازمند دقت بیشتر (C)';
  } else {
    evaluationLabel = 'نیازمند بهبود و تذکر (D)';
  }

  return {
    year,
    month,
    monthName,
    positivePoints,
    negativePoints,
    netPoints,
    positiveCount,
    negativeCount,
    totalCount: matchingScores.length,
    scores: matchingScores,
    evaluationLabel
  };
};

// بذرگذاری اولیه در صورت خالی بودن حافظه برای تجربه کاربری غنی
export const seedInitialScoresIfEmpty = (employeeList: { id: string; name: string; nationalId?: string }[]) => {
  const current = getLocalScores();
  if (current.length > 0 || !employeeList || employeeList.length === 0) return;

  const today = getShamsiDate();
  const now = Date.now();
  const sampleScores: EmployeeScore[] = [];

  // به عنوان مثال یک امتیاز مثبت برای اولین کارمند
  const firstEmp = employeeList[0];
  if (firstEmp) {
    sampleScores.push({
      id: `score_seed_1`,
      employee_id: firstEmp.id,
      employee_name: firstEmp.name,
      national_id: firstEmp.nationalId,
      type: 'POSITIVE',
      points: 15,
      category: 'نظم، انضباط و وقت‌شناسی عالی',
      description: 'حضور به‌موقع در شیفت‌های کاری و رعایت دقیق نظم اداری در طول ماه',
      shamsi_date: today,
      time: '09:30',
      registered_by: 'مدیر سیستم',
      timestamp: now - 3600000 * 24
    });
  }

  if (employeeList.length > 1) {
    const secondEmp = employeeList[1];
    sampleScores.push({
      id: `score_seed_2`,
      employee_id: secondEmp.id,
      employee_name: secondEmp.name,
      national_id: secondEmp.nationalId,
      type: 'POSITIVE',
      points: 20,
      category: 'کیفیت بالا و دقت در انجام وظایف',
      description: 'انجام کامل و باکیفیت پروژه و همکاری شایسته با اعضای تیم',
      shamsi_date: today,
      time: '11:15',
      registered_by: 'مدیر سیستم',
      timestamp: now - 3600000 * 48
    });
  }

  saveLocalScores(sampleScores);
};
