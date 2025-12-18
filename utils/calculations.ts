
import { AttendanceLog, LogType, CalculationResult } from '../types';

export const calculateWorkDetails = (logs: AttendanceLog[]): CalculationResult => {
  let totalMinutes = 0;
  let holidayMinutes = 0;
  let leaveMinutes = 0;
  
  // دسته‌بندی لاگ‌ها بر اساس تاریخ
  const logsByDate: Record<string, AttendanceLog[]> = {};
  logs.forEach(log => {
    if (!logsByDate[log.shamsiDate]) logsByDate[log.shamsiDate] = [];
    logsByDate[log.shamsiDate].push(log);
  });

  Object.entries(logsByDate).forEach(([date, dayLogs]) => {
    // مرتب‌سازی بر اساس زمان
    const sortedLogs = dayLogs.sort((a, b) => a.timestamp - b.timestamp);
    let dayWorkMinutes = 0;
    let dayLeaveMinutes = 0;

    for (let i = 0; i < sortedLogs.length; i++) {
      const current = sortedLogs[i];
      const next = sortedLogs[i + 1];

      if (!next) break;

      const diff = (next.timestamp - current.timestamp) / (1000 * 60);

      if (current.type === LogType.CLOCK_IN && next.type === LogType.CLOCK_OUT) {
        dayWorkMinutes += diff;
        i++; // پرش به جفت بعدی
      } else if (current.type === LogType.HOURLY_LEAVE_START && next.type === LogType.HOURLY_LEAVE_END) {
        dayLeaveMinutes += diff;
        i++;
      }
    }

    totalMinutes += dayWorkMinutes;
    leaveMinutes += dayLeaveMinutes;

    // چک کردن جمعه (تعطیل‌کاری)
    const dateObj = new Date(sortedLogs[0].timestamp);
    if (dateObj.getDay() === 5) {
      holidayMinutes += dayWorkMinutes;
    }
  });

  // اضافه‌کاری: فراتر از ۸ ساعت در روز (ساده‌سازی شده برای این نسخه)
  // در محاسبات پیشرفته باید بر اساس ۴۴ ساعت در هفته باشد
  const overtimeMinutes = totalMinutes > (logs.length * 480 / 2) ? totalMinutes * 0.2 : 0; 

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
    formattedOvertime: formatTime(totalMinutes * 0.1), // پیش‌فرض ۱۰ درصد اضافه‌کاری برای نمایش
    formattedHoliday: formatTime(holidayMinutes)
  };
};
