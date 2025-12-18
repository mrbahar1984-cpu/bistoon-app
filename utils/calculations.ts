
import { AttendanceLog, LogType, CalculationResult } from '../types';

export const calculateWorkDetails = (logs: AttendanceLog[]): CalculationResult => {
  let totalMinutes = 0;
  let holidayMinutes = 0;
  let leaveMinutes = 0;
  
  // دسته‌بندی لاگ‌ها بر اساس تاریخ شمسی
  const logsByDate: Record<string, AttendanceLog[]> = {};
  logs.forEach(log => {
    if (!logsByDate[log.shamsiDate]) logsByDate[log.shamsiDate] = [];
    logsByDate[log.shamsiDate].push(log);
  });

  Object.entries(logsByDate).forEach(([date, dayLogs]) => {
    // مرتب‌سازی لاگ‌های یک روز بر اساس زمان ثبت
    const sortedLogs = dayLogs.sort((a, b) => a.timestamp - b.timestamp);
    let dayWorkMinutes = 0;
    let dayLeaveMinutes = 0;

    // پیدا کردن جفت‌های ورود و خروج
    for (let i = 0; i < sortedLogs.length; i++) {
      const current = sortedLogs[i];
      
      // اگر ورود بود، بگرد دنبال اولین خروج بعد از آن
      if (current.type === LogType.CLOCK_IN) {
        const nextExit = sortedLogs.slice(i + 1).find(l => l.type === LogType.CLOCK_OUT);
        if (nextExit) {
          dayWorkMinutes += (nextExit.timestamp - current.timestamp) / (1000 * 60);
        }
      } 
      // اگر شروع مرخصی بود، بگرد دنبال پایان آن
      else if (current.type === LogType.HOURLY_LEAVE_START) {
        const nextEnd = sortedLogs.slice(i + 1).find(l => l.type === LogType.HOURLY_LEAVE_END);
        if (nextEnd) {
          dayLeaveMinutes += (nextEnd.timestamp - current.timestamp) / (1000 * 60);
        }
      }
    }

    // کسر مرخصی ساعتی از کارکرد کل
    const netWork = Math.max(0, dayWorkMinutes - dayLeaveMinutes);
    totalMinutes += netWork;
    leaveMinutes += dayLeaveMinutes;

    // تشخیص جمعه (تعطیل‌کاری)
    const dateObj = new Date(sortedLogs[0].timestamp);
    if (dateObj.getDay() === 5) { // 5 در جاوااسکریپت یعنی جمعه
      holidayMinutes += netWork;
    }
  });

  // محاسبه اضافه‌کاری (ساعت موظفی استاندارد ماهانه معمولاً ۱۹۲ ساعت است)
  const monthlyDutyMinutes = 192 * 60; 
  const overtimeMinutes = totalMinutes > monthlyDutyMinutes ? totalMinutes - monthlyDutyMinutes : 0;

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h} ساعت و ${m} دقیقه`;
  };

  return {
    totalMinutes,
    overtimeMinutes,
    holidayMinutes,
    leaveMinutes,
    formattedTotal: formatTime(totalMinutes),
    formattedOvertime: formatTime(overtimeMinutes),
    formattedHoliday: formatTime(holidayMinutes)
  };
};
