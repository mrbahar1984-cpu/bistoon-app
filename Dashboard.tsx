import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, LeaveType, AttendanceLog, DirectMessage } from './types';
import { getShamsiDate, getShamsiTime, getDayName, toEnglishDigits, isHoliday } from './jalali';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { 
  Play, Square, Coffee, Clock, Send, History, 
  LogIn, RefreshCcw, Flower2, CheckCircle, 
  Users, Wifi, WifiOff, MessageCircle, Download,
  ShieldAlert, Home, CalendarDays, FileEdit, TrendingUp, Sparkles, Filter,
  Edit2, AlertTriangle, Check, X, Plus, ChevronRight, ChevronLeft, Calendar,
  ArrowRight, Info, CheckCircle2, ChevronDown
} from 'lucide-react';

// تعاریف و توابع کمکی مستقل برای جلوگیری از خطای ایمپورت در صورت قدیمی بودن فایل‌های پروژه
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

const shamsiMonthNames = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

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

const getCurrentMonthRange = (referenceDateStr?: string) => {
  const today = referenceDateStr ? referenceDateStr : getShamsiDate();
  const parsed = parseShamsiDate(today) || { year: 1403, month: 1, day: 1 };
  const totalDays = getDaysInShamsiMonth(parsed.year, parsed.month);
  const startDate = formatShamsiDate(parsed.year, parsed.month, 1);
  const endDate = formatShamsiDate(parsed.year, parsed.month, totalDays);
  const monthName = shamsiMonthNames[parsed.month - 1] || '';
  return { startDate, endDate, monthName, year: parsed.year, month: parsed.month };
};

const calculateMonthPerformance = (
  logs: AttendanceLog[],
  requests: LeaveRequest[],
  year: number,
  month: number
): MonthPerformanceStats => {
  const toEn = (str: string): string => {
    if (!str) return "";
    const p = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
    let res = String(str);
    for (let i = 0; i < 10; i++) res = res.replace(p[i], i.toString());
    return res;
  };

  const totalDays = getDaysInShamsiMonth(year, month);
  const startDate = `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/01`;
  const endDate = `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(totalDays).padStart(2, '0')}`;
  const startStandard = toEn(startDate);
  const endStandard = toEn(endDate);
  const monthName = shamsiMonthNames[month - 1] || '';

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

interface Props {
  currentUser: EmployeeData | null;
  onLogin: (user: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ currentUser, onLogin }) => {
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'MAIN' | 'FULL_HISTORY' | 'REQUEST_STATUS' | 'MESSAGES'>('MAIN');
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  
  // Direct Messages state
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [hasUnreadMsg, setHasUnreadMsg] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', nationalId: '', password: '' });

  // Separate modes for: REMOTE_WORK (ثبت دورکاری) | LEAVE (ثبت مرخصی)
  const [actionCategory, setActionCategory] = useState<'REMOTE_WORK' | 'LEAVE'>('REMOTE_WORK');
  const [leaveSubCategory, setLeaveSubCategory] = useState<'DAILY_LEAVE' | 'HOURLY_PASS'>('DAILY_LEAVE');

  // زیرتب‌های بخش تاریخچه تردد: تاریخچه ریز ترددها یا خلاصه کارکرد ماه‌های قبل
  const [historySubTab, setHistorySubTab] = useState<'DETAILED_LOGS' | 'PAST_MONTHS_SUMMARY'>('DETAILED_LOGS');
  const [selectedPastMonthKey, setSelectedPastMonthKey] = useState<string>('');
  const [historyDateFilter, setHistoryDateFilter] = useState<'ALL' | 'CURRENT_MONTH' | 'LAST_30_DAYS'>('ALL');

  // مودال اختصاصی درخواست اصلاح تردد یا ثبت تردد ثبت‌نشده
  const [correctionModal, setCorrectionModal] = useState<{
    isOpen: boolean;
    date: string;
    type: LogType;
    hour: number;
    minute: number;
    desc: string;
    originalTime?: string;
    logId?: string;
    isEdit: boolean;
  }>({
    isOpen: false,
    date: getShamsiDate(),
    type: LogType.CLOCK_IN,
    hour: 8,
    minute: 0,
    desc: '',
    originalTime: undefined,
    logId: undefined,
    isEdit: false
  });

  const [reqForm, setReqForm] = useState({ 
    type: 'REMOTE_WORK' as LeaveType, 
    date: getShamsiDate(), 
    h: 4, m: 0, 
    days: 1,
    desc: '',
    passType: 'شخصی',
    dailyType: 'استحقاقی',
    startDate: getShamsiDate(),
    endDate: getShamsiDate(),
    passStartH: 8,
    passStartM: 0,
    passEndH: 10,
    passEndM: 0
  });
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REMOTE_WORK' | 'LEAVE' | 'CORRECT_LOG'>('ALL');

  // آمار عملکرد ماه جاری کاربر (استفاده از موتور محاسباتی واحد)
  const currentMonthStats = useMemo(() => {
    if (!currentUser) {
      return {
        year: 1403,
        month: 7,
        monthName: '',
        startDate: '',
        endDate: '',
        totalWorkMinutes: 0,
        totalPhysicalMinutes: 0,
        totalRemoteMinutes: 0,
        totalPassMinutes: 0,
        dailyLeaveDays: 0,
        formattedWork: '۰ ساعت',
        formattedPhysicalWork: '۰ ساعت',
        formattedRemote: '۰ ساعت',
        formattedPass: '۰ ساعت',
        hasActivity: false
      };
    }

    const today = getShamsiDate();
    const parsed = parseShamsiDate(today) || { year: 1403, month: 7, day: 1 };
    return calculateMonthPerformance(currentUser.logs || [], myRequests || [], parsed.year, parsed.month);
  }, [currentUser?.logs, myRequests]);

  // آمار خلاصه عملکرد ماه‌های گذشته (انتقال خودکار بعد از پایان هر ماه)
  const pastMonthsStats = useMemo(() => {
    if (!currentUser) return [];
    const today = getShamsiDate();
    const parsed = parseShamsiDate(today) || { year: 1403, month: 7, day: 1 };
    const currentYear = parsed.year;
    const currentMonth = parsed.month;

    const list: MonthPerformanceStats[] = [];

    // ۱. ماه‌های قبلی سال جاری
    for (let m = currentMonth - 1; m >= 1; m--) {
      list.push(calculateMonthPerformance(currentUser.logs || [], myRequests || [], currentYear, m));
    }

    // ۲. ماه‌های سال قبل (در صورت وجود تردد یا به صورت آرشیو سالانه)
    const hasLastYearData = (currentUser.logs || []).some(l => {
      const p = parseShamsiDate(l.shamsi_date);
      return p && p.year === currentYear - 1;
    });

    if (hasLastYearData || currentMonth <= 3) {
      for (let m = 12; m >= 1; m--) {
        const stats = calculateMonthPerformance(currentUser.logs || [], myRequests || [], currentYear - 1, m);
        if (stats.hasActivity || hasLastYearData) {
          list.push(stats);
        }
      }
    }

    return list;
  }, [currentUser?.logs, myRequests]);

  // ماه انتخاب‌شده برای نمایش خلاصه عملکرد ماه قبل
  const activePastMonthStats = useMemo(() => {
    if (pastMonthsStats.length === 0) return null;
    if (selectedPastMonthKey) {
      const found = pastMonthsStats.find(s => `${s.year}-${s.month}` === selectedPastMonthKey);
      if (found) return found;
    }
    return pastMonthsStats[0];
  }, [pastMonthsStats, selectedPastMonthKey]);

  const incompleteAttendances = useMemo(() => {
    if (!currentUser || !currentUser.logs) return [];
    
    const today = toEnglishDigits(getShamsiDate());
    const logsByDate: Record<string, AttendanceLog[]> = {};
    
    // Group all logs except today
    currentUser.logs.forEach(log => {
      const date = toEnglishDigits(log.shamsi_date);
      if (date === today) return; // Skip today!
      if (!logsByDate[date]) logsByDate[date] = [];
      logsByDate[date].push(log);
    });

    const listWithIssues: { date: string; issues: string[] }[] = [];
    
    // Check each date
    Object.entries(logsByDate).forEach(([date, dayLogs]) => {
      // Sort chronologically
      const sorted = [...dayLogs].sort((a, b) => {
        const timeToMinutes = (timeStr: string) => {
          if (!timeStr) return 0;
          const parts = toEnglishDigits(timeStr).trim().split(':').map(Number);
          if (parts.length >= 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
          return 0;
        };
        const timeSecA = timeToMinutes(a.time);
        const timeSecB = timeToMinutes(b.time);
        if (timeSecA !== timeSecB) return timeSecA - timeSecB;
        return a.timestamp - b.timestamp;
      });

      const dayIssues: string[] = [];
      let activeIn: any = null;
      let consecutiveIns = 0;
      let consecutiveOuts = 0;
      
      sorted.forEach((l) => {
        const typeStr = l.type as string;
        const isIn = typeStr === LogType.CLOCK_IN || typeStr === 'CLOCK_IN' || typeStr === 'ورود';
        const isOut = typeStr === LogType.CLOCK_OUT || typeStr === 'CLOCK_OUT' || typeStr === 'خروج';
        
        if (isIn) {
          if (activeIn) {
            consecutiveIns++;
          }
          activeIn = l;
        } else if (isOut) {
          if (!activeIn) {
            consecutiveOuts++;
          }
          activeIn = null;
        }
      });

      if (activeIn) {
        dayIssues.push("خروج ثبت نشده است");
      }
      if (consecutiveIns > 0) {
        dayIssues.push("ورود مکرر بدون خروج ثبت شده است");
      }
      if (consecutiveOuts > 0) {
        dayIssues.push("ورود ثبت نشده است");
      }

      // Pass check
      let activePassStart: any = null;
      let consecutivePassStarts = 0;
      let consecutivePassEnds = 0;

      sorted.forEach((l) => {
        const typeStr = l.type as string;
        const isStart = typeStr === LogType.HOURLY_LEAVE_START || typeStr === 'HOURLY_LEAVE_START' || typeStr === 'شروع پاس' || typeStr === 'پاس';
        const isEnd = typeStr === LogType.HOURLY_LEAVE_END || typeStr === 'HOURLY_LEAVE_END' || typeStr === 'پایان پاس';
        
        if (isStart) {
          if (activePassStart) {
            consecutivePassStarts++;
          }
          activePassStart = l;
        } else if (isEnd) {
          if (!activePassStart) {
            consecutivePassEnds++;
          }
          activePassStart = null;
        }
      });

      if (activePassStart) {
        dayIssues.push("پایان پاس ساعتی ثبت نشده است");
      }
      if (consecutivePassStarts > 0) {
        dayIssues.push("شروع پاس ساعتی مکرر ثبت شده است");
      }
      if (consecutivePassEnds > 0) {
        dayIssues.push("شروع پاس ساعتی ثبت نشده است (یا پایان بدون شروع)");
      }

      if (dayIssues.length > 0) {
        listWithIssues.push({
          date,
          issues: dayIssues
        });
      }
    });

    return listWithIssues.sort((a, b) => b.date.localeCompare(a.date));
  }, [currentUser?.logs]);

  // مدیریت هوشمند نصب PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // بررسی اینکه آیا همین الان در حالت نصب شده است یا خیر
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('مرورگر شما در حال حاضر اجازه نصب مستقیم را نمی‌دهد. لطفاً از تنظیمات مرورگر گزینه Add to Home Screen را بزنید.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    }
  };

  const fetchDirectMessages = useCallback(async () => {
    if (!currentUser) return;
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    try {
      await supabase.from('direct_messages').delete().lt('timestamp', cutoff);
    } catch (e) {
      console.warn("Notice: Old message purge step fallback:", e);
    }

    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('employee_id', currentUser.id)
      .gte('timestamp', cutoff)
      .order('timestamp', { ascending: true });

    if (data) {
      setDirectMessages(data as DirectMessage[]);
      const unread = data.some(m => m.sender === 'ADMIN' && !m.is_read);
      setHasUnreadMsg(unread);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;

    fetchDirectMessages();

    const channel = supabase
      .channel('attendance-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => fetchColleagues())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `employee_id=eq.${currentUser.id}` }, () => fetchDirectMessages())
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    const interval = setInterval(() => {
        loadDataSilent();
        fetchDirectMessages();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [currentUser?.id, fetchDirectMessages]);

  const loadDataSilent = async () => {
    if (!currentUser) return;
    const { data: reqs } = await supabase.from('leave_requests').select('*').eq('employee_id', currentUser.id).order('timestamp', { ascending: false });
    if (reqs) setMyRequests(reqs);
    fetchColleagues();
  };

  const loadData = async () => {
    if (!currentUser) return;
    setSyncing(true);
    const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', currentUser.id).order('timestamp', { ascending: false });
    const { data: reqs } = await supabase.from('leave_requests').select('*').eq('employee_id', currentUser.id).order('timestamp', { ascending: false });
    if (logs) onLogin({ ...currentUser, logs });
    if (reqs) setMyRequests(reqs);
    fetchColleagues();
    fetchDirectMessages();
    setSyncing(false);
  };

  const fetchColleagues = async () => {
    const today = toEnglishDigits(getShamsiDate());
    const { data: emps } = await supabase.from('employees').select('id, name');
    const { data: logs } = await supabase.from('attendance_logs').select('*').eq('shamsi_date', today);
    
    if (emps && logs) {
      const mapped = emps.map(e => {
        const eLogs = logs.filter(l => l.employee_id === e.id).sort((a,b) => b.timestamp - a.timestamp);
        const last = eLogs[0];
        
        const typeLabels: Record<string, string> = {
          [LogType.CLOCK_IN]: 'ورود',
          [LogType.CLOCK_OUT]: 'خروج',
          [LogType.HOURLY_LEAVE_START]: 'شروع پاس',
          [LogType.HOURLY_LEAVE_END]: 'پایان پاس'
        };

        const eventLabel = last ? typeLabels[last.type] : 'ثبت نشده';
        // منطق نقطه: اگر آخرین تردد ورود یا پایان پاس باشد یعنی داخل است
        const isPresent = last ? (last.type === LogType.CLOCK_IN || last.type === LogType.HOURLY_LEAVE_END) : false;

        return {
          id: e.id,
          name: e.name,
          event: eventLabel,
          time: last ? last.time : '--:--',
          isPresent
        };
      });
      setColleagues(mapped);
    }
  };

  useEffect(() => { if (currentUser) loadData(); }, [currentUser?.id]);

  const addLog = async (type: LogType) => {
    if (syncing) {
      alert('درخواست شما در حال پردازش است، لطفاً منتظر پاسخ سرور بمانید.');
      return;
    }

    const today = toEnglishDigits(getShamsiDate());
    const time = getShamsiTime();
    const now = Date.now();

    // Check duplicate insertion attempt within 60 seconds or same minute
    const isDuplicate = currentUser?.logs?.some(l => {
      const logDate = toEnglishDigits(l.shamsi_date);
      const isSameType = l.type === type;
      const isSameDate = logDate === today;
      const isSameTime = l.time === time;
      const isRecent = Math.abs(now - (l.timestamp || 0)) < 60000;
      return isSameType && isSameDate && (isSameTime || isRecent);
    });

    if (isDuplicate) {
      alert('این تردد اخیراً ثبت شده است. برای جلوگیری از ثبت تکراری، لطفاً منتظر پاسخ سرور بمانید یا ۱ دقیقه بعد مجدداً تلاش کنید.');
      return;
    }

    setSyncing(true);
    const { error } = await supabase.from('attendance_logs').insert([{
      employee_id: currentUser?.id,
      type,
      shamsi_date: today,
      time: time,
      timestamp: now
    }]);

    if (!error) {
      await loadData();
    } else {
      alert('خطا در ثبت تردد: ' + error.message);
    }
    setSyncing(false);
  };

  // آماده‌سازی سطرهای ریز تردد: یک سطر به ازای هر تاریخ (به همراه وضعیت‌ها و دکمه‌های ثبت/ویرایش)
  const detailedDayRows = useMemo(() => {
    if (!currentUser) return [];

    const timeToMinutes = (timeStr: string) => {
      if (!timeStr) return 0;
      const parts = toEnglishDigits(timeStr).trim().split(':').map(Number);
      if (parts.length >= 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
      return 0;
    };

    // ۱. استخراج تمام تاریخ‌های متمایز لاگ‌ها و درخواست‌های اصلاح تردد
    const dateSet = new Set<string>();
    (currentUser.logs || []).forEach(l => {
      if (l.shamsi_date) dateSet.add(toEnglishDigits(l.shamsi_date));
    });
    (myRequests || []).forEach(r => {
      if (r.type === 'CORRECT_LOG' && r.shamsi_date) {
        dateSet.add(toEnglishDigits(r.shamsi_date));
      }
    });

    let allDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

    // اعمال فیلتر تاریخ در صورت انتخاب کاربر
    if (historyDateFilter === 'CURRENT_MONTH') {
      const { startDate, endDate } = getCurrentMonthRange();
      const s = toEnglishDigits(startDate);
      const e = toEnglishDigits(endDate);
      allDates = allDates.filter(d => d >= s && d <= e);
    } else if (historyDateFilter === 'LAST_30_DAYS') {
      allDates = allDates.slice(0, 30);
    }

    return allDates.map(date => {
      const p = parseShamsiDate(date);
      let dayName = '';
      let isFriday = false;
      if (p) {
        try {
          const dateObj = new Date(p.year > 1600 ? p.year : p.year + 621, p.month - 1, p.day);
          dayName = getDayName(dateObj);
          isFriday = dayName === 'جمعه';
        } catch (e) {
          dayName = '';
        }
      }

      // لاگ‌های موجود در این تاریخ به ترتیب ساعت
      const dayLogs = (currentUser.logs || [])
        .filter(l => toEnglishDigits(l.shamsi_date) === date)
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

      // درخواست‌های اصلاح تردد برای این تاریخ
      const dayReqs = (myRequests || []).filter(r => 
        r.type === 'CORRECT_LOG' && toEnglishDigits(r.shamsi_date) === date
      );

      // استخراج اطلاعات هر درخواست
      const parsedReqs = dayReqs.map(r => {
        const typeMatch = (r.description || '').match(/\[CORRECT_LOG:type=([^:]+):time=([^\]]+)\]/);
        const logIdMatch = (r.description || '').match(/\[logId=([^\]]+)\]/);
        const origTimeMatch = (r.description || '').match(/\[origTime=([^\]]+)\]/);
        const rejectReasonMatch = (r.description || '').match(/\[علت رد:\s*([^\]]+)\]/);

        return {
          request: r,
          type: typeMatch ? typeMatch[1] : '',
          time: typeMatch ? typeMatch[2] : '',
          logId: logIdMatch ? logIdMatch[1] : '',
          origTime: origTimeMatch ? origTimeMatch[1] : '',
          status: r.status,
          rejectionReason: r.rejection_reason || (rejectReasonMatch ? rejectReasonMatch[1] : '')
        };
      });

      // انتساب وضعیت‌ها به لاگ‌های موجود
      const matchedReqIds = new Set<string>();

      const processedLogs = dayLogs.map(log => {
        let match = parsedReqs.find(pr => pr.logId && pr.logId === log.id && !matchedReqIds.has(pr.request.id));
        if (!match) {
          match = parsedReqs.find(pr => 
            pr.type === log.type && 
            (pr.origTime === log.time || (!pr.origTime && !pr.logId)) && 
            !matchedReqIds.has(pr.request.id)
          );
        }

        if (match) {
          matchedReqIds.add(match.request.id);
        }

        return {
          id: log.id,
          type: log.type,
          time: log.time,
          is_manual: log.is_manual,
          requestStatus: match ? match.status : undefined,
          requestedTime: match ? match.time : undefined,
          rejectionReason: match ? match.rejectionReason : undefined,
          matchingRequest: match ? match.request : undefined
        };
      });

      // بررسی ترددهای ثبت‌نشده (Unrecorded)
      const unrecordedList: Array<{
        type: LogType;
        label: string;
        requestStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
        requestedTime?: string;
        rejectionReason?: string;
      }> = [];

      let hasIn = false;
      let hasOut = false;
      let hasPassStart = false;
      let hasPassEnd = false;

      processedLogs.forEach(l => {
        const t = (l.type || '') as string;
        if (t === LogType.CLOCK_IN || t === 'CLOCK_IN' || t === 'ورود') hasIn = true;
        if (t === LogType.CLOCK_OUT || t === 'CLOCK_OUT' || t === 'خروج') hasOut = true;
        if (t === LogType.HOURLY_LEAVE_START || t === 'HOURLY_LEAVE_START' || t === 'شروع پاس') hasPassStart = true;
        if (t === LogType.HOURLY_LEAVE_END || t === 'HOURLY_LEAVE_END' || t === 'پایان پاس') hasPassEnd = true;
      });

      // اگر ورود دارد ولی خروج ندارد، خروج ثبت نشده است
      if (hasIn && !hasOut) {
        const outReq = parsedReqs.find(pr => (pr.type === LogType.CLOCK_OUT || pr.type === 'CLOCK_OUT') && !matchedReqIds.has(pr.request.id));
        unrecordedList.push({
          type: LogType.CLOCK_OUT,
          label: 'خروج',
          requestStatus: outReq ? outReq.status : undefined,
          requestedTime: outReq ? outReq.time : undefined,
          rejectionReason: outReq ? outReq.rejectionReason : undefined
        });
      }

      // اگر خروج دارد ولی ورود ندارد، ورود ثبت نشده است
      if (hasOut && !hasIn) {
        const inReq = parsedReqs.find(pr => (pr.type === LogType.CLOCK_IN || pr.type === 'CLOCK_IN') && !matchedReqIds.has(pr.request.id));
        unrecordedList.push({
          type: LogType.CLOCK_IN,
          label: 'ورود',
          requestStatus: inReq ? inReq.status : undefined,
          requestedTime: inReq ? inReq.time : undefined,
          rejectionReason: inReq ? inReq.rejectionReason : undefined
        });
      }

      // اگر شروع پاس دارد ولی پایان ندارد
      if (hasPassStart && !hasPassEnd) {
        const passEndReq = parsedReqs.find(pr => (pr.type === LogType.HOURLY_LEAVE_END || pr.type === 'HOURLY_LEAVE_END') && !matchedReqIds.has(pr.request.id));
        unrecordedList.push({
          type: LogType.HOURLY_LEAVE_END,
          label: 'پایان پاس',
          requestStatus: passEndReq ? passEndReq.status : undefined,
          requestedTime: passEndReq ? passEndReq.time : undefined,
          rejectionReason: passEndReq ? passEndReq.rejectionReason : undefined
        });
      }

      // سایر درخواست‌های اصلاح ثبت‌شده در این روز که هنوز منتسب نشده‌اند
      parsedReqs.forEach(pr => {
        if (!matchedReqIds.has(pr.request.id)) {
          const typeLabels: Record<string, string> = {
            'CLOCK_IN': 'ورود',
            'CLOCK_OUT': 'خروج',
            'HOURLY_LEAVE_START': 'شروع پاس',
            'HOURLY_LEAVE_END': 'پایان پاس'
          };
          unrecordedList.push({
            type: pr.type as LogType,
            label: typeLabels[pr.type] || pr.type,
            requestStatus: pr.status,
            requestedTime: pr.time,
            rejectionReason: pr.rejectionReason
          });
        }
      });

      // محاسبه کارکرد آن روز
      let dayPhysicalMinutes = 0;
      let activeIn: any = null;
      dayLogs.forEach(l => {
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

      let dayPassMinutes = 0;
      let activePassStart: any = null;
      dayLogs.forEach(l => {
        const typeStr = (l.type || '') as string;
        const typeNormalized = typeStr.toUpperCase();
        const isStart = typeNormalized === 'HOURLY_LEAVE_START' || typeNormalized === 'شروع پاس';
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

      const netDayMinutes = Math.max(0, dayPhysicalMinutes - dayPassMinutes);
      let dayWorkFormatted = '---';
      if (netDayMinutes > 0) {
        const h = Math.floor(netDayMinutes / 60);
        const m = Math.round(netDayMinutes % 60);
        dayWorkFormatted = m === 0 ? `${h} ساعت` : `${h} ساعت و ${m} دقیقه`;
      }

      const hasIncompleteIssue = (hasIn && !hasOut) || (hasOut && !hasIn) || (hasPassStart && !hasPassEnd);

      return {
        date,
        dayName,
        isFriday,
        logs: processedLogs,
        unrecorded: unrecordedList,
        dayWorkFormatted,
        hasIncompleteIssue
      };
    });
  }, [currentUser?.logs, myRequests, historyDateFilter]);

  const openEditCorrection = (log: { id?: string; type: LogType; time: string }, date?: string) => {
    const targetDate = date || (log as any).shamsi_date || getShamsiDate();
    const parts = (log.time || '08:00').split(':').map(Number);
    setCorrectionModal({
      isOpen: true,
      date: targetDate,
      type: log.type,
      hour: isNaN(parts[0]) ? 8 : parts[0],
      minute: isNaN(parts[1]) ? 0 : parts[1],
      desc: '',
      originalTime: log.time,
      logId: log.id,
      isEdit: true
    });
  };

  const openNewCorrectionForDate = (date: string, defaultType: LogType = LogType.CLOCK_IN) => {
    const defaultH = defaultType === LogType.CLOCK_OUT ? 17 : defaultType === LogType.HOURLY_LEAVE_START ? 10 : defaultType === LogType.HOURLY_LEAVE_END ? 12 : 8;
    setCorrectionModal({
      isOpen: true,
      date: date,
      type: defaultType,
      hour: defaultH,
      minute: 0,
      desc: '',
      originalTime: undefined,
      logId: undefined,
      isEdit: false
    });
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (syncing) return;
    setSyncing(true);

    const hourStr = String(correctionModal.hour).padStart(2, '0');
    const minStr = String(correctionModal.minute).padStart(2, '0');
    const typeLabelMap: Record<string, string> = {
      [LogType.CLOCK_IN]: 'ورود',
      [LogType.CLOCK_OUT]: 'خروج',
      [LogType.HOURLY_LEAVE_START]: 'شروع پاس',
      [LogType.HOURLY_LEAVE_END]: 'پایان پاس'
    };
    const label = typeLabelMap[correctionModal.type] || correctionModal.type;
    const timeStr = `${hourStr}:${minStr}`;

    let descString = `[CORRECT_LOG:type=${correctionModal.type}:time=${timeStr}] `;
    if (correctionModal.isEdit && correctionModal.originalTime) {
      descString += `[ویرایش ${label} از ${correctionModal.originalTime} به ${timeStr}] `;
    } else {
      descString += `[ثبت ${label} در ساعت ${timeStr}] `;
    }
    if (correctionModal.logId) {
      descString += `[logId=${correctionModal.logId}] `;
    }
    if (correctionModal.originalTime) {
      descString += `[origTime=${correctionModal.originalTime}] `;
    }
    descString += correctionModal.desc ? `| علت: ${correctionModal.desc}` : '';

    const { data, error } = await supabase.from('leave_requests').insert([{
      employee_id: currentUser?.id,
      type: 'CORRECT_LOG' as LeaveType,
      amount: 0,
      shamsi_date: toEnglishDigits(correctionModal.date),
      description: descString,
      status: 'PENDING',
      timestamp: Date.now()
    }]).select();

    if (!error && data) {
      setCorrectionModal(prev => ({ ...prev, isOpen: false }));
      setSuccessMsg('درخواست اصلاح تردد با موفقیت ارسال شد و در انتظار تایید مدیر قرار گرفت.');
      loadData();
    } else {
      alert('خطا در ثبت درخواست اصلاح: ' + (error?.message || 'نامشخص'));
    }
    setSyncing(false);
  };

  const submitReq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (syncing) {
      alert('درخواست شما در حال پردازش است، لطفاً منتظر بمانید.');
      return;
    }
    setSyncing(true);
    let amount = 1;
    let description = reqForm.desc;
    let remote_hours: number | null = null;
    let remote_minutes: number | null = null;
    let targetDate = reqForm.date;
    let finalType: LeaveType = 'REMOTE_WORK';
    let successText = 'ثبت با موفقیت انجام شد.';

    if (actionCategory === 'REMOTE_WORK') {
      finalType = 'REMOTE_WORK';
      amount = Number((reqForm.h + (reqForm.m / 60)).toFixed(2));
      remote_hours = reqForm.h;
      remote_minutes = reqForm.m;
      targetDate = reqForm.date;
      successText = 'ثبت دورکاری شما با موفقیت انجام شد.';
    } else if (actionCategory === 'LEAVE') {
      if (leaveSubCategory === 'HOURLY_PASS') {
        finalType = 'HOURLY_PASS';
        const sh = reqForm.passStartH !== undefined ? reqForm.passStartH : 8;
        const sm = reqForm.passStartM !== undefined ? reqForm.passStartM : 0;
        const eh = reqForm.passEndH !== undefined ? reqForm.passEndH : 10;
        const em = reqForm.passEndM !== undefined ? reqForm.passEndM : 0;
        const diffMins = (eh * 60 + em) - (sh * 60 + sm);
        amount = Number((Math.max(0, diffMins) / 60).toFixed(2));
        targetDate = reqForm.date;
        
        const startTimeStr = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
        const endTimeStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        
        description = `[پاس ${reqForm.passType}] از ساعت ${startTimeStr} تا ${endTimeStr} | ${reqForm.desc}`;
        successText = 'ثبت پاس ساعتی شما با موفقیت انجام شد.';
      } else {
        finalType = 'DAILY_LEAVE';
        amount = reqForm.days;
        targetDate = reqForm.startDate;
        description = `[مرخصی ${reqForm.dailyType}] | تعداد: ${reqForm.days} روز | از: ${reqForm.startDate} تا: ${reqForm.endDate} | توضیحات: ${reqForm.desc}`;
        successText = 'ثبت مرخصی روزانه شما با موفقیت انجام شد.';
      }
    }

    const { data, error } = await supabase.from('leave_requests').insert([{
      employee_id: currentUser?.id,
      type: finalType,
      amount,
      shamsi_date: toEnglishDigits(targetDate),
      description: description,
      status: 'PENDING',
      timestamp: Date.now(),
      remote_hours,
      remote_minutes
    }]).select();

    if (!error && data) {
      setSuccessMsg(successText);
      setReqForm({ 
        ...reqForm, 
        desc: '', 
        h: 4, 
        m: 0, 
        days: 1,
        startDate: getShamsiDate(),
        endDate: getShamsiDate()
      });
      loadData();
    } else if (error) {
      alert('خطا در ثبت: ' + error.message);
    }
    setSyncing(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !currentUser) return;
    setLoadingMessages(true);

    const msgObj = {
      employee_id: currentUser.id,
      sender: 'EMPLOYEE',
      message: newMessageText.trim(),
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
      setNewMessageText('');
      fetchDirectMessages();
    }
    setLoadingMessages(false);
  };

  const handleWhatsAppNotify = () => {
    const text = `سلام، درخواست جدید در BaharTime ثبت شد.%0A👤 کاربر: ${currentUser?.name}%0A📅 تاریخ: ${reqForm.date}`;
    window.open(`https://wa.me/989123456789?text=${text}`, '_blank');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const nid = toEnglishDigits(formData.nationalId).trim();
    if (!/^\d{10}$/.test(nid)) {
      alert('کد ملی باید دقیقاً ۱۰ رقم (فقط عدد) باشد.');
      return;
    }

    setSyncing(true);
    try {
      if (isRegister) {
        const { data, error } = await supabase.from('employees').insert([{ name: formData.name, national_id: nid, password: formData.password }]).select();
        if (data && data[0]) onLogin({ ...data[0], nationalId: data[0].national_id, logs: [] });
        else if (error) alert('خطا در ثبت‌نام: ' + error.message);
      } else {
        const { data } = await supabase.from('employees').select('*').eq('national_id', nid).eq('password', formData.password).single();
        if (data) onLogin({ ...data, nationalId: data.national_id, logs: [] });
        else alert('کد ملی یا رمز عبور اشتباه است.');
      }
    } catch (err) { alert('خطا در برقراری ارتباط با سرور'); }
    setSyncing(false);
  };

  const handleSetActiveTabMain = useCallback(() => setActiveTab('MAIN'), []);
  const handleSetActiveTabHistory = useCallback(() => setActiveTab('FULL_HISTORY'), []);
  const handleSetActiveTabRequests = useCallback(() => setActiveTab('REQUEST_STATUS'), []);
  const handleSetActiveTabMessages = useCallback(async () => {
    setActiveTab('MESSAGES');
    setHasUnreadMsg(false);
    if (currentUser) {
      await supabase
        .from('direct_messages')
        .update({ is_read: true })
        .eq('employee_id', currentUser.id)
        .eq('sender', 'ADMIN')
        .eq('is_read', false);
    }
  }, [currentUser?.id]);

  const handleClockIn = useCallback(() => addLog(LogType.CLOCK_IN), [currentUser?.id, syncing]);
  const handleClockOut = useCallback(() => addLog(LogType.CLOCK_OUT), [currentUser?.id, syncing]);
  const handleLeaveStart = useCallback(() => addLog(LogType.HOURLY_LEAVE_START), [currentUser?.id, syncing]);
  const handleLeaveEnd = useCallback(() => addLog(LogType.HOURLY_LEAVE_END), [currentUser?.id, syncing]);

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[3rem] shadow-2xl border">
        <div className="flex justify-center mb-8"><div className="bg-emerald-600 p-5 rounded-[2rem] text-white"><Flower2 size={40}/></div></div>
        <h2 className="text-3xl font-black text-center mb-8">BaharTime</h2>
        <form onSubmit={handleAuth} className="space-y-4">
          {isRegister && <input required className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold" placeholder="نام و نام خانوادگی" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
          <input 
            required 
            maxLength={10}
            inputMode="numeric"
            className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-mono font-bold" 
            placeholder="کد ملی (۱۰ رقم)" 
            value={formData.nationalId} 
            onChange={e => {
              const val = toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 10);
              setFormData({...formData, nationalId: val});
            }} 
          />
          <input required type="password" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none" placeholder="رمز عبور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          <button disabled={syncing} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black flex items-center justify-center gap-2">
            {syncing ? <RefreshCcw className="animate-spin" /> : <LogIn size={20}/>} {isRegister ? 'ثبت‌نام' : 'ورود'}
          </button>
        </form>
        <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-xs text-slate-400 font-bold">
          {isRegister ? 'حساب دارید؟ وارد شوید' : 'کاربر جدید هستم'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <nav className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-4 z-20">
        <div className="flex gap-2 bg-white p-2 rounded-3xl shadow-sm border border-slate-100 w-fit mx-auto md:mx-0">
          <TabBtn active={activeTab === 'MAIN'} label="میز کار" icon={<Play size={18}/>} onClick={handleSetActiveTabMain} />
          <TabBtn active={activeTab === 'FULL_HISTORY'} label="تاریخچه تردد" icon={<History size={18}/>} onClick={handleSetActiveTabHistory} />
          <TabBtn active={activeTab === 'REQUEST_STATUS'} label="ثبتی‌ها و درخواست‌ها" icon={<Send size={18}/>} onClick={handleSetActiveTabRequests} />
          <TabBtn active={activeTab === 'MESSAGES'} label="پیام مدیر" icon={<MessageCircle size={18}/>} onClick={handleSetActiveTabMessages} hasBadge={hasUnreadMsg} />
        </div>
        
        {showInstallBtn && (
          <button onClick={handleInstallClick} className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-xl animate-bounce">
            <Download size={16}/> نصب اپلیکیشن باهار
          </button>
        )}
      </nav>

      {activeTab === 'MAIN' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* کارت‌های خلاصه عملکرد ماه جاری کاربر (طراحی فلت و یکدست بر پایه تم تیره اصیل و بدون سایه‌روشن) */}
          <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[3rem] shadow-xl border border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-slate-800 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-black text-white tracking-tight">خلاصه عملکرد ماه جاری شما</h2>
                  <p className="text-[11px] font-bold text-slate-400">
                    آمار تاییدشده کارکرد، مرخصی و پاس در <span className="text-emerald-400 font-black">{currentMonthStats.monthName} {currentMonthStats.year}</span>
                  </p>
                </div>
              </div>
              <span className="text-xs font-black bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 font-mono">
                {currentMonthStats.monthName} {currentMonthStats.year}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {/* ۱. کارکرد کل ماه جاری */}
              <div className="bg-slate-800/90 p-5 rounded-3xl border border-slate-700/80 hover:border-emerald-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-black text-slate-200">کارکرد کل ماه جاری</span>
                  <Clock size={18} className="text-emerald-400" />
                </div>
                <div className="text-base md:text-xl font-black text-emerald-400 font-mono my-1">
                  {currentMonthStats.formattedWork}
                </div>
                <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between border-t border-slate-700/60 pt-2 mt-1">
                  <span>حضوری: {currentMonthStats.formattedPhysicalWork}</span>
                  <span>دورکاری: {currentMonthStats.formattedRemote}</span>
                </div>
              </div>

              {/* ۲. مرخصی استفاده شده ماه جاری */}
              <div className="bg-slate-800/90 p-5 rounded-3xl border border-slate-700/80 hover:border-rose-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-black text-slate-200">مرخصی استفاده شده</span>
                  <CalendarDays size={18} className="text-rose-400" />
                </div>
                <div className="text-base md:text-xl font-black text-rose-400 font-mono my-1">
                  {currentMonthStats.dailyLeaveDays} <span className="text-xs font-bold text-slate-300">روز</span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 border-t border-slate-700/60 pt-2 mt-1">
                  مرخصی‌های تاییدشده ماه
                </div>
              </div>

              {/* ۳. پاس استفاده شده ماه جاری */}
              <div className="bg-slate-800/90 p-5 rounded-3xl border border-slate-700/80 hover:border-amber-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-black text-slate-200">پاس استفاده شده</span>
                  <Coffee size={18} className="text-amber-400" />
                </div>
                <div className="text-base md:text-xl font-black text-amber-400 font-mono my-1">
                  {currentMonthStats.formattedPass}
                </div>
                <div className="text-[10px] font-bold text-slate-400 border-t border-slate-700/60 pt-2 mt-1">
                  مجموع پاس حضوری و ساعتی
                </div>
              </div>

              {/* ۴. دورکاری ماه جاری */}
              <div className="bg-slate-800/90 p-5 rounded-3xl border border-slate-700/80 hover:border-teal-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-black text-slate-200">میزان دورکاری</span>
                  <Home size={18} className="text-teal-400" />
                </div>
                <div className="text-base md:text-xl font-black text-teal-400 font-mono my-1">
                  {currentMonthStats.formattedRemote}
                </div>
                <div className="text-[10px] font-bold text-slate-400 border-t border-slate-700/60 pt-2 mt-1">
                  دورکاری‌های تاییدشده ماه
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-12 gap-6">
            <div className="md:col-span-7 space-y-6">
              {/* کارت مرکزی زمان */}
              <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Flower2 size={200} /></div>
                 <LiveClock />
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
                    <ActionBtn icon={<Play />} label="ثبت ورود" color="bg-emerald-500" onClick={handleClockIn} disabled={syncing} />
                    <ActionBtn icon={<Square />} label="ثبت خروج" color="bg-rose-500" onClick={handleClockOut} disabled={syncing} />
                    <ActionBtn icon={<Coffee />} label="شروع پاس" color="bg-amber-500" onClick={handleLeaveStart} disabled={syncing} />
                    <ActionBtn icon={<Clock />} label="پایان پاس" color="bg-indigo-500" onClick={handleLeaveEnd} disabled={syncing} />
                 </div>
              </div>

              {/* هشدار تردد ناقص */}
              {incompleteAttendances.length > 0 && (
                <div className="bg-rose-50/60 p-8 rounded-[3rem] border border-rose-100/80 animate-in fade-in slide-in-from-top-4 duration-300">
                  <h3 className="font-black text-rose-800 mb-4 flex items-center gap-2 text-base">
                    <ShieldAlert className="text-rose-600 animate-pulse" size={22} />
                    تردد ناقص (نیاز به پیگیری)
                  </h3>
                  <p className="text-[11px] font-black text-rose-600 mb-6 leading-relaxed">
                    سیستم مغایرت‌هایی در ثبتی‌های شما برای روزهای گذشته شناسایی کرده است. لطفاً از بخش «درخواست اصلاح تردد» جهت اصلاح اقدام نمایید:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                    {incompleteAttendances.map((item, index) => (
                      <div key={index} className="flex flex-col gap-1 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-rose-100 shadow-sm text-right">
                        <div className="flex justify-between items-center border-b pb-2 mb-2 border-rose-50">
                          <span className="text-xs font-black text-slate-800 font-mono">{item.date}</span>
                          <span className="text-[9px] font-black uppercase text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">ناقص</span>
                        </div>
                        <div className="space-y-1">
                          {item.issues.map((issue, idx) => (
                            <div key={idx} className="text-[10px] font-black text-rose-600 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              {issue}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ترددهای اخیر */}
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                  <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><History size={20} className="text-emerald-600"/> ترددهای امروز</h3>
                  <div className="space-y-2">
                    {currentUser.logs.filter(l => l.shamsi_date === toEnglishDigits(getShamsiDate())).map((l, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border">
                        <span className="text-sm font-black text-slate-700">{l.time}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase">{l.type.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* وضعیت همکاران */}
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                  <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><Users size={20} className="text-indigo-600"/> همکاران آنلاین</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                    {colleagues.map((c, i) => (
                      <ColleagueItem key={c.id || i} colleague={c} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ستون تفکیک‌شده ثبت دورکاری، ثبت مرخصی و درخواست اصلاح تردد */}
            <div className="md:col-span-5 space-y-6">
              <div className="bg-white p-7 rounded-[3rem] shadow-sm border border-slate-100 space-y-5">
                {/* تب‌های تفکیک‌شده ثبتی‌ها و درخواست‌ها */}
                <div>
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActionCategory('REMOTE_WORK');
                        setSuccessMsg('');
                      }}
                      className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        actionCategory === 'REMOTE_WORK'
                          ? 'bg-teal-600 text-white shadow-md'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      <Home size={15}/> ثبت دورکاری
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionCategory('LEAVE');
                        setSuccessMsg('');
                      }}
                      className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        actionCategory === 'LEAVE'
                          ? 'bg-rose-600 text-white shadow-md'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      <CalendarDays size={15}/> ثبت مرخصی
                    </button>
                  </div>
                  <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-[11px]">
                      <FileEdit size={14} className="text-indigo-600 shrink-0"/>
                      <span>اصلاح و ثبت تردد به «تاریخچه تردد» منتقل شده است.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('FULL_HISTORY');
                        setHistorySubTab('DETAILED_LOGS');
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-xl font-black text-[10px] whitespace-nowrap shadow-sm transition-all"
                    >
                      ریز ترددها
                    </button>
                  </div>
                </div>

                {/* پیام موفقیت */}
                {successMsg && (
                  <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-black flex flex-col gap-3 border border-emerald-100 animate-in fade-in">
                    <div className="flex items-center gap-2"><CheckCircle size={18} className="text-emerald-600"/> {successMsg}</div>
                    <button onClick={handleWhatsAppNotify} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-black shadow-md transition-all">
                      <MessageCircle size={14}/> اطلاع‌رسانی به مدیر از طریق واتساپ
                    </button>
                  </div>
                )}

                {/* فرم ۱: ثبت دورکاری */}
                {actionCategory === 'REMOTE_WORK' && (
                  <form onSubmit={submitReq} className="space-y-4 animate-in fade-in">
                    <div className="border-b pb-3">
                      <h3 className="text-base font-black text-teal-800 flex items-center gap-2">
                        <Home size={18} className="text-teal-600"/> ثبت دورکاری
                      </h3>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                        ثبت ساعت و مشخصات دورکاری جهت تایید در کارکرد ماهانه
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500">ساعت دورکاری</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="23" 
                          className="w-full p-3.5 bg-slate-50 rounded-2xl font-bold font-mono text-center outline-none border focus:ring-2 focus:ring-teal-500 transition-all" 
                          placeholder="ساعت" 
                          value={reqForm.h} 
                          onChange={e => setReqForm({...reqForm, h: Math.max(0, parseInt(e.target.value) || 0)})} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500">دقیقه دورکاری</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="59" 
                          className="w-full p-3.5 bg-slate-50 rounded-2xl font-bold font-mono text-center outline-none border focus:ring-2 focus:ring-teal-500 transition-all" 
                          placeholder="دقیقه" 
                          value={reqForm.m} 
                          onChange={e => setReqForm({...reqForm, m: Math.max(0, Math.min(59, parseInt(e.target.value) || 0))})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <ShamsiDatePicker
                        label="تاریخ دورکاری (انتخاب تقویم)"
                        value={reqForm.date}
                        onChange={d => setReqForm({...reqForm, date: d})}
                        theme="teal"
                        className="w-full"
                        inputClassName="p-3 bg-slate-50 border-slate-200"
                        showLongDateSubtitle={true}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500">توضیحات و گزارش کار دورکاری</label>
                      <textarea 
                        className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs outline-none border focus:ring-2 focus:ring-teal-500 transition-all" 
                        rows={2} 
                        placeholder="توضیح وظایف انجام شده در دورکاری..." 
                        value={reqForm.desc} 
                        onChange={e => setReqForm({...reqForm, desc: e.target.value})} 
                      />
                    </div>

                    <button 
                      disabled={syncing} 
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white p-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                    >
                      {syncing ? <RefreshCcw className="animate-spin" size={16} /> : <Home size={16}/>}
                      ثبت دورکاری
                    </button>
                  </form>
                )}

                {/* فرم ۲: ثبت مرخصی و پاس */}
                {actionCategory === 'LEAVE' && (
                  <form onSubmit={submitReq} className="space-y-4 animate-in fade-in">
                    <div className="border-b pb-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-black text-rose-800 flex items-center gap-2">
                          <CalendarDays size={18} className="text-rose-600"/> ثبت مرخصی و پاس
                        </h3>
                        {/* زیر-تب مرخصی روزانه یا پاس ساعتی */}
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                          <button
                            type="button"
                            onClick={() => setLeaveSubCategory('DAILY_LEAVE')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                              leaveSubCategory === 'DAILY_LEAVE' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            مرخصی روزانه
                          </button>
                          <button
                            type="button"
                            onClick={() => setLeaveSubCategory('HOURLY_PASS')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                              leaveSubCategory === 'HOURLY_PASS' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            پاس ساعتی
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* مرخصی روزانه */}
                    {leaveSubCategory === 'DAILY_LEAVE' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500">نوع مرخصی روزانه</label>
                            <select 
                              className="w-full p-3 bg-slate-50 rounded-2xl font-black text-xs outline-none border focus:ring-2 focus:ring-rose-500 transition-all" 
                              value={reqForm.dailyType} 
                              onChange={e => setReqForm({...reqForm, dailyType: e.target.value})}
                            >
                              <option value="استحقاقی">استحقاقی</option>
                              <option value="استعلاجی">استعلاجی</option>
                              <option value="بدون حقوق">بدون حقوق</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500">تعداد روز</label>
                            <input 
                              type="number" 
                              min="1" 
                              className="w-full p-3 bg-slate-50 rounded-2xl font-bold font-mono text-center outline-none border focus:ring-2 focus:ring-rose-500 transition-all" 
                              value={reqForm.days} 
                              onChange={e => setReqForm({...reqForm, days: Math.max(1, parseInt(e.target.value) || 1)})} 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <ShamsiDatePicker
                              label="از تاریخ"
                              value={reqForm.startDate}
                              onChange={d => setReqForm({...reqForm, startDate: d})}
                              theme="rose"
                              className="w-full"
                              inputClassName="p-2.5 bg-slate-50 border-slate-200"
                            />
                          </div>
                          <div className="space-y-1">
                            <ShamsiDatePicker
                              label="تا تاریخ"
                              value={reqForm.endDate}
                              onChange={d => setReqForm({...reqForm, endDate: d})}
                              theme="rose"
                              className="w-full"
                              inputClassName="p-2.5 bg-slate-50 border-slate-200"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* پاس ساعتی */}
                    {leaveSubCategory === 'HOURLY_PASS' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500">نوع پاس ساعتی</label>
                            <select 
                              className="w-full p-3 bg-slate-50 rounded-2xl font-black text-xs outline-none border focus:ring-2 focus:ring-amber-500 transition-all" 
                              value={reqForm.passType} 
                              onChange={e => setReqForm({...reqForm, passType: e.target.value})}
                            >
                              <option value="شخصی">شخصی</option>
                              <option value="اداری">اداری</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <ShamsiDatePicker
                              label="تاریخ پاس"
                              value={reqForm.date}
                              onChange={d => setReqForm({...reqForm, date: d})}
                              theme="amber"
                              className="w-full"
                              inputClassName="p-2.5 bg-slate-50 border-slate-200"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500">شروع پاس (ساعت:دقیقه)</label>
                            <div className="flex gap-1">
                              <input 
                                type="number" 
                                min="0" 
                                max="23" 
                                className="w-1/2 p-2.5 bg-slate-50 rounded-xl font-bold font-mono text-center outline-none border focus:ring-2 focus:ring-amber-500 transition-all" 
                                placeholder="س" 
                                value={reqForm.passStartH !== undefined ? reqForm.passStartH : 8} 
                                onChange={e => setReqForm({...reqForm, passStartH: Math.max(0, parseInt(e.target.value) || 0)})} 
                              />
                              <input 
                                type="number" 
                                min="0" 
                                max="59" 
                                className="w-1/2 p-2.5 bg-slate-50 rounded-xl font-bold font-mono text-center outline-none border focus:ring-2 focus:ring-amber-500 transition-all" 
                                placeholder="د" 
                                value={reqForm.passStartM !== undefined ? reqForm.passStartM : 0} 
                                onChange={e => setReqForm({...reqForm, passStartM: Math.max(0, Math.min(59, parseInt(e.target.value) || 0))})} 
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500">پایان پاس (ساعت:دقیقه)</label>
                            <div className="flex gap-1">
                              <input 
                                type="number" 
                                min="0" 
                                max="23" 
                                className="w-1/2 p-2.5 bg-slate-50 rounded-xl font-bold font-mono text-center outline-none border focus:ring-2 focus:ring-amber-500 transition-all" 
                                placeholder="س" 
                                value={reqForm.passEndH !== undefined ? reqForm.passEndH : 10} 
                                onChange={e => setReqForm({...reqForm, passEndH: Math.max(0, parseInt(e.target.value) || 0)})} 
                              />
                              <input 
                                type="number" 
                                min="0" 
                                max="59" 
                                className="w-1/2 p-2.5 bg-slate-50 rounded-xl font-bold font-mono text-center outline-none border focus:ring-2 focus:ring-amber-500 transition-all" 
                                placeholder="د" 
                                value={reqForm.passEndM !== undefined ? reqForm.passEndM : 0} 
                                onChange={e => setReqForm({...reqForm, passEndM: Math.max(0, Math.min(59, parseInt(e.target.value) || 0))})} 
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500">توضیحات</label>
                      <textarea 
                        className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs outline-none border focus:ring-2 focus:ring-rose-500 transition-all" 
                        rows={2} 
                        placeholder="توضیحات مرخصی یا پاس..." 
                        value={reqForm.desc} 
                        onChange={e => setReqForm({...reqForm, desc: e.target.value})} 
                      />
                    </div>

                    <button 
                      disabled={syncing} 
                      className={`w-full text-white p-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50 ${
                        leaveSubCategory === 'DAILY_LEAVE' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {syncing ? <RefreshCcw className="animate-spin" size={16} /> : <CalendarDays size={16}/>}
                      {leaveSubCategory === 'DAILY_LEAVE' ? 'ثبت مرخصی روزانه' : 'ثبت پاس ساعتی'}
                    </button>
                  </form>
                )}

                </div>
            </div>
          </div>
        </div>
      )}

      {/* بخش تاریخچه کامل تردد (شامل دو بخش: تاریخچه ریز ترددها و خلاصه کارکرد ماه‌های قبل) */}
      {activeTab === 'FULL_HISTORY' && (
        <div className="space-y-6 animate-in fade-in">
          {/* هدر بخش تاریخچه به همراه تب‌های انتخاب زیربخش */}
          <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2.5">
                <History className="text-emerald-600" size={26}/>
                تاریخچه تردد و عملکرد پرسنل
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-1">
                مشاهده ریز ترددهای روزانه، ثبت و ویرایش تردد، و آرشیو کارکرد ماه‌های گذشته
              </p>
            </div>

            {/* سوییچ زیرتب‌های تاریخچه: ریز ترددها / خلاصه کارکرد ماه‌های قبل */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setHistorySubTab('DETAILED_LOGS')}
                className={`py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  historySubTab === 'DETAILED_LOGS'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Clock size={16}/> تاریخچه ریز ترددها
              </button>
              <button
                type="button"
                onClick={() => setHistorySubTab('PAST_MONTHS_SUMMARY')}
                className={`py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  historySubTab === 'PAST_MONTHS_SUMMARY'
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <TrendingUp size={16}/> خلاصه کارکرد ماه‌های قبل
                {pastMonthsStats.length > 0 && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                    historySubTab === 'PAST_MONTHS_SUMMARY' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {pastMonthsStats.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* بخش اول: خلاصه کارکرد ماه‌های قبل (انتقال خودکار عملکرد بعد از پایان هر ماه) */}
          {historySubTab === 'PAST_MONTHS_SUMMARY' && (
            <div className="space-y-6 animate-in fade-in">
              {pastMonthsStats.length === 0 ? (
                <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
                    <TrendingUp size={30} />
                  </div>
                  <h3 className="text-base font-black text-slate-700">هنوز ماهی به پایان نرسیده است</h3>
                  <p className="text-xs text-slate-400 font-bold max-w-md mx-auto leading-relaxed">
                    خلاصه عملکرد ماه جاری در تب «میز کار» نمایش داده می‌شود و پس از پایان هر ماه به صورت خودکار به عنوان سابقه به این بخش منتقل خواهد شد.
                  </p>
                </div>
              ) : (
                <>
                  {/* نوار انتخاب ماه گذشته */}
                  <div className="bg-white p-5 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={18} className="text-indigo-600"/>
                      <span className="text-xs font-black text-slate-700">انتخاب ماه گذشته:</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {pastMonthsStats.map((stats) => {
                        const key = `${stats.year}-${stats.month}`;
                        const isSelected = activePastMonthStats && `${activePastMonthStats.year}-${activePastMonthStats.month}` === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedPastMonthKey(key)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            <span>{stats.monthName} {stats.year}</span>
                            {stats.hasActivity && (
                              <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* کارت‌های خلاصه عملکرد ماه گذشته انتخاب‌شده (دقیقاً مشابه ساختار میز کار بر پایه تم تیره اصیل و فلت) */}
                  {activePastMonthStats && (
                    <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[3rem] shadow-xl border border-slate-800 space-y-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-slate-800 gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                            <TrendingUp size={22} />
                          </div>
                          <div>
                            <h3 className="text-base md:text-lg font-black text-white tracking-tight">
                              خلاصه عملکرد ماه <span className="text-indigo-400">{activePastMonthStats.monthName} {activePastMonthStats.year}</span> (پایان‌یافته)
                            </h3>
                            <p className="text-[11px] font-bold text-slate-400">
                              آرشیو رسمی کارکرد، مرخصی و پاس‌های ثبت‌شده از تاریخ {activePastMonthStats.startDate} تا {activePastMonthStats.endDate}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-black bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-700 text-indigo-400 font-mono">
                          {activePastMonthStats.monthName} {activePastMonthStats.year}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* ۱. کارکرد کل ماه گذشته */}
                        <div className="bg-slate-800/90 p-5 rounded-3xl border border-slate-700/80 hover:border-emerald-500/40 transition-all flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-black text-slate-200">کارکرد کل ماه</span>
                            <Clock size={18} className="text-emerald-400" />
                          </div>
                          <div className="text-base md:text-xl font-black text-emerald-400 font-mono my-1">
                            {activePastMonthStats.formattedWork}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between border-t border-slate-700/60 pt-2 mt-1">
                            <span>حضوری: {activePastMonthStats.formattedPhysicalWork}</span>
                            <span>دورکاری: {activePastMonthStats.formattedRemote}</span>
                          </div>
                        </div>

                        {/* ۲. مرخصی استفاده شده ماه گذشته */}
                        <div className="bg-slate-800/90 p-5 rounded-3xl border border-slate-700/80 hover:border-rose-500/40 transition-all flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-black text-slate-200">مرخصی استفاده شده</span>
                            <CalendarDays size={18} className="text-rose-400" />
                          </div>
                          <div className="text-base md:text-xl font-black text-rose-400 font-mono my-1">
                            {activePastMonthStats.dailyLeaveDays} <span className="text-xs font-bold text-slate-300">روز</span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 border-t border-slate-700/60 pt-2 mt-1">
                            مرخصی‌های تاییدشده ماه
                          </div>
                        </div>

                        {/* ۳. پاس استفاده شده ماه گذشته */}
                        <div className="bg-slate-800/90 p-5 rounded-3xl border border-slate-700/80 hover:border-amber-500/40 transition-all flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-black text-slate-200">پاس استفاده شده</span>
                            <Coffee size={18} className="text-amber-400" />
                          </div>
                          <div className="text-base md:text-xl font-black text-amber-400 font-mono my-1">
                            {activePastMonthStats.formattedPass}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 border-t border-slate-700/60 pt-2 mt-1">
                            مجموع پاس حضوری و ساعتی
                          </div>
                        </div>

                        {/* ۴. دورکاری ماه گذشته */}
                        <div className="bg-slate-800/90 p-5 rounded-3xl border border-slate-700/80 hover:border-teal-500/40 transition-all flex flex-col justify-between">
                          <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-black text-slate-200">میزان دورکاری</span>
                            <Home size={18} className="text-teal-400" />
                          </div>
                          <div className="text-base md:text-xl font-black text-teal-400 font-mono my-1">
                            {activePastMonthStats.formattedRemote}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 border-t border-slate-700/60 pt-2 mt-1">
                            دورکاری‌های تاییدشده ماه
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* جدول مقایسه‌ای و آرشیو تمام ماه‌های گذشته */}
                  <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-sm border border-slate-100 space-y-4">
                    <h4 className="text-base font-black text-slate-800 flex items-center gap-2 border-b pb-3">
                      <Calendar size={18} className="text-slate-600"/>
                      آرشیو عملکرد کلی ماه‌های گذشته
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-500 border-b">
                          <tr>
                            <th className="p-3.5 font-black rounded-r-2xl">ماه و سال</th>
                            <th className="p-3.5 font-black text-center">کارکرد کل</th>
                            <th className="p-3.5 font-black text-center">حضور فیزیکی</th>
                            <th className="p-3.5 font-black text-center">دورکاری تاییدشده</th>
                            <th className="p-3.5 font-black text-center">مرخصی روزانه</th>
                            <th className="p-3.5 font-black text-center">پاس ساعتی</th>
                            <th className="p-3.5 font-black text-center rounded-l-2xl">عملیات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pastMonthsStats.map((stats) => {
                            const key = `${stats.year}-${stats.month}`;
                            const isSelected = activePastMonthStats && `${activePastMonthStats.year}-${activePastMonthStats.month}` === key;
                            return (
                              <tr 
                                key={key}
                                className={`border-b border-slate-50 hover:bg-slate-50/70 transition-all ${
                                  isSelected ? 'bg-indigo-50/40 font-bold' : ''
                                }`}
                              >
                                <td className="p-3.5 font-black text-slate-800">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${stats.hasActivity ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                    <span>{stats.monthName} {stats.year}</span>
                                  </div>
                                </td>
                                <td className="p-3.5 font-mono font-black text-emerald-600 text-center">{stats.formattedWork}</td>
                                <td className="p-3.5 font-mono text-slate-600 text-center">{stats.formattedPhysicalWork}</td>
                                <td className="p-3.5 font-mono text-teal-600 text-center">{stats.formattedRemote}</td>
                                <td className="p-3.5 font-mono text-rose-600 text-center">{stats.dailyLeaveDays} روز</td>
                                <td className="p-3.5 font-mono text-amber-600 text-center">{stats.formattedPass}</td>
                                <td className="p-3.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPastMonthKey(key)}
                                    className="px-3 py-1 bg-slate-100 hover:bg-indigo-600 hover:text-white rounded-lg text-[11px] font-black transition-all"
                                  >
                                    مشاهده کارت‌ها
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* بخش دوم: تاریخچه ریز ترددها (یک سطر به ازای هر تاریخ با دکمه ویرایش، ثبت مجزا، و تغییر رنگ ساعت بر اساس تایید مدیر) */}
          {historySubTab === 'DETAILED_LOGS' && (
            <div className="space-y-6 animate-in fade-in">
              {/* نوار ابزار بالا: دکمه ثبت درخواست اصلاح تردد جدید، فیلترها، و راهنمای رنگ‌ها */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* دکمه اختصاصی ثبت درخواست اصلاح تردد / ثبت تردد جدید */}
                  <button
                    type="button"
                    onClick={() => openNewCorrectionForDate(getShamsiDate(), LogType.CLOCK_IN)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-200 transition-all active:scale-95"
                  >
                    <Plus size={16}/> ثبت درخواست اصلاح یا تردد جدید
                  </button>

                  {/* فیلتر تاریخ‌های ریز ترددها */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setHistoryDateFilter('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        historyDateFilter === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      تمام روزها
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryDateFilter('CURRENT_MONTH')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        historyDateFilter === 'CURRENT_MONTH' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      ماه جاری
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryDateFilter('LAST_30_DAYS')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                        historyDateFilter === 'LAST_30_DAYS' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      ۳۰ روز اخیر
                    </button>
                  </div>
                </div>

                {/* راهنمای رنگ‌های وضعیت ساعت ثبت شده بر اساس تایید مدیر */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-500">
                  <span className="text-slate-700 font-black">راهنمای وضعیت رنگ‌ها:</span>
                  <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>سبز: تایید شده توسط مدیر</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-amber-50 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>زرد: در انتظار تایید مدیر</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 px-2.5 py-1 rounded-lg border border-rose-300">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>قرمز: درخواست اصلاح رد شده</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>خاکستری: ثبت عادی</span>
                  </div>
                </div>
              </div>

              {/* لیست تاریخچه ریز ترددها: هر تاریخ در یک خط افقی */}
              <div className="space-y-3">
                {detailedDayRows.map(row => (
                  <div 
                    key={row.date} 
                    className="p-4 md:p-5 bg-white rounded-3xl border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* ستون تاریخ و روز هفته */}
                    <div className="flex items-center gap-3 min-w-[210px]">
                      <div className={`w-2 h-10 rounded-full ${
                        row.isFriday ? 'bg-amber-400' : row.hasIncompleteIssue ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-slate-800">{row.date}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            row.isFriday ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {row.dayName} {row.isFriday && '(تعطیل)'}
                          </span>
                        </div>
                        {row.hasIncompleteIssue && (
                          <span className="text-[10px] font-black text-rose-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={11} className="text-rose-500"/> تردد ناقص نیاز به تکمیل
                          </span>
                        )}
                      </div>
                    </div>

                    {/* زنجیره ساعات تردد در یک خط (ورودها، خروج‌ها، پاس‌ها با دکمه ویرایش و رنگ وضعیت) */}
                    <div className="flex-1 flex flex-wrap items-center gap-2">
                      {/* نمایش لاگ‌های ثبت‌شده برای این تاریخ */}
                      {row.logs.map((item, idx) => {
                        const typeMap: Record<string, string> = {
                          [LogType.CLOCK_IN]: 'ورود',
                          [LogType.CLOCK_OUT]: 'خروج',
                          [LogType.HOURLY_LEAVE_START]: 'شروع پاس',
                          [LogType.HOURLY_LEAVE_END]: 'پایان پاس'
                        };
                        const typeLabel = typeMap[item.type] || item.type;

                        return (
                          <div 
                            key={item.id || idx}
                            className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all ${
                              item.requestStatus === 'PENDING'
                                ? 'bg-amber-50 text-amber-900 border-amber-300 ring-2 ring-amber-400/40'
                                : (item.requestStatus === 'APPROVED' || item.is_manual)
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                : item.requestStatus === 'REJECTED'
                                ? 'bg-rose-50 text-rose-900 border-rose-300'
                                : 'bg-slate-50 text-slate-800 border-slate-200'
                            }`}
                          >
                            <span className="text-[10px] font-bold text-slate-500">{typeLabel}:</span>
                            <span className="font-mono font-black text-xs">{item.time}</span>

                            {/* برچسب‌های وضعیت تایید/در انتظار/رد */}
                            {item.requestStatus === 'PENDING' && (
                              <span 
                                className="text-[9px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse" 
                                title={`درخواست اصلاح به ${item.requestedTime} در انتظار تایید مدیر است`}
                              >
                                ⏳ در انتظار ({item.requestedTime})
                              </span>
                            )}
                            {(item.requestStatus === 'APPROVED' || item.is_manual) && (
                              <span 
                                className="text-[9px] font-black bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full flex items-center gap-0.5" 
                                title="این تردد توسط مدیر تایید شده است"
                              >
                                <Check size={10}/> تایید مدیر
                              </span>
                            )}
                            {item.requestStatus === 'REJECTED' && (
                              <span 
                                className="text-[9px] font-black bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full flex items-center gap-0.5" 
                                title={item.rejectionReason ? `علت رد: ${item.rejectionReason}` : 'درخواست اصلاح رد شد'}
                              >
                                <X size={10}/> رد شد
                              </span>
                            )}

                            {/* دکمه ویرایش ساعت در کنار ساعت ثبت شده */}
                            <button
                              type="button"
                              onClick={() => openEditCorrection(item, row.date)}
                              className="p-1 hover:bg-white rounded-lg text-indigo-600 hover:text-indigo-800 transition-all border border-transparent hover:border-slate-200"
                              title="درخواست ویرایش / اصلاح این ساعت"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        );
                      })}

                      {/* نمایش ترددهای ثبت‌نشده با دکمه‌های ثبت مجزا */}
                      {row.unrecorded.map((unrec, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          {unrec.requestStatus === 'PENDING' ? (
                            <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-2">
                              <span className="text-[10px] font-bold">{unrec.label}:</span>
                              <span className="font-mono font-black text-xs">{unrec.requestedTime}</span>
                              <span className="text-[9px] font-black bg-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                                ⏳ در انتظار تایید مدیر
                              </span>
                              <button
                                type="button"
                                onClick={() => openNewCorrectionForDate(row.date, unrec.type)}
                                className="p-1 hover:bg-white rounded-lg text-amber-800"
                                title="تغییر ساعت درخواستی"
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                          ) : unrec.requestStatus === 'REJECTED' ? (
                            <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-center gap-2">
                              <span className="text-[10px] font-bold">{unrec.label}:</span>
                              <span className="text-[9px] font-black bg-rose-200 px-2 py-0.5 rounded-full">رد شد</span>
                              <button
                                type="button"
                                onClick={() => openNewCorrectionForDate(row.date, unrec.type)}
                                className="text-[10px] font-black text-rose-700 underline"
                              >
                                ثبت مجدد
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openNewCorrectionForDate(row.date, unrec.type)}
                              className={`px-3 py-1.5 rounded-xl border border-dashed text-xs font-black flex items-center gap-1.5 transition-all ${
                                unrec.type === LogType.CLOCK_IN 
                                  ? 'border-emerald-300 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100'
                                  : unrec.type === LogType.CLOCK_OUT
                                  ? 'border-rose-300 bg-rose-50/50 text-rose-700 hover:bg-rose-100'
                                  : 'border-amber-300 bg-amber-50/50 text-amber-700 hover:bg-amber-100'
                              }`}
                            >
                              <Plus size={13} />
                              <span>ثبت {unrec.label}</span>
                            </button>
                          )}
                        </div>
                      ))}

                      {/* دکمه ثبت تردد دلخواه / اضافی برای این روز */}
                      <button
                        type="button"
                        onClick={() => openNewCorrectionForDate(row.date, LogType.CLOCK_IN)}
                        className="px-2.5 py-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 border border-dashed border-slate-300 text-[11px] font-bold flex items-center gap-1 transition-all"
                        title="ثبت تردد جدید یا اضافه برای این تاریخ"
                      >
                        <Plus size={12} />
                        <span>تردد دلخواه</span>
                      </button>
                    </div>

                    {/* جمع کارکرد خالص آن روز */}
                    <div className="text-left shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block">کارکرد روز:</span>
                      <span className="text-xs font-mono font-black text-slate-700">{row.dayWorkFormatted}</span>
                    </div>
                  </div>
                ))}

                {detailedDayRows.length === 0 && (
                  <div className="p-12 text-center text-slate-400 font-bold text-xs bg-white rounded-3xl border border-dashed">
                    هیچ رکوردی برای نمایش در این بازه یافت نشد.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* مودال پاپ‌آپ درخواست اصلاح یا ثبت تردد */}
          {correctionModal.isOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-md w-full shadow-2xl border text-right space-y-5 animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <FileEdit size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800">
                        {correctionModal.isEdit ? 'درخواست اصلاح ساعت ثبت‌شده' : 'ثبت تردد فراموش‌شده'}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold">
                        {correctionModal.isEdit ? `ساعت ثبت‌شده قبلی: ${correctionModal.originalTime}` : 'ثبت درخواست جدید جهت تایید مدیر'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCorrectionModal(prev => ({ ...prev, isOpen: false }))}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleCorrectionSubmit} className="space-y-4">
                  {/* انتخاب تاریخ با ShamsiDatePicker */}
                  <div>
                    <ShamsiDatePicker
                      label="تاریخ تردد"
                      value={correctionModal.date}
                      onChange={d => setCorrectionModal(prev => ({ ...prev, date: d }))}
                      theme="indigo"
                      className="w-full"
                      inputClassName="p-3 bg-slate-50 border-slate-200"
                      showLongDateSubtitle={true}
                    />
                  </div>

                  {/* نوع تردد */}
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700">نوع تردد</label>
                    <select
                      className="w-full p-3 bg-slate-50 border rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={correctionModal.type}
                      onChange={e => setCorrectionModal(prev => ({ ...prev, type: e.target.value as LogType }))}
                    >
                      <option value={LogType.CLOCK_IN}>ورود</option>
                      <option value={LogType.CLOCK_OUT}>خروج</option>
                      <option value={LogType.HOURLY_LEAVE_START}>شروع پاس (ساعتی)</option>
                      <option value={LogType.HOURLY_LEAVE_END}>پایان پاس (ساعتی)</option>
                    </select>
                  </div>

                  {/* ساعت و دقیقه درخواستی */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-700">ساعت (00 الی 23)</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        className="w-full p-3 bg-slate-50 border rounded-2xl font-mono font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                        value={correctionModal.hour}
                        onChange={e => setCorrectionModal(prev => ({ ...prev, hour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-black text-slate-700">دقیقه (00 الی 59)</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        className="w-full p-3 bg-slate-50 border rounded-2xl font-mono font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                        value={correctionModal.minute}
                        onChange={e => setCorrectionModal(prev => ({ ...prev, minute: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) }))}
                      />
                    </div>
                  </div>

                  {/* علت درخواست اصلاح */}
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700">علت درخواست اصلاح</label>
                    <textarea
                      rows={2}
                      placeholder="علت عدم ثبت به موقع یا نیاز به اصلاح ساعت..."
                      className="w-full p-3 bg-slate-50 border rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={correctionModal.desc}
                      onChange={e => setCorrectionModal(prev => ({ ...prev, desc: e.target.value }))}
                    />
                  </div>

                  {/* دکمه‌های عملیات */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={syncing}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white p-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
                    >
                      {syncing ? <RefreshCcw className="animate-spin" size={16} /> : <Send size={16}/>}
                      ارسال درخواست به مدیر
                    </button>
                    <button
                      type="button"
                      onClick={() => setCorrectionModal(prev => ({ ...prev, isOpen: false }))}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3.5 rounded-2xl font-black text-xs transition-all"
                    >
                      انصراف
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* بخش وضعیت ثبتی‌ها و درخواست‌ها */}
      {activeTab === 'REQUEST_STATUS' && (() => {
        const filteredRequests = myRequests.filter(r => {
          if (statusFilter === 'ALL') return true;
          if (statusFilter === 'REMOTE_WORK') return r.type === 'REMOTE_WORK';
          if (statusFilter === 'LEAVE') return r.type === 'DAILY_LEAVE' || r.type === 'HOURLY_PASS';
          if (statusFilter === 'CORRECT_LOG') return r.type === 'CORRECT_LOG';
          return true;
        });

        return (
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 animate-in fade-in space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Send className="text-indigo-600" size={24}/> پیگیری ثبتی‌ها و درخواست‌های من
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  مشاهده وضعیت تایید یا رد ثبتی‌های دورکاری، مرخصی و درخواست‌های اصلاح تردد
                </p>
              </div>

              {/* فیلتر نوع */}
              <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                    statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  همه ({myRequests.length})
                </button>
                <button
                  onClick={() => setStatusFilter('REMOTE_WORK')}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                    statusFilter === 'REMOTE_WORK' ? 'bg-teal-600 text-white' : 'text-teal-700 hover:bg-teal-50'
                  }`}
                >
                  ثبت دورکاری
                </button>
                <button
                  onClick={() => setStatusFilter('LEAVE')}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                    statusFilter === 'LEAVE' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  ثبت مرخصی
                </button>
                <button
                  onClick={() => setStatusFilter('CORRECT_LOG')}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                    statusFilter === 'CORRECT_LOG' ? 'bg-indigo-600 text-white' : 'text-indigo-700 hover:bg-indigo-50'
                  }`}
                >
                  درخواست اصلاح تردد
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRequests.map((r, i) => {
                const getRejectionReasonLocal = () => {
                  if (r.rejection_reason) return r.rejection_reason;
                  if (!r.description) return '';
                  const match = r.description.match(/\[علت رد:\s*([^\]]+)\]/);
                  return match ? match[1] : '';
                };
                const rejectReason = getRejectionReasonLocal();

                const typeLabels: Record<string, { label: string; bg: string; text: string }> = {
                  'REMOTE_WORK': { label: 'ثبت دورکاری', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700' },
                  'HOURLY_PASS': { label: 'ثبت پاس ساعتی', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
                  'DAILY_LEAVE': { label: 'ثبت مرخصی روزانه', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
                  'CORRECT_LOG': { label: 'درخواست اصلاح تردد', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' }
                };

                const typeInfo = typeLabels[r.type] || { label: r.type, bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700' };
                
                return (
                  <div key={i} className="p-6 bg-slate-50/80 rounded-[2.5rem] border relative overflow-hidden group hover:bg-white hover:shadow-md transition-all text-right flex flex-col justify-between">
                    <div className={`absolute top-0 right-0 w-1.5 h-full ${r.status === 'APPROVED' ? 'bg-emerald-500' : r.status === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-400'}`}></div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl border ${typeInfo.bg} ${typeInfo.text}`}>
                          {typeInfo.label}
                        </span>
                        <span className={`text-[9px] font-black px-3 py-1 rounded-full ${
                          r.status === 'APPROVED' ? 'bg-emerald-500 text-white' : 
                          r.status === 'REJECTED' ? 'bg-rose-500 text-white' : 
                          'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {r.status === 'APPROVED' ? 'تایید شد' : r.status === 'REJECTED' ? 'رد شد' : 'در انتظار بررسی'}
                        </span>
                      </div>

                      <p className="text-xs font-black text-slate-800 font-mono">تاریخ: {r.shamsi_date}</p>
                      <p className="text-xs text-slate-500 font-bold mt-2 bg-white/70 p-3 rounded-2xl border border-slate-100 leading-relaxed">
                        {r.description ? r.description.replace(/^\[CORRECT_LOG:[^\]]+\]\s*/, '') : '---'}
                      </p>
                    </div>

                    {r.status === 'REJECTED' && rejectReason && (
                      <div className="mt-3 text-xs font-black text-rose-600 bg-rose-50 p-3 rounded-2xl border border-rose-100 flex flex-col gap-1 text-right">
                        <span className="text-[9px] font-black uppercase text-rose-400">علت رد شدن درخواست:</span>
                        <span>{rejectReason}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredRequests.length === 0 && (
                <div className="col-span-full p-12 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-3xl border border-dashed">
                  موردی در این دسته یافت نشد.
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* بخش پیام‌های مدیر */}
      {activeTab === 'MESSAGES' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 animate-in fade-in duration-300 space-y-6 text-right">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <MessageCircle className="text-emerald-600" size={24} />
              پیام‌های مدیر و گفت‌وگو
            </h2>
            <button 
              onClick={fetchDirectMessages}
              className="text-xs text-slate-400 hover:text-emerald-600 font-bold flex items-center gap-1 transition-all"
            >
              <RefreshCcw size={14} /> به‌روزرسانی
            </button>
          </div>

          {/* هشدار ثابت 48 ساعته */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs font-bold leading-relaxed flex items-center gap-2">
            <ShieldAlert className="text-amber-600 shrink-0" size={20} />
            <span>پیام‌ها تا ۴۸ ساعت باقی می‌مانند و سپس پاک خواهند شد.</span>
          </div>

          {/* لیست پیام‌ها */}
          <div className="space-y-4 max-h-[400px] overflow-y-auto p-4 bg-slate-50/70 rounded-3xl border custom-scrollbar flex flex-col">
            {directMessages.map((msg) => {
              const isAdmin = msg.sender === 'ADMIN';
              return (
                <div 
                  key={msg.id || msg.timestamp} 
                  className={`flex flex-col max-w-[80%] ${isAdmin ? 'self-start items-start' : 'self-end items-end'}`}
                >
                  <div className={`p-4 rounded-3xl text-xs font-bold leading-relaxed shadow-sm ${
                    isAdmin 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}>
                    <div className="text-[10px] opacity-75 mb-1 font-black">
                      {isAdmin ? 'مدیر سیستم' : 'شما'}
                    </div>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <div className="text-[9px] opacity-60 mt-2 text-left font-mono">
                      {msg.shamsi_date} | {msg.time}
                    </div>
                  </div>
                </div>
              );
            })}
            {directMessages.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-10 font-bold">هنوز پیامی رد و بدل نشده است.</p>
            )}
          </div>

          {/* فرم ارسال پیام */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input 
              type="text" 
              placeholder="پیام خود را به مدیر بنویسید..." 
              className="flex-1 p-4 bg-slate-50 border rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              value={newMessageText}
              onChange={e => setNewMessageText(e.target.value)}
            />
            <button 
              type="submit" 
              disabled={loadingMessages || !newMessageText.trim()} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              <Send size={16} /> ارسال
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

const LiveClockComponent: React.FC = () => {
  const [time, setTime] = useState(getShamsiTime());
  const [dateInfo, setDateInfo] = useState({ day: getDayName(new Date()), date: getShamsiDate() });
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(getShamsiTime());
      // Update date info at midnight or just every minute to be safe
      const now = new Date();
      if (now.getSeconds() === 0) {
        setDateInfo({ day: getDayName(now), date: getShamsiDate() });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <h2 className="text-6xl md:text-8xl font-black text-emerald-600 mb-2 font-mono tracking-tighter">{time}</h2>
      <p className="text-slate-400 font-bold text-lg">{dateInfo.day} {dateInfo.date}</p>
    </>
  );
};

const LiveClock = React.memo(LiveClockComponent);

interface TabBtnProps {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  hasBadge?: boolean;
}

const TabBtnComponent: React.FC<TabBtnProps> = ({ active, label, icon, onClick, hasBadge }) => (
  <button onClick={onClick} className={`relative flex items-center gap-3 px-6 md:px-8 py-3.5 md:py-4 rounded-2xl font-black text-xs transition-all ${active ? 'bg-emerald-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
    {icon} 
    <span className="hidden sm:inline">{label}</span>
    {hasBadge && (
      <>
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full animate-ping border-2 border-white" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white" />
      </>
    )}
  </button>
);

const TabBtn = React.memo(TabBtnComponent);

interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}

const ActionBtnComponent: React.FC<ActionBtnProps> = ({ icon, label, color, onClick, disabled }) => (
  <button 
    onClick={onClick} 
    disabled={disabled}
    className={`${color} text-white p-6 rounded-[2.5rem] flex flex-col items-center gap-3 shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:scale-100`}
  >
    <div className="p-3 bg-white/20 rounded-2xl">
      {disabled ? <RefreshCcw className="animate-spin" size={20} /> : icon}
    </div>
    <span className="text-[10px] font-black">{disabled ? 'در حال ثبت...' : label}</span>
  </button>
);

const ActionBtn = React.memo(ActionBtnComponent);

interface ColleagueItemProps {
  colleague: any;
}

const ColleagueItemComponent: React.FC<ColleagueItemProps> = ({ colleague }) => (
  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[2rem] border border-slate-100 hover:bg-white transition-all">
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-black text-slate-800">{colleague.name}</span>
      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
        <span>ساعت: {colleague.time}</span>
        <span className="opacity-30">|</span>
        <span className={colleague.isPresent ? 'text-emerald-600' : 'text-rose-500'}>{colleague.event}</span>
      </div>
    </div>
    <div className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${colleague.isPresent ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
  </div>
);

const ColleagueItem = React.memo(ColleagueItemComponent);

export default Dashboard;