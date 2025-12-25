import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails, checkIncompleteLogs } from './calculations';
import { EmployeeData, LogType, LeaveRequest, AttendanceLog } from './types';
import { getShamsiDate, toEnglishDigits, shamsiMonthNames } from './jalali';
import { 
  ShieldAlert, Users, FileText, Check, Printer, Download, 
  Calendar, FileSpreadsheet, X, AlertTriangle, Clock
} from 'lucide-react';

type AdminMenu = 'LIVE' | 'ADVANCED_REPORT' | 'MONTHLY_DUTY' | 'REQUESTS' | 'USERS';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('LIVE');
  const [loading, setLoading] = useState(false);
  const [monthlyDuty, setMonthlyDuty] = useState(192);
  
  // States برای گزارشات
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reportType, setReportType] = useState<'SUMMARY' | 'DETAILED'>('SUMMARY');
  const [reportRange, setReportRange] = useState({ from: getShamsiDate(), to: getShamsiDate() });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: emps } = await supabase.from('employees').select('*, logs(*)');
    const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name)');
    const parts = getShamsiDate().split('/');
    const { data: duty } = await supabase.from('monthly_duty').select('hours').eq('year', parts[0]).eq('month', parts[1]).maybeSingle();

    if (emps) setEmployees(emps);
    if (reqs) setRequests(reqs.map(r => ({ ...r, employee_name: r.employees?.name })));
    if (duty) setMonthlyDuty(duty.hours);
    setLoading(false);
  };

  const updateDutyHours = async (val: number) => {
    const parts = getShamsiDate().split('/');
    await supabase.from('monthly_duty').upsert({ year: parts[0], month: parts[1], hours: val }, { onConflict: 'year,month' });
    setMonthlyDuty(val);
  };

  const exportCSV = () => {
    let csvData = "\uFEFF";
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

  return (
    <div className="flex h-screen bg-slate-50 font-['Vazirmatn']" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-l p-6 flex flex-col gap-2 no-print">
        <div className="flex items-center gap-3 mb-8 px-2">
          <ShieldAlert className="text-emerald-600" />
          <h2 className="font-black text-slate-800">پنل مدیریت</h2>
        </div>
        {[
          { id: 'LIVE', label: 'هشدارهای تردد', icon: <Clock size={18}/> },
          { id: 'ADVANCED_REPORT', label: 'گزارشات پیشرفته', icon: <FileSpreadsheet size={18}/> },
          { id: 'MONTHLY_DUTY', label: 'تنظیم موظفی ماه', icon: <Calendar size={18}/> },
          { id: 'REQUESTS', label: 'درخواست‌ها', icon: <FileText size={18}/> },
          { id: 'USERS', label: 'کاربران', icon: <Users size={18}/> },
        ].map(item => (
          <button key={item.id} onClick={() => setActiveMenu(item.id as AdminMenu)} className={`flex items-center gap-3 p-3 rounded-xl font-bold text-xs ${activeMenu === item.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            {item.icon} {item.label}
          </button>
        ))}
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        {activeMenu === 'LIVE' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black">ترددهای ناقص (نیازمند اصلاح)</h3>
            {employees.map(emp => {
              if (!checkIncompleteLogs(emp.logs || [])) return null;
              return (
                <div key={emp.id} className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-amber-500" />
                    <span className="font-bold text-slate-800">{emp.name}</span>
                  </div>
                  <span className="text-xs font-bold text-amber-700">تردد ناقص (ورود/خروج نامنظم)</span>
                </div>
              );
            })}
          </div>
        )}

        {activeMenu === 'MONTHLY_DUTY' && (
          <div className="max-w-md bg-white p-8 rounded-3xl shadow-sm border text-center mx-auto mt-10">
            <h3 className="font-black mb-4 text-slate-700">ساعت موظفی {shamsiMonthNames[parseInt(getShamsiDate().split('/')[1])-1]}</h3>
            <input type="number" value={monthlyDuty} onChange={e => updateDutyHours(parseInt(e.target.value))} className="w-full p-4 bg-slate-50 rounded-2xl text-center text-2xl font-black text-emerald-600 outline-none" />
          </div>
        )}

        {activeMenu === 'ADVANCED_REPORT' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border flex flex-wrap gap-4 items-end no-print">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">پرسنل</label>
                <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="block p-2 bg-slate-100 rounded-lg text-xs font-bold outline-none">
                  <option value="ALL">همه</option>
                  {employees.map(e => <option key={e.id} value={e.id!}>{e.name}</option>)}
                </select>
              </div>
              <button onClick={() => setShowDatePicker(true)} className="p-3 bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-2">
                <Calendar size={14}/> {reportRange.from} تا {reportRange.to}
              </button>
              <div className="flex bg-slate-100 p-1 rounded-xl mr-4">
                <button onClick={() => setReportType('SUMMARY')} className={`px-3 py-1 rounded-lg text-[10px] font-bold ${reportType === 'SUMMARY' ? 'bg-white shadow-sm text-emerald-600' : ''}`}>خلاصه</button>
                <button onClick={() => setReportType('DETAILED')} className={`px-3 py-1 rounded-lg text-[10px] font-bold ${reportType === 'DETAILED' ? 'bg-white shadow-sm text-emerald-600' : ''}`}>ریز تردد</button>
              </div>
              <div className="flex gap-2 mr-auto">
                <button onClick={() => window.print()} className="p-3 bg-slate-800 text-white rounded-xl"><Printer size={16}/></button>
                <button onClick={exportCSV} className="p-3 bg-emerald-600 text-white rounded-xl"><Download size={16}/></button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border overflow-hidden p-6 shadow-sm">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="text-slate-400 border-b">
                    <th className="p-3">نام</th>
                    {reportType === 'SUMMARY' ? (
                      <>
                        <th className="p-3 text-center">کارکرد</th>
                        <th className="p-3 text-center text-emerald-600">اضافه کار</th>
                        <th className="p-3 text-center text-rose-500">کسر کار</th>
                      </>
                    ) : (
                      <>
                        <th className="p-3 text-center">تاریخ</th>
                        <th className="p-3 text-center">نوع</th>
                        <th className="p-3 text-center">ساعت</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="font-bold">
                  {employees.filter(e => selectedEmployeeId === 'ALL' || e.id === selectedEmployeeId).map(emp => {
                    const stats = calculateWorkDetails(emp.logs || [], monthlyDuty, requests.filter(r => r.employee_id === emp.id));
                    if (reportType === 'SUMMARY') {
                      return (
                        <tr key={emp.id} className="border-b last:border-0">
                          <td className="p-3">{emp.name}</td>
                          <td className="p-3 text-center">{stats.formattedWork}</td>
                          <td className="p-3 text-center text-emerald-600">+{stats.formattedOvertime}</td>
                          <td className="p-3 text-center text-rose-500">-{stats.formattedDeficit}</td>
                        </tr>
                      );
                    } else {
                      return (emp.logs || [])
                        .filter(l => l.shamsiDate >= reportRange.from && l.shamsiDate <= reportRange.to)
                        .map(log => (
                          <tr key={log.id} className="border-b last:border-0">
                            <td className="p-3">{emp.name}</td>
                            <td className="p-3 text-center">{log.shamsiDate}</td>
                            <td className="p-3 text-center">{log.type === LogType.CLOCK_IN ? 'ورود' : 'خروج'}</td>
                            <td className="p-3 text-center font-mono">{log.time}</td>
                          </tr>
                        ));
                    }
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm">
            <div className="flex justify-between items-center mb-6">
              <h4 className="font-black">بازه گزارش</h4>
              <button onClick={() => setShowDatePicker(false)}><X/></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={reportRange.from} onChange={e => setReportRange({...reportRange, from: toEnglishDigits(e.target.value)})} placeholder="از تاریخ (1403/10/01)" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-center border outline-none focus:border-emerald-500" />
              <input type="text" value={reportRange.to} onChange={e => setReportRange({...reportRange, to: toEnglishDigits(e.target.value)})} placeholder="تا تاریخ (1403/10/30)" className="w-full p-4 bg-slate-50 rounded-xl font-bold text-center border outline-none focus:border-emerald-500" />
            </div>
            <button onClick={() => setShowDatePicker(false)} className="w-full mt-6 py-4 bg-emerald-600 text-white rounded-xl font-black">اعمال فیلتر</button>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default AdminPanel;