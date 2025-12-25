import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails, checkIncompleteLogs } from './calculations';
import { EmployeeData, LogType, LeaveRequest, AttendanceLog } from './types';
import { getShamsiDate, toEnglishDigits, shamsiMonthNames } from './jalali';
import { 
  ShieldAlert, Users, FileText, Check, Trash2, Printer, Download, 
  Calendar, FileSpreadsheet, X, AlertTriangle, Clock, ChevronRight, ChevronLeft, Eye
} from 'lucide-react';

type AdminMenu = 'LIVE' | 'ADVANCED_REPORT' | 'MONTHLY_DUTY' | 'REQUESTS' | 'USERS';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('LIVE');
  const [loading, setLoading] = useState(false);
  
  // States برای موظفی هوشمند
  const [dutyYear, setDutyYear] = useState(getShamsiDate().split('/')[0]);
  const [dutyMonth, setDutyMonth] = useState(getShamsiDate().split('/')[1]);
  const [monthlyDuty, setMonthlyDuty] = useState(192);
  
  // States برای گزارشات پیشرفته
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reportType, setReportType] = useState<'SUMMARY' | 'DETAILED'>('SUMMARY');
  const [reportRange, setReportRange] = useState({ from: getShamsiDate(), to: getShamsiDate() });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');

  useEffect(() => {
    if (adminAuth) {
      fetchInitialData();
    }
  }, [adminAuth]);

  useEffect(() => {
    if (adminAuth) fetchDutyHours();
  }, [dutyYear, dutyMonth]);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: emps } = await supabase.from('employees').select('*, logs(*)');
    const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name)');
    if (emps) setEmployees(emps);
    if (reqs) setRequests(reqs.map(r => ({ ...r, employee_name: r.employees?.name })));
    setLoading(false);
  };

  const fetchDutyHours = async () => {
    const { data } = await supabase
      .from('monthly_duty')
      .select('hours')
      .eq('year', dutyYear)
      .eq('month', dutyMonth)
      .maybeSingle();
    setMonthlyDuty(data?.hours || 192);
  };

  const handleAdminLogin = () => {
    if (password === 'admin123') setAdminAuth(true);
    else alert('رمز عبور اشتباه است');
  };

  const updateDutyHours = async (val: number) => {
    setMonthlyDuty(val);
    await supabase.from('monthly_duty').upsert(
      { year: dutyYear, month: dutyMonth, hours: val }, 
      { onConflict: 'year,month' }
    );
  };

  const handleAction = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await supabase.from('leave_requests').update({ status }).eq('id', id);
    fetchInitialData();
  };

  const deleteEmployee = async (id: string) => {
    if(!confirm('آیا از حذف این کاربر و تمامی لاگ‌های او اطمینان دارید؟')) return;
    await supabase.from('employees').delete().eq('id', id);
    fetchInitialData();
  };

  const exportCSV = () => {
    let csvData = "\uFEFF"; // BOM for Excel Persian support
    if (reportType === 'SUMMARY') {
      csvData += "نام پرسنل,کارکرد خالص,اضافه کار,کسر کار,مرخصی روزانه\n";
      employees.filter(e => selectedEmployeeId === 'ALL' || e.id === selectedEmployeeId).forEach(emp => {
        const s = calculateWorkDetails(emp.logs || [], monthlyDuty, requests.filter(r => r.employee_id === emp.id));
        csvData += `${emp.name},${s.formattedWork},${s.formattedOvertime},${s.formattedDeficit},${s.dailyLeaveDays}\n`;
      });
    } else {
      csvData += "نام پرسنل,تاریخ,نوع,ساعت\n";
      employees.filter(e => selectedEmployeeId === 'ALL' || e.id === selectedEmployeeId).forEach(emp => {
        (emp.logs || []).filter(l => l.shamsiDate >= reportRange.from && l.shamsiDate <= reportRange.to).forEach(l => {
          csvData += `${emp.name},${l.shamsiDate},${l.type === LogType.CLOCK_IN ? 'ورود' : 'خروج'},${l.time}\n`;
        });
      });
    }
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Report_${getShamsiDate().replace(/\//g, '-')}.csv`;
    link.click();
  };

  if (!adminAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 font-['Vazirmatn']" dir="rtl">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl w-full max-w-md text-center">
          <ShieldAlert size={60} className="mx-auto text-emerald-600 mb-6" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">ورود به مدیریت</h2>
          <p className="text-slate-400 text-sm mb-8 font-bold">رمز عبور را وارد کنید</p>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
            className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl mb-4 text-center text-xl font-bold outline-none transition-all"
            placeholder="••••••••"
          />
          <button onClick={handleAdminLogin} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">ورود به پنل</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-['Vazirmatn']" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-l p-6 flex flex-col gap-2 no-print">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><ShieldAlert size={24}/></div>
          <h2 className="font-black text-slate-800">پنل مدیریت</h2>
        </div>
        {[
          { id: 'LIVE', label: 'وضعیت آنی و هشدار', icon: <Clock size={18}/> },
          { id: 'ADVANCED_REPORT', label: 'گزارشات پیشرفته', icon: <FileSpreadsheet size={18}/> },
          { id: 'MONTHLY_DUTY', label: 'ساعت موظفی ماه', icon: <Calendar size={18}/> },
          { id: 'REQUESTS', label: 'درخواست‌ها', icon: <FileText size={18}/> },
          { id: 'USERS', label: 'مدیریت کاربران', icon: <Users size={18}/> },
        ].map(item => (
          <button 
            key={item.id} 
            onClick={() => setActiveMenu(item.id as AdminMenu)} 
            className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-xs transition-all ${activeMenu === item.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        
        {activeMenu === 'LIVE' && (
          <div className="space-y-6">
             <h3 className="text-xl font-black text-slate-800">هشدارهای تردد و وضعیت آنی</h3>
             <div className="grid grid-cols-1 gap-4">
                {employees.map(emp => {
                  const isIncomplete = checkIncompleteLogs(emp.logs || []);
                  if (!isIncomplete) return null;
                  return (
                    <div key={emp.id} className="bg-amber-50 border border-amber-200 p-5 rounded-[2rem] flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500 text-white rounded-2xl"><AlertTriangle size={20}/></div>
                        <div>
                          <p className="font-black text-slate-800">{emp.name}</p>
                          <p className="text-[10px] font-bold text-amber-600">تردد ناقص: تعداد ورود و خروج‌ها در یک روز با هم همخوانی ندارد.</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {employees.length > 0 && !employees.some(e => checkIncompleteLogs(e.logs || [])) && (
                   <div className="text-center p-12 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                      <Check className="mx-auto text-emerald-500 mb-4" size={40} />
                      <p className="font-bold text-slate-400">تمامی ترددها مرتب هستند.</p>
                   </div>
                )}
             </div>
          </div>
        )}

        {activeMenu === 'MONTHLY_DUTY' && (
          <div className="max-w-xl mx-auto space-y-8">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border text-center">
              <h3 className="font-black text-xl mb-8 text-slate-700">تنظیم ساعت موظفی</h3>
              <div className="flex gap-4 mb-8">
                 <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-slate-400">سال</label>
                    <input type="text" value={dutyYear} onChange={e => setDutyYear(toEnglishDigits(e.target.value))} className="w-full p-4 bg-slate-50 rounded-2xl text-center font-black outline-none border focus:border-emerald-500" />
                 </div>
                 <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-slate-400">ماه</label>
                    <select value={dutyMonth} onChange={e => setDutyMonth(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-center font-black outline-none border focus:border-emerald-500">
                       {shamsiMonthNames.map((m, i) => <option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>)}
                    </select>
                 </div>
              </div>
              <div className="space-y-4">
                <p className="text-xs font-bold text-slate-400">ساعت موظفی برای بازه انتخابی:</p>
                <input 
                  type="number" 
                  value={monthlyDuty} 
                  onChange={e => updateDutyHours(parseInt(e.target.value))} 
                  className="w-full p-6 bg-emerald-50 rounded-3xl text-center text-4xl font-black text-emerald-600 outline-none border-2 border-emerald-100" 
                />
              </div>
            </div>
          </div>
        )}

        {activeMenu === 'ADVANCED_REPORT' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] border flex flex-wrap gap-4 items-end no-print shadow-sm">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">انتخاب پرسنل</label>
                <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="block p-3 bg-slate-100 rounded-xl text-xs font-bold outline-none border-none">
                  <option value="ALL">همه پرسنل</option>
                  {employees.map(e => <option key={e.id} value={e.id!}>{e.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">بازه زمانی</label>
                <button onClick={() => setShowDatePicker(true)} className="p-3 bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-200 transition-all">
                  <Calendar size={14}/> {reportRange.from} تا {reportRange.to}
                </button>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl mr-4">
                <button onClick={() => setReportType('SUMMARY')} className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all ${reportType === 'SUMMARY' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>خلاصه کارکرد</button>
                <button onClick={() => setReportType('DETAILED')} className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all ${reportType === 'DETAILED' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>ریز ترددهای روزانه</button>
              </div>
              <div className="flex gap-2 mr-auto">
                <button onClick={() => window.print()} className="p-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-all"><Printer size={18}/></button>
                <button onClick={exportCSV} className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-50"><Download size={18}/></button>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] border overflow-hidden p-8 shadow-sm">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-slate-400 border-b">
                    <th className="p-4">نام و نام خانوادگی</th>
                    {reportType === 'SUMMARY' ? (
                      <>
                        <th className="p-4 text-center">کارکرد کل</th>
                        <th className="p-4 text-center text-emerald-600">اضافه کار</th>
                        <th className="p-4 text-center text-rose-500">کسر کار</th>
                        <th className="p-4 text-center">مرخصی</th>
                      </>
                    ) : (
                      <>
                        <th className="p-4 text-center">تاریخ شمسی</th>
                        <th className="p-4 text-center">نوع ثبت</th>
                        <th className="p-4 text-center font-mono">ساعت</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="font-bold text-slate-700">
                  {employees.filter(e => selectedEmployeeId === 'ALL' || e.id === selectedEmployeeId).map(emp => {
                    const stats = calculateWorkDetails(emp.logs || [], monthlyDuty, requests.filter(r => r.employee_id === emp.id));
                    if (reportType === 'SUMMARY') {
                      return (
                        <tr key={emp.id} className="border-b last:border-0 hover:bg-slate-50 transition-all">
                          <td className="p-4">{emp.name}</td>
                          <td className="p-4 text-center">{stats.formattedWork}</td>
                          <td className="p-4 text-center text-emerald-600">+{stats.formattedOvertime}</td>
                          <td className="p-4 text-center text-rose-500">-{stats.formattedDeficit}</td>
                          <td className="p-4 text-center">{stats.dailyLeaveDays} روز</td>
                        </tr>
                      );
                    } else {
                      return (emp.logs || [])
                        .filter(l => l.shamsiDate >= reportRange.from && l.shamsiDate <= reportRange.to)
                        .map(log => (
                          <tr key={log.id} className="border-b last:border-0 hover:bg-slate-50 transition-all">
                            <td className="p-4">{emp.name}</td>
                            <td className="p-4 text-center">{log.shamsiDate}</td>
                            <td className="p-4 text-center">
                               <span className={`px-3 py-1 rounded-full text-[9px] ${log.type === LogType.CLOCK_IN ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
                                  {log.type === LogType.CLOCK_IN ? 'ورود' : 'خروج'}
                               </span>
                            </td>
                            <td className="p-4 text-center font-mono">{log.time}</td>
                          </tr>
                        ));
                    }
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeMenu === 'REQUESTS' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requests.length === 0 ? (
                 <div className="col-span-full text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                    <FileText className="mx-auto text-slate-200 mb-4" size={50} />
                    <p className="font-bold text-slate-400">درخواستی یافت نشد.</p>
                 </div>
              ) : requests.filter(r => r.status === 'PENDING').map(req => (
                <div key={req.id} className="bg-white p-6 rounded-[2.5rem] border shadow-sm space-y-4">
                   <div className="flex justify-between items-start">
                      <div>
                         <p className="font-black text-slate-800">{req.employee_name}</p>
                         <p className="text-[10px] font-bold text-slate-400">{req.shamsi_date}</p>
                      </div>
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black">
                         {req.type === 'DAILY_LEAVE' ? 'مرخصی روزانه' : req.type === 'HOURLY_PASS' ? 'پاس ساعتی' : 'دورکاری'}
                      </span>
                   </div>
                   <p className="text-xs text-slate-600 font-bold bg-slate-50 p-4 rounded-2xl border border-slate-100">{req.description || 'توضیحی ندارد'}</p>
                   <div className="flex gap-2">
                      <button onClick={() => handleAction(req.id, 'APPROVED')} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"><Check size={16}/> تایید</button>
                      <button onClick={() => handleAction(req.id, 'REJECTED')} className="flex-1 py-3 bg-rose-50 text-rose-500 rounded-xl font-bold text-xs">رد کردن</button>
                   </div>
                </div>
              ))}
           </div>
        )}

        {activeMenu === 'USERS' && (
           <div className="bg-white rounded-[3rem] border overflow-hidden shadow-sm">
              <table className="w-full text-right text-xs">
                 <thead>
                    <tr className="bg-slate-50 text-slate-400 border-b">
                       <th className="p-5">نام پرسنل</th>
                       <th className="p-5">کد ملی</th>
                       <th className="p-5">تعداد لاگ‌ها</th>
                       <th className="p-5 text-center">عملیات</th>
                    </tr>
                 </thead>
                 <tbody className="font-bold">
                    {employees.map(emp => (
                       <tr key={emp.id} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="p-5">{emp.name}</td>
                          <td className="p-5 font-mono">{emp.nationalId}</td>
                          <td className="p-5">{emp.logs?.length || 0} مورد</td>
                          <td className="p-5 flex justify-center gap-2">
                             <button onClick={() => deleteEmployee(emp.id!)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={18}/></button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        )}

      </main>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm shadow-2xl scale-in-center">
            <div className="flex justify-between items-center mb-8">
              <h4 className="font-black text-lg">بازه زمانی گزارش</h4>
              <button onClick={() => setShowDatePicker(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-all"><X size={20}/></button>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 mr-2">از تاریخ (مثال: 1403/10/01)</label>
                 <input type="text" value={reportRange.from} onChange={e => setReportRange({...reportRange, from: toEnglishDigits(e.target.value)})} className="w-full p-5 bg-slate-50 rounded-2xl font-black text-center border-2 border-transparent focus:border-emerald-500 outline-none transition-all" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 mr-2">تا تاریخ (مثال: 1403/10/30)</label>
                 <input type="text" value={reportRange.to} onChange={e => setReportRange({...reportRange, to: toEnglishDigits(e.target.value)})} className="w-full p-5 bg-slate-50 rounded-2xl font-black text-center border-2 border-transparent focus:border-emerald-500 outline-none transition-all" />
              </div>
            </div>
            <button onClick={() => setShowDatePicker(false)} className="w-full mt-8 py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black shadow-lg shadow-emerald-100">اعمال فیلتر</button>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          main { padding: 0 !important; }
          .bg-white { border: none !important; box-shadow: none !important; }
        }
        .scale-in-center { animation: scale-in-center 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
        @keyframes scale-in-center {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AdminPanel;