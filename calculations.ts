
import { AttendanceLog, LogType, CalculationResult, LeaveRequest } from './types';

/**
 * محاسبه کارکرد بر اساس مجموع فواصل زمانی بین هر ورود و خروج
 * و کسر پاس‌های ساعتی تایید شده یا ثبت شده
 */
export const calculateWorkDetails = (
  logs: AttendanceLog[], 
  dutyHours: number = 192,
  requests: LeaveRequest[] = []
): CalculationResult => {
  let physicalWorkMinutes = 0;
  let passMinutes = 0;
  let remoteMinutes = 0;
  let dailyLeaveDays = 0;

  // ۱. گروه‌بندی لاگ‌ها بر اساس تاریخ شمسی
  const logsByDate: Record<string, AttendanceLog[]> = {};
  logs.forEach(log => {
    if (!logsByDate[log.shamsiDate]) logsByDate[log.shamsiDate] = [];
    logsByDate[log.shamsiDate].push(log);
  });

  // ۲. محاسبه فواصل زمانی برای هر روز
  Object.values(logsByDate).forEach(dayLogs => {
    const sorted = dayLogs.sort((a, b) => a.timestamp - b.timestamp);
    
    // الف) محاسبه مجموع فواصل ورود تا خروج (تجمیع ترددهای متعدد در یک روز)
    let dayPhysicalMinutes = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].type === LogType.CLOCK_IN) {
        // پیدا کردن اولین خروج بعد از این ورود
        const nextExit = sorted.slice(i + 1).find(l => l.type === LogType.CLOCK_OUT);
        if (nextExit) {
          dayPhysicalMinutes += (nextExit.timestamp - sorted[i].timestamp) / 60000;
        }
      }
    }
    physicalWorkMinutes += dayPhysicalMinutes;

    // ب) محاسبه پاس‌های ساعتی ثبت شده دستی (دکمه‌های شروع/پایان پاس)
    let dayPassMinutes = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].type === LogType.HOURLY_LEAVE_START) {
        const nextEnd = sorted.slice(i + 1).find(l => l.type === LogType.HOURLY_LEAVE_END);
        if (nextEnd) {
          dayPassMinutes += (nextEnd.timestamp - sorted[i].timestamp) / 60000;
        }
      }
    }
    passMinutes += dayPassMinutes;
  });

  // ۳. اعمال درخواست‌های تایید شده (دورکاری، مرخصی روزانه، پاس ساعتی سیستمی)
  requests.filter(r => r.status === 'APPROVED').forEach(req => {
    if (req.type === 'REMOTE_WORK') {
      remoteMinutes += req.amount * 60;
    } else if (req.type === 'HOURLY_PASS') {
      // پاس‌های ساعتی که از طریق فرم درخواست تایید شده‌اند
      passMinutes += req.amount * 60;
    } else if (req.type === 'DAILY_LEAVE') {
      dailyLeaveDays += 1;
    }
  });

  // ۴. کارکرد خالص: (مجموع حضور فیزیکی - مجموع پاس‌ها) + دورکاری
  const netWorkMinutes = Math.max(0, (physicalWorkMinutes - passMinutes) + remoteMinutes);

  // ۵. تعدیل موظفی: کسر ۸ ساعت به ازای هر روز مرخصی روزانه تایید شده
  const adjustedDutyMinutes = Math.max(0, (dutyHours * 60) - (dailyLeaveDays * 8 * 60));

  // ۶. محاسبه اضافه‌کار و کسر‌کار نسبت به موظفی تعدیل شده
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
    totalDailyLeaveDays: dailyLeaveDays,
    adjustedDutyMinutes,
    overtimeMinutes: overtime,
    deficitMinutes: deficit,
    formattedTotalWork: format(netWorkMinutes),
    formattedOvertime: format(overtime),
    formattedDeficit: deficit > 0 ? `(${format(deficit)})` : '0'
  };
};
