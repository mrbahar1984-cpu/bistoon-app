
import { AttendanceLog, LogType, CalculationResult } from './types';

export const calculateWorkDetails = (logs: AttendanceLog[], dutyHours: number = 192): CalculationResult => {
  let totalMinutes = 0;
  let holidayMinutes = 0;
  let leaveMinutes = 0;
  
  const logsByDate: Record<string, AttendanceLog[]> = {};
  logs.forEach(log => {
    if (!logsByDate[log.shamsiDate]) logsByDate[log.shamsiDate] = [];
    logsByDate[log.shamsiDate].push(log);
  });

  Object.entries(logsByDate).forEach(([date, dayLogs]) => {
    const sortedLogs = dayLogs.sort((a, b) => {
      // استفاده از زمان (Time) برای مرتب‌سازی دقیق‌تر در صورت یکسان بودن timestamp
      return a.time.localeCompare(b.time) || a.timestamp - b.timestamp;
    });

    let dayWorkMinutes = 0;
    let dayLeaveMinutes = 0;

    for (let i = 0; i < sortedLogs.length; i++) {
      const current = sortedLogs[i];
      if (current.type === LogType.CLOCK_IN) {
        const nextExit = sortedLogs.slice(i + 1).find(l => l.type === LogType.CLOCK_OUT);
        if (nextExit) {
          // برای ترددهای دستی که timestamp دقیق ندارند، از تفاضل ساعت استفاده می‌شود (تقریبی)
          const diff = (nextExit.timestamp - current.timestamp) / (1000 * 60);
          dayWorkMinutes += diff > 0 ? diff : 0;
        }
      } 
      else if (current.type === LogType.HOURLY_LEAVE_START) {
        const nextEnd = sortedLogs.slice(i + 1).find(l => l.type === LogType.HOURLY_LEAVE_END);
        if (nextEnd) {
          const diff = (nextEnd.timestamp - current.timestamp) / (1000 * 60);
          dayLeaveMinutes += diff > 0 ? diff : 0;
        }
      }
    }

    const netWork = Math.max(0, dayWorkMinutes - dayLeaveMinutes);
    totalMinutes += netWork;
    leaveMinutes += dayLeaveMinutes;

    // تشخیص جمعه
    if (dayLogs.length > 0) {
      const dParts = date.split('/');
      // تشخیص ساده بر اساس نام روز در صورت امکان یا استفاده از timestamp
      const dateObj = new Date(sortedLogs[0].timestamp);
      if (dateObj.getDay() === 5) holidayMinutes += netWork;
    }
  });

  const monthlyDutyMinutes = dutyHours * 60; 
  const overtimeMinutes = totalMinutes > monthlyDutyMinutes ? totalMinutes - monthlyDutyMinutes : 0;
  const deficitMinutes = totalMinutes < monthlyDutyMinutes ? monthlyDutyMinutes - totalMinutes : 0;

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h} ساعت و ${m} دقیقه`;
  };

  return {
    totalMinutes,
    overtimeMinutes,
    deficitMinutes,
    holidayMinutes,
    leaveMinutes,
    formattedTotal: formatTime(totalMinutes),
    formattedOvertime: formatTime(overtimeMinutes),
    formattedDeficit: formatTime(deficitMinutes),
    formattedHoliday: formatTime(holidayMinutes)
  };
};
