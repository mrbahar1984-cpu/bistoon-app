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

export interface MonthPerformanceStats {
  year: number;
  month: number;
  monthName: string;
  startDate: string;
  endDate: string;
  totalWorkMinutes: number;
  totalPhysicalMinutes: number;
  totalRemoteMinutes: number;
  totalPassMinutes: number;
  dailyLeaveDays: number;
  formattedWork: string;
  formattedPhysicalWork: string;
  formattedRemote: string;
  formattedPass: string;
  hasActivity: boolean;
}

/**
 * محاسبه خلاصه عملکرد کاربر برای یک ماه مشخص (شمسی)
 * قابل استفاده برای ماه جاری در میز کار و ماه‌های قبل در بخش تاریخچه
 */
export const calculateMonthPerformance = (
  logs: AttendanceLog[],
  requests: LeaveRequest[],
  year: number,
  month: number
): MonthPerformanceStats => {
  // توابع کمکی تبدیل زمان و ارقام
  const toEn = (str: string): string => {
    if (!str) return "";
    const p = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
    let res = String(str);
    for (let i = 0; i < 10; i++) res = res.replace(p[i], i.toString());
    return res;
  };

  const getDaysInMonth = (y: number, m: number): number => {
    if (m <= 6) return 31;
    if (m <= 11) return 30;
    // کبیسه شمسی تقریبی
    const isLeap = [1, 5, 9, 13, 17, 22, 26, 30].includes(y % 33);
    return isLeap ? 30 : 29;
  };

  const monthNames = [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
  ];

  const totalDays = getDaysInMonth(year, month);
  const startDate = `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/01`;
  const endDate = `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(totalDays).padStart(2, '0')}`;
  const startStandard = toEn(startDate);
  const endStandard = toEn(endDate);
  const monthName = monthNames[month - 1] || '';

  const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const parts = toEn(timeStr).split(':').map(Number);
    if (parts.length >= 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
    return 0;
  };

  // ۱. حضور فیزیکی
  const empLogs = (logs || []).filter(l => {
    const d = toEn(l.shamsi_date);
    return d >= startStandard && d <= endStandard;
  });

  const logsByDate: Record<string, AttendanceLog[]> = {};
  empLogs.forEach(l => {
    const standardDate = toEn(l.shamsi_date);
    if (!logsByDate[standardDate]) logsByDate[standardDate] = [];
    logsByDate[standardDate].push(l);
  });

  let totalWorkMinutes = 0;
  let totalPassLogMinutes = 0;

  Object.values(logsByDate).forEach(dayLogs => {
    const sorted = [...dayLogs].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

    let dayPhysicalMinutes = 0;
    let activeIn: any = null;
    sorted.forEach(l => {
      const typeStr = (l.type || '') as string;
      const typeNormalized = typeStr.toUpperCase();
      const isIn = typeNormalized === 'CLOCK_IN' || typeNormalized === 'ورود';
      const isOut = typeNormalized === 'CLOCK_OUT' || typeNormalized === 'خروج';

      if (isIn) {
        if (!activeIn) activeIn = l;
      } else if (isOut) {
        if (activeIn) {
          const diff = timeToMinutes(l.time) - timeToMinutes(activeIn.time);
          if (diff > 0) dayPhysicalMinutes += diff;
          activeIn = null;
        }
      }
    });
    totalWorkMinutes += dayPhysicalMinutes;

    let dayPassMinutes = 0;
    let activePassStart: any = null;
    sorted.forEach(l => {
      const typeStr = (l.type || '') as string;
      const typeNormalized = typeStr.toUpperCase();
      const isStart = typeNormalized === 'HOURLY_LEAVE_START' || typeNormalized === 'شروع پاس' || typeNormalized === 'پاس';
      const isEnd = typeNormalized === 'HOURLY_LEAVE_END' || typeNormalized === 'پایان پاس';

      if (isStart) {
        if (!activePassStart) activePassStart = l;
      } else if (isEnd) {
        if (activePassStart) {
          const diff = timeToMinutes(l.time) - timeToMinutes(activePassStart.time);
          if (diff > 0) dayPassMinutes += diff;
          activePassStart = null;
        }
      }
    });
    totalPassLogMinutes += dayPassMinutes;
  });

  // ۲. دورکاری تایید شده
  const approvedRemoteWorks = (requests || []).filter(r => 
    r.status === 'APPROVED' &&
    r.type === 'REMOTE_WORK' &&
    toEn(r.shamsi_date) >= startStandard &&
    toEn(r.shamsi_date) <= endStandard
  );

  let totalRemoteMinutes = 0;
  approvedRemoteWorks.forEach(r => {
    if (r.remote_hours !== undefined && r.remote_hours !== null && r.remote_minutes !== undefined && r.remote_minutes !== null) {
      totalRemoteMinutes += (r.remote_hours * 60) + r.remote_minutes;
    } else if (r.amount) {
      totalRemoteMinutes += Math.round(r.amount * 60);
    }
  });

  // ۳. پاس ساعتی تایید شده
  const personalPasses = (requests || []).filter(r => 
    r.status === 'APPROVED' &&
    r.type === 'HOURLY_PASS' &&
    toEn(r.shamsi_date) >= startStandard &&
    toEn(r.shamsi_date) <= endStandard
  );
  const totalPassReqMinutes = personalPasses.reduce((sum, r) => sum + (r.amount * 60 || 0), 0);
  const totalPassOverallMinutes = totalPassLogMinutes + totalPassReqMinutes;

  // ۴. مرخصی روزانه تایید شده
  const dailyLeaves = (requests || []).filter(r => 
    r.status === 'APPROVED' &&
    r.type === 'DAILY_LEAVE' &&
    toEn(r.shamsi_date) >= startStandard &&
    toEn(r.shamsi_date) <= endStandard
  );
  const totalDailyLeaveDays = dailyLeaves.reduce((sum, r) => sum + (r.amount || 1), 0);

  const formatMinutesToPersian = (totalMins: number): string => {
    if (!totalMins || totalMins <= 0) return '۰ ساعت';
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    return m === 0 ? `${h} ساعت` : `${h} ساعت و ${m} دقیقه`;
  };

  const totalOverallWorkMinutes = totalWorkMinutes + totalRemoteMinutes;
  const hasActivity = totalOverallWorkMinutes > 0 || totalPassOverallMinutes > 0 || totalDailyLeaveDays > 0 || empLogs.length > 0;

  return {
    year,
    month,
    monthName,
    startDate,
    endDate,
    totalWorkMinutes: totalOverallWorkMinutes,
    totalPhysicalMinutes: totalWorkMinutes,
    totalRemoteMinutes,
    totalPassMinutes: totalPassOverallMinutes,
    dailyLeaveDays: totalDailyLeaveDays,
    formattedWork: formatMinutesToPersian(totalOverallWorkMinutes),
    formattedPhysicalWork: formatMinutesToPersian(totalWorkMinutes),
    formattedRemote: formatMinutesToPersian(totalRemoteMinutes),
    formattedPass: formatMinutesToPersian(totalPassOverallMinutes),
    hasActivity
  };
};

