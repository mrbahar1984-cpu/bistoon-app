import { AttendanceLog, LogType, CalculationResult, LeaveRequest } from './types';

/**
 * تشخیص ترددهای ناقص در یک روز
 * منطق: جفت بودن ورود و خروج‌ها را بررسی می‌کند
 */
export const checkIncompleteLogs = (dayLogs: AttendanceLog[]): boolean => {
  const sorted = dayLogs.sort((a, b) => a.timestamp - b.timestamp);
  let state: 'IN' | 'OUT' = 'OUT';
  
  for (const log of sorted) {
    if (log.type === LogType.CLOCK_IN) {
      if (state === 'IN') return true; // دو ورود بدون خروج میانی
      state = 'IN';
    } else if (log.type === LogType.CLOCK_OUT) {
      if (state === 'OUT') return true; // خروج بدون ورود قبلی
      state = 'OUT';
    }
  }
  return state === 'IN'; // اگر روز با وضعیت ورود تمام شده باشد
};

export const calculateWorkDetails = (
  logs: AttendanceLog[], 
  dutyHours: number = 192,
  requests: LeaveRequest[] = []
): CalculationResult & { isIncomplete?: boolean } => {
  let physicalWorkMinutes = 0;
  let passMinutes = 0;
  let remoteMinutes = 0;
  let dailyLeaveDays = 0;
  let hasIncomplete = false;

  // گروه‌بندی لاگ‌ها بر اساس تاریخ
  const logsByDate: Record<string, AttendanceLog[]> = {};
  logs.forEach(log => {
    if (!logsByDate[log.shamsiDate]) logsByDate[log.shamsiDate] = [];
    logsByDate[log.shamsiDate].push(log);
  });

  // محاسبه کارکرد روزانه و بررسی نقص تردد
  Object.values(logsByDate).forEach(dayLogs => {
    if (checkIncompleteLogs(dayLogs)) hasIncomplete = true;
    
    const sorted = dayLogs.sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].type === LogType.CLOCK_IN) {
        const nextExit = sorted.slice(i + 1).find(l => l.type === LogType.CLOCK_OUT);
        if (nextExit) {
          physicalWorkMinutes += (nextExit.timestamp - sorted[i].timestamp) / (1000 * 60);
          i = sorted.indexOf(nextExit);
        }
      }
    }
  });

  // اعمال درخواست‌های تایید شده
  requests.filter(r => r.status === 'APPROVED').forEach(req => {
    if (req.type === 'REMOTE_WORK') remoteMinutes += req.amount * 60;
    else if (req.type === 'HOURLY_PASS') passMinutes += req.amount * 60;
    else if (req.type === 'DAILY_LEAVE') dailyLeaveDays += 1;
  });

  const netWorkMinutes = Math.max(0, (physicalWorkMinutes - passMinutes) + remoteMinutes);
  const adjustedDutyMinutes = Math.max(0, (dutyHours * 60) - (dailyLeaveDays * 8 * 60));

  const overtime = netWorkMinutes > adjustedDutyMinutes ? netWorkMinutes - adjustedDutyMinutes : 0;
  const deficit = netWorkMinutes < adjustedDutyMinutes ? adjustedDutyMinutes - netWorkMinutes : 0;

  const format = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  };

  return {
    totalWorkMinutes: netWorkMinutes,
    totalPassMinutes: passMinutes,
    totalRemoteMinutes: remoteMinutes,
    dailyLeaveDays,
    overtimeMinutes: overtime,
    deficitMinutes: deficit,
    formattedWork: format(netWorkMinutes),
    formattedOvertime: format(overtime),
    formattedDeficit: format(deficit),
    isIncomplete: hasIncomplete
  };
};