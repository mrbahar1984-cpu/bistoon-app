
import { AttendanceLog, LogType, CalculationResult, LeaveRequest } from './types';

export const calculateWorkDetails = (
  logs: AttendanceLog[], 
  dutyHours: number = 192,
  requests: LeaveRequest[] = []
): CalculationResult => {
  let totalMinutes = 0;
  let holidayMinutes = 0;
  let leaveMinutes = 0;
  let remoteMinutes = 0;
  let dailyLeaveDays = 0;
  
  // ۱. محاسبه ساعات حضور فیزیکی
  const logsByDate: Record<string, AttendanceLog[]> = {};
  logs.forEach(log => {
    if (!logsByDate[log.shamsiDate]) logsByDate[log.shamsiDate] = [];
    logsByDate[log.shamsiDate].push(log);
  });

  Object.entries(logsByDate).forEach(([date, dayLogs]) => {
    const sortedLogs = dayLogs.sort((a, b) => a.timestamp - b.timestamp);
    let dayWorkMinutes = 0;
    let dayLeaveMinutes = 0;

    for (let i = 0; i < sortedLogs.length; i++) {
      const current = sortedLogs[i];
      if (current.type === LogType.CLOCK_IN) {
        const nextExit = sortedLogs.slice(i + 1).find(l => l.type === LogType.CLOCK_OUT);
        if (nextExit) {
          dayWorkMinutes += (nextExit.timestamp - current.timestamp) / (1000 * 60);
        }
      } 
      else if (current.type === LogType.HOURLY_LEAVE_START) {
        const nextEnd = sortedLogs.slice(i + 1).find(l => l.type === LogType.HOURLY_LEAVE_END);
        if (nextEnd) {
          dayLeaveMinutes += (nextEnd.timestamp - current.timestamp) / (1000 * 60);
        }
      }
    }

    const netWork = Math.max(0, dayWorkMinutes - dayLeaveMinutes);
    totalMinutes += netWork;
    leaveMinutes += dayLeaveMinutes;

    // تشخیص جمعه
    const dateObj = new Date(sortedLogs[0].timestamp);
    if (dateObj.getDay() === 5) holidayMinutes += netWork;
  });

  // ۲. اعمال دورکاری‌های تایید شده
  requests.filter(r => r.type === 'REMOTE_WORK' && r.status === 'APPROVED').forEach(r => {
    const rMins = r.amount * 60;
    remoteMinutes += rMins;
    totalMinutes += rMins;
  });

  // ۳. اعمال مرخصی‌های روزانه (تعدیل موظفی)
  const approvedDailyLeaves = requests.filter(r => r.type === 'DAILY_LEAVE' && r.status === 'APPROVED');
  dailyLeaveDays = approvedDailyLeaves.length;
  
  // طبق فایل پایتون: موظفی تعدیل شده = موظفی کل - (روزهای مرخصی * ۸ ساعت)
  const dailyLeaveMinutes = dailyLeaveDays * 8 * 60;
  const adjustedDutyMinutes = Math.max(0, (dutyHours * 60) - dailyLeaveMinutes);

  // ۴. محاسبه اضافه‌کار و کسر‌کار نسبت به موظفی تعدیل شده
  const overtimeMinutes = totalMinutes > adjustedDutyMinutes ? totalMinutes - adjustedDutyMinutes : 0;
  const deficitMinutes = totalMinutes < adjustedDutyMinutes ? adjustedDutyMinutes - totalMinutes : 0;

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  };

  return {
    totalMinutes,
    overtimeMinutes,
    deficitMinutes,
    holidayMinutes,
    leaveMinutes,
    remoteMinutes,
    dailyLeaveDays,
    adjustedDutyMinutes,
    formattedTotal: formatTime(totalMinutes),
    formattedOvertime: formatTime(overtimeMinutes),
    formattedDeficit: deficitMinutes > 0 ? `(${formatTime(deficitMinutes)})` : '0',
    formattedHoliday: formatTime(holidayMinutes),
    formattedRemote: formatTime(remoteMinutes)
  };
};
