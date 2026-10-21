import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, ChevronRight, ChevronLeft, Clock, 
  CheckCircle2, AlertTriangle, Coffee, Laptop, Palmtree, 
  Sparkles, Filter, Info, X, ChevronDown, Check, ArrowRight,
  Briefcase, Sun, Moon, CalendarCheck, ShieldCheck, UserCheck, Plus
} from 'lucide-react';
import { EmployeeData, AttendanceLog, LeaveRequest, LogType } from './types';
import { 
  getShamsiDate, toEnglishDigits, getDayName,
  jalaliToGregorian, gregorianToJalali, getFirstDayOfWeekInShamsiMonth,
  getDaysInShamsiMonth, parseShamsiDate, formatShamsiDate, formatShamsiLong,
  shamsiMonthNames, shamsiWeekDays
} from './jalali';

// تقویم تعطیلات ثابت تقویم رسمی کشور
const OFFICIAL_IRAN_HOLIDAYS: Record<string, string> = {
  '01/01': 'جشن نوروز / آغاز سال نو',
  '01/02': 'عید نوروز',
  '01/03': 'عید نوروز',
  '01/04': 'عید نوروز',
  '01/12': 'روز جمهوری اسلامی ایران',
  '01/13': 'روز طبیعت (سیزده‌بدر)',
  '03/14': 'رحلت حضرت امام خمینی (ره)',
  '03/15': 'قیام خونین ۱۵ خرداد',
  '11/22': 'پیروزی انقلاب اسلامی',
  '12/29': 'روز ملی شدن صنعت نفت',
  '12/30': 'آخرین روز سال (تعطیل در سال‌های کبیسه)'
};

export interface ShiftDefinition {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  workMinutes: number;
  description: string;
}

export const PRESET_SHIFTS: ShiftDefinition[] = [
  {
    id: 'STANDARD',
    name: 'شیفت کاری',
    startTime: '07:00',
    endTime: '16:30',
    workMinutes: 8 * 60,
    description: '07:00 الی 16:30'
  },
  {
    id: 'MORNING_EARLY',
    name: 'شیفت صبح‌کار',
    startTime: '07:30',
    endTime: '15:30',
    workMinutes: 8 * 60,
    description: '۰۷:۳۰ الی ۱۵:۳۰ (۸ ساعت کارکرد)'
  },
  {
    id: 'EVENING',
    name: 'شیفت عصرکار',
    startTime: '14:00',
    endTime: '22:00',
    workMinutes: 8 * 60,
    description: '۱۴:۰۰ الی ۲۲:۰۰ (۸ ساعت کارکرد)'
  },
  {
    id: 'FLOATING',
    name: 'شیفت شناور منعطف',
    startTime: '07:00 - 09:30',
    endTime: '15:30 - 18:00',
    workMinutes: 8 * 60,
    description: 'ورود شناور و تکمیل حداقل ۸ ساعت کارکرد در روز'
  }
];

interface WorkCalendarProps {
  currentUser: EmployeeData;
  requests: LeaveRequest[];
  onOpenCorrectionModal?: (date: string, defaultType?: LogType) => void;
}

export const WorkCalendar: React.FC<WorkCalendarProps> = ({
  currentUser,
  requests,
  onOpenCorrectionModal
}) => {
  // تاریخ امروز
  const todayStr = useMemo(() => toEnglishDigits(getShamsiDate()), []);
  const todayParsed = useMemo(() => parseShamsiDate(todayStr) || { year: 1403, month: 1, day: 1 }, [todayStr]);

  // ماه و سال انتخاب شده برای نمایش تقویم
  const [selectedYear, setSelectedYear] = useState<number>(todayParsed.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(todayParsed.month);

  // شیفت کاری کاربر (با امکان انتخاب یا شخصی‌سازی و ذخیره در حافظه محلی)
  const [selectedShiftId, setSelectedShiftId] = useState<string>(() => {
    try {
      return localStorage.getItem(`bahar_emp_shift_${currentUser.id}`) || 'STANDARD';
    } catch (e) {
      return 'STANDARD';
    }
  });

  // وضعیت فیلتر سریع تقویم
  const [viewFilter, setViewFilter] = useState<'ALL' | 'WORK_DAYS' | 'HOLIDAYS' | 'LEAVES'>('ALL');

  // روز انتخاب شده برای نمایش مدال جزئیات
  const [selectedDayDetail, setSelectedDayDetail] = useState<{
    dateStr: string;
    dayNum: number;
    dayOfWeekName: string;
    isToday: boolean;
    isFriday: boolean;
    holidayTitle?: string;
    isHoliday: boolean;
    shift: ShiftDefinition;
    logs: AttendanceLog[];
    requests: LeaveRequest[];
    physicalMinutes: number;
    remoteMinutes: number;
    passMinutes: number;
    totalWorkMinutes: number;
    hasIncompleteIssue: boolean;
    issueText?: string;
  } | null>(null);

  // تغییر شیفت و ذخیره در حافظه
  const activeShift = useMemo(() => {
    return PRESET_SHIFTS.find(s => s.id === selectedShiftId) || PRESET_SHIFTS[0];
  }, [selectedShiftId]);

  const handleSelectShift = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    try {
      localStorage.setItem(`bahar_emp_shift_${currentUser.id}`, shiftId);
    } catch (e) {
      console.warn("Storage not allowed:", e);
    }
  };

  // تعطیلات رسمی ذخیره شده توسط مدیر در localStorage
  const customAdminHolidays = useMemo<string[]>(() => {
    try {
      const saved = localStorage.getItem('bahar_official_holidays');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  }, []);

  // ناوبری ماه‌ها
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const handleJumpToCurrentMonth = () => {
    setSelectedYear(todayParsed.year);
    setSelectedMonth(todayParsed.month);
  };

  // سال‌های قابل انتخاب
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = todayParsed.year - 2; y <= todayParsed.year + 2; y++) {
      list.push(y);
    }
    return list;
  }, [todayParsed.year]);

  // زمان به دقیقه
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const clean = toEnglishDigits(timeStr).trim();
    const parts = clean.split(':').map(Number);
    if (parts.length >= 2) {
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    }
    return 0;
  };

  const formatMinutesPersian = (totalMinutes: number): string => {
    if (!totalMinutes || totalMinutes <= 0) return '۰ ساعت';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (m === 0) return `${h} ساعت`;
    if (h === 0) return `${m} دقیقه`;
    return `${h} ساعت و ${m} دقیقه`;
  };

  // پردازش و ایجاد اطلاعات روزهای تقویم ماه جاری
  const monthCalendarData = useMemo(() => {
    const totalDays = getDaysInShamsiMonth(selectedYear, selectedMonth);
    const firstDayOffset = getFirstDayOfWeekInShamsiMonth(selectedYear, selectedMonth); // 0 = Shanbeh, 6 = Friday

    // فیلتر کردن لاگ‌های کاربر برای این ماه
    const startStr = formatShamsiDate(selectedYear, selectedMonth, 1);
    const endStr = formatShamsiDate(selectedYear, selectedMonth, totalDays);

    const logsMap: Record<string, AttendanceLog[]> = {};
    (currentUser.logs || []).forEach(log => {
      const d = toEnglishDigits(log.shamsi_date);
      if (d >= startStr && d <= endStr) {
        if (!logsMap[d]) logsMap[d] = [];
        logsMap[d].push(log);
      }
    });

    // فیلتر کردن درخواست‌های تایید شده برای این ماه
    const reqsMap: Record<string, LeaveRequest[]> = {};
    (requests || []).forEach(req => {
      if (req.status === 'APPROVED' && req.shamsi_date) {
        const d = toEnglishDigits(req.shamsi_date);
        if (d >= startStr && d <= endStr) {
          if (!reqsMap[d]) reqsMap[d] = [];
          reqsMap[d].push(req);
        }
      }
    });

    // آمار تجمیعی ماه
    let totalWorkDaysCount = 0;
    let totalHolidaysCount = 0;
    let daysWithAttendanceCount = 0;
    let totalMonthWorkMinutes = 0;
    let totalMonthRemoteMinutes = 0;
    let totalMonthLeavesCount = 0;

    const days = [];

    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dateStr = formatShamsiDate(selectedYear, selectedMonth, dayNum);
      const isToday = dateStr === todayStr;

      // محاسبه روز هفته میلادی برای یافتن نام روز
      const g = jalaliToGregorian(selectedYear, selectedMonth, dayNum);
      const gDate = new Date(g.gy, g.gm - 1, g.gd);
      const dayOfWeekName = getDayName(gDate);
      const isFriday = dayOfWeekName === 'جمعه';
      const isThursday = dayOfWeekName === 'پنج‌شنبه';

      // بررسی تعطیلات رسمی
      const mmddKey = `${String(selectedMonth).padStart(2, '0')}/${String(dayNum).padStart(2, '0')}`;
      let holidayTitle: string | undefined = undefined;
      
      if (OFFICIAL_IRAN_HOLIDAYS[mmddKey]) {
        holidayTitle = OFFICIAL_IRAN_HOLIDAYS[mmddKey];
      } else if (customAdminHolidays.includes(dateStr)) {
        holidayTitle = 'تعطیل اداری / اعلام شده توسط شرکت';
      }

      const isHoliday = isFriday || !!holidayTitle;
      if (isHoliday) {
        totalHolidaysCount++;
      } else {
        totalWorkDaysCount++;
      }

      // لاگ‌های این روز
      const dayLogs = (logsMap[dateStr] || []).sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      const dayReqs = reqsMap[dateStr] || [];

      // محاسبه ساعت کارکرد فیزیکی
      let dayPhysicalMinutes = 0;
      let activeIn: any = null;
      let consecutiveIns = 0;
      let consecutiveOuts = 0;

      dayLogs.forEach(l => {
        const typeStr = (l.type || '') as string;
        const norm = typeStr.toUpperCase();
        const isIn = norm === 'CLOCK_IN' || norm === 'ورود';
        const isOut = norm === 'CLOCK_OUT' || norm === 'خروج';

        if (isIn) {
          if (activeIn) consecutiveIns++;
          activeIn = l;
        } else if (isOut) {
          if (activeIn) {
            const diff = timeToMinutes(l.time) - timeToMinutes(activeIn.time);
            if (diff > 0) dayPhysicalMinutes += diff;
            activeIn = null;
          } else {
            consecutiveOuts++;
          }
        }
      });

      // بررسی پاس ساعتی ثبت شده
      let dayPassMinutes = 0;
      let activePassStart: any = null;
      let consecutivePassStarts = 0;
      let consecutivePassEnds = 0;

      dayLogs.forEach(l => {
        const typeStr = (l.type || '') as string;
        const norm = typeStr.toUpperCase();
        const isStart = norm === 'HOURLY_LEAVE_START' || norm === 'شروع پاس' || norm === 'پاس';
        const isEnd = norm === 'HOURLY_LEAVE_END' || norm === 'پایان پاس';

        if (isStart) {
          if (activePassStart) consecutivePassStarts++;
          activePassStart = l;
        } else if (isEnd) {
          if (activePassStart) {
            const diff = timeToMinutes(l.time) - timeToMinutes(activePassStart.time);
            if (diff > 0) dayPassMinutes += diff;
            activePassStart = null;
          } else {
            consecutivePassEnds++;
          }
        }
      });

      // درخواست‌های تایید شده دورکاری، مرخصی روزانه، و پاس ساعتی
      let dayRemoteMinutes = 0;
      let dayLeaveDaily = false;
      let hasApprovedCorrection = false;

      dayReqs.forEach(r => {
        if (r.type === 'REMOTE_WORK') {
          if (r.remote_hours !== undefined && r.remote_hours !== null && r.remote_minutes !== undefined && r.remote_minutes !== null) {
            dayRemoteMinutes += (r.remote_hours * 60) + r.remote_minutes;
          } else if (r.amount) {
            dayRemoteMinutes += Math.round(r.amount * 60);
          }
        } else if (r.type === 'DAILY_LEAVE') {
          dayLeaveDaily = true;
          totalMonthLeavesCount++;
        } else if (r.type === 'HOURLY_PASS') {
          dayPassMinutes += Math.round((r.amount || 0) * 60);
        } else if (r.type === 'CORRECT_LOG') {
          hasApprovedCorrection = true;
        }
      });

      const totalDayWorkMinutes = Math.max(0, dayPhysicalMinutes - dayPassMinutes) + dayRemoteMinutes;
      totalMonthWorkMinutes += totalDayWorkMinutes;
      totalMonthRemoteMinutes += dayRemoteMinutes;

      if (totalDayWorkMinutes > 0 || dayLogs.length > 0) {
        daysWithAttendanceCount++;
      }

      // خطایابی تردد ناقص (فقط برای روزهای گذشته یا دیروز)
      let hasIncompleteIssue = false;
      let issueText: string | undefined = undefined;

      if (!isToday && dateStr < todayStr && !isHoliday && !dayLeaveDaily) {
        if (activeIn) {
          hasIncompleteIssue = true;
          issueText = 'خروج ثبت نشده است';
        } else if (consecutiveOuts > 0) {
          hasIncompleteIssue = true;
          issueText = 'ورود ثبت نشده است';
        } else if (activePassStart) {
          hasIncompleteIssue = true;
          issueText = 'پایان پاس ثبت نشده است';
        }
      }

      // استخراج اولین ورود و آخرین خروج
      const firstIn = dayLogs.find(l => {
        const norm = (l.type || '').toUpperCase();
        return norm === 'CLOCK_IN' || norm === 'ورود';
      });
      const lastOut = [...dayLogs].reverse().find(l => {
        const norm = (l.type || '').toUpperCase();
        return norm === 'CLOCK_OUT' || norm === 'خروج';
      });

      days.push({
        dateStr,
        dayNum,
        dayOfWeekName,
        isToday,
        isFriday,
        isThursday,
        holidayTitle,
        isHoliday,
        shift: activeShift,
        logs: dayLogs,
        requests: dayReqs,
        physicalMinutes: dayPhysicalMinutes,
        remoteMinutes: dayRemoteMinutes,
        passMinutes: dayPassMinutes,
        totalWorkMinutes: totalDayWorkMinutes,
        hasIncompleteIssue,
        issueText,
        firstInTime: firstIn?.time,
        lastOutTime: lastOut?.time,
        dayLeaveDaily,
        hasApprovedCorrection,
        isPast: dateStr < todayStr,
        isFuture: dateStr > todayStr
      });
    }

    return {
      totalDays,
      firstDayOffset,
      days,
      stats: {
        totalWorkDaysCount,
        totalHolidaysCount,
        daysWithAttendanceCount,
        totalMonthWorkMinutes,
        totalMonthRemoteMinutes,
        totalMonthLeavesCount,
        formattedTotalWork: formatMinutesPersian(totalMonthWorkMinutes),
        formattedRemote: formatMinutesPersian(totalMonthRemoteMinutes)
      }
    };
  }, [selectedYear, selectedMonth, currentUser.logs, requests, todayStr, activeShift, customAdminHolidays]);

  // سلول‌های فیلتر شده تقویم
  const displayedDays = useMemo(() => {
    if (viewFilter === 'ALL') return monthCalendarData.days;
    if (viewFilter === 'WORK_DAYS') return monthCalendarData.days.filter(d => !d.isHoliday);
    if (viewFilter === 'HOLIDAYS') return monthCalendarData.days.filter(d => d.isHoliday);
    if (viewFilter === 'LEAVES') return monthCalendarData.days.filter(d => d.dayLeaveDaily || d.remoteMinutes > 0 || d.passMinutes > 0);
    return monthCalendarData.days;
  }, [monthCalendarData.days, viewFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* هدر کنترل ماه تقویم و انتخاب شیفت کاری */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <CalendarCheck size={26} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-black text-slate-800">تقویم کاری و شیفت ماهانه</h2>
                <span className="text-xs bg-emerald-50 text-emerald-700 font-black px-3 py-1 rounded-full border border-emerald-200">
                  {shamsiMonthNames[selectedMonth - 1]} {selectedYear}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-400 mt-1">
                مشاهده روزهای کاری، شیفت‌های فعال، تعطیلات رسمی و وضعیت کارکرد روزانه
              </p>
            </div>
          </div>

          {/* تعویض شیفت کاری و ناوبری ماه */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* انتخاب‌گر شیفت کاری پرسنل */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <span className="text-xs font-black text-slate-500 mr-2 flex items-center gap-1">
                <Briefcase size={14} className="text-emerald-600" />
                شیفت کاری:
              </span>
              <select
                value={selectedShiftId}
                onChange={e => handleSelectShift(e.target.value)}
                className="bg-white text-xs font-black text-slate-800 py-1.5 px-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500"
              >
                {PRESET_SHIFTS.map(shift => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.startTime} - {shift.endTime})
                  </option>
                ))}
              </select>
            </div>

            {/* کلیدهای جابجایی ماه */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all"
                title="ماه قبل"
              >
                <ChevronRight size={18} />
              </button>

              <div className="flex items-center gap-2 px-2">
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="bg-transparent text-xs font-black text-slate-800 outline-none cursor-pointer"
                >
                  {shamsiMonthNames.map((mName, idx) => (
                    <option key={idx + 1} value={idx + 1}>{mName}</option>
                  ))}
                </select>
                <span className="text-slate-300">/</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent text-xs font-black text-slate-800 outline-none cursor-pointer font-mono"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all"
                title="ماه بعد"
              >
                <ChevronLeft size={18} />
              </button>
            </div>

            {/* دکمه بازگشت به ماه جاری */}
            {(selectedYear !== todayParsed.year || selectedMonth !== todayParsed.month) && (
              <button
                onClick={handleJumpToCurrentMonth}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-black px-3.5 py-2.5 rounded-2xl transition-all border border-emerald-200"
              >
                <Sparkles size={14} />
                برو به ماه جاری
              </button>
            )}
          </div>
        </div>

        {/* کارت‌های آماری خلاصه ماه در تقویم */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-400">تعداد روزهای ماه</span>
            <div className="text-lg font-black text-slate-800 mt-1 font-mono">{monthCalendarData.totalDays} روز</div>
          </div>

          <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
            <span className="text-[11px] font-bold text-emerald-700">روزهای کاری موظفی</span>
            <div className="text-lg font-black text-emerald-800 mt-1 font-mono">{monthCalendarData.stats.totalWorkDaysCount} روز</div>
          </div>

          <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-100">
            <span className="text-[11px] font-bold text-rose-700">تعطیلات رسمی و جمعه</span>
            <div className="text-lg font-black text-rose-800 mt-1 font-mono">{monthCalendarData.stats.totalHolidaysCount} روز</div>
          </div>

          <div className="bg-sky-50/70 p-3.5 rounded-2xl border border-sky-100">
            <span className="text-[11px] font-bold text-sky-700">روزهای دارای حضور</span>
            <div className="text-lg font-black text-sky-800 mt-1 font-mono">{monthCalendarData.stats.daysWithAttendanceCount} روز</div>
          </div>

          <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-100">
            <span className="text-[11px] font-bold text-indigo-700">کارکرد کل ماه</span>
            <div className="text-sm font-black text-indigo-800 mt-1 truncate" title={monthCalendarData.stats.formattedTotalWork}>
              {monthCalendarData.stats.formattedTotalWork}
            </div>
          </div>

          <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-100">
            <span className="text-[11px] font-bold text-amber-700">مرخصی / دورکاری</span>
            <div className="text-sm font-black text-amber-800 mt-1 truncate">
              {monthCalendarData.stats.totalMonthLeavesCount} روز مرخصی
            </div>
          </div>
        </div>

        {/* نوار اطلاعات شیفت فعال و ساعات کاری */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-xs text-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Sun size={15} />
            </div>
            <div>
              <span className="font-black text-emerald-900 ml-1">برنامه کاری شما:</span>
              <span className="font-bold text-slate-700">{activeShift.name}</span>
              <span className="text-slate-400 mx-2">|</span>
              <span className="font-mono font-bold text-emerald-800">{activeShift.description}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 bg-white/70 px-3 py-1.5 rounded-xl border border-emerald-200">
            <span>شنبه الی چهارشنبه: روز کاری</span>
            <span className="opacity-30">|</span>
            <span>پنج‌شنبه: نیمه‌وقت</span>
            <span className="opacity-30">|</span>
            <span className="text-rose-600">جمعه: تعطیل رسمی</span>
          </div>
        </div>
      </div>

      {/* تقویم ماهانه گرید ۷ ستونه */}
      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-4">
        {/* سرستون روزهای هفته (شنبه تا جمعه) */}
        <div className="grid grid-cols-7 gap-2 text-center pb-2 border-b border-slate-100">
          {shamsiWeekDays.map((w, index) => (
            <div
              key={index}
              className={`py-2 rounded-xl text-xs md:text-sm font-black ${
                w.isWeekend 
                  ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                  : index === 5 
                  ? 'bg-slate-100/70 text-slate-600'
                  : 'bg-slate-50 text-slate-700'
              }`}
            >
              <span className="hidden sm:inline">{w.name}</span>
              <span className="sm:hidden">{w.short}</span>
            </div>
          ))}
        </div>

        {/* خانه‌های تقویم */}
        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {/* پدینگ روزهای قبل از روز اول ماه */}
          {Array.from({ length: monthCalendarData.firstDayOffset }).map((_, i) => (
            <div 
              key={`empty-${i}`} 
              className="min-h-[105px] md:min-h-[125px] rounded-2xl bg-slate-50/50 border border-dashed border-slate-200/60 p-2 opacity-30 pointer-events-none"
            />
          ))}

          {/* روزهای ماه */}
          {monthCalendarData.days.map((day) => {
            const hasLogs = day.logs.length > 0;
            const hasWork = day.totalWorkMinutes > 0;

            return (
              <div
                key={day.dateStr}
                onClick={() => setSelectedDayDetail(day)}
                className={`min-h-[105px] md:min-h-[130px] p-2.5 md:p-3 rounded-2xl border transition-all duration-200 flex flex-col justify-between cursor-pointer select-none group relative overflow-hidden ${
                  day.isToday 
                    ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50/30 shadow-md shadow-emerald-500/10'
                    : day.isFriday 
                    ? 'bg-rose-50/40 border-rose-200/70 hover:border-rose-300 hover:bg-rose-50/80'
                    : day.holidayTitle
                    ? 'bg-rose-50/30 border-rose-200/80 hover:border-rose-300 hover:bg-rose-50/70'
                    : hasWork
                    ? 'bg-white border-slate-200 hover:border-emerald-400 hover:shadow-md'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                {/* هدر روز: شماره روز و تگ امروز/تعطیل */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5">
                    <span 
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs md:text-sm ${
                        day.isToday
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : day.isHoliday
                          ? 'text-rose-600 bg-rose-100/60'
                          : 'text-slate-800 bg-slate-100 group-hover:bg-slate-200'
                      }`}
                    >
                      {day.dayNum}
                    </span>
                    {day.isToday && (
                      <span className="hidden lg:inline text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded-md animate-pulse">
                        امروز
                      </span>
                    )}
                  </div>

                  {/* نشانگر تعطیل / شیفت */}
                  {day.isHoliday ? (
                    <span 
                      className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 truncate max-w-[70px]"
                      title={day.holidayTitle || 'تعطیل'}
                    >
                      {day.isFriday ? 'جمعه' : 'تعطیل'}
                    </span>
                  ) : day.isThursday ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                      پنج‌شنبه
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-slate-400 group-hover:text-slate-600">
                      کاری
                    </span>
                  )}
                </div>

                {/* وضعیت کارکرد و تردد در روز */}
                <div className="my-1.5 flex flex-col gap-1">
                  {/* اگر مرخصی روزانه تایید شده دارد */}
                  {day.dayLeaveDaily ? (
                    <div className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 p-1 rounded-lg border border-amber-200/80 truncate">
                      <Palmtree size={12} className="shrink-0" />
                      <span className="truncate">مرخصی روزانه</span>
                    </div>
                  ) : hasWork ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between text-[10px] font-black text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded-md border border-emerald-200 truncate">
                        <span className="flex items-center gap-1">
                          <Clock size={11} className="text-emerald-600" />
                          <span className="font-mono">
                            {Math.floor(day.totalWorkMinutes / 60)}h {Math.round(day.totalWorkMinutes % 60)}m
                          </span>
                        </span>
                      </div>
                      {day.remoteMinutes > 0 && (
                        <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded truncate">
                          <Laptop size={10} className="shrink-0" />
                          <span>دورکاری: {Math.floor(day.remoteMinutes / 60)}h</span>
                        </div>
                      )}
                    </div>
                  ) : day.isHoliday ? (
                    <div className="text-[10px] font-bold text-rose-500/90 truncate py-1">
                      {day.holidayTitle || 'تعطیل هفتگی'}
                    </div>
                  ) : day.hasIncompleteIssue ? (
                    <div className="flex items-center gap-1 text-[9px] font-black text-rose-700 bg-rose-100/90 p-1 rounded-md border border-rose-200">
                      <AlertTriangle size={11} className="shrink-0" />
                      <span className="truncate">{day.issueText || 'تردد ناقص'}</span>
                    </div>
                  ) : day.isPast ? (
                    <span className="text-[10px] font-bold text-slate-300 py-1">
                      بدون تردد
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 py-1 group-hover:text-emerald-600 transition-colors">
                      {day.shift.startTime} - {day.shift.endTime}
                    </span>
                  )}
                </div>

                {/* فوتر کوچک با زمان ورود/خروج در صورت وجود */}
                <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                  {day.firstInTime ? (
                    <span className="text-emerald-600 font-bold" title={`ورود: ${day.firstInTime}`}>
                      {day.firstInTime}
                    </span>
                  ) : (
                    <span className="opacity-0">-</span>
                  )}
                  {day.lastOutTime ? (
                    <span className="text-slate-600 font-bold" title={`خروج: ${day.lastOutTime}`}>
                      {day.lastOutTime}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* راهنمای رنگ‌ها و نشانه‌ها (Legend) */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-600">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-lg bg-emerald-100 border border-emerald-300" />
              <span>روز دارای حضور و کارکرد</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-lg bg-indigo-100 border border-indigo-300" />
              <span>دورکاری تایید شده</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-lg bg-amber-100 border border-amber-300" />
              <span>مرخصی روزانه</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-lg bg-rose-100 border border-rose-300" />
              <span>تعطیل رسمی و جمعه</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-lg bg-white border-2 border-emerald-500" />
              <span>امروز</span>
            </div>
          </div>

          <span className="text-[11px] text-slate-400">
            برای مشاهده جزئیات تردد و ثبت اصلاحیه روی روز مورد نظر کلیک کنید
          </span>
        </div>
      </div>

      {/* مودال جزئیات روز انتخابی تقویم */}
      {selectedDayDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* هدر مودال */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-mono font-black text-lg ${
                  selectedDayDetail.isToday 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                    : selectedDayDetail.isHoliday 
                    ? 'bg-rose-100 text-rose-700' 
                    : 'bg-slate-100 text-slate-800'
                }`}>
                  {selectedDayDetail.dayNum}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-800">
                      {selectedDayDetail.dayOfWeekName}، {selectedDayDetail.dayNum} {shamsiMonthNames[selectedMonth - 1]} {selectedYear}
                    </h3>
                    {selectedDayDetail.isToday && (
                      <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">امروز</span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">
                    {selectedDayDetail.isHoliday 
                      ? selectedDayDetail.holidayTitle || 'تعطیل هفتگی (جمعه)'
                      : `روز کاری • ${selectedDayDetail.shift.name}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDayDetail(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* بدنه اطلاعات روز */}
            <div className="space-y-4 my-6">
              {/* باکس وضعیت شیفت */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-500">شیفت کاری مورد انتظار:</span>
                  <div className="font-black text-slate-800 text-sm mt-0.5">{selectedDayDetail.shift.name}</div>
                  <div className="text-xs font-mono font-bold text-emerald-700 mt-0.5">
                    ساعات موظفی: {selectedDayDetail.shift.startTime} الی {selectedDayDetail.shift.endTime}
                  </div>
                </div>
                <div className="text-left font-mono">
                  <span className="text-[10px] font-black text-slate-400 block">موظفی استاندارد</span>
                  <span className="text-sm font-black text-slate-700">۸:۰۰ ساعت</span>
                </div>
              </div>

              {/* کارت خلاصه کارکرد این روز */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 block">کارکرد کل</span>
                  <span className="text-sm font-black text-emerald-900 font-mono mt-1 block">
                    {formatMinutesPersian(selectedDayDetail.totalWorkMinutes)}
                  </span>
                </div>

                <div className="p-3 bg-sky-50 rounded-2xl border border-sky-100 text-center">
                  <span className="text-[10px] font-bold text-sky-700 block">حضور فیزیکی</span>
                  <span className="text-sm font-black text-sky-900 font-mono mt-1 block">
                    {formatMinutesPersian(selectedDayDetail.physicalMinutes)}
                  </span>
                </div>

                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                  <span className="text-[10px] font-bold text-indigo-700 block">دورکاری</span>
                  <span className="text-sm font-black text-indigo-900 font-mono mt-1 block">
                    {formatMinutesPersian(selectedDayDetail.remoteMinutes)}
                  </span>
                </div>
              </div>

              {/* هشدار تردد ناقص در صورت وجود */}
              {selectedDayDetail.hasIncompleteIssue && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold">
                  <AlertTriangle size={18} className="text-rose-600 shrink-0" />
                  <div>
                    <span className="font-black">هشدار تردد ناقص: </span>
                    {selectedDayDetail.issueText}
                  </div>
                </div>
              )}

              {/* لیست ترددهای ثبت شده در این روز */}
              <div>
                <h4 className="text-xs font-black text-slate-700 mb-2.5 flex items-center gap-1.5">
                  <Clock size={15} className="text-emerald-600" />
                  ترددهای ثبت‌شده در این تاریخ ({selectedDayDetail.logs.length} مورد):
                </h4>

                {selectedDayDetail.logs.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs text-slate-400 font-bold border border-slate-100">
                    هیچ تردد فیزیکی برای این روز در سیستم ثبت نشده است.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDayDetail.logs.map((log, index) => {
                      const typeStr = (log.type || '').toUpperCase();
                      const isIn = typeStr === 'CLOCK_IN' || typeStr === 'ورود';
                      const isOut = typeStr === 'CLOCK_OUT' || typeStr === 'خروج';
                      const isPassStart = typeStr === 'HOURLY_LEAVE_START' || typeStr === 'شروع پاس';
                      const isPassEnd = typeStr === 'HOURLY_LEAVE_END' || typeStr === 'پایان پاس';

                      return (
                        <div
                          key={log.id || index}
                          className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200/60 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              isIn ? 'bg-emerald-500' : isOut ? 'bg-rose-500' : 'bg-amber-500'
                            }`} />
                            <span className="text-xs font-black text-slate-800">
                              {isIn ? 'ورود' : isOut ? 'خروج' : isPassStart ? 'شروع پاس' : isPassEnd ? 'پایان پاس' : log.type}
                            </span>
                            {log.is_manual && (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                                اصلاحیه دستی
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-black text-xs text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                            {log.time}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* درخواست‌های تایید شده برای این روز */}
              {selectedDayDetail.requests.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-slate-700 mb-2.5 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    درخواست‌های تایید شده این تاریخ:
                  </h4>
                  <div className="space-y-2">
                    {selectedDayDetail.requests.map((r) => (
                      <div key={r.id} className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs flex items-center justify-between">
                        <div>
                          <span className="font-black text-emerald-900 ml-2">
                            {r.type === 'DAILY_LEAVE' ? 'مرخصی روزانه' : r.type === 'REMOTE_WORK' ? 'دورکاری' : r.type === 'HOURLY_PASS' ? 'پاس ساعتی' : 'اصلاح تردد'}
                          </span>
                          <span className="text-slate-600 font-bold">
                            {r.description?.replace(/\[[^\]]+\]/g, '').trim() || 'بدون توضیحات'}
                          </span>
                        </div>
                        <span className="font-mono font-black text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                          {r.type === 'DAILY_LEAVE' ? `${r.amount} روز` : `${r.amount} ساعت`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* فوتر مدال و دکمه درخواست اصلاح */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedDayDetail(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors"
              >
                بستن
              </button>

              {onOpenCorrectionModal && (
                <button
                  onClick={() => {
                    const date = selectedDayDetail.dateStr;
                    setSelectedDayDetail(null);
                    onOpenCorrectionModal(date, LogType.CLOCK_IN);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md shadow-emerald-600/20"
                >
                  <Plus size={16} />
                  ثبت یا اصلاح تردد برای این روز
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkCalendar;
