
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, AttendanceLog } from './types';
import { getShamsiDate, toEnglishDigits } from './jalali';
import { 
  ShieldAlert, Users, Check, Trash2, Edit2, Plus,
  FileSpreadsheet, Download, Clock, Database, Wifi, WifiOff,
  Bell, BellOff, BellRing, Calendar, Search, Save, X
} from 'lucide-react';

type AdminMenu = 'USERS' | 'REQUESTS' | 'ATTENDANCE' | 'REPORTS' | 'MAINTENANCE';

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
  
  // States newly added for Request Actions
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  
  // Report date filters
  const [reportStartDate, setReportStartDate] = useState(() => {
    const today = getShamsiDate();
    const parts = today.split('/');
    if (parts.length === 3) {
      return `${parts[0]}/${parts[1]}/01`;
    }
    return '1430/01/01'; // Fallback
  });
  const [reportEndDate, setReportEndDate] = useState(getShamsiDate);
  
  // Manual Entry State
  const [manualEntry, setManualEntry] = useState({ employee_id: '', type: LogType.CLOCK_IN, date: getShamsiDate(), time: '08:00' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: emps } = await supabase.from('employees').select('*').order('name');
      if (emps) setEmployees(emps.map(e => ({ ...e, nationalId: e.national_id, logs: [] })));
      
      const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name)').order('timestamp', { ascending: false });
      if (reqs) setRequests(reqs);

      const { data: logs } = await supabase.from('attendance_logs').select('*, employees(name)').order('timestamp', { ascending: false }).limit(500);
      if (logs) setAttendanceLogs(logs as AttendanceLog[]);
    } catch (err) {
      console.error("Fetch Error:", err);
    }
    setLoading(false);
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

    const { error } = await supabase.from('attendance_logs').insert([{
      employee_id: manualEntry.employee_id,
      type: manualEntry.type,
      shamsi_date: manualEntry.date,
      time: manualEntry.time,
      is_manual: true,
      timestamp: calculatedTimestamp
    }]);

    if (!error) { 
      alert('تردد با موفقیت ثبت شد'); 
      fetchData(); 
    } else {
      alert('خطا در ثبت تردد: ' + error.message);
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
    csv += "کارمند,تاریخ تردد,ساعت تردد,نوع تردد,ثبت دستی\n";
    
    attendanceLogs.forEach(l => {
      const typeMap: Record<string, string> = {
        'CLOCK_IN': 'ورود',
        'CLOCK_OUT': 'خروج',
        'HOURLY_LEAVE_START': 'شروع پاس',
        'HOURLY_LEAVE_END': 'پایان پاس'
      };
      const cleanType = typeMap[l.type] || l.type;
      csv += `"${l.employees?.name || 'نامعلوم'}",${l.shamsi_date},${l.time},${cleanType},${l.is_manual ? 'بله' : 'خیر'}\n`;
    });
    
    // 2. دریافت کامل درخواست‌ها
    csv += "\n\n=== گزارش درخواست‌های مرخصی روزانه، پاس ساعتی و دورکاری ===\n";
    csv += "کارمند,نوع درخواست,تاریخ درخواست,میزان (روز/ساعت),توضیحات,وضعیت,علت رد شدن احتمالی\n";
    
    requests.forEach(r => {
      const typeMap: Record<string, string> = {
        'REMOTE_WORK': 'دورکاری',
        'HOURLY_PASS': 'پاس ساعتی',
        'DAILY_LEAVE': 'مرخصی روزانه'
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
      
      const cleanDesc = (r.description || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const cleanReason = getRejectionReasonLocal().replace(/"/g, '""');
      
      csv += `"${r.employees?.name || r.employee_name || 'نامعلوم'}",${typeMap[r.type] || r.type},${r.shamsi_date},${r.type === 'DAILY_LEAVE' ? `${r.amount} روز` : `${r.amount} ساعت`},"${cleanDesc}",${statusMap[r.status] || r.status},"${cleanReason}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `backup_full_${getShamsiDate()}.csv`;
    link.click();
  };

  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length >= 2) {
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    }
    return 0;
  };

  const getWorkStatsForEmployee = (empId: string) => {
    const empLogs = attendanceLogs.filter(l => 
      l.employee_id === empId && 
      l.shamsi_date >= toEnglishDigits(reportStartDate) && 
      l.shamsi_date <= toEnglishDigits(reportEndDate)
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
    
    const workHrs = Math.floor(totalWorkMinutes / 60);
    const workMins = Math.round(totalWorkMinutes % 60);
    const formattedWork = `${workHrs} ساعت و ${workMins} دقیقه`;
    const decimalWorkHours = Number((totalWorkMinutes / 60).toFixed(2));
    
    // Format passes to text H and M
    const formatMinutesToPersian = (totalMins: number): string => {
      if (!totalMins || totalMins <= 0) return '0 ساعت';
      const h = Math.floor(totalMins / 60);
      const m = Math.round(totalMins % 60);
      return m === 0 ? `${h} ساعت` : `${h} ساعت و ${m} دقیقه`;
    };
    
    return {
      workMinutes: totalWorkMinutes,
      formattedWork,
      decimalWorkHours,
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
      shamsi_date: string;
      clock_in: string;
      clock_out: string;
      pass_start: string;
      pass_end: string;
    }> = {};

    const sortedFiltered = [...filtered].sort((a, b) => a.timestamp - b.timestamp);

    sortedFiltered.forEach(l => {
      const key = `${l.employee_id}_${l.shamsi_date}`;
      if (!groups[key]) {
        groups[key] = {
          employee_id: l.employee_id,
          employee_name: l.employees?.name || 'نامعلوم',
          shamsi_date: l.shamsi_date,
          clock_in: '---',
          clock_out: '---',
          pass_start: '---',
          pass_end: '---',
        };
      }

      const typeStr = l.type as string;
      const typeNormalized = typeStr.toUpperCase();
      if (typeNormalized === 'CLOCK_IN' || typeNormalized === 'ورود') {
        groups[key].clock_in = groups[key].clock_in === '---' ? l.time : `${groups[key].clock_in} | ${l.time}`;
      } else if (typeNormalized === 'CLOCK_OUT' || typeNormalized === 'خروج') {
        groups[key].clock_out = groups[key].clock_out === '---' ? l.time : `${groups[key].clock_out} | ${l.time}`;
      } else if (typeNormalized === 'HOURLY_LEAVE_START' || typeNormalized === 'شروع پاس' || typeNormalized === 'پاس') {
        groups[key].pass_start = groups[key].pass_start === '---' ? l.time : `${groups[key].pass_start} | ${l.time}`;
      } else if (typeNormalized === 'HOURLY_LEAVE_END' || typeNormalized === 'پایان پاس') {
        groups[key].pass_end = groups[key].pass_end === '---' ? l.time : `${groups[key].pass_end} | ${l.time}`;
      }
    });

    return Object.values(groups).sort((a, b) => b.shamsi_date.localeCompare(a.shamsi_date));
  };

  const exportDetailedLogsToExcel = () => {
    let csv = "\ufeffریز تردد پرسنل (یک ردیف در روز)\n";
    csv += `از تاریخ,${reportStartDate},تا تاریخ,${reportEndDate}\n\n`;
    csv += "نام پرسنل,تاریخ,ساعت ورود,ساعت خروج,شروع پاس ساعتی,پایان پاس ساعتی\n";
    
    getGroupedLogs().forEach(g => {
      csv += `"${g.employee_name}",${g.shamsi_date},${g.clock_in},${g.clock_out},${g.pass_start},${g.pass_end}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `detailed_attendance_logs_${reportStartDate}_to_${reportEndDate}.csv`;
    link.click();
  };

  const exportWorkReportToExcel = () => {
    let csv = "\ufeffگزارش کارکرد پرسنل\n";
    csv += `از تاریخ,${reportStartDate},تا تاریخ,${reportEndDate}\n\n`;
    csv += "کارمند,ساعت کارکرد (فرمت),ساعت کارکرد (اعشاری),ساعت پاس های ثبت شده,روزهای مرخصی روزانه\n";
    
    const targets = selectedEmpId === 'ALL' ? employees : employees.filter(e => e.id === selectedEmpId);
    targets.forEach(e => {
      const stats = getWorkStatsForEmployee(e.id);
      csv += `"${e.name}",${stats.formattedWork},${stats.decimalWorkHours},"${stats.formattedPass}",${stats.dailyLeaveDays}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `work_report_${reportStartDate}_to_${reportEndDate}.csv`;
    link.click();
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
          <MenuBtn active={activeMenu === 'MAINTENANCE'} label="نگهداری سیستم" icon={<Database size={20}/>} onClick={() => setActiveMenu('MAINTENANCE')} />
        </nav>
      </aside>

      <main className="flex-1 p-8 bg-slate-50/50 overflow-y-auto max-h-screen custom-scrollbar">
        {/* USERS SECTION */}
        {activeMenu === 'USERS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
            <h2 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-2"><Users className="text-emerald-600"/> لیست پرسنل</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map(e => (
                <div key={e.id} className="p-5 bg-slate-50 rounded-3xl border flex justify-between items-center">
                  <span className="font-black text-slate-800">{e.name}</span>
                  <button onClick={() => deleteItem('employees', e.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REQUESTS SECTION */}
        {activeMenu === 'REQUESTS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
            <h2 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-2 text-right"><Check className="text-emerald-600"/> مدیریت درخواست‌ها</h2>
            <div className="space-y-4">
              {requests.map(r => {
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
                  'DAILY_LEAVE': 'مرخصی روزانه'
                };
                
                return (
                  <div key={r.id} className="p-6 bg-slate-50 rounded-3xl border flex flex-col gap-4 text-right">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-slate-800 text-sm">
                          {r.employees?.name || r.employee_name || 'کارمند نامشخص'} - {typeMap[r.type] || r.type}
                        </p>
                        <p className="text-xs text-slate-400 font-bold mt-1">
                          تاریخ: {r.shamsi_date} | مقدار درخواستی: {r.type === 'DAILY_LEAVE' ? `${r.amount} روز` : `${r.amount} ساعت`}
                        </p>
                        <p className="text-xs text-slate-505 font-bold mt-2 bg-white/70 p-3 rounded-2xl block border border-slate-100">
                          {r.description || 'بدون توضیحات'}
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
              {requests.length === 0 && (
                <p className="text-center text-slate-400 py-10 font-bold">درخواستی در سیستم ثبت نشده است.</p>
              )}
            </div>
          </div>
        )}

        {/* ATTENDANCE SECTION */}
        {activeMenu === 'ATTENDANCE' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Plus className="text-emerald-600"/> ثبت دستی تردد</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <select className="p-4 rounded-2xl bg-slate-50 border text-xs font-black outline-none" value={manualEntry.employee_id} onChange={e => setManualEntry({...manualEntry, employee_id: e.target.value})}>
                  <option value="">انتخاب کارمند</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select className="p-4 rounded-2xl bg-slate-50 border text-xs font-black outline-none" value={manualEntry.type} onChange={e => setManualEntry({...manualEntry, type: e.target.value as LogType})}>
                  <option value="CLOCK_IN">ورود پرسنل</option>
                  <option value="CLOCK_OUT">خروج پرسنل</option>
                  <option value="HOURLY_LEAVE_START">شروع پاس ساعتی</option>
                  <option value="HOURLY_LEAVE_END">پایان پاس ساعتی</option>
                </select>
                <input type="text" className="p-4 rounded-2xl bg-slate-50 border text-xs font-bold text-center outline-none" value={manualEntry.date} onChange={e => setManualEntry({...manualEntry, date: e.target.value})} />
                <input type="time" className="p-4 rounded-2xl bg-slate-50 border text-xs font-black text-center outline-none" value={manualEntry.time} onChange={e => setManualEntry({...manualEntry, time: e.target.value})} />
                <button onClick={handleManualSubmit} className="bg-emerald-600 text-white rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all">ثبت تردد</button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Clock className="text-emerald-600"/> لیست ترددها</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="text-[10px] text-slate-400 border-b">
                      <th className="p-4">نام</th>
                      <th className="p-4">تاریخ</th>
                      <th className="p-4">ساعت</th>
                      <th className="p-4">نوع</th>
                      <th className="p-4">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {attendanceLogs.slice(0, 100).map(l => (
                      <tr key={l.id} className="border-b hover:bg-slate-50">
                        <td className="p-4 font-black">{l.employees?.name}</td>
                        <td className="p-4 font-mono">{l.shamsi_date}</td>
                        <td className="p-4 font-black text-emerald-600">{l.time}</td>
                        <td className="p-4 text-slate-400">{l.type}</td>
                        <td className="p-4">
                          <button onClick={() => deleteItem('attendance_logs', l.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS SECTION */}
        {activeMenu === 'REPORTS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-6">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2 mb-1"><FileSpreadsheet className="text-emerald-600"/> گزارش کارکرد و ترددها</h2>
                <p className="text-[11px] text-slate-400 font-bold">محاسبه خالص ساعت کارکرد، مرخصی‌ها و پاس‌های ساعتی پرسنل در بازه زمانی دلخواه</p>
              </div>

              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-bold">پرسنل:</span>
                  <select className="p-3 bg-slate-50 border rounded-xl text-xs font-black outline-none" value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
                    <option value="ALL">همه پرسنل</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-bold">از:</span>
                  <input type="text" className="p-3 bg-slate-50 border rounded-xl text-xs font-mono font-bold text-center outline-none w-28 animate-pulse-subtle" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-bold">تا:</span>
                  <input type="text" className="p-3 bg-slate-50 border rounded-xl text-xs font-mono font-bold text-center outline-none w-28 animate-pulse-subtle" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} />
                </div>

                <button onClick={exportWorkReportToExcel} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-black transition-all shadow-md"><Download size={14}/> خروجی اکسل کارکرد</button>
              </div>
            </div>

            {/* SUMMARY WORK REPORT TABLE */}
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
              <h3 className="font-black text-sm text-slate-700 mb-4 flex items-center gap-2">📊 خلاصه کارکرد پرسنل در بازه درخواستی</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-white text-slate-500 border-b">
                      <th className="p-4 rounded-r-xl">نام کارمند</th>
                      <th className="p-4 text-center">از تاریخ</th>
                      <th className="p-4 text-center">تا تاریخ</th>
                      <th className="p-4 text-center">ساعت کارکرد (فرمت)</th>
                      <th className="p-4 text-center">ساعت کارکرد (اعشاری)</th>
                      <th className="p-4 text-center">جمع پاس ها (ساعت و دقیقه)</th>
                      <th className="p-4 text-center rounded-l-xl">مرخصی روزانه (روز)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedEmpId === 'ALL' ? employees : employees.filter(e => e.id === selectedEmpId)).map(e => {
                      const stats = getWorkStatsForEmployee(e.id);
                      return (
                        <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-white transition-all font-bold">
                          <td className="p-4 font-black text-slate-800">{e.name}</td>
                          <td className="p-4 text-center font-mono text-slate-500">{reportStartDate}</td>
                          <td className="p-4 text-center font-mono text-slate-500">{reportEndDate}</td>
                          <td className="p-4 text-center font-black text-indigo-600">{stats.formattedWork}</td>
                          <td className="p-4 text-center font-mono text-slate-600">{stats.decimalWorkHours} ساعت</td>
                          <td className="p-4 text-center font-bold text-amber-600">{stats.formattedPass}</td>
                          <td className="p-4 text-center font-bold text-rose-600">{stats.dailyLeaveDays} روز</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DETAILED ATTENDANCE LOGS LIST (GROUPED - ONE ROW PER DAY) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border">
                <h3 className="font-black text-sm text-slate-700 flex items-center gap-2">🔍 گزارش ریز تردد پرسنل (تک ردیف در هر روز)</h3>
                <button 
                  onClick={exportDetailedLogsToExcel} 
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-md"
                >
                  <Download size={14}/> خروجی ریز ترددها
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr className="border-b">
                      <th className="p-4 rounded-r-xl text-right">نام پرسنل</th>
                      <th className="p-4 text-center">تاریخ</th>
                      <th className="p-4 text-center">ساعت ورود ثبت شده</th>
                      <th className="p-4 text-center">ساعت خروج ثبت شده</th>
                      <th className="p-4 text-center">شروع پاس ساعتی</th>
                      <th className="p-4 text-center rounded-l-xl">پایان پاس ساعتی</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getGroupedLogs().map((g, idx) => (
                      <tr key={idx} className="border-b hover:bg-slate-50/50 transition-all font-bold">
                        <td className="p-4 font-black text-slate-800 text-right">{g.employee_name}</td>
                        <td className="p-4 text-center font-mono text-slate-500">{g.shamsi_date}</td>
                        <td className="p-4 text-center font-mono text-emerald-600">{g.clock_in}</td>
                        <td className="p-4 text-center font-mono text-rose-500">{g.clock_out}</td>
                        <td className="p-4 text-center font-mono text-amber-600">{g.pass_start}</td>
                        <td className="p-4 text-center font-mono text-indigo-500">{g.pass_end}</td>
                      </tr>
                    ))}
                    {getGroupedLogs().length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center p-12 text-slate-400 font-bold">ترددی در این بازه یافت نشد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MAINTENANCE SECTION */}
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
                <div className="flex gap-2">
                  <input type="text" id="purgeDate" placeholder="1402/12/29" className="flex-1 p-4 rounded-2xl bg-white border font-mono text-center text-xs outline-none focus:ring-2 focus:ring-rose-500" />
                  <button onClick={() => handlePurge((document.getElementById('purgeDate') as HTMLInputElement).value)} className="bg-rose-600 text-white px-6 rounded-2xl font-black text-xs hover:bg-rose-700 transition-all shadow-lg shadow-rose-200">پاکسازی</button>
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
              <input 
                type="text" 
                className="w-full p-4 bg-slate-50 border rounded-2xl font-bold font-mono text-center outline-none" 
                value={editingRequest.shamsi_date} 
                onChange={e => setEditingRequest({...editingRequest, shamsi_date: e.target.value})} 
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
    </div>
  );
};

const MenuBtn = React.memo(({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-black text-xs transition-all ${active ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
    {icon} <span>{label}</span>
  </button>
));

export default AdminPanel;
