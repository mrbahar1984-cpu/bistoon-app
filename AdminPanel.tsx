
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, AttendanceLog, DirectMessage } from './types';
import { 
  getShamsiDate, 
  getShamsiTime, 
  toEnglishDigits, 
  getDayName 
} from './jalali';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { 
  ShieldAlert, Users, Check, Trash2, Edit2, Plus,
  FileSpreadsheet, Download, Clock, Database, Wifi, WifiOff,
  Bell, BellOff, BellRing, Calendar, Search, Save, X, MessageCircle, Send, RefreshCcw,
  Calculator, Printer, Coins, FileText, CheckCircle2, Sparkles, Filter, CalendarDays
} from 'lucide-react';

// توابع و تعاریف کمکی تقویم جلالی برای اطمینان از عدم وابستگی به نسخه فایل‌های قدیمی
const shamsiMonthNames = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

const jalaliToGregorian = (jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } => {
  let gy = (jy > 979) ? 1600 : 621;
  jy -= (jy > 979) ? 979 : 0;
  let days = (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + 78 + jd;
  if (jm < 7) {
    days += (jm - 1) * 31;
  } else {
    days += ((jm - 7) * 30) + 186;
  }
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const salA = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && gd > salA[gm]) {
    gd -= salA[gm];
    gm++;
  }
  return { gy, gm, gd };
};

const getDaysInShamsiMonth = (year: number, month: number): number => {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  const isLeap = [1, 5, 9, 13, 17, 22, 26, 30].includes(year % 33);
  return isLeap ? 30 : 29;
};

const parseShamsiDate = (str: string): { year: number; month: number; day: number } | null => {
  if (!str) return null;
  const clean = toEnglishDigits(str).trim();
  const parts = clean.split(/[/-]/).map(p => parseInt(p, 10));
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    const year = parts[0];
    const month = Math.min(12, Math.max(1, parts[1]));
    const maxDays = getDaysInShamsiMonth(year, month);
    const day = Math.min(maxDays, Math.max(1, parts[2]));
    return { year, month, day };
  }
  return null;
};

const formatShamsiDate = (year: number, month: number, day: number): string => {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}/${m}/${d}`;
};

type AdminMenu = 'USERS' | 'REQUESTS' | 'ATTENDANCE' | 'REPORTS' | 'OVERTIME' | 'MAINTENANCE' | 'MESSAGES';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('USERS');
  const [loading, setLoading] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('ALL');
  
  // Admin Chat State
  const [selectedChatEmpId, setSelectedChatEmpId] = useState<string>('');
  const [adminMessages, setAdminMessages] = useState<DirectMessage[]>([]);
  const [adminNewMsg, setAdminNewMsg] = useState('');
  const [loadingAdminMsg, setLoadingAdminMsg] = useState(false);
  
  // States newly added for Request Actions
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [requestEmpFilter, setRequestEmpFilter] = useState<string>('ALL');
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('ALL');
  
  // Attendance Sub-Tab & Filter State
  const [attendanceSubTab, setAttendanceSubTab] = useState<'MANAGE' | 'MANUAL'>('MANAGE');
  const [attendanceEmpFilter, setAttendanceEmpFilter] = useState<string>('ALL');
  const [attendanceStartDate, setAttendanceStartDate] = useState<string>(() => {
    const today = getShamsiDate();
    const parts = today.split('/');
    if (parts.length === 3) {
      return `${parts[0]}/${parts[1]}/01`;
    }
    return '1402/01/01';
  });
  const [attendanceEndDate, setAttendanceEndDate] = useState<string>(getShamsiDate);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(false);
  const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);

  // Reports Sub-Tab State
  const [reportsSubTab, setReportsSubTab] = useState<'SUMMARY' | 'DETAILED'>('SUMMARY');
  
  // Report date filters
  const [reportStartDate, setReportStartDate] = useState(() => {
    const today = getShamsiDate();
    const parts = today.split('/');
    if (parts.length === 3) {
      return `${parts[0]}/${parts[1]}/01`;
    }
    return '1402/01/01'; // Fallback
  });
  const [reportEndDate, setReportEndDate] = useState(getShamsiDate);
  
  // Manual Entry State
  const [manualEntry, setManualEntry] = useState({ employee_id: '', type: LogType.CLOCK_IN, date: getShamsiDate(), time: '08:00' });
  const [purgeDate, setPurgeDate] = useState<string>('');

  // --- وضعیت بخش محاسبه اضافه کار، تعطیل کاری و جمعه کاری ---
  const [overtimeYear, setOvertimeYear] = useState<number>(() => {
    const today = getShamsiDate();
    const p = parseShamsiDate(today);
    return p ? p.year : 1403;
  });
  const [overtimeMonth, setOvertimeMonth] = useState<number>(() => {
    const today = getShamsiDate();
    const p = parseShamsiDate(today);
    return p ? p.month : 6;
  });
  
  // ساعات موظفی پایه ماه (پیش‌فرض ۲۰۸ ساعت مطابق مثال کاربر)
  const [baseDutyHours, setBaseDutyHours] = useState<number>(208);
  const [hoursPerDay, setHoursPerDay] = useState<number>(8);
  
  // روزهای تعطیل رسمی در ایران (غیر از جمعه) تعریف شده توسط مدیر
  const [officialHolidays, setOfficialHolidays] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bahar_official_holidays');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [newHolidayDate, setNewHolidayDate] = useState<string>(getShamsiDate());

  // حالت نمایش گزارش اضافه‌کار: 'ALL_TABLE' (جدول تجمیعی پرسنل) یا 'INDIVIDUAL' (فیش انفرادی)
  const [overtimeViewMode, setOvertimeViewMode] = useState<'ALL_TABLE' | 'INDIVIDUAL'>('ALL_TABLE');
  const [selectedOvertimeEmpId, setSelectedOvertimeEmpId] = useState<string>('');
  const [activePrintTarget, setActivePrintTarget] = useState<'ALL_TABLE' | 'INDIVIDUAL' | null>(null);

  const fetchAttendanceLogs = useCallback(async (
    empId = attendanceEmpFilter,
    startDate = attendanceStartDate,
    endDate = attendanceEndDate
  ) => {
    setLoadingAttendance(true);
    try {
      let query = supabase
        .from('attendance_logs')
        .select('*, employees(name, national_id)')
        .order('timestamp', { ascending: false });

      if (empId && empId !== 'ALL') {
        query = query.eq('employee_id', empId);
      }
      if (startDate && startDate.trim()) {
        query = query.gte('shamsi_date', toEnglishDigits(startDate.trim()));
      }
      if (endDate && endDate.trim()) {
        query = query.lte('shamsi_date', toEnglishDigits(endDate.trim()));
      }

      const { data, error } = await query;
      if (error) {
        console.error("Fetch attendance logs error:", error);
      } else if (data) {
        setAttendanceLogs(data as AttendanceLog[]);
      }
    } catch (err) {
      console.error("Fetch attendance error:", err);
    }
    setLoadingAttendance(false);
  }, [attendanceEmpFilter, attendanceStartDate, attendanceEndDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: emps } = await supabase.from('employees').select('*').order('name');
      if (emps) setEmployees(emps.map(e => ({ ...e, nationalId: e.national_id, logs: [] })));
      
      const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name, national_id)').order('timestamp', { ascending: false });
      if (reqs) setRequests(reqs);

      const { data: logs } = await supabase.from('attendance_logs').select('*, employees(name, national_id)').order('timestamp', { ascending: false });
      if (logs) setAttendanceLogs(logs as AttendanceLog[]);
    } catch (err) {
      console.error("Fetch Error:", err);
    }
    setLoading(false);
  };

  const fetchAdminMessages = useCallback(async (empId: string) => {
    if (!empId) return;
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    try {
      await supabase.from('direct_messages').delete().lt('timestamp', cutoff);
    } catch (e) {
      console.warn("Notice: Old message purge step fallback:", e);
    }

    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('employee_id', empId)
      .gte('timestamp', cutoff)
      .order('timestamp', { ascending: true });

    if (data) {
      setAdminMessages(data as DirectMessage[]);
      // Mark messages as read by admin
      await supabase
        .from('direct_messages')
        .update({ is_read: true })
        .eq('employee_id', empId)
        .eq('sender', 'EMPLOYEE')
        .eq('is_read', false);
    }
  }, []);

  const handleAdminSendMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNewMsg.trim() || !selectedChatEmpId) return;
    setLoadingAdminMsg(true);

    const msgObj = {
      employee_id: selectedChatEmpId,
      sender: 'ADMIN',
      message: adminNewMsg.trim(),
      shamsi_date: getShamsiDate(),
      time: getShamsiTime(),
      timestamp: Date.now(),
      is_read: false
    };

    const { error } = await supabase.from('direct_messages').insert([msgObj]);
    if (error) {
      if (error.message?.includes('direct_messages') || error.code === '42P01') {
        alert('جدول direct_messages در دیتابیس Supabase هنوز ایجاد نشده است.\nلطفاً دستور SQL ارائه‌شده را در SQL Editor سوبابیس اجرا نمایید.');
      } else {
        alert('خطا در ارسال پیام: ' + error.message);
      }
    } else {
      setAdminNewMsg('');
      fetchAdminMessages(selectedChatEmpId);
    }
    setLoadingAdminMsg(false);
  };

  useEffect(() => {
    if (!adminAuth) return;
    fetchData();
    const channel = supabase.channel('admin-sync').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminAuth]);

  // Actions
  const handlePurge = async (date: string) => {
    if (confirm(`آیا از حذف تمام ترددها تا تاریخ ${date} مطمئن هستید؟ این عمل غیرقابل بازگشت است.`)) {
      const { error } = await supabase.from('attendance_logs').delete().lte('shamsi_date', date);
      if (!error) { alert('پاکسازی با موفقیت انجام شد.'); fetchData(); }
    }
  };

  const handleManualSubmit = async () => {
    if (!manualEntry.employee_id) return alert('لطفاً کارمند را انتخاب کنید');
    
    // Estimate a numeric timestamp based on Shamsi date and time for correct chronological sorting
    let calculatedTimestamp = Date.now();
    try {
      const dParts = manualEntry.date.split('/').map(Number);
      const tParts = manualEntry.time.split(':').map(Number);
      if (dParts.length === 3 && tParts.length >= 2) {
        const jYear = dParts[0];
        const jMonth = dParts[1];
        const jDay = dParts[2];
        const hour = tParts[0];
        const minute = tParts[1];
        
        const baseYear = 1400;
        const yearsDiff = jYear - baseYear;
        let days = yearsDiff * 365 + Math.floor(yearsDiff / 4);
        
        if (jMonth <= 6) {
          days += (jMonth - 1) * 31;
        } else {
          days += 6 * 31 + (jMonth - 7) * 30;
        }
        days += jDay - 1;
        
        const baseMs = 1616284800000; // 1400/01/01 roughly
        calculatedTimestamp = baseMs + (days * 24 * 60 * 60 * 1000) + (hour * 60 * 60 * 1000) + (minute * 60 * 1000);
      }
    } catch (e) {
      console.error("Error estimating timestamp, falling back to Date.now()", e);
    }

    // Try Attempt 1: inserting with is_manual and numeric timestamp
    console.log("Attempt 1 manual submit...");
    const attempt1 = await supabase.from('attendance_logs').insert([{
      employee_id: manualEntry.employee_id,
      type: manualEntry.type,
      shamsi_date: manualEntry.date,
      time: manualEntry.time,
      is_manual: true,
      timestamp: calculatedTimestamp
    }]);

    if (!attempt1.error) { 
      alert('تردد با موفقیت ثبت شد'); 
      fetchData(); 
      return;
    }

    console.warn("Attempt 1 manual submit failed, trying fallbacks...", attempt1.error);

    // If "is_manual" or "column" was the issue, try Attempt 2: omitting is_manual
    if (attempt1.error.message?.includes('is_manual') || attempt1.error.message?.includes('column')) {
      console.log("Attempt 2 (without is_manual column)...");
      const attempt2 = await supabase.from('attendance_logs').insert([{
        employee_id: manualEntry.employee_id,
        type: manualEntry.type,
        shamsi_date: manualEntry.date,
        time: manualEntry.time,
        timestamp: calculatedTimestamp
      }]);
      
      if (!attempt2.error) {
        alert('تردد با موفقیت ثبت شد');
        fetchData();
        return;
      }
      console.warn("Attempt 2 failed:", attempt2.error);
    }

    // Attempt 3: If timestamp column in DB actually expects ISO datetimestring instead of integer
    console.log("Attempt 3 (with iOS datetime string)...");
    const attempt3 = await supabase.from('attendance_logs').insert([{
      employee_id: manualEntry.employee_id,
      type: manualEntry.type,
      shamsi_date: manualEntry.date,
      time: manualEntry.time,
      timestamp: new Date().toISOString() as any
    }]);

    if (!attempt3.error) {
      alert('تردد با موفقیت ثبت شد');
      fetchData();
      return;
    }
    console.warn("Attempt 3 failed:", attempt3.error);

    // Attempt 4: Minimum fields (exactly like Dashboard.tsx, using Date.now() and omitting is_manual)
    console.log("Attempt 4 (Dashboard-like setup)...");
    const attempt4 = await supabase.from('attendance_logs').insert([{
      employee_id: manualEntry.employee_id,
      type: manualEntry.type,
      shamsi_date: manualEntry.date,
      time: manualEntry.time,
      timestamp: Date.now()
    }]);

    if (!attempt4.error) {
      alert('تردد با موفقیت ثبت شد');
      fetchData();
    } else {
      alert('خطا در ثبت تردد: ' + attempt4.error.message);
    }
  };

  const deleteItem = async (table: string, id: string) => {
    if (confirm('آیا از حذف این مورد مطمئن هستید؟')) {
      await supabase.from(table).delete().eq('id', id);
      fetchData();
    }
  };

  const exportToExcel = () => {
    // 1. دریافت کامل ترددها
    let csv = "\ufeff=== گزارش ترددهای ثبت شده در سیستم ===\n";
    csv += "کارمند,کد ملی,تاریخ تردد,ساعت تردد,نوع تردد,ثبت دستی\n";
    
    attendanceLogs.forEach(l => {
      const typeMap: Record<string, string> = {
        'CLOCK_IN': 'ورود',
        'CLOCK_OUT': 'خروج',
        'HOURLY_LEAVE_START': 'شروع پاس',
        'HOURLY_LEAVE_END': 'پایان پاس'
      };
      const cleanType = typeMap[l.type] || l.type;
      const natId = l.employees?.national_id || '---';
      csv += `"${l.employees?.name || 'نامعلوم'}","${natId}",${l.shamsi_date},${l.time},${cleanType},${l.is_manual ? 'بله' : 'خیر'}\n`;
    });
    
    // 2. دریافت کامل درخواست‌ها
    csv += "\n\n=== گزارش درخواست‌های مرخصی روزانه، پاس ساعتی و دورکاری ===\n";
    csv += "کارمند,کد ملی,نوع درخواست,تاریخ درخواست,میزان (روز/ساعت),توضیحات,وضعیت,علت رد شدن احتمالی\n";
    
    requests.forEach(r => {
      const typeMap: Record<string, string> = {
        'REMOTE_WORK': 'دورکاری',
        'HOURLY_PASS': 'پاس ساعتی',
        'DAILY_LEAVE': 'مرخصی روزانه',
        'CORRECT_LOG': 'اصلاح تردد'
      };
      const statusMap: Record<string, string> = {
        'PENDING': 'در انتظار تایید',
        'APPROVED': 'تایید شده',
        'REJECTED': 'رد شده'
      };
      
      const getRejectionReasonLocal = () => {
        if (r.rejection_reason) return r.rejection_reason;
        if (!r.description) return '';
        const match = r.description.match(/\[علت رد:\s*([^\]]+)\]/);
        return match ? match[1] : '';
      };
      
      const rawDesc = r.description || '';
      const displayDesc = rawDesc.replace(/^\[CORRECT_LOG:[^\]]+\]\s*/, '');
      const cleanDesc = displayDesc.replace(/"/g, '""').replace(/\n/g, ' ');
      const cleanReason = getRejectionReasonLocal().replace(/"/g, '""');
      
      const amountStr = r.type === 'DAILY_LEAVE' ? `${r.amount} روز` : r.type === 'CORRECT_LOG' ? '---' : `${r.amount} ساعت`;
      const natId = r.employees?.national_id || '---';
      
      csv += `"${r.employees?.name || r.employee_name || 'نامعلوم'}","${natId}",${typeMap[r.type] || r.type},${r.shamsi_date},${amountStr},"${cleanDesc}",${statusMap[r.status] || r.status},"${cleanReason}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `backup_full_${getShamsiDate()}.csv`;
    link.click();
  };

  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const clean = toEnglishDigits(timeStr).trim();
    const parts = clean.split(':').map(Number);
    if (parts.length >= 2) {
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    }
    return 0;
  };

  const getWorkStatsForEmployee = (empId: string) => {
    const empLogs = attendanceLogs.filter(l => 
      l.employee_id === empId && 
      toEnglishDigits(l.shamsi_date) >= toEnglishDigits(reportStartDate) && 
      toEnglishDigits(l.shamsi_date) <= toEnglishDigits(reportEndDate)
    );
    
    const logsByDate: Record<string, any[]> = {};
    empLogs.forEach(l => {
      const standardDate = toEnglishDigits(l.shamsi_date);
      if (!logsByDate[standardDate]) logsByDate[standardDate] = [];
      logsByDate[standardDate].push(l);
    });
    
    let totalWorkMinutes = 0;
    let totalPassLogMinutes = 0;
    
    Object.values(logsByDate).forEach(dayLogs => {
      const sorted = [...dayLogs].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      
      // Calculate Work Attendance Hours using robust state-machine pairing
      let dayPhysicalMinutes = 0;
      let activeIn: any = null;
      sorted.forEach(l => {
        const typeStr = l.type as string;
        const typeNormalized = typeStr.toUpperCase();
        const isIn = typeNormalized === 'CLOCK_IN' || typeNormalized === 'ورود';
        const isOut = typeNormalized === 'CLOCK_OUT' || typeNormalized === 'خروج';
        
        if (isIn) {
          if (!activeIn) {
            activeIn = l;
          }
        } else if (isOut) {
          if (activeIn) {
            const diff = timeToMinutes(l.time) - timeToMinutes(activeIn.time);
            if (diff > 0) {
              dayPhysicalMinutes += diff;
            }
            activeIn = null;
          }
        }
      });
      totalWorkMinutes += dayPhysicalMinutes;

      // Calculate Pass hours from actual logs using robust state-machine pairing
      let dayPassMinutes = 0;
      let activePassStart: any = null;
      sorted.forEach(l => {
        const typeStr = l.type as string;
        const typeNormalized = typeStr.toUpperCase();
        const isStart = typeNormalized === 'HOURLY_LEAVE_START' || typeNormalized === 'شروع پاس' || typeNormalized === 'پاس';
        const isEnd = typeNormalized === 'HOURLY_LEAVE_END' || typeNormalized === 'پایان پاس';
        
        if (isStart) {
          if (!activePassStart) {
            activePassStart = l;
          }
        } else if (isEnd) {
          if (activePassStart) {
            const diff = timeToMinutes(l.time) - timeToMinutes(activePassStart.time);
            if (diff > 0) {
              dayPassMinutes += diff;
            }
            activePassStart = null;
          }
        }
      });
      totalPassLogMinutes += dayPassMinutes;
    });
    
    // Gathers Approved Remote Work Requests
    const approvedRemoteWorks = requests.filter(r => 
      r.employee_id === empId &&
      r.status === 'APPROVED' &&
      r.type === 'REMOTE_WORK' &&
      toEnglishDigits(r.shamsi_date) >= toEnglishDigits(reportStartDate) &&
      toEnglishDigits(r.shamsi_date) <= toEnglishDigits(reportEndDate)
    );

    let totalRemoteMinutes = 0;
    approvedRemoteWorks.forEach(r => {
      if (r.remote_hours !== undefined && r.remote_hours !== null && r.remote_minutes !== undefined && r.remote_minutes !== null) {
        totalRemoteMinutes += (r.remote_hours * 60) + r.remote_minutes;
      } else if (r.amount) {
        totalRemoteMinutes += Math.round(r.amount * 60);
      }
    });

    // Gathers Approved Hourly Pass Requests
    const personalPasses = requests.filter(r => 
      r.employee_id === empId &&
      r.status === 'APPROVED' &&
      r.type === 'HOURLY_PASS' &&
      toEnglishDigits(r.shamsi_date) >= toEnglishDigits(reportStartDate) &&
      toEnglishDigits(r.shamsi_date) <= toEnglishDigits(reportEndDate)
    );
    
    const totalPassReqMinutes = personalPasses.reduce((sum, r) => sum + (r.amount * 60 || 0), 0);
    const totalPassOverallMinutes = totalPassLogMinutes + totalPassReqMinutes;
    
    const dailyLeaves = requests.filter(r => 
      r.employee_id === empId &&
      r.status === 'APPROVED' &&
      r.type === 'DAILY_LEAVE' &&
      toEnglishDigits(r.shamsi_date) >= toEnglishDigits(reportStartDate) &&
      toEnglishDigits(r.shamsi_date) <= toEnglishDigits(reportEndDate)
    );
    
    const totalDailyLeaveDays = dailyLeaves.reduce((sum, r) => sum + (r.amount || 1), 0);
    
    // Format minutes to text H and M
    const formatMinutesToPersian = (totalMins: number): string => {
      if (!totalMins || totalMins <= 0) return '0 ساعت';
      const h = Math.floor(totalMins / 60);
      const m = Math.round(totalMins % 60);
      return m === 0 ? `${h} ساعت` : `${h} ساعت و ${m} دقیقه`;
    };

    const formattedPhysicalWork = formatMinutesToPersian(totalWorkMinutes);
    const decimalPhysicalHours = Number((totalWorkMinutes / 60).toFixed(2));

    const formattedRemote = formatMinutesToPersian(totalRemoteMinutes);
    const decimalRemoteHours = Number((totalRemoteMinutes / 60).toFixed(2));

    const totalOverallWorkMinutes = totalWorkMinutes + totalRemoteMinutes;
    const formattedTotalWork = formatMinutesToPersian(totalOverallWorkMinutes);
    const decimalTotalWorkHours = Number((totalOverallWorkMinutes / 60).toFixed(2));
    
    return {
      workMinutes: totalWorkMinutes,
      formattedWork: formattedPhysicalWork,
      decimalWorkHours: decimalPhysicalHours,
      remoteMinutes: totalRemoteMinutes,
      formattedRemote,
      decimalRemoteHours,
      totalOverallWorkMinutes,
      formattedTotalWork,
      decimalTotalWorkHours,
      totalPassMinutes: totalPassOverallMinutes,
      formattedPass: formatMinutesToPersian(totalPassOverallMinutes),
      dailyLeaveDays: totalDailyLeaveDays
    };
  };

  const getGroupedLogs = () => {
    const filtered = attendanceLogs.filter(l => {
      const d = toEnglishDigits(l.shamsi_date);
      const start = toEnglishDigits(reportStartDate);
      const end = toEnglishDigits(reportEndDate);
      const dateMatch = d >= start && d <= end;
      const empMatch = selectedEmpId === 'ALL' || l.employee_id === selectedEmpId;
      return dateMatch && empMatch;
    });

    const groups: Record<string, {
      employee_id: string;
      employee_name: string;
      employee_national_id: string;
      shamsi_date: string;
      ins: string[];
      outs: string[];
      starts: string[];
      ends: string[];
    }> = {};

    const sortedFiltered = [...filtered].sort((a, b) => a.timestamp - b.timestamp);

    sortedFiltered.forEach(l => {
      const key = `${l.employee_id}_${l.shamsi_date}`;
      if (!groups[key]) {
        groups[key] = {
          employee_id: l.employee_id,
          employee_name: l.employees?.name || 'نامعلوم',
          employee_national_id: l.employees?.national_id || '---',
          shamsi_date: l.shamsi_date,
          ins: [],
          outs: [],
          starts: [],
          ends: []
        };
      }

      const typeStr = l.type as string;
      const typeNormalized = typeStr.toUpperCase();
      if (typeNormalized === 'CLOCK_IN' || typeNormalized === 'ورود') {
        groups[key].ins.push(l.time);
      } else if (typeNormalized === 'CLOCK_OUT' || typeNormalized === 'خروج') {
        groups[key].outs.push(l.time);
      } else if (typeNormalized === 'HOURLY_LEAVE_START' || typeNormalized === 'شروع پاس' || typeNormalized === 'پاس') {
        groups[key].starts.push(l.time);
      } else if (typeNormalized === 'HOURLY_LEAVE_END' || typeNormalized === 'پایان پاس') {
        groups[key].ends.push(l.time);
      }
    });

    let maxInsLength = 1;
    let maxPassLength = 1;
    Object.values(groups).forEach(g => {
      if (g.ins.length > maxInsLength) maxInsLength = g.ins.length;
      if (g.outs.length > maxInsLength) maxInsLength = g.outs.length;
      if (g.starts.length > maxPassLength) maxPassLength = g.starts.length;
      if (g.ends.length > maxPassLength) maxPassLength = g.ends.length;
    });

    const sortedGroups = Object.values(groups).sort((a, b) => b.shamsi_date.localeCompare(a.shamsi_date));
    return {
      groups: sortedGroups,
      maxInsLength,
      maxPassLength
    };
  };

  const exportDetailedLogsToExcel = () => {
    const { groups: dataList, maxInsLength, maxPassLength } = getGroupedLogs();
    
    let csv = "\ufeffریز تردد پرسنل (تفکیک ستون‌ها)\n";
    csv += `از تاریخ,${reportStartDate},تا تاریخ,${reportEndDate}\n\n`;
    
    let headers = "نام پرسنل,کد ملی,تاریخ";
    for (let i = 1; i <= maxInsLength; i++) {
      headers += `,ورود ${i},خروج ${i}`;
    }
    for (let i = 1; i <= maxPassLength; i++) {
      headers += `,شروع پاس ${i},پایان پاس ${i}`;
    }
    csv += headers + "\n";
    
    dataList.forEach(g => {
      let row = `"${g.employee_name}","${g.employee_national_id}",${g.shamsi_date}`;
      for (let i = 0; i < maxInsLength; i++) {
        row += `,${g.ins[i] || '---'},${g.outs[i] || '---'}`;
      }
      for (let i = 1; i <= maxPassLength; i++) {
        row += `,${g.starts[i - 1] || '---'},${g.ends[i - 1] || '---'}`;
      }
      csv += row + "\n";
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `detailed_attendance_logs_${reportStartDate}_to_${reportEndDate}.csv`;
    link.click();
  };

  const exportWorkReportToExcel = () => {
    let csv = "\ufeffگزارش کارکرد پرسنل (شامل کارکرد حضوری و دورکاری)\n";
    csv += `از تاریخ,${reportStartDate},تا تاریخ,${reportEndDate}\n\n`;
    csv += "کارمند,کد ملی,کارکرد حضوری (فرمت),دورکاری (فرمت),جمع کل کارکرد (فرمت),کارکرد حضوری (اعشاری),دورکاری (اعشاری),جمع کارکرد (اعشاری),ساعت پاس های ثبت شده,روزهای مرخصی روزانه\n";
    
    const targets = selectedEmpId === 'ALL' ? employees : employees.filter(e => e.id === selectedEmpId);
    targets.forEach(e => {
      const stats = getWorkStatsForEmployee(e.id);
      const natId = e.nationalId || e.national_id || '---';
      csv += `"${e.name}","${natId}","${stats.formattedWork}","${stats.formattedRemote}","${stats.formattedTotalWork}",${stats.decimalWorkHours},${stats.decimalRemoteHours},${stats.decimalTotalWorkHours},"${stats.formattedPass}",${stats.dailyLeaveDays}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `work_report_${reportStartDate}_to_${reportEndDate}.csv`;
    link.click();
  };

  // --- توابع و محاسبات بخش اضافه‌کار، جمعه‌کاری و تعطیل‌کاری ---
  const addOfficialHoliday = (dateStr: string) => {
    const std = toEnglishDigits(dateStr.trim());
    if (!std) return;
    if (officialHolidays.includes(std)) {
      alert('این تاریخ قبلاً به عنوان روز تعطیل رسمی ثبت شده است.');
      return;
    }
    const updated = [...officialHolidays, std].sort();
    setOfficialHolidays(updated);
    try {
      localStorage.setItem('bahar_official_holidays', JSON.stringify(updated));
    } catch (e) {}
  };

  const removeOfficialHoliday = (dateStr: string) => {
    const updated = officialHolidays.filter(d => d !== dateStr);
    setOfficialHolidays(updated);
    try {
      localStorage.setItem('bahar_official_holidays', JSON.stringify(updated));
    } catch (e) {}
  };

  const overtimeMonthInfo = useMemo(() => {
    const totalDays = getDaysInShamsiMonth(overtimeYear, overtimeMonth);
    const startDate = `${overtimeYear}/${String(overtimeMonth).padStart(2, '0')}/01`;
    const endDate = `${overtimeYear}/${String(overtimeMonth).padStart(2, '0')}/${String(totalDays).padStart(2, '0')}`;
    const monthName = shamsiMonthNames[overtimeMonth - 1] || '';

    let fridaysCount = 0;
    const fridaysList: string[] = [];
    const holidaysInMonthList: string[] = [];

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${overtimeYear}/${String(overtimeMonth).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
      const g = jalaliToGregorian(overtimeYear, overtimeMonth, day);
      const d = new Date(g.gy, g.gm - 1, g.gd);
      const isFriday = d.getDay() === 5;

      if (isFriday) {
        fridaysCount++;
        fridaysList.push(dateStr);
      } else if (officialHolidays.includes(dateStr)) {
        holidaysInMonthList.push(dateStr);
      }
    }

    const workingDays = Math.max(0, totalDays - fridaysCount - holidaysInMonthList.length);
    const suggestedDutyHours = workingDays * hoursPerDay;

    return {
      totalDays,
      startDate,
      endDate,
      monthName,
      fridaysCount,
      fridaysList,
      holidaysInMonthList,
      workingDays,
      suggestedDutyHours
    };
  }, [overtimeYear, overtimeMonth, officialHolidays, hoursPerDay]);

  const employeeOvertimeStats = useMemo(() => {
    const { startDate, endDate, fridaysList, holidaysInMonthList } = overtimeMonthInfo;
    const startStd = toEnglishDigits(startDate);
    const endStd = toEnglishDigits(endDate);
    const baseDutyMinutes = baseDutyHours * 60;

    return employees.map(emp => {
      // ۱. لاگ‌های ماه جاری
      const empLogs = attendanceLogs.filter(l => 
        l.employee_id === emp.id &&
        toEnglishDigits(l.shamsi_date) >= startStd &&
        toEnglishDigits(l.shamsi_date) <= endStd
      );

      const logsByDate: Record<string, AttendanceLog[]> = {};
      empLogs.forEach(l => {
        const d = toEnglishDigits(l.shamsi_date);
        if (!logsByDate[d]) logsByDate[d] = [];
        logsByDate[d].push(l);
      });

      let totalPhysicalMinutes = 0;
      let totalPassLogMinutes = 0;
      const dayWorkMinutesMap: Record<string, number> = {};

      Object.entries(logsByDate).forEach(([date, dayLogs]) => {
        const sorted = [...dayLogs].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

        let dayPhysical = 0;
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
              if (diff > 0) dayPhysical += diff;
              activeIn = null;
            }
          }
        });

        let dayPass = 0;
        let activePassStart: any = null;
        sorted.forEach(l => {
          const typeStr = (l.type || '') as string;
          const typeNormalized = typeStr.toUpperCase();
          const isStart = typeNormalized === 'HOURLY_LEAVE_START' || typeNormalized === 'شروع پاس';
          const isEnd = typeNormalized === 'HOURLY_LEAVE_END' || typeNormalized === 'پایان پاس';

          if (isStart) {
            if (!activePassStart) activePassStart = l;
          } else if (isEnd) {
            if (activePassStart) {
              const diff = timeToMinutes(l.time) - timeToMinutes(activePassStart.time);
              if (diff > 0) dayPass += diff;
              activePassStart = null;
            }
          }
        });

        totalPhysicalMinutes += dayPhysical;
        totalPassLogMinutes += dayPass;
        dayWorkMinutesMap[date] = (dayWorkMinutesMap[date] || 0) + dayPhysical;
      });

      // ۲. دورکاری‌های تایید شده در ماه
      const approvedRemote = requests.filter(r => 
        r.employee_id === emp.id &&
        r.status === 'APPROVED' &&
        r.type === 'REMOTE_WORK' &&
        toEnglishDigits(r.shamsi_date) >= startStd &&
        toEnglishDigits(r.shamsi_date) <= endStd
      );

      let totalRemoteMinutes = 0;
      approvedRemote.forEach(r => {
        let mins = 0;
        if (r.remote_hours !== undefined && r.remote_hours !== null && r.remote_minutes !== undefined && r.remote_minutes !== null) {
          mins = (r.remote_hours * 60) + r.remote_minutes;
        } else if (r.amount) {
          mins = Math.round(r.amount * 60);
        }
        totalRemoteMinutes += mins;
        const d = toEnglishDigits(r.shamsi_date);
        dayWorkMinutesMap[d] = (dayWorkMinutesMap[d] || 0) + mins;
      });

      const totalOverallWorkMinutes = totalPhysicalMinutes + totalRemoteMinutes;

      // ۳. پاس‌های ساعتی تایید شده
      const approvedPasses = requests.filter(r => 
        r.employee_id === emp.id &&
        r.status === 'APPROVED' &&
        r.type === 'HOURLY_PASS' &&
        toEnglishDigits(r.shamsi_date) >= startStd &&
        toEnglishDigits(r.shamsi_date) <= endStd
      );
      const totalPassReqMinutes = approvedPasses.reduce((sum, r) => sum + (r.amount * 60 || 0), 0);
      const totalPassMinutes = totalPassLogMinutes + totalPassReqMinutes;

      // ۴. مرخصی روزانه تایید شده (هر روز = hoursPerDay ساعت معادل ۸ ساعت)
      const approvedDailyLeaves = requests.filter(r => 
        r.employee_id === emp.id &&
        r.status === 'APPROVED' &&
        r.type === 'DAILY_LEAVE' &&
        toEnglishDigits(r.shamsi_date) >= startStd &&
        toEnglishDigits(r.shamsi_date) <= endStd
      );
      const dailyLeaveDays = approvedDailyLeaves.reduce((sum, r) => sum + (r.amount || 1), 0);
      const leaveDeductionMinutes = dailyLeaveDays * hoursPerDay * 60;

      // ۵. مجموع کسر از موظفی = (مرخصی روزانه × ۸ ساعت) + پاس ساعتی
      const totalDeductionMinutes = leaveDeductionMinutes + totalPassMinutes;

      // ۶. موظفی تعدیل‌شده کارمند = موظفی پایه - مجموع کسر
      const adjustedDutyMinutes = Math.max(0, baseDutyMinutes - totalDeductionMinutes);

      // ۷. محاسبه اضافه کار و کسر کار بر مبنای موظفی تعدیل‌شده
      let overtimeMinutes = 0;
      let deficitMinutes = 0;
      if (totalOverallWorkMinutes > adjustedDutyMinutes) {
        overtimeMinutes = totalOverallWorkMinutes - adjustedDutyMinutes;
      } else {
        deficitMinutes = adjustedDutyMinutes - totalOverallWorkMinutes;
      }

      // ۸. جمعه‌کاری (تعداد روزهای جمعه با کارکرد و ساعات کارکرد)
      let fridayWorkDays = 0;
      let fridayWorkMinutes = 0;
      fridaysList.forEach(fDate => {
        const dStd = toEnglishDigits(fDate);
        const wMins = dayWorkMinutesMap[dStd] || 0;
        if (wMins > 0) {
          fridayWorkDays++;
          fridayWorkMinutes += wMins;
        }
      });

      // ۹. تعطیل‌کاری (تعداد روزهای تعطیل رسمی غیرجمعه با کارکرد و ساعات کارکرد)
      let holidayWorkDays = 0;
      let holidayWorkMinutes = 0;
      holidaysInMonthList.forEach(hDate => {
        const dStd = toEnglishDigits(hDate);
        const wMins = dayWorkMinutesMap[dStd] || 0;
        if (wMins > 0) {
          holidayWorkDays++;
          holidayWorkMinutes += wMins;
        }
      });

      const formatHM = (mins: number) => {
        if (!mins || mins <= 0) return '۰ ساعت';
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        return m === 0 ? `${h} ساعت` : `${h} ساعت و ${m} دقیقه`;
      };

      return {
        empId: emp.id,
        empName: emp.name,
        nationalId: emp.nationalId || emp.national_id || '---',
        totalPhysicalMinutes,
        totalRemoteMinutes,
        totalOverallWorkMinutes,
        formattedTotalWork: formatHM(totalOverallWorkMinutes),
        decimalTotalWorkHours: Number((totalOverallWorkMinutes / 60).toFixed(2)),
        dailyLeaveDays,
        leaveDeductionMinutes,
        formattedLeaveDeduction: formatHM(leaveDeductionMinutes),
        totalPassMinutes,
        formattedPass: formatHM(totalPassMinutes),
        totalDeductionMinutes,
        formattedTotalDeduction: formatHM(totalDeductionMinutes),
        baseDutyMinutes,
        formattedBaseDuty: `${baseDutyHours} ساعت`,
        adjustedDutyMinutes,
        formattedAdjustedDuty: formatHM(adjustedDutyMinutes),
        overtimeMinutes,
        formattedOvertime: formatHM(overtimeMinutes),
        decimalOvertimeHours: Number((overtimeMinutes / 60).toFixed(2)),
        deficitMinutes,
        formattedDeficit: formatHM(deficitMinutes),
        fridayWorkDays,
        fridayWorkMinutes,
        formattedFridayWork: formatHM(fridayWorkMinutes),
        holidayWorkDays,
        holidayWorkMinutes,
        formattedHolidayWork: formatHM(holidayWorkMinutes)
      };
    });
  }, [employees, attendanceLogs, requests, overtimeMonthInfo, baseDutyHours, hoursPerDay]);

  const exportOvertimeToExcel = () => {
    const { monthName } = overtimeMonthInfo;
    let csv = "\ufeff=== گزارش محاسبه اضافه کار، جمعه کاری و تعطیل کاری پرسنل ===\n";
    csv += `ماه و سال,${monthName} ${overtimeYear},ساعات موظفی پایه ماه,${baseDutyHours} ساعت,ساعت کاری روزانه,${hoursPerDay} ساعت\n\n`;
    csv += "ردیف,نام کارمند,کد ملی,کل کارکرد (متن),کل کارکرد (ساعت اعشاری),کارکرد حضوری (دقیقه),دورکاری تاییدشده (دقیقه),مرخصی روزانه (روز),کسر موظفی مرخصی (متن),پاس ساعتی (متن),مجموع کسر از موظفی,موظفی پایه,موظفی تعدیل شده,اضافه کار (متن),اضافه کار (ساعت اعشاری),کسر کار (متن),تعداد روز جمعه کاری,ساعات جمعه کاری,تعداد روز تعطیل کاری,ساعات تعطیل کاری\n";

    employeeOvertimeStats.forEach((s, idx) => {
      csv += `${idx + 1},"${s.empName}","${s.nationalId}","${s.formattedTotalWork}",${s.decimalTotalWorkHours},${s.totalPhysicalMinutes},${s.totalRemoteMinutes},${s.dailyLeaveDays},"${s.formattedLeaveDeduction}","${s.formattedPass}","${s.formattedTotalDeduction}","${s.formattedBaseDuty}","${s.formattedAdjustedDuty}","${s.formattedOvertime}",${s.decimalOvertimeHours},"${s.formattedDeficit}",${s.fridayWorkDays},"${s.formattedFridayWork}",${s.holidayWorkDays},"${s.formattedHolidayWork}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `overtime_report_${overtimeYear}_${overtimeMonth}_${monthName}.csv`;
    link.click();
  };

  const handlePrintOvertime = (target: 'ALL_TABLE' | 'INDIVIDUAL', empId?: string) => {
    setActivePrintTarget(target);
    if (empId) setSelectedOvertimeEmpId(empId);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 p-12 bg-white rounded-[3rem] shadow-2xl text-center border">
        <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"><ShieldAlert size={40} /></div>
        <h2 className="text-2xl font-black mb-8 text-slate-800 tracking-tight">پنل مدیریت BaharTime</h2>
        <input type="password" placeholder="گذرواژه امنیتی" className="w-full p-5 rounded-2xl bg-slate-50 mb-6 text-center font-black outline-none border focus:ring-2 focus:ring-emerald-500 transition-all" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && password === 'admin123' && setAdminAuth(true)} />
        <button onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('گذرواژه اشتباه است')} className="w-full bg-slate-800 text-white p-5 rounded-2xl font-black hover:bg-slate-900 transition-all shadow-lg">ورود به مدیریت</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen -m-8">
      <aside className="w-full lg:w-64 bg-white border-l p-6 flex flex-col no-print shadow-sm">
        <h1 className="font-black text-emerald-600 text-2xl mb-12 text-center tracking-tighter uppercase">Bahar Admin</h1>
        <nav className="space-y-3 flex-1">
          <MenuBtn active={activeMenu === 'USERS'} label="مدیریت پرسنل" icon={<Users size={20}/>} onClick={() => setActiveMenu('USERS')} />
          <MenuBtn active={activeMenu === 'REQUESTS'} label="مدیریت درخواست‌ها" icon={<Check size={20}/>} onClick={() => setActiveMenu('REQUESTS')} />
          <MenuBtn active={activeMenu === 'ATTENDANCE'} label="مدیریت ترددها" icon={<Clock size={20}/>} onClick={() => setActiveMenu('ATTENDANCE')} />
          <MenuBtn active={activeMenu === 'REPORTS'} label="گزارش پیشرفته" icon={<FileSpreadsheet size={20}/>} onClick={() => setActiveMenu('REPORTS')} />
          <MenuBtn active={activeMenu === 'OVERTIME'} label="اضافه‌کار و تعطیلات" icon={<Calculator size={20}/>} onClick={() => setActiveMenu('OVERTIME')} />
          <MenuBtn active={activeMenu === 'MESSAGES'} label="پیام‌ها و چت پرسنل" icon={<MessageCircle size={20}/>} onClick={() => setActiveMenu('MESSAGES')} />
          <MenuBtn active={activeMenu === 'MAINTENANCE'} label="نگهداری سیستم" icon={<Database size={20}/>} onClick={() => setActiveMenu('MAINTENANCE')} />
        </nav>
      </aside>

      <main className="flex-1 p-8 bg-slate-50/50 overflow-y-auto max-h-screen custom-scrollbar text-right">
        {/* USERS SECTION */}
        {activeMenu === 'USERS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Users className="text-emerald-600"/> لیست و مدیریت پرسنل
              </h2>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                تعداد کل: {employees.length} نفر
              </span>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map(e => {
                const natId = e.nationalId || e.national_id || 'ثبت نشده';
                return (
                  <div key={e.id} className="p-5 bg-slate-50 rounded-3xl border flex flex-col justify-between gap-4 hover:border-emerald-200 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-black text-slate-800 text-sm mb-1">{e.name}</h3>
                        <p className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1">
                          <span>کد ملی:</span>
                          <span className="text-slate-600">{natId}</span>
                        </p>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    </div>

                    <div className="flex items-center gap-2 border-t pt-3 border-slate-200/60">
                      <button 
                        onClick={() => {
                          setSelectedChatEmpId(e.id);
                          setActiveMenu('MESSAGES');
                          fetchAdminMessages(e.id);
                        }} 
                        className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-200/80 transition-all"
                      >
                        <MessageCircle size={14}/> پیام / گفت‌وگو
                      </button>

                      <button 
                        onClick={async () => {
                          if (confirm(`آیا از حذف کاربر غیرمجاز "${e.name}" با کد ملی "${natId}" مطمئن هستید؟ این عمل تمام اطلاعات و ترددهای کاربر را پاک خواهد کرد.`)) {
                            await supabase.from('employees').delete().eq('id', e.id);
                            fetchData();
                          }
                        }} 
                        className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-bold text-xs border border-rose-200 transition-all"
                        title="حذف کاربر غيرمجاز"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MESSAGES SECTION */}
        {activeMenu === 'MESSAGES' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <MessageCircle className="text-emerald-600" size={24}/>
                ارسال پیام متنی به پرسنل و گفت‌وگو
              </h2>

              {/* انتخاب کارمند برای چت */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <label className="text-xs font-black text-slate-500 whitespace-nowrap">انتخاب پرسنل:</label>
                <select 
                  className="w-full md:w-64 p-3 bg-slate-50 border rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={selectedChatEmpId}
                  onChange={e => {
                    const id = e.target.value;
                    setSelectedChatEmpId(id);
                    if (id) fetchAdminMessages(id);
                  }}
                >
                  <option value="">-- لطفاً یک کارمند انتخاب کنید --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.nationalId || e.national_id || 'کد ملی نامشخص'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* هشدار ماندگاری 48 ساعته */}
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs font-bold leading-relaxed flex items-center gap-2">
              <ShieldAlert className="text-amber-600 shrink-0" size={20} />
              <span>پیام‌های رد و بدل شده تا ۴۸ ساعت در دیتابیس باقی می‌مانند و سپس به‌صورت خودکار پاک خواهند شد.</span>
            </div>

            {selectedChatEmpId ? (
              <div className="space-y-4">
                {/* لیست پیام‌ها */}
                <div className="space-y-4 max-h-[420px] overflow-y-auto p-4 bg-slate-50/70 rounded-3xl border custom-scrollbar flex flex-col">
                  {adminMessages.map(msg => {
                    const isAdmin = msg.sender === 'ADMIN';
                    return (
                      <div 
                        key={msg.id || msg.timestamp} 
                        className={`flex flex-col max-w-[80%] ${isAdmin ? 'self-end items-end' : 'self-start items-start'}`}
                      >
                        <div className={`p-4 rounded-3xl text-xs font-bold leading-relaxed shadow-sm ${
                          isAdmin 
                            ? 'bg-slate-800 text-white rounded-tl-none' 
                            : 'bg-emerald-600 text-white rounded-tr-none'
                        }`}>
                          <div className="text-[10px] opacity-75 mb-1 font-black">
                            {isAdmin ? 'مدیر (شما)' : employees.find(e => e.id === selectedChatEmpId)?.name || 'کارمند'}
                          </div>
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                          <div className="text-[9px] opacity-60 mt-2 text-left font-mono">
                            {msg.shamsi_date} | {msg.time}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {adminMessages.length === 0 && (
                    <p className="text-center text-slate-400 text-xs py-10 font-bold">هنوز هیچ پیامی با این کارمند رد و بدل نشده است.</p>
                  )}
                </div>

                {/* فرم ارسال پیام */}
                <form onSubmit={handleAdminSendMsg} className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="پیام خود را به کارمند بنویسید..." 
                    className="flex-1 p-4 bg-slate-50 border rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={adminNewMsg}
                    onChange={e => setAdminNewMsg(e.target.value)}
                  />
                  <button 
                    type="submit" 
                    disabled={loadingAdminMsg || !adminNewMsg.trim()} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
                  >
                    <Send size={16}/> ارسال پیام
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-3xl border border-dashed">
                جهت مشاهده گفت‌وگوها یا ارسال پیام، ابتدا از منوی بالا یک کارمند را انتخاب نمایید.
              </div>
            )}
          </div>
        )}

        {/* REQUESTS SECTION */}
        {activeMenu === 'REQUESTS' && (() => {
          const filteredRequests = requests.filter(r => {
            const matchesEmp = requestEmpFilter === 'ALL' || r.employee_id === requestEmpFilter;
            const matchesStatus = requestStatusFilter === 'ALL' || r.status === requestStatusFilter;
            return matchesEmp && matchesStatus;
          });

          const pendingCount = requests.filter(r => r.status === 'PENDING').length;

          return (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in space-y-6">
              {/* سربرگ مدیریت درخواست‌ها */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Check className="text-emerald-600" size={24}/> مدیریت و بررسی درخواست‌ها
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">
                    بررسی، تایید، رد و فیلتر درخواست‌های مرخصی، پاس ساعتی، دورکاری و اصلاح تردد پرسنل
                  </p>
                </div>

                {pendingCount > 0 && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                    <span>{pendingCount} درخواست جدید در انتظار بررسی</span>
                  </div>
                )}
              </div>

              {/* نوار فیلتر کارمند و وضعیت */}
              <div className="bg-slate-50 p-5 rounded-3xl border space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* فیلتر کارمند */}
                  <div className="flex items-center gap-2 min-w-[280px] flex-1">
                    <label className="text-xs font-black text-slate-700 whitespace-nowrap flex items-center gap-1.5">
                      <Users size={16} className="text-emerald-600"/> فیلتر پرسنل:
                    </label>
                    <select 
                      className="w-full p-3 bg-white border rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      value={requestEmpFilter}
                      onChange={e => setRequestEmpFilter(e.target.value)}
                    >
                      <option value="ALL">همه پرسنل (تمام درخواست‌ها)</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.nationalId || e.national_id || 'کد ملی نامشخص'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* فیلتر وضعیت درخواست */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-black text-slate-700 whitespace-nowrap">وضعیت:</label>
                    <div className="flex bg-white p-1 rounded-2xl border gap-1">
                      <button
                        onClick={() => setRequestStatusFilter('ALL')}
                        className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                          requestStatusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        همه
                      </button>
                      <button
                        onClick={() => setRequestStatusFilter('PENDING')}
                        className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all flex items-center gap-1 ${
                          requestStatusFilter === 'PENDING' ? 'bg-amber-500 text-white' : 'text-amber-700 hover:bg-amber-50'
                        }`}
                      >
                        در انتظار {pendingCount > 0 && <span className="bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{pendingCount}</span>}
                      </button>
                      <button
                        onClick={() => setRequestStatusFilter('APPROVED')}
                        className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                          requestStatusFilter === 'APPROVED' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        تایید شده
                      </button>
                      <button
                        onClick={() => setRequestStatusFilter('REJECTED')}
                        className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                          requestStatusFilter === 'REJECTED' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        رد شده
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs font-bold text-slate-500">
                  <span>
                    نمایش درخواست‌های: <strong className="text-slate-800">{requestEmpFilter === 'ALL' ? 'همه پرسنل' : employees.find(e => e.id === requestEmpFilter)?.name}</strong>
                  </span>
                  <span className="bg-white px-3 py-1 rounded-full border text-[11px]">
                    تعداد: <strong className="font-mono font-black text-emerald-600">{filteredRequests.length}</strong> درخواست
                  </span>
                </div>
              </div>

              {/* لیست درخواست‌های فیلتر شده */}
              <div className="space-y-4">
                {filteredRequests.map(r => {
                  const getRejectionReasonLocal = () => {
                    if (r.rejection_reason) return r.rejection_reason;
                    if (!r.description) return '';
                    const match = r.description.match(/\[علت رد:\s*([^\]]+)\]/);
                    return match ? match[1] : '';
                  };
                  const rejectReason = getRejectionReasonLocal();
                  
                  const typeMap: Record<string, string> = {
                    'REMOTE_WORK': 'دورکاری',
                    'HOURLY_PASS': 'پاس ساعتی',
                    'DAILY_LEAVE': 'مرخصی روزانه',
                    'CORRECT_LOG': 'اصلاح تردد'
                  };
                  
                  return (
                    <div key={r.id} className="p-6 bg-slate-50 rounded-3xl border flex flex-col gap-4 text-right">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-black text-slate-800 text-sm">
                            {r.employees?.name || r.employee_name || 'کارمند نامشخص'} - {typeMap[r.type] || r.type}
                          </p>
                          <p className="text-xs text-slate-400 font-bold mt-1">
                            تاریخ: {r.shamsi_date} {r.type !== 'CORRECT_LOG' && `| مقدار درخواستی: ${r.type === 'DAILY_LEAVE' ? `${r.amount} روز` : `${r.amount} ساعت`}`}
                          </p>
                          <p className="text-xs text-slate-505 font-bold mt-2 bg-white/70 p-3 rounded-2xl block border border-slate-100">
                            {r.description ? r.description.replace(/^\[CORRECT_LOG:[^\]]+\]\s*/, '') : 'بدون توضیحات'}
                          </p>
                          {r.status === 'REJECTED' && rejectReason && (
                            <p className="text-[11px] font-black text-rose-600 mt-2 bg-rose-50/50 p-2 rounded-xl border border-rose-100 flex items-center gap-1">
                              <span>علت رد شده:</span>
                              <span>{rejectReason}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 text-left">
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                            r.status === 'APPROVED' ? 'bg-emerald-500 text-white' : 
                            r.status === 'REJECTED' ? 'bg-rose-500 text-white' : 
                            'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {r.status === 'APPROVED' ? 'تایید شد' : r.status === 'REJECTED' ? 'رد شد' : 'در انتظار'}
                          </span>
                          
                          <div className="flex gap-1 mt-2">
                            {/* تایید */}
                            {r.status !== 'APPROVED' && (
                              <button 
                                onClick={async () => {
                                  let cleanDesc = r.description || '';
                                  cleanDesc = cleanDesc.replace(/\s*\[علت رد:\s*[^\]]+\]/, '');
                                  
                                  const { error } = await supabase.from('leave_requests').update({
                                    status: 'APPROVED', 
                                    rejection_reason: null, 
                                    description: cleanDesc
                                  }).eq('id', r.id);
                                  
                                  if (error) {
                                    // Fallback if rejection_reason column does not exist
                                    await supabase.from('leave_requests').update({
                                      status: 'APPROVED',
                                      description: cleanDesc
                                    }).eq('id', r.id);
                                  }

                                  // ADD CORE TRIGGER: If this is CORRECT_LOG, auto insert into attendance logs
                                  if (r.type === 'CORRECT_LOG' && r.description) {
                                    const match = r.description.match(/\[CORRECT_LOG:type=([^:]+):time=([^\]]+)\]/);
                                    if (match) {
                                      const logType = match[1];
                                      const logTime = match[2];
                                      const logDate = r.shamsi_date;
                                      
                                      let calculatedTimestamp = Date.now();
                                      try {
                                        const parts = logDate.split('/').map(Number);
                                        const timeParts = logTime.split(':').map(Number);
                                        if (parts.length === 3 && timeParts.length >= 2) {
                                          const year = parts[0];
                                          const month = parts[1];
                                          const day = parts[2];
                                          const h = timeParts[0];
                                          const m = timeParts[1];
                                          
                                          const diffYears = year - 1400;
                                          let days = diffYears * 365 + Math.floor(diffYears / 4);
                                          if (month <= 6) {
                                            days += (month - 1) * 31;
                                          } else {
                                            days += 186 + (month - 7) * 30;
                                          }
                                          days += day - 1;
                                          calculatedTimestamp = 1616284800000 + days * 24 * 60 * 60 * 1000 + h * 60 * 60 * 1000 + m * 60 * 1000;
                                        }
                                      } catch (e) {
                                        console.error("Error setting timestamp:", e);
                                      }
                                      
                                      const { error: logErr1 } = await supabase.from('attendance_logs').insert([{
                                        employee_id: r.employee_id,
                                        type: logType as any,
                                        shamsi_date: logDate,
                                        time: logTime,
                                        is_manual: true,
                                        timestamp: calculatedTimestamp
                                      }]);
                                      
                                      if (logErr1) {
                                        console.warn("Log insert failed fallback...", logErr1);
                                        const { error: logErr2 } = await supabase.from('attendance_logs').insert([{
                                          employee_id: r.employee_id,
                                          type: logType as any,
                                          shamsi_date: logDate,
                                          time: logTime,
                                          timestamp: calculatedTimestamp
                                        }]);
                                        if (logErr2) {
                                          console.error("Log fallback failed:", logErr2);
                                        }
                                      }
                                    }
                                  }
                                  
                                  fetchData();
                                }} 
                                className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-xl font-bold text-xs flex items-center gap-1 border border-emerald-200"
                                title="تایید درخواست"
                              >
                                <Check size={14}/> تایید
                              </button>
                            )}
                            
                            {/* رد */}
                            {r.status !== 'REJECTED' && (
                              <button 
                                onClick={() => {
                                  setRejectingId(r.id);
                                  setRejectionReason('');
                                }} 
                                className="text-rose-600 bg-rose-50 hover:bg-rose-100 p-2 rounded-xl font-bold text-xs flex items-center gap-1 border border-rose-200"
                                title="رد درخواست"
                              >
                                <X size={14}/> رد
                              </button>
                            )}
                            
                            {/* ویرایش */}
                            <button 
                              onClick={() => setEditingRequest(r)} 
                              className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-xl font-bold text-xs flex items-center gap-1 border border-blue-200"
                              title="ویرایش درخواست"
                            >
                              <Edit2 size={14}/> ویرایش
                            </button>
                            
                            {/* حذف */}
                            <button 
                              onClick={() => deleteItem('leave_requests', r.id)} 
                              className="text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-xl font-bold text-xs flex items-center gap-1 border border-slate-200"
                              title="حذف درخواست"
                            >
                              <Trash2 size={14}/> حذف
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* علت رد شدن */}
                      {rejectingId === r.id && (
                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 space-y-3 mt-2 animate-in slide-in-from-top-2 duration-300">
                          <label className="text-[11px] font-black text-rose-800">علت رد شدن درخواست را بنویسید:</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="مثال: تداخل با شیفت دیگر / عدم موافقت" 
                              className="flex-1 p-3 bg-white rounded-xl border text-xs outline-none focus:ring-1 focus:ring-rose-500 font-bold" 
                              value={rejectionReason} 
                              onChange={e => setRejectionReason(e.target.value)} 
                            />
                            <button 
                              onClick={async () => {
                                if (!rejectionReason.trim()) return alert('لطفاً علت رد شدن را وارد کنید');
                                
                                let { error } = await supabase.from('leave_requests').update({
                                  status: 'REJECTED',
                                  rejection_reason: rejectionReason
                                }).eq('id', r.id);
                                
                                if (error && error.message?.includes('column')) {
                                  // Fallback
                                  const updatedDesc = `${r.description || ''} [علت رد: ${rejectionReason}]`;
                                  await supabase.from('leave_requests').update({
                                    status: 'REJECTED',
                                    description: updatedDesc
                                  }).eq('id', r.id);
                                }
                                
                                setRejectingId(null);
                                setRejectionReason('');
                                fetchData();
                              }} 
                              className="bg-rose-600 text-white px-5 py-2.5 rounded-xl text-xs font-black animate-pulse-subtle"
                            >
                              ثبت رد شدن
                            </button>
                            <button 
                              onClick={() => {
                                setRejectingId(null);
                                setRejectionReason('');
                              }} 
                              className="bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-xs font-black"
                            >
                              انصراف
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredRequests.length === 0 && (
                  <p className="text-center text-slate-400 py-10 font-bold">
                    درخواستی با این مشخصات و فیلترها در سیستم یافت نشد.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* ATTENDANCE SECTION */}
        {activeMenu === 'ATTENDANCE' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in space-y-6">
            {/* سربرگ و تب‌های مجزای مدیریت تردد */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Clock className="text-emerald-600" size={24}/> مدیریت و ثبت ترددهای پرسنل
                </h2>
                <p className="text-[11px] text-slate-400 font-bold mt-1">مشاهده، فیلتر تاریخی، ویرایش، حذف و یا ثبت دستی ورود و خروج کارمندان</p>
              </div>

              {/* زیرتب‌ها با تفکیک کاملاً مشخص */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 border">
                <button
                  onClick={() => {
                    setAttendanceSubTab('MANAGE');
                    fetchAttendanceLogs();
                  }}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
                    attendanceSubTab === 'MANAGE' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Edit2 size={16}/> ۱. لیست و مدیریت ترددها
                </button>
                <button
                  onClick={() => setAttendanceSubTab('MANUAL')}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
                    attendanceSubTab === 'MANUAL' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Plus size={16}/> ۲. ثبت دستی تردد جدید
                </button>
              </div>
            </div>

            {/* زیرتب ۱: ثبت دستی تردد */}
            {attendanceSubTab === 'MANUAL' && (
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200/80 space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <Plus size={18} className="text-emerald-600"/> فرم ثبت دستی تردد برای پرسنل
                  </h3>
                  <span className="text-[11px] text-slate-400 font-bold">این تردد با برچسب «دستی مدیر» ذخیره خواهد شد</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500">انتخاب پرسنل</label>
                    <select 
                      className="w-full p-4 rounded-2xl bg-white border text-xs font-black outline-none focus:ring-2 focus:ring-emerald-500 transition-all" 
                      value={manualEntry.employee_id} 
                      onChange={e => setManualEntry({...manualEntry, employee_id: e.target.value})}
                    >
                      <option value="">-- انتخاب کارمند --</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.nationalId || e.national_id || '---'})</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500">نوع تردد</label>
                    <select 
                      className="w-full p-4 rounded-2xl bg-white border text-xs font-black outline-none focus:ring-2 focus:ring-emerald-500 transition-all" 
                      value={manualEntry.type} 
                      onChange={e => setManualEntry({...manualEntry, type: e.target.value as LogType})}
                    >
                      <option value="CLOCK_IN">ورود پرسنل</option>
                      <option value="CLOCK_OUT">خروج پرسنل</option>
                      <option value="HOURLY_LEAVE_START">شروع پاس ساعتی</option>
                      <option value="HOURLY_LEAVE_END">پایان پاس ساعتی</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500">تاریخ (شمسی)</label>
                    <ShamsiDatePicker
                      value={manualEntry.date}
                      onChange={d => setManualEntry({...manualEntry, date: d})}
                      theme="emerald"
                      className="w-full"
                      inputClassName="p-3.5 bg-white border rounded-2xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500">ساعت</label>
                    <input 
                      type="time" 
                      className="w-full p-4 rounded-2xl bg-white border text-xs font-black font-mono text-center outline-none focus:ring-2 focus:ring-emerald-500 transition-all" 
                      value={manualEntry.time} 
                      onChange={e => setManualEntry({...manualEntry, time: e.target.value})} 
                    />
                  </div>

                  <div className="flex items-end">
                    <button 
                      onClick={async () => {
                        await handleManualSubmit();
                        fetchAttendanceLogs();
                      }} 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs transition-all shadow-lg p-4 h-[52px]"
                    >
                      ثبت تردد
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* زیرتب ۲: ویرایش و حذف ترددهای ثبت شده با فیلتر کارمند و بازه تاریخ */}
            {attendanceSubTab === 'MANAGE' && (
              <div className="space-y-4 animate-in fade-in">
                {/* فیلتر کارمند و بازه تاریخ */}
                <div className="bg-slate-50 p-5 rounded-3xl border space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* فیلتر پرسنل */}
                    <div className="flex items-center gap-2 min-w-[260px] flex-1">
                      <label className="text-xs font-black text-slate-700 whitespace-nowrap flex items-center gap-1.5">
                        <Users size={16} className="text-emerald-600"/> پرسنل:
                      </label>
                      <select 
                        className="w-full p-3 bg-white border rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        value={attendanceEmpFilter}
                        onChange={e => {
                          const newEmp = e.target.value;
                          setAttendanceEmpFilter(newEmp);
                          fetchAttendanceLogs(newEmp, attendanceStartDate, attendanceEndDate);
                        }}
                      >
                        <option value="ALL">همه پرسنل (بدون فیلتر فردی)</option>
                        {employees.map(e => (
                          <option key={e.id} value={e.id}>
                            {e.name} ({e.nationalId || e.national_id || 'کد ملی نامشخص'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* فیلتر از تاریخ */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-700 font-black whitespace-nowrap">از تاریخ:</span>
                      <ShamsiDatePicker
                        value={attendanceStartDate}
                        onChange={d => setAttendanceStartDate(d)}
                        placeholder="1403/01/01"
                        theme="emerald"
                        className="w-36"
                        inputClassName="p-2.5 bg-white border rounded-xl"
                      />
                    </div>

                    {/* فیلتر تا تاریخ */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-700 font-black whitespace-nowrap">تا تاریخ:</span>
                      <ShamsiDatePicker
                        value={attendanceEndDate}
                        onChange={d => setAttendanceEndDate(d)}
                        placeholder="1403/12/29"
                        theme="emerald"
                        className="w-36"
                        inputClassName="p-2.5 bg-white border rounded-xl"
                      />
                    </div>

                    {/* دکمه فراخوانی و جستجو */}
                    <button 
                      onClick={() => fetchAttendanceLogs(attendanceEmpFilter, attendanceStartDate, attendanceEndDate)}
                      disabled={loadingAttendance}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-xs font-black transition-all shadow-md disabled:opacity-50"
                    >
                      <Search size={15}/> {loadingAttendance ? 'در حال فراخوانی...' : 'فراخوانی و جستجو'}
                    </button>
                  </div>

                  {/* کلیدهای میانبر انتخاب بازه زمانی */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold text-[11px]">میانبرهای بازه:</span>
                      <button
                        onClick={() => {
                          const today = getShamsiDate();
                          const parts = today.split('/');
                          const startOfMonth = parts.length === 3 ? `${parts[0]}/${parts[1]}/01` : today;
                          setAttendanceStartDate(startOfMonth);
                          setAttendanceEndDate(today);
                          fetchAttendanceLogs(attendanceEmpFilter, startOfMonth, today);
                        }}
                        className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border font-bold text-[11px] transition-all"
                      >
                        ماه جاری
                      </button>
                      <button
                        onClick={() => {
                          setAttendanceStartDate('');
                          setAttendanceEndDate('');
                          fetchAttendanceLogs(attendanceEmpFilter, '', '');
                        }}
                        className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border font-bold text-[11px] transition-all"
                      >
                        تمام تاریخ‌ها (کامل)
                      </button>
                    </div>

                    <span className="text-xs font-bold text-slate-600 bg-white px-3.5 py-1.5 rounded-full border">
                      تعداد تردد‌های یافت‌شده: <span className="font-mono font-black text-emerald-600">{attendanceLogs.length}</span> مورد
                    </span>
                  </div>
                </div>

                {/* پیام راهنما جهت جلوگیری از اشتباه */}
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2 leading-relaxed">
                  <ShieldAlert size={18} className="text-amber-600 shrink-0"/>
                  <span>برای دسترسی به تمام ترددها یا ترددهای تاریخ‌های گذشته، بازه زمانی یا پرسنل را انتخاب کرده و دکمه فراخوانی را بزنید. سپس می‌توانید هر تردد را ویرایش یا حذف کنید.</span>
                </div>

                {/* جدول ترددها */}
                <div className="bg-white rounded-[2rem] border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-500 border-b">
                        <tr className="text-[11px] font-black">
                          <th className="p-4">نام پرسنل</th>
                          <th className="p-4 text-center">کد ملی</th>
                          <th className="p-4 text-center">تاریخ (شمسی)</th>
                          <th className="p-4 text-center">ساعت</th>
                          <th className="p-4 text-center">نوع تردد</th>
                          <th className="p-4 text-center">شیوه ثبت</th>
                          <th className="p-4 text-center">عملیات مدیریت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold">
                        {attendanceLogs.map(l => {
                          const empName = l.employees?.name || employees.find(e => e.id === l.employee_id)?.name || 'نامشخص';
                          const natId = l.employees?.national_id || employees.find(e => e.id === l.employee_id)?.nationalId || '---';
                          const getLogTypeTitle = (t: string) => {
                            switch(t) {
                              case 'CLOCK_IN': return 'ورود';
                              case 'CLOCK_OUT': return 'خروج';
                              case 'HOURLY_LEAVE_START': return 'شروع پاس';
                              case 'HOURLY_LEAVE_END': return 'پایان پاس';
                              default: return t;
                            }
                          };
                          return (
                            <tr key={l.id} className="hover:bg-slate-50/80 transition-all">
                              <td className="p-4 font-black text-slate-800">{empName}</td>
                              <td className="p-4 text-center font-mono text-slate-500">{natId}</td>
                              <td className="p-4 text-center font-mono text-slate-600">{l.shamsi_date}</td>
                              <td className="p-4 text-center font-mono font-black text-emerald-600">{l.time}</td>
                              <td className="p-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                                  l.type === 'CLOCK_IN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  l.type === 'CLOCK_OUT' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  l.type === 'HOURLY_LEAVE_START' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}>
                                  {getLogTypeTitle(l.type)}
                                </span>
                              </td>
                              <td className="p-4 text-center text-[11px] text-slate-400 font-mono">
                                {l.is_manual ? 'دستی مدیر' : 'سیستمی'}
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button 
                                    onClick={() => setEditingLog(l)} 
                                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-black text-xs flex items-center gap-1 border border-blue-200 transition-all"
                                    title="ویرایش این تردد"
                                  >
                                    <Edit2 size={14}/> ویرایش
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      if (confirm(`آیا از حذف تردد کارمند "${empName}" در تاریخ "${l.shamsi_date}" ساعت "${l.time}" اطمینان کامل دارید؟`)) {
                                        await supabase.from('attendance_logs').delete().eq('id', l.id);
                                        fetchAttendanceLogs();
                                      }
                                    }} 
                                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-black text-xs flex items-center gap-1 border border-rose-200 transition-all"
                                    title="حذف این تردد"
                                  >
                                    <Trash2 size={14}/> حذف
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {attendanceLogs.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center p-12 text-slate-400 font-bold">
                              {loadingAttendance ? 'در حال بارگذاری ترددها...' : 'ترددی با این مشخصات و بازه زمانی یافت نشد.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* REPORTS SECTION */}
        {activeMenu === 'REPORTS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in space-y-6">
            {/* سربرگ گزارش پیشرفته و تب‌ها */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-600" size={24}/> گزارش‌های پیشرفته و کارکرد
                </h2>
                <p className="text-[11px] text-slate-400 font-bold mt-1">مشاهده خلاصه کارکرد و یا ریز دقیق ورود و خروج روزانه پرسنل</p>
              </div>

              {/* تب‌های گزارش */}
              <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 border">
                <button
                  onClick={() => setReportsSubTab('SUMMARY')}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
                    reportsSubTab === 'SUMMARY' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileSpreadsheet size={16}/> خلاصه کارکرد پرسنل
                </button>
                <button
                  onClick={() => setReportsSubTab('DETAILED')}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
                    reportsSubTab === 'DETAILED' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Clock size={16}/> ریز تردد پرسنل (تفکیک روزانه)
                </button>
              </div>
            </div>

            {/* نوار فیلترهای عمومی گزارش (کارمند و بازه زمانی) */}
            <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-50 p-5 rounded-3xl border">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-700 font-black">پرسنل:</span>
                  <select 
                    className="p-3 bg-white border rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-emerald-500" 
                    value={selectedEmpId} 
                    onChange={e => setSelectedEmpId(e.target.value)}
                  >
                    <option value="ALL">همه پرسنل</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-700 font-black whitespace-nowrap">از تاریخ:</span>
                  <ShamsiDatePicker
                    value={reportStartDate}
                    onChange={d => setReportStartDate(d)}
                    placeholder="1403/01/01"
                    theme="emerald"
                    className="w-36"
                    inputClassName="p-2.5 bg-white border rounded-xl"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-700 font-black whitespace-nowrap">تا تاریخ:</span>
                  <ShamsiDatePicker
                    value={reportEndDate}
                    onChange={d => setReportEndDate(d)}
                    placeholder="1403/12/29"
                    theme="emerald"
                    className="w-36"
                    inputClassName="p-2.5 bg-white border rounded-xl"
                  />
                </div>
              </div>

              {/* دکمه دانلود اکسل متناسب با تب انتخاب شده */}
              {reportsSubTab === 'SUMMARY' ? (
                <button 
                  onClick={exportWorkReportToExcel} 
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-black transition-all shadow-md"
                >
                  <Download size={14}/> خروجی اکسل کارکرد
                </button>
              ) : (
                <button 
                  onClick={exportDetailedLogsToExcel} 
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl text-xs font-black transition-all shadow-md"
                >
                  <Download size={14}/> خروجی اکسل ریز ترددها
                </button>
              )}
            </div>

            {/* تب ۱: خلاصه کارکرد پرسنل */}
            {reportsSubTab === 'SUMMARY' && (
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 animate-in fade-in">
                <h3 className="font-black text-sm text-slate-800 mb-4 flex items-center gap-2">
                  📊 جدول خلاصه کارکرد پرسنل در بازه زمانی تعیین‌شده (شامل کارکرد حضوری و دورکاری)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-white text-slate-800 border-b border-slate-200 font-black">
                        <th className="p-4 rounded-r-xl text-slate-900 font-black">نام کارمند</th>
                        <th className="p-4 text-center text-slate-800 font-black">کد ملی</th>
                        <th className="p-4 text-center text-slate-800 font-black">از تاریخ</th>
                        <th className="p-4 text-center text-slate-800 font-black">تا تاریخ</th>
                        <th className="p-4 text-center text-indigo-900 font-black">کارکرد حضوری</th>
                        <th className="p-4 text-center text-teal-900 bg-teal-100/60 font-black">میزان دورکاری</th>
                        <th className="p-4 text-center text-emerald-950 bg-emerald-100/60 font-black">جمع کل کارکرد</th>
                        <th className="p-4 text-center text-amber-900 font-black">جمع پاس‌ها</th>
                        <th className="p-4 text-center rounded-l-xl text-rose-900 font-black">مرخصی روزانه</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedEmpId === 'ALL' ? employees : employees.filter(e => e.id === selectedEmpId)).map(e => {
                        const stats = getWorkStatsForEmployee(e.id);
                        const natId = e.nationalId || e.national_id || '---';
                        return (
                          <tr key={e.id} className="border-b border-slate-200 last:border-0 hover:bg-white transition-all font-bold">
                            <td className="p-4 font-black text-slate-900">{e.name}</td>
                            <td className="p-4 text-center font-mono font-bold text-slate-800">{natId}</td>
                            <td className="p-4 text-center font-mono font-bold text-slate-700">{reportStartDate}</td>
                            <td className="p-4 text-center font-mono font-bold text-slate-700">{reportEndDate}</td>
                            <td className="p-4 text-center font-black text-indigo-900">{stats.formattedWork}</td>
                            <td className="p-4 text-center font-black text-teal-900 bg-teal-50/70">{stats.formattedRemote}</td>
                            <td className="p-4 text-center font-black text-emerald-900 bg-emerald-50/70">{stats.formattedTotalWork}</td>
                            <td className="p-4 text-center font-black text-amber-900">{stats.formattedPass}</td>
                            <td className="p-4 text-center font-black text-rose-900">{stats.dailyLeaveDays} روز</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* تب ۲: ریز تردد پرسنل (تک ردیف در هر روز) */}
            {reportsSubTab === 'DETAILED' && (() => {
              const { groups: dataList, maxInsLength, maxPassLength } = getGroupedLogs();
              return (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                      🔍 جدول ریز تردد پرسنل (تک ردیف به‌ازای هر روز)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-800">
                        <tr className="border-b border-slate-200 text-xs font-black">
                          <th className="p-4 rounded-r-xl text-right text-slate-900">نام پرسنل</th>
                          <th className="p-4 text-center text-slate-800">کد ملی</th>
                          <th className="p-4 text-center text-slate-800">تاریخ</th>
                          {Array.from({ length: maxInsLength }).map((_, i) => (
                            <React.Fragment key={`in-out-${i}`}>
                              <th className="p-4 text-center text-emerald-900 border-r border-slate-200 bg-emerald-100/50">ورود {i + 1}</th>
                              <th className="p-4 text-center text-rose-900 border-r border-slate-200 bg-rose-100/50">خروج {i + 1}</th>
                            </React.Fragment>
                          ))}
                          {Array.from({ length: maxPassLength }).map((_, i) => (
                            <React.Fragment key={`pass-${i}`}>
                              <th className="p-4 text-center text-amber-900 border-r border-slate-200 bg-amber-100/50">شروع پاس {i + 1}</th>
                              <th className="p-4 text-center text-indigo-900 border-r border-slate-200 bg-indigo-100/50 rounded-l-xl">پایان پاس {i + 1}</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dataList.map((g, idx) => (
                          <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50/70 transition-all font-bold">
                            <td className="p-4 font-black text-slate-900 text-right">{g.employee_name}</td>
                            <td className="p-4 text-center font-mono font-bold text-slate-800">{g.employee_national_id}</td>
                            <td className="p-4 text-center font-mono font-bold text-slate-700">{g.shamsi_date}</td>
                            {Array.from({ length: maxInsLength }).map((_, i) => (
                              <React.Fragment key={`vals-in-out-${i}`}>
                                <td className="p-4 text-center font-mono font-black text-emerald-800 border-r border-slate-200">{g.ins[i] || '---'}</td>
                                <td className="p-4 text-center font-mono font-black text-rose-800 border-r border-slate-200">{g.outs[i] || '---'}</td>
                              </React.Fragment>
                            ))}
                            {Array.from({ length: maxPassLength }).map((_, i) => (
                              <React.Fragment key={`vals-pass-${i}`}>
                                <td className="p-4 text-center font-mono font-black text-amber-800 border-r border-slate-200">{g.starts[i] || '---'}</td>
                                <td className="p-4 text-center font-mono font-black text-indigo-800 border-r border-slate-200">{g.ends[i] || '---'}</td>
                              </React.Fragment>
                            ))}
                          </tr>
                        ))}
                        {dataList.length === 0 && (
                          <tr>
                            <td colSpan={3 + maxInsLength * 2 + maxPassLength * 2} className="text-center p-12 text-slate-500 font-bold">ترددی در این بازه یافت نشد.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* OVERTIME & HOLIDAY SECTION (محاسبه اضافه کار، جمعه کاری و تعطیل کاری) */}
        {activeMenu === 'OVERTIME' && (() => {
          const selectedEmp = employeeOvertimeStats.find(s => s.empId === selectedOvertimeEmpId) || employeeOvertimeStats[0];

          return (
            <div className="space-y-6 animate-in fade-in">
              {/* سربرگ بخش اضافه‌کار و تعطیلات */}
              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-inner">
                    <Calculator size={26} />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                      محاسبه اضافه‌کار، جمعه‌کاری و تعطیل‌کاری
                    </h2>
                    <p className="text-xs text-slate-400 font-bold mt-1">
                      محاسبه دقیق بر مبنای کسر مرخصی و پاس از موظفی، شناسایی جمعه‌کاری و تعطیلات رسمی
                    </p>
                  </div>
                </div>

                {/* انتخاب حالت نمایش: جدول تجمیعی پرسنل / فیش انفرادی */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                  <button
                    type="button"
                    onClick={() => setOvertimeViewMode('ALL_TABLE')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      overtimeViewMode === 'ALL_TABLE'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Users size={15}/> جدول تجمیعی پرسنل
                  </button>
                  <button
                    type="button"
                    onClick={() => setOvertimeViewMode('INDIVIDUAL')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      overtimeViewMode === 'INDIVIDUAL'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <FileText size={15}/> فیش انفرادی کارمند
                  </button>
                </div>
              </div>

              {/* پنل تنظیمات ماه، موظفی و تعطیلات رسمی */}
              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5 no-print">
                <div className="border-b pb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <CalendarDays size={18} className="text-indigo-600"/>
                    تنظیمات دوره محاسباتی، موظفی ماه و روزهای تعطیل رسمی
                  </h3>
                  <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl border border-indigo-100">
                    بازه: {overtimeMonthInfo.startDate} الی {overtimeMonthInfo.endDate} ({overtimeMonthInfo.totalDays} روز)
                  </span>
                </div>

                {/* ردیف انتخاب سال، ماه، ساعت موظفی و ساعت روزانه */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* انتخاب سال */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">سال شمسی:</label>
                    <select
                      className="w-full p-3 bg-slate-50 border rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={overtimeYear}
                      onChange={e => setOvertimeYear(parseInt(e.target.value, 10))}
                    >
                      <option value={1402}>۱۴۰۲</option>
                      <option value={1403}>۱۴۰۳</option>
                      <option value={1404}>۱۴۰۴</option>
                      <option value={1405}>۱۴۰۵</option>
                    </select>
                  </div>

                  {/* انتخاب ماه */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">ماه مورد نظر:</label>
                    <select
                      className="w-full p-3 bg-slate-50 border rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      value={overtimeMonth}
                      onChange={e => setOvertimeMonth(parseInt(e.target.value, 10))}
                    >
                      {shamsiMonthNames.map((name, idx) => (
                        <option key={idx + 1} value={idx + 1}>{name}</option>
                      ))}
                    </select>
                  </div>

                  {/* ساعات موظفی پایه ماه */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700">ساعات موظفی پایه ماه:</label>
                      <button
                        type="button"
                        onClick={() => setBaseDutyHours(overtimeMonthInfo.suggestedDutyHours)}
                        className="text-[10px] text-indigo-600 font-black hover:underline"
                        title="تنظیم خودکار بر اساس روزهای کاری"
                      >
                        محاسبه تقویم: {overtimeMonthInfo.suggestedDutyHours} س
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="400"
                      className="w-full p-3 bg-slate-50 border rounded-2xl font-mono font-black text-center text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      value={baseDutyHours}
                      onChange={e => setBaseDutyHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    />
                  </div>

                  {/* ساعت کاری روزانه */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700">معادل روزانه مرخصی (ساعت):</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      className="w-full p-3 bg-slate-50 border rounded-2xl font-mono font-black text-center text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      value={hoursPerDay}
                      onChange={e => setHoursPerDay(Math.max(1, parseInt(e.target.value, 10) || 8))}
                    />
                  </div>
                </div>

                {/* بنر راهنمای محاسباتی تقویم */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-slate-800 font-bold">
                    <span>ماه {overtimeMonthInfo.monthName}: <strong className="text-slate-900">{overtimeMonthInfo.totalDays} روز</strong></span>
                    <span className="opacity-30">|</span>
                    <span className="text-amber-900 font-black">جمعه‌ها: <strong>{overtimeMonthInfo.fridaysCount} روز</strong></span>
                    <span className="opacity-30">|</span>
                    <span className="text-rose-900 font-black">تعطیلات رسمی غیرجمعه: <strong>{overtimeMonthInfo.holidaysInMonthList.length} روز</strong></span>
                    <span className="opacity-30">|</span>
                    <span className="text-emerald-900 font-black">روزهای کاری خالص: <strong>{overtimeMonthInfo.workingDays} روز</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBaseDutyHours(overtimeMonthInfo.suggestedDutyHours)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded-xl font-black text-xs transition-all"
                  >
                    ⚡ اعمال موظفی استاندارد ({overtimeMonthInfo.suggestedDutyHours} ساعت)
                  </button>
                </div>

                {/* مدیریت روزهای تعطیل رسمی غیرجمعه در ایران */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-800">
                        تعریف روزهای تعطیل رسمی تقویم در این ماه (غیر از جمعه):
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold">
                        جمعه‌ها به طور خودکار شناسایی می‌شوند؛ سایر روزهای تعطیل رسمی ماه (نظیر شهادت، مبعث، عید نوروز و...) را در اینجا اضافه کنید.
                      </p>
                    </div>

                    {/* فرم افزودن تاریخ تعطیل رسمی جدید */}
                    <div className="flex items-center gap-2">
                      <ShamsiDatePicker
                        value={newHolidayDate}
                        onChange={d => setNewHolidayDate(d)}
                        theme="rose"
                        className="w-36"
                        inputClassName="p-2 bg-slate-50 border rounded-xl text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newHolidayDate) {
                            addOfficialHoliday(newHolidayDate);
                          }
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1 transition-all shadow-sm"
                      >
                        <Plus size={14}/> افزودن تعطیل رسمی
                      </button>
                    </div>
                  </div>

                  {/* چیپ‌های تعطیلات رسمی تعریف‌شده در این ماه */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {overtimeMonthInfo.holidaysInMonthList.map(hDate => (
                      <span
                        key={hDate}
                        className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1 rounded-xl text-xs font-mono font-bold"
                      >
                        <span>{hDate}</span>
                        <button
                          type="button"
                          onClick={() => removeOfficialHoliday(hDate)}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-full p-0.5"
                          title="حذف این روز تعطیل"
                        >
                          <X size={12}/>
                        </button>
                      </span>
                    ))}
                    {overtimeMonthInfo.holidaysInMonthList.length === 0 && (
                      <span className="text-[11px] text-slate-400 font-bold">
                        هنوز هیچ روز تعطیل رسمی (غیر از جمعه) برای این ماه تعریف نشده است.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* حالت ۱: جدول جامع و تجمیعی کلیه پرسنل */}
              {overtimeViewMode === 'ALL_TABLE' && (
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 no-print">
                    <div>
                      <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <Users size={20} className="text-indigo-600"/>
                        جدول محاسبات کارکرد، اضافه کار و تعطیلات کلیه پرسنل ({overtimeMonthInfo.monthName} {overtimeYear})
                      </h3>
                      <p className="text-xs text-slate-400 font-bold mt-1">
                        موظفی پایه ماه: {baseDutyHours} ساعت | فرمول: موظفی تعدیل‌شده = موظفی پایه - (مرخصی روزانه × ۸ س) - پاس ساعتی
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={exportOvertimeToExcel}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md transition-all"
                      >
                        <Download size={15}/> خروجی اکسل (CSV)
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintOvertime('ALL_TABLE')}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md transition-all"
                      >
                        <Printer size={15}/> چاپ جدول کلی پرسنل (A4)
                      </button>
                    </div>
                  </div>

                  {/* جدول تجمیعی */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-800 border-b border-slate-200">
                        <tr className="text-xs font-black">
                          <th className="p-3.5 rounded-r-2xl text-center text-slate-900">ردیف</th>
                          <th className="p-3.5 text-slate-900">نام و نام خانوادگی</th>
                          <th className="p-3.5 text-center text-slate-800">کد ملی</th>
                          <th className="p-3.5 text-center bg-blue-100/60 text-blue-950 font-black">کل کارکرد</th>
                          <th className="p-3.5 text-center text-rose-900 font-black">مرخصی (روز / کسر)</th>
                          <th className="p-3.5 text-center text-amber-900 font-black">پاس ساعتی</th>
                          <th className="p-3.5 text-center bg-slate-200/80 text-slate-900 font-black">جمع کسر از موظفی</th>
                          <th className="p-3.5 text-center bg-indigo-100/60 text-indigo-950 font-black">موظفی تعدیل‌شده</th>
                          <th className="p-3.5 text-center bg-emerald-100/70 text-emerald-950 font-black">اضافه‌کار خالص</th>
                          <th className="p-3.5 text-center text-rose-900 font-black">کسر کار</th>
                          <th className="p-3.5 text-center bg-amber-100/60 text-amber-950 font-black">جمعه‌کاری</th>
                          <th className="p-3.5 text-center bg-purple-100/60 text-purple-950 font-black">تعطیل‌کاری</th>
                          <th className="p-3.5 text-center rounded-l-2xl text-slate-800 no-print">عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeOvertimeStats.map((s, idx) => (
                          <tr key={s.empId} className="border-b border-slate-200 hover:bg-slate-50/80 transition-all font-bold">
                            <td className="p-3.5 text-center font-mono font-bold text-slate-700">{idx + 1}</td>
                            <td className="p-3.5 text-slate-900 font-black">{s.empName}</td>
                            <td className="p-3.5 text-center font-mono font-bold text-slate-800">{s.nationalId}</td>
                            <td className="p-3.5 text-center font-mono font-black text-blue-900 bg-blue-50/50">{s.formattedTotalWork}</td>
                            <td className="p-3.5 text-center font-mono font-bold text-rose-900">
                              {s.dailyLeaveDays > 0 ? `${s.dailyLeaveDays} روز (${s.formattedLeaveDeduction})` : '---'}
                            </td>
                            <td className="p-3.5 text-center font-mono font-bold text-amber-900">
                              {s.totalPassMinutes > 0 ? s.formattedPass : '---'}
                            </td>
                            <td className="p-3.5 text-center font-mono font-bold text-slate-900 bg-slate-100">
                              {s.totalDeductionMinutes > 0 ? s.formattedTotalDeduction : '۰'}
                            </td>
                            <td className="p-3.5 text-center font-mono font-black text-indigo-950 bg-indigo-50/50">
                              {s.formattedAdjustedDuty}
                            </td>
                            <td className="p-3.5 text-center font-mono font-black text-emerald-900 bg-emerald-50/80 text-sm">
                              {s.overtimeMinutes > 0 ? s.formattedOvertime : '---'}
                            </td>
                            <td className="p-3.5 text-center font-mono font-bold text-rose-900">
                              {s.deficitMinutes > 0 ? s.formattedDeficit : '---'}
                            </td>
                            <td className="p-3.5 text-center font-mono font-bold text-amber-950 bg-amber-50/50">
                              {s.fridayWorkDays > 0 ? `${s.fridayWorkDays} روز (${s.formattedFridayWork})` : '---'}
                            </td>
                            <td className="p-3.5 text-center font-mono font-bold text-purple-950 bg-purple-50/50">
                              {s.holidayWorkDays > 0 ? `${s.holidayWorkDays} روز (${s.formattedHolidayWork})` : '---'}
                            </td>
                            <td className="p-3.5 text-center no-print">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOvertimeEmpId(s.empId);
                                  setOvertimeViewMode('INDIVIDUAL');
                                }}
                                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-800 rounded-lg text-xs font-black transition-all"
                              >
                                مشاهده فیش
                              </button>
                            </td>
                          </tr>
                        ))}
                        {employeeOvertimeStats.length === 0 && (
                          <tr>
                            <td colSpan={13} className="text-center p-10 text-slate-500 font-bold">
                              کارمندی در سیستم یافت نشد.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* حالت ۲: فیش انفرادی کارمند (طراحی اداری و استاندارد A4) */}
              {overtimeViewMode === 'INDIVIDUAL' && !selectedEmp && (
                <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-200 text-center text-slate-500 font-bold">
                  کارمندی در سیستم برای نمایش فیش محاسبات یافت نشد.
                </div>
              )}

              {overtimeViewMode === 'INDIVIDUAL' && selectedEmp && (
                <div className="space-y-6">
                  {/* سلکتور کارمند و دکمه پرینت */}
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 whitespace-nowrap">انتخاب کارمند:</span>
                      <select
                        className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 min-w-[240px]"
                        value={selectedEmp.empId}
                        onChange={e => setSelectedOvertimeEmpId(e.target.value)}
                      >
                        {employeeOvertimeStats.map(s => (
                          <option key={s.empId} value={s.empId}>{s.empName} ({s.nationalId})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintOvertime('INDIVIDUAL', selectedEmp.empId)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg transition-all"
                      >
                        <Printer size={16}/> چاپ فیش این کارمند (A4)
                      </button>
                    </div>
                  </div>

                  {/* کارت فیش رسمی A4 کارمند */}
                  <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-md border border-slate-200 text-right space-y-8 max-w-4xl mx-auto">
                    {/* سربرگ فیش */}
                    <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6">
                      <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                          فیش محاسبه کارکرد، اضافه‌کار و تعطیل‌کاری
                        </h2>
                        <p className="text-xs text-slate-600 font-bold mt-1">
                          دوره: ماه {overtimeMonthInfo.monthName} سال {overtimeYear} (از {overtimeMonthInfo.startDate} تا {overtimeMonthInfo.endDate})
                        </p>
                      </div>
                      <div className="text-left font-mono">
                        <span className="text-xs font-black text-emerald-700 block uppercase tracking-wider">BaharTime HR</span>
                        <span className="text-[11px] text-slate-500 font-bold">تاریخ صدور: {getShamsiDate()}</span>
                      </div>
                    </div>

                    {/* مشخصات پرسنلی */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px] font-bold">نام و نام خانوادگی:</span>
                        <strong className="text-slate-900 text-sm font-black">{selectedEmp.empName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] font-bold">کد ملی:</span>
                        <strong className="text-slate-900 font-mono text-sm font-black">{selectedEmp.nationalId}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] font-bold">موظفی پایه ماه:</span>
                        <strong className="text-slate-900 font-mono font-black">{selectedEmp.formattedBaseDuty}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] font-bold">روزهای کاری تقویم:</span>
                        <strong className="text-slate-900 font-black">{overtimeMonthInfo.workingDays} روز کاری</strong>
                      </div>
                    </div>

                    {/* جدول ریز محاسبات و کسر از موظفی */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-800 border-b border-slate-200 pb-2">ریز محاسبات کسر از موظفی و اضافه‌کار:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                          <div className="flex justify-between items-center text-slate-700 font-bold">
                            <span>۱. ساعات موظفی پایه ماه:</span>
                            <span className="font-mono font-black text-slate-900">{selectedEmp.formattedBaseDuty}</span>
                          </div>
                          <div className="flex justify-between items-center text-rose-900 font-bold">
                            <span>۲. کسر بابت مرخصی روزانه ({selectedEmp.dailyLeaveDays} روز × {hoursPerDay} س):</span>
                            <span className="font-mono font-black">- {selectedEmp.formattedLeaveDeduction}</span>
                          </div>
                          <div className="flex justify-between items-center text-amber-900 font-bold">
                            <span>۳. کسر بابت پاس ساعتی استفاده‌شده:</span>
                            <span className="font-mono font-black">- {selectedEmp.formattedPass}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-slate-900 font-black">
                            <span>مجموع کسر از موظفی:</span>
                            <span className="font-mono text-rose-800 font-black">- {selectedEmp.formattedTotalDeduction}</span>
                          </div>
                        </div>

                        <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-2 text-xs">
                          <div className="flex justify-between items-center text-indigo-950 font-black">
                            <span>موظفی نهایی و تعدیل‌شده کارمند:</span>
                            <span className="font-mono font-black text-sm text-indigo-900">{selectedEmp.formattedAdjustedDuty}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-800 font-bold">
                            <span>کل کارکرد واقعی (حضوری + دورکاری):</span>
                            <span className="font-mono font-black text-sm text-blue-900">{selectedEmp.formattedTotalWork}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 text-[11px] pt-1 font-bold">
                            <span>(حضور فیزیکی: {Math.floor(selectedEmp.totalPhysicalMinutes / 60)}س | دورکاری: {Math.floor(selectedEmp.totalRemoteMinutes / 60)}س)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* کادر شاخص اضافه‌کار خالص کارمند (طراحی فلت و بدون سایه‌روشن با کنتراست تیره و خوانا روی زمینه سفید) */}
                    <div className="p-6 bg-emerald-50 border-2 border-emerald-300 rounded-3xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-emerald-800 block">نتیجه نهایی محاسبات:</span>
                        <h3 className="text-lg md:text-xl font-black text-slate-900">
                          {selectedEmp.overtimeMinutes > 0 ? 'میزان اضافه‌کار خالص تاییدشده' : 'وضعیت کارکرد کارمند'}
                        </h3>
                      </div>
                      <div className="text-center sm:text-left">
                        {selectedEmp.overtimeMinutes > 0 ? (
                          <div className="text-2xl md:text-4xl font-mono font-black tracking-tight text-emerald-900">
                            {selectedEmp.formattedOvertime}
                            <span className="text-xs font-bold text-emerald-700 block mt-1">({selectedEmp.decimalOvertimeHours} ساعت اعشاری)</span>
                          </div>
                        ) : selectedEmp.deficitMinutes > 0 ? (
                          <div className="text-xl md:text-2xl font-mono font-black text-rose-800">
                            کسر کار: {selectedEmp.formattedDeficit}
                          </div>
                        ) : (
                          <div className="text-lg font-black text-slate-800">
                            کارکرد دقیقاً منطبق بر موظفی
                          </div>
                        )}
                      </div>
                    </div>

                    {/* آمار جمعه‌کاری و تعطیل‌کاری */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* باکس جمعه‌کاری */}
                      <div className="p-5 bg-amber-50 rounded-2xl border border-amber-300 space-y-2">
                        <div className="flex items-center justify-between text-amber-950 font-black">
                          <span className="text-xs">جمعه‌کاری (کارکرد در روزهای جمعه):</span>
                          <span className="text-xs font-mono font-black bg-amber-200/90 text-amber-950 px-2 py-0.5 rounded-lg border border-amber-300">
                            {selectedEmp.fridayWorkDays} روز جمعه
                          </span>
                        </div>
                        <div className="text-base font-black text-amber-900 font-mono">
                          مجموع ساعات جمعه‌کاری: {selectedEmp.formattedFridayWork}
                        </div>
                        <p className="text-[10px] text-amber-800 font-bold">
                          محاسبه‌شده از ترددهای ثبت‌شده در روزهای جمعه ماه
                        </p>
                      </div>

                      {/* باکس تعطیل‌کاری */}
                      <div className="p-5 bg-purple-50 rounded-2xl border border-purple-300 space-y-2">
                        <div className="flex items-center justify-between text-purple-950 font-black">
                          <span className="text-xs">تعطیل‌کاری رسمی (غیر از جمعه):</span>
                          <span className="text-xs font-mono font-black bg-purple-200/90 text-purple-950 px-2 py-0.5 rounded-lg border border-purple-300">
                            {selectedEmp.holidayWorkDays} روز تعطیل
                          </span>
                        </div>
                        <div className="text-base font-black text-purple-900 font-mono">
                          مجموع ساعات تعطیل‌کاری: {selectedEmp.formattedHolidayWork}
                        </div>
                        <p className="text-[10px] text-purple-800 font-bold">
                          محاسبه‌شده بر اساس روزهای تعطیل رسمی تعریف‌شده در تقویم ماه
                        </p>
                      </div>
                    </div>

                    {/* بخش امضاها مناسب اسناد رسمی اداری و پرینت A4 */}
                    <div className="pt-8 border-t-2 border-dashed border-slate-300 grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-xs">
                      <div className="space-y-8">
                        <span className="text-slate-500 font-bold block">امضای کارمند:</span>
                        <div className="border-b border-slate-300 w-28 mx-auto"></div>
                      </div>
                      <div className="space-y-8">
                        <span className="text-slate-500 font-bold block">کارگزینی و اداری:</span>
                        <div className="border-b border-slate-300 w-28 mx-auto"></div>
                      </div>
                      <div className="space-y-8">
                        <span className="text-slate-500 font-bold block">امور مالی و حسابداری:</span>
                        <div className="border-b border-slate-300 w-28 mx-auto"></div>
                      </div>
                      <div className="space-y-8">
                        <span className="text-slate-500 font-bold block">تایید مدیریت عامل:</span>
                        <div className="border-b border-slate-300 w-28 mx-auto"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* کانتینر مخصوص چاپ A4 (فقط هنگام ارسال دستور پرینت ظاهر می‌شود) */}
              <div className="print-only">
                {activePrintTarget === 'INDIVIDUAL' && selectedEmp && (
                  <div className="p-8 space-y-6 text-right">
                    <div className="text-center border-b-2 border-black pb-4 space-y-1">
                      <h1 className="text-xl font-black">سامانه مدیریت منابع انسانی و تردد BaharTime</h1>
                      <h2 className="text-base font-black">فیش رسمی محاسبه کارکرد، اضافه‌کار و تعطیل‌کاری پرسنل</h2>
                      <p className="text-xs text-gray-600">
                        دوره محاسباتی: ماه {overtimeMonthInfo.monthName} {overtimeYear} (از {overtimeMonthInfo.startDate} تا {overtimeMonthInfo.endDate}) | تاریخ چاپ: {getShamsiDate()}
                      </p>
                    </div>

                    <div className="grid grid-cols-4 gap-4 p-3 border border-gray-400 text-xs">
                      <div>نام کارمند: <strong>{selectedEmp.empName}</strong></div>
                      <div>کد ملی: <strong className="font-mono">{selectedEmp.nationalId}</strong></div>
                      <div>موظفی پایه ماه: <strong className="font-mono">{selectedEmp.formattedBaseDuty}</strong></div>
                      <div>روزهای کاری ماه: <strong>{overtimeMonthInfo.workingDays} روز</strong></div>
                    </div>

                    <table className="w-full text-right text-xs border border-gray-400 border-collapse">
                      <tbody>
                        <tr className="border-b border-gray-300">
                          <td className="p-2.5 font-bold bg-gray-50 border-l border-gray-300 w-1/2">۱. ساعات موظفی پایه ماه:</td>
                          <td className="p-2.5 font-mono">{selectedEmp.formattedBaseDuty}</td>
                        </tr>
                        <tr className="border-b border-gray-300">
                          <td className="p-2.5 font-bold bg-gray-50 border-l border-gray-300">۲. کسر از موظفی بابت مرخصی روزانه ({selectedEmp.dailyLeaveDays} روز):</td>
                          <td className="p-2.5 font-mono text-red-700">- {selectedEmp.formattedLeaveDeduction}</td>
                        </tr>
                        <tr className="border-b border-gray-300">
                          <td className="p-2.5 font-bold bg-gray-50 border-l border-gray-300">۳. کسر از موظفی بابت پاس ساعتی استفاده‌شده:</td>
                          <td className="p-2.5 font-mono text-red-700">- {selectedEmp.formattedPass}</td>
                        </tr>
                        <tr className="border-b border-gray-300">
                          <td className="p-2.5 font-bold bg-gray-100 border-l border-gray-300">مجموع کسر از موظفی کارمند:</td>
                          <td className="p-2.5 font-mono font-bold">- {selectedEmp.formattedTotalDeduction}</td>
                        </tr>
                        <tr className="border-b border-gray-300">
                          <td className="p-2.5 font-bold bg-gray-100 border-l border-gray-300">موظفی نهایی و تعدیل‌شده کارمند:</td>
                          <td className="p-2.5 font-mono font-bold text-indigo-900">{selectedEmp.formattedAdjustedDuty}</td>
                        </tr>
                        <tr className="border-b border-gray-300">
                          <td className="p-2.5 font-bold bg-gray-50 border-l border-gray-300">کل کارکرد واقعی پرسنل (حضور فیزیکی + دورکاری تاییدشده):</td>
                          <td className="p-2.5 font-mono font-bold">{selectedEmp.formattedTotalWork}</td>
                        </tr>
                        <tr className="border-b border-gray-300">
                          <td className="p-2.5 font-black bg-gray-200 border-l border-gray-300 text-sm">اضافه‌کار خالص کارمند:</td>
                          <td className="p-2.5 font-mono font-black text-sm text-green-800">
                            {selectedEmp.overtimeMinutes > 0 ? `${selectedEmp.formattedOvertime} (${selectedEmp.decimalOvertimeHours} ساعت)` : '۰ ساعت'}
                          </td>
                        </tr>
                        <tr className="border-b border-gray-300">
                          <td className="p-2.5 font-bold bg-gray-50 border-l border-gray-300">جمعه‌کاری (تعداد روز و ساعات کار در جمعه):</td>
                          <td className="p-2.5 font-mono">{selectedEmp.fridayWorkDays} روز ({selectedEmp.formattedFridayWork})</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-bold bg-gray-50 border-l border-gray-300">تعطیل‌کاری رسمی (تعداد روز و ساعات کار در تعطیل رسمی):</td>
                          <td className="p-2.5 font-mono">{selectedEmp.holidayWorkDays} روز ({selectedEmp.formattedHolidayWork})</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="pt-12 grid grid-cols-4 gap-4 text-center text-xs page-break-inside-avoid">
                      <div className="space-y-12">
                        <span>امضای کارمند</span>
                        <div className="border-b border-black w-24 mx-auto"></div>
                      </div>
                      <div className="space-y-12">
                        <span>کارگزینی و اداری</span>
                        <div className="border-b border-black w-24 mx-auto"></div>
                      </div>
                      <div className="space-y-12">
                        <span>امور مالی و حسابداری</span>
                        <div className="border-b border-black w-24 mx-auto"></div>
                      </div>
                      <div className="space-y-12">
                        <span>تایید مدیریت عامل</span>
                        <div className="border-b border-black w-24 mx-auto"></div>
                      </div>
                    </div>
                  </div>
                )}

                {activePrintTarget === 'ALL_TABLE' && (
                  <div className="p-6 space-y-4 text-right">
                    <div className="text-center border-b-2 border-black pb-3 space-y-1">
                      <h1 className="text-lg font-black">گزارش تجمیعی کارکرد، موظفی، اضافه‌کار و تعطیلات پرسنل</h1>
                      <p className="text-xs">
                        دوره: ماه {overtimeMonthInfo.monthName} {overtimeYear} | ساعات موظفی پایه: {baseDutyHours} ساعت | تاریخ چاپ: {getShamsiDate()}
                      </p>
                    </div>

                    <table className="w-full text-right text-[10px] border border-gray-400 border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-400 font-bold">
                          <th className="p-2 text-center border-l">ردیف</th>
                          <th className="p-2 border-l">نام کارمند</th>
                          <th className="p-2 text-center border-l">کد ملی</th>
                          <th className="p-2 text-center border-l">کل کارکرد</th>
                          <th className="p-2 text-center border-l">مرخصی (روز/کسر)</th>
                          <th className="p-2 text-center border-l">پاس ساعتی</th>
                          <th className="p-2 text-center border-l">جمع کسر موظفی</th>
                          <th className="p-2 text-center border-l">موظفی تعدیل‌شده</th>
                          <th className="p-2 text-center border-l">اضافه‌کار</th>
                          <th className="p-2 text-center border-l">کسر کار</th>
                          <th className="p-2 text-center border-l">جمعه‌کاری</th>
                          <th className="p-2 text-center">تعطیل‌کاری</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeOvertimeStats.map((s, idx) => (
                          <tr key={s.empId} className="border-b border-gray-300">
                            <td className="p-2 text-center font-mono border-l">{idx + 1}</td>
                            <td className="p-2 font-bold border-l">{s.empName}</td>
                            <td className="p-2 text-center font-mono border-l">{s.nationalId}</td>
                            <td className="p-2 text-center font-mono border-l">{s.formattedTotalWork}</td>
                            <td className="p-2 text-center font-mono border-l">{s.dailyLeaveDays > 0 ? `${s.dailyLeaveDays}ر (${s.formattedLeaveDeduction})` : '---'}</td>
                            <td className="p-2 text-center font-mono border-l">{s.totalPassMinutes > 0 ? s.formattedPass : '---'}</td>
                            <td className="p-2 text-center font-mono border-l">{s.totalDeductionMinutes > 0 ? s.formattedTotalDeduction : '۰'}</td>
                            <td className="p-2 text-center font-mono font-bold border-l">{s.formattedAdjustedDuty}</td>
                            <td className="p-2 text-center font-mono font-bold border-l text-green-800">{s.overtimeMinutes > 0 ? s.formattedOvertime : '---'}</td>
                            <td className="p-2 text-center font-mono border-l text-red-700">{s.deficitMinutes > 0 ? s.formattedDeficit : '---'}</td>
                            <td className="p-2 text-center font-mono border-l">{s.fridayWorkDays > 0 ? `${s.fridayWorkDays}ر (${s.formattedFridayWork})` : '---'}</td>
                            <td className="p-2 text-center font-mono">{s.holidayWorkDays > 0 ? `${s.holidayWorkDays}ر (${s.formattedHolidayWork})` : '---'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="pt-10 grid grid-cols-3 gap-4 text-center text-xs page-break-inside-avoid">
                      <div className="space-y-10">
                        <span>امور اداری و کارگزینی</span>
                        <div className="border-b border-black w-24 mx-auto"></div>
                      </div>
                      <div className="space-y-10">
                        <span>امور مالی و حسابداری</span>
                        <div className="border-b border-black w-24 mx-auto"></div>
                      </div>
                      <div className="space-y-10">
                        <span>مدیریت عامل</span>
                        <div className="border-b border-black w-24 mx-auto"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        {activeMenu === 'MAINTENANCE' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
            <h2 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-2"><Database className="text-emerald-600"/> نگهداری سیستم</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-8 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                <h3 className="font-black text-emerald-800 mb-4 flex items-center gap-2"><Download size={20}/> پشتیبان‌گیری کامل</h3>
                <p className="text-xs text-emerald-600 mb-6 leading-relaxed">دریافت فایل CSV از تمامی ترددهای ثبت شده در سیستم برای بایگانی آفلاین.</p>
                <button onClick={exportToExcel} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">دریافت فایل پشتیبان</button>
              </div>
              
              <div className="p-8 bg-rose-50 rounded-[2rem] border border-rose-100">
                <h3 className="font-black text-rose-800 mb-4 flex items-center gap-2"><Trash2 size={20}/> پاکسازی دیتابیس</h3>
                <p className="text-xs text-rose-600 mb-6 leading-relaxed">حذف ترددهای قدیمی برای افزایش سرعت برنامه. لطفاً تاریخ مورد نظر را وارد کنید.</p>
                <div className="flex items-center gap-2">
                  <ShamsiDatePicker
                    value={purgeDate}
                    onChange={d => setPurgeDate(d)}
                    placeholder="1402/12/29"
                    theme="slate"
                    className="flex-1"
                    inputClassName="p-3.5 bg-white border rounded-2xl"
                  />
                  <button 
                    onClick={() => {
                      if (!purgeDate) {
                        alert('لطفاً تاریخ پاکسازی را انتخاب نمایید.');
                        return;
                      }
                      handlePurge(purgeDate);
                    }} 
                    className="bg-rose-600 text-white px-6 py-3.5 rounded-2xl font-black text-xs hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                  >
                    پاکسازی
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* مودال ویرایش درخواست */}
      {editingRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100 w-full max-w-md space-y-4 text-right rtl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-black text-slate-800 mb-4 border-b pb-3">ویرایش درخواست کارمند</h3>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">نوع درخواست</label>
              <select 
                className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-xs outline-none" 
                value={editingRequest.type} 
                onChange={e => setEditingRequest({...editingRequest, type: e.target.value as any})}
              >
                <option value="REMOTE_WORK">دورکاری</option>
                <option value="HOURLY_PASS">پاس ساعتی</option>
                <option value="DAILY_LEAVE">مرخصی روزانه</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">تاریخ درخواست (شمسی)</label>
              <ShamsiDatePicker
                value={editingRequest.shamsi_date}
                onChange={d => setEditingRequest({...editingRequest, shamsi_date: d})}
                theme="emerald"
                className="w-full"
                inputClassName="p-3.5 bg-slate-50 border rounded-2xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">مقدار (روز / ساعت اعشاری)</label>
              <input 
                type="number" 
                step="0.01"
                className="w-full p-4 bg-slate-50 border rounded-2xl font-bold font-mono text-center outline-none" 
                value={editingRequest.amount} 
                onChange={e => setEditingRequest({...editingRequest, amount: parseFloat(e.target.value) || 0})} 
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">توضیحات</label>
              <textarea 
                className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs outline-none" 
                rows={3}
                value={editingRequest.description} 
                onChange={e => setEditingRequest({...editingRequest, description: e.target.value})} 
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button 
                onClick={async () => {
                  const { error } = await supabase.from('leave_requests').update({
                    type: editingRequest.type,
                    shamsi_date: editingRequest.shamsi_date,
                    amount: editingRequest.amount,
                    description: editingRequest.description
                  }).eq('id', editingRequest.id);
                  if (!error) {
                    setEditingRequest(null);
                    fetchData();
                  } else {
                    alert('خطا در بروزرسانی: ' + error.message);
                  }
                }} 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl font-black text-sm text-center shadow-lg transition-all"
              >
                ذخیره تغییرات
              </button>
              <button 
                onClick={() => setEditingRequest(null)} 
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 p-4 rounded-2xl font-black text-sm text-center transition-all"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال ویرایش تردد */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-100 w-full max-w-md space-y-4 text-right rtl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-black text-slate-800 mb-4 border-b pb-3 flex items-center gap-2">
              <Edit2 className="text-emerald-600" size={20}/> ویرایش تردد پرسنل
            </h3>

            <div className="p-3 bg-slate-50 rounded-2xl border text-xs font-bold text-slate-600">
              <span>کارمند: </span>
              <strong className="text-slate-800">
                {editingLog.employees?.name || employees.find(e => e.id === editingLog.employee_id)?.name || 'نامشخص'}
              </strong>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">نوع تردد</label>
              <select 
                className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                value={editingLog.type} 
                onChange={e => setEditingLog({...editingLog, type: e.target.value as any})}
              >
                <option value="CLOCK_IN">ورود پرسنل</option>
                <option value="CLOCK_OUT">خروج پرسنل</option>
                <option value="HOURLY_LEAVE_START">شروع پاس ساعتی</option>
                <option value="HOURLY_LEAVE_END">پایان پاس ساعتی</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">تاریخ تردد (شمسی)</label>
              <ShamsiDatePicker
                value={editingLog.shamsi_date}
                onChange={d => setEditingLog({...editingLog, shamsi_date: d})}
                theme="emerald"
                className="w-full"
                inputClassName="p-3.5 bg-slate-50 border rounded-2xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400">ساعت تردد</label>
              <input 
                type="time" 
                className="w-full p-4 bg-slate-50 border rounded-2xl font-black font-mono text-center outline-none focus:ring-2 focus:ring-emerald-500" 
                value={editingLog.time} 
                onChange={e => setEditingLog({...editingLog, time: e.target.value})} 
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button 
                onClick={async () => {
                  let calculatedTimestamp = editingLog.timestamp;
                  try {
                    const dParts = editingLog.shamsi_date.split('/').map(Number);
                    const tParts = editingLog.time.split(':').map(Number);
                    if (dParts.length === 3 && tParts.length >= 2) {
                      const jYear = dParts[0];
                      const jMonth = dParts[1];
                      const jDay = dParts[2];
                      const hour = tParts[0];
                      const minute = tParts[1];
                      const approxGregYear = jYear + 621;
                      calculatedTimestamp = new Date(approxGregYear, jMonth - 1, jDay, hour, minute).getTime();
                    }
                  } catch (e) {
                    console.error(e);
                  }

                  const { error } = await supabase.from('attendance_logs').update({
                    type: editingLog.type,
                    shamsi_date: toEnglishDigits(editingLog.shamsi_date.trim()),
                    time: toEnglishDigits(editingLog.time.trim()),
                    timestamp: calculatedTimestamp
                  }).eq('id', editingLog.id);

                  if (!error) {
                    setEditingLog(null);
                    fetchAttendanceLogs();
                  } else {
                    alert('خطا در بروزرسانی تردد: ' + error.message);
                  }
                }} 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl font-black text-sm text-center shadow-lg transition-all"
              >
                ذخیره تغییرات
              </button>
              <button 
                onClick={() => setEditingLog(null)} 
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 p-4 rounded-2xl font-black text-sm text-center transition-all"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuBtn = React.memo(({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-black text-xs transition-all ${active ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
    {icon} <span>{label}</span>
  </button>
));

export default AdminPanel;
