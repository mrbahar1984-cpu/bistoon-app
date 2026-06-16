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
    // Fix: Using shamsi_date as defined in types.ts instead of shamsiDate
    if (!logsByDate[log.shamsi_date]) logsByDate[log.shamsi_date] = [];
    logsByDate[log.shamsi_date].push(log);
  });

  // ۲. محاسبه فواصل زمانی برای هر روز
  Object.values(logsByDate).forEach(dayLogs => {
    const sorted = [...dayLogs].sort((a, b) => a.timestamp - b.timestamp);
    
    // الف) محاسبه مجموع فواصل ورود تا خروج (تجمیع ترددهای متعدد در یک روز)
    let dayPhysicalMinutes = 0;
    let activeIn: any = null;
    sorted.forEach(l => {
      const typeStr = l.type as string;
      const typeNormalized = typeStr.toUpperCase();
      const isIn = typeNormalized === 'CLOCK_IN' || typeStr === 'ورود';
      const isOut = typeNormalized === 'CLOCK_OUT' || typeStr === 'خروج';
      
      if (isIn) {
        if (!activeIn) {
          activeIn = l;
        }
      } else if (isOut) {
        if (activeIn) {
          const diff = (l.timestamp - activeIn.timestamp) / 60000;
          if (diff > 0) {
            dayPhysicalMinutes += diff;
          }
          activeIn = null;
        }
      }
    });
    physicalWorkMinutes += dayPhysicalMinutes;

    // ب) محاسبه پاس‌های ساعتی ثبت شده دستی (دکمه‌های شروع/پایان پاس)
    let dayPassMinutes = 0;
    let activePassStart: any = null;
    sorted.forEach(l => {
      const typeStr = l.type as string;
      const typeNormalized = typeStr.toUpperCase();
      const isStart = typeNormalized === 'HOURLY_LEAVE_START' || typeStr === 'شروع پاس' || typeStr === 'پاس';
      const isEnd = typeNormalized === 'HOURLY_LEAVE_END' || typeStr === 'پایان پاس';
      
      if (isStart) {
        if (!activePassStart) {
          activePassStart = l;
        }
      } else if (isEnd) {
        if (activePassStart) {
          const diff = (l.timestamp - activePassStart.timestamp) / 60000;
          if (diff > 0) {
            dayPassMinutes += diff;
          }
          activePassStart = null;
        }
      }
    });
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
