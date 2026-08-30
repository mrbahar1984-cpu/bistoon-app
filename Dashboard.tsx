import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, LeaveType, AttendanceLog, DirectMessage } from './types';
import { getShamsiDate, getShamsiTime, getDayName, toEnglishDigits, getCurrentMonthRange } from './jalali';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { 
  Play, Square, Coffee, Clock, Send, History, 
  LogIn, RefreshCcw, Flower2, CheckCircle, 
  Users, Wifi, WifiOff, MessageCircle, Download,
  ShieldAlert, Home, CalendarDays, FileEdit, TrendingUp, Sparkles, Filter
} from 'lucide-react';

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

  // Separate modes for: REMOTE_WORK (ثبت دورکاری) | LEAVE (ثبت مرخصی) | CORRECT_LOG (درخواست اصلاح تردد)
  const [actionCategory, setActionCategory] = useState<'REMOTE_WORK' | 'LEAVE' | 'CORRECT_LOG'>('REMOTE_WORK');
  const [leaveSubCategory, setLeaveSubCategory] = useState<'DAILY_LEAVE' | 'HOURLY_PASS'>('DAILY_LEAVE');

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
    passEndM: 0,
    correctionType: 'CLOCK_IN',
    correctionHour: 8,
    correctionMinute: 0
  });
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REMOTE_WORK' | 'LEAVE' | 'CORRECT_LOG'>('ALL');

  // آمار عملکرد ماه جاری کاربر
  const currentMonthStats = useMemo(() => {
    if (!currentUser) {
      return {
        formattedWork: '۰ ساعت',
        formattedPhysicalWork: '۰ ساعت',
        formattedRemote: '۰ ساعت',
        formattedPass: '۰ ساعت',
        dailyLeaveDays: 0,
        monthName: '',
        year: 1403
      };
    }

    const { startDate, endDate, monthName, year } = getCurrentMonthRange();
    const startStandard = toEnglishDigits(startDate);
    const endStandard = toEnglishDigits(endDate);

    // ۱. کارکرد حضوری لاگ‌های ماه جاری
    const empLogs = (currentUser.logs || []).filter(l => {
      const d = toEnglishDigits(l.shamsi_date);
      return d >= startStandard && d <= endStandard;
    });

    const timeToMinutes = (timeStr: string) => {
      if (!timeStr) return 0;
      const parts = timeStr.split(':').map(Number);
      if (parts.length >= 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
      return 0;
    };

    const logsByDate: Record<string, AttendanceLog[]> = {};
    empLogs.forEach(l => {
      const standardDate = toEnglishDigits(l.shamsi_date);
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
        const typeStr = l.type as string;
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
        const typeStr = l.type as string;
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

    // ۲. دورکاری‌های تایید شده در ماه جاری
    const approvedRemoteWorks = myRequests.filter(r => 
      r.status === 'APPROVED' &&
      r.type === 'REMOTE_WORK' &&
      toEnglishDigits(r.shamsi_date) >= startStandard &&
      toEnglishDigits(r.shamsi_date) <= endStandard
    );

    let totalRemoteMinutes = 0;
    approvedRemoteWorks.forEach(r => {
      if (r.remote_hours !== undefined && r.remote_hours !== null && r.remote_minutes !== undefined && r.remote_minutes !== null) {
        totalRemoteMinutes += (r.remote_hours * 60) + r.remote_minutes;
      } else if (r.amount) {
        totalRemoteMinutes += Math.round(r.amount * 60);
      }
    });

    // ۳. پاس‌های ساعتی تایید شده در ماه جاری
    const personalPasses = myRequests.filter(r => 
      r.status === 'APPROVED' &&
      r.type === 'HOURLY_PASS' &&
      toEnglishDigits(r.shamsi_date) >= startStandard &&
      toEnglishDigits(r.shamsi_date) <= endStandard
    );

    const totalPassReqMinutes = personalPasses.reduce((sum, r) => sum + (r.amount * 60 || 0), 0);
    const totalPassOverallMinutes = totalPassLogMinutes + totalPassReqMinutes;

    // ۴. مرخصی‌های روزانه تایید شده در ماه جاری
    const dailyLeaves = myRequests.filter(r => 
      r.status === 'APPROVED' &&
      r.type === 'DAILY_LEAVE' &&
      toEnglishDigits(r.shamsi_date) >= startStandard &&
      toEnglishDigits(r.shamsi_date) <= endStandard
    );

    const totalDailyLeaveDays = dailyLeaves.reduce((sum, r) => sum + (r.amount || 1), 0);

    const formatMinutesToPersian = (totalMins: number): string => {
      if (!totalMins || totalMins <= 0) return '۰ ساعت';
      const h = Math.floor(totalMins / 60);
      const m = Math.round(totalMins % 60);
      return m === 0 ? `${h} ساعت` : `${h} ساعت و ${m} دقیقه`;
    };

    const totalOverallWorkMinutes = totalWorkMinutes + totalRemoteMinutes;

    return {
      formattedWork: formatMinutesToPersian(totalOverallWorkMinutes),
      formattedPhysicalWork: formatMinutesToPersian(totalWorkMinutes),
      formattedRemote: formatMinutesToPersian(totalRemoteMinutes),
      formattedPass: formatMinutesToPersian(totalPassOverallMinutes),
      dailyLeaveDays: totalDailyLeaveDays,
      monthName,
      year
    };
  }, [currentUser?.logs, myRequests]);

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
          const parts = timeStr.split(':').map(Number);
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
    } else if (actionCategory === 'CORRECT_LOG') {
      finalType = 'CORRECT_LOG';
      amount = 0;
      targetDate = reqForm.date;
      const hourStr = String(reqForm.correctionHour ?? 8).padStart(2, '0');
      const minStr = String(reqForm.correctionMinute ?? 0).padStart(2, '0');
      const cType = reqForm.correctionType || 'CLOCK_IN';
      
      const typeLabelMap: Record<string, string> = {
        'CLOCK_IN': 'ورود',
        'CLOCK_OUT': 'خروج',
        'HOURLY_LEAVE_START': 'شروع پاس',
        'HOURLY_LEAVE_END': 'پایان پاس'
      };
      const label = typeLabelMap[cType] || cType;
      
      description = `[CORRECT_LOG:type=${cType}:time=${hourStr}:${minStr}] درخواست اصلاح تردد به ${label} برای ساعت ${hourStr}:${minStr} | ${reqForm.desc}`;
      successText = 'درخواست اصلاح تردد شما با موفقیت ارسال شد.';
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
          {/* کارت‌های خلاصه عملکرد ماه جاری کاربر */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-6 md:p-8 rounded-[3rem] shadow-xl border border-slate-700/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-slate-700/60 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-black tracking-tight">خلاصه عملکرد ماه جاری شما</h2>
                  <p className="text-[11px] font-bold text-slate-400">
                    آمار تاییدشده کارکرد، مرخصی و پاس در <span className="text-emerald-400">{currentMonthStats.monthName} {currentMonthStats.year}</span>
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-slate-300 font-mono">
                {currentMonthStats.monthName} {currentMonthStats.year}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {/* ۱. کارکرد کل ماه جاری */}
              <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10 hover:border-emerald-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-black">کارکرد کل ماه جاری</span>
                  <Clock size={18} className="text-emerald-400" />
                </div>
                <div className="text-base md:text-xl font-black text-emerald-400 font-mono my-1">
                  {currentMonthStats.formattedWork}
                </div>
                <div className="text-[10px] font-bold text-slate-400 flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                  <span>حضوری: {currentMonthStats.formattedPhysicalWork}</span>
                  <span>دورکاری: {currentMonthStats.formattedRemote}</span>
                </div>
              </div>

              {/* ۲. مرخصی استفاده شده ماه جاری */}
              <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10 hover:border-rose-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-black">مرخصی استفاده شده</span>
                  <CalendarDays size={18} className="text-rose-400" />
                </div>
                <div className="text-base md:text-xl font-black text-rose-400 font-mono my-1">
                  {currentMonthStats.dailyLeaveDays} <span className="text-xs font-bold text-slate-300">روز</span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 border-t border-white/5 pt-2 mt-1">
                  مرخصی‌های تاییدشده ماه
                </div>
              </div>

              {/* ۳. پاس استفاده شده ماه جاری */}
              <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10 hover:border-amber-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-black">پاس استفاده شده</span>
                  <Coffee size={18} className="text-amber-400" />
                </div>
                <div className="text-base md:text-xl font-black text-amber-400 font-mono my-1">
                  {currentMonthStats.formattedPass}
                </div>
                <div className="text-[10px] font-bold text-slate-400 border-t border-white/5 pt-2 mt-1">
                  مجموع پاس حضوری و ساعتی
                </div>
              </div>

              {/* ۴. دورکاری ماه جاری */}
              <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10 hover:border-teal-500/40 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-black">میزان دورکاری</span>
                  <Home size={18} className="text-teal-400" />
                </div>
                <div className="text-base md:text-xl font-black text-teal-400 font-mono my-1">
                  {currentMonthStats.formattedRemote}
                </div>
                <div className="text-[10px] font-bold text-slate-400 border-t border-white/5 pt-2 mt-1">
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
                    <button
                      type="button"
                      onClick={() => {
                        setActionCategory('CORRECT_LOG');
                        setSuccessMsg('');
                      }}
                      className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        actionCategory === 'CORRECT_LOG'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      <FileEdit size={15}/> اصلاح تردد
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

                {/* فرم ۳: درخواست اصلاح تردد */}
                {actionCategory === 'CORRECT_LOG' && (
                  <form onSubmit={submitReq} className="space-y-4 animate-in fade-in">
                    <div className="border-b pb-3">
                      <h3 className="text-base font-black text-indigo-800 flex items-center gap-2">
                        <FileEdit size={18} className="text-indigo-600"/> درخواست اصلاح تردد
                      </h3>
                      <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                        ارسال درخواست اصلاح ورود/خروج یا پاس فراموش‌شده به مدیر سیستم
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500">نوع تردد اصلاحی</label>
                        <select 
                          className="w-full p-3 bg-slate-50 rounded-2xl font-black text-xs outline-none border focus:ring-2 focus:ring-indigo-500 transition-all font-bold" 
                          value={reqForm.correctionType} 
                          onChange={e => setReqForm({...reqForm, correctionType: e.target.value})}
                        >
                          <option value="CLOCK_IN">ورود</option>
                          <option value="CLOCK_OUT">خروج</option>
                          <option value="HOURLY_LEAVE_START">شروع پاس (ساعتی)</option>
                          <option value="HOURLY_LEAVE_END">پایان پاس (ساعتی)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <ShamsiDatePicker
                          label="تاریخ تردد"
                          value={reqForm.date}
                          onChange={d => setReqForm({...reqForm, date: d})}
                          theme="indigo"
                          className="w-full"
                          inputClassName="p-2.5 bg-slate-50 border-slate-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500">ساعت (00 الی 23)</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="23" 
                          className="w-full p-3 bg-slate-50 rounded-2xl font-bold font-mono text-center outline-none border focus:ring-2 focus:ring-indigo-500 transition-all" 
                          placeholder="ساعت" 
                          value={reqForm.correctionHour} 
                          onChange={e => setReqForm({...reqForm, correctionHour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0))})} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500">دقیقه (00 الی 59)</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="59" 
                          className="w-full p-3 bg-slate-50 rounded-2xl font-bold font-mono text-center outline-none border focus:ring-2 focus:ring-indigo-500 transition-all" 
                          placeholder="دقیقه" 
                          value={reqForm.correctionMinute} 
                          onChange={e => setReqForm({...reqForm, correctionMinute: Math.max(0, Math.min(59, parseInt(e.target.value) || 0))})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500">علت درخواست اصلاح</label>
                      <textarea 
                        className="w-full p-3 bg-slate-50 rounded-2xl font-bold text-xs outline-none border focus:ring-2 focus:ring-indigo-500 transition-all" 
                        rows={2} 
                        placeholder="علت عدم ثبت تردد یا نیاز به اصلاح..." 
                        value={reqForm.desc} 
                        onChange={e => setReqForm({...reqForm, desc: e.target.value})} 
                      />
                    </div>

                    <button 
                      disabled={syncing} 
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                    >
                      {syncing ? <RefreshCcw className="animate-spin" size={16} /> : <Send size={16}/>}
                      ارسال درخواست اصلاح تردد
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* بخش تاریخچه کامل تردد */}
      {activeTab === 'FULL_HISTORY' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 animate-in fade-in">
          <h3 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-2 text-slate-800">
            <History className="text-emerald-600" size={24}/> تاریخچه کامل تردد پرسنل
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4 font-black rounded-r-2xl">تاریخ</th>
                  <th className="p-4 font-black text-center">ساعت ثبت</th>
                  <th className="p-4 font-black rounded-l-2xl text-center">نوع تردد</th>
                </tr>
              </thead>
              <tbody>
                {currentUser.logs.map((l, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-all">
                    <td className="p-4 font-mono font-bold text-slate-700">{l.shamsi_date}</td>
                    <td className="p-4 font-black text-emerald-600 font-mono text-center">{l.time}</td>
                    <td className="p-4 text-xs text-slate-500 font-bold text-center">
                      <span className="bg-slate-100 px-3 py-1 rounded-full text-[11px] font-black">
                        {l.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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