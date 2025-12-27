
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, AttendanceLog } from './types';
import { getShamsiDate, toEnglishDigits, shamsiMonthNames } from './jalali';
import { 
  ShieldAlert, Users, FileText, Check, Trash2, Calendar, 
  Menu, RefreshCcw, Activity, FileSpreadsheet, Eye, X, 
  ChevronRight, ChevronLeft, Download, Edit2, Plus, Save
} from 'lucide-react';

type AdminMenu = 'USERS' | 'REQUESTS' | 'ATTENDANCE' | 'REPORTS';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('USERS');
  const [loading, setLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<string>('');
  
  // States for Reports
  const [reportRange, setReportRange] = useState({ from: getShamsiDate(), to: getShamsiDate() });
  const [reportData, setReportData] = useState<any[]>([]);

  // States for Attendance Edit
  const [empLogs, setEmpLogs] = useState<AttendanceLog[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualLog, setManualLog] = useState({ date: getShamsiDate(), time: '08:00', type: LogType.CLOCK_IN });

  const fetchData = async () => {
    setLoading(true);
    const { data: emps } = await supabase.from('employees').select('*');
    if (emps) setEmployees(emps.map(e => ({ ...e, nationalId: e.national_id, logs: [] })));
    const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name, national_id)');
    if (reqs) setRequests(reqs);
    setLoading(false);
  };

  useEffect(() => { if (adminAuth) fetchData(); }, [adminAuth]);

  const handleManualAdd = async () => {
    if (!selectedEmp) return;
    await supabase.from('attendance_logs').insert([{
      employee_id: selectedEmp,
      shamsi_date: toEnglishDigits(manualLog.date),
      time: manualLog.time,
      type: manualLog.type,
      timestamp: Date.now(),
      is_manual: true
    }]);
    fetchEmpLogs(selectedEmp);
    setShowManualForm(false);
  };

  const fetchEmpLogs = async (id: string) => {
    setSelectedEmp(id);
    const { data } = await supabase.from('attendance_logs').select('*').eq('employee_id', id).order('timestamp', { ascending: false });
    if (data) setEmpLogs(data);
  };

  const deleteLog = async (id: string) => {
    if(!confirm('حذف شود؟')) return;
    await supabase.from('attendance_logs').delete().eq('id', id);
    fetchEmpLogs(selectedEmp);
  };

  const updateRequest = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await supabase.from('leave_requests').update({ status }).eq('id', id);
    fetchData();
  };

  const generateReport = async () => {
    setLoading(true);
    const { data: allLogs } = await supabase.from('attendance_logs')
      .select('*')
      .gte('shamsi_date', toEnglishDigits(reportRange.from))
      .lte('shamsi_date', toEnglishDigits(reportRange.to))
      .order('timestamp', { ascending: true });
    
    const { data: approvedReqs } = await supabase.from('leave_requests')
      .select('*')
      .eq('status', 'APPROVED')
      .gte('shamsi_date', toEnglishDigits(reportRange.from))
      .lte('shamsi_date', toEnglishDigits(reportRange.to));

    // Grouping by Date and Employee
    const grouped: any = {};
    allLogs?.forEach(log => {
      const key = `${log.shamsi_date}_${log.employee_id}`;
      if (!grouped[key]) grouped[key] = { date: log.shamsi_date, empId: log.employee_id, logs: [] };
      grouped[key].logs.push(log);
    });

    const final = Object.values(grouped).map((item: any) => {
      const emp = employees.find(e => e.id === item.empId);
      const dayReqs = approvedReqs?.filter(r => r.employee_id === item.empId && r.shamsi_date === item.date && r.type === 'REMOTE_WORK');
      const totalRemote = dayReqs?.reduce((acc, curr) => acc + (curr.remote_hours || 0) + (curr.remote_minutes || 0)/60, 0) || 0;
      
      const clocks = item.logs.filter((l:any) => l.type === LogType.CLOCK_IN || l.type === LogType.CLOCK_OUT);
      const passes = item.logs.filter((l:any) => l.type === LogType.HOURLY_LEAVE_START || l.type === LogType.HOURLY_LEAVE_END);

      return {
        date: item.date,
        name: emp?.name || 'نامشخص',
        nid: emp?.nationalId || '---',
        clocks,
        passes,
        remote: totalRemote.toFixed(2)
      };
    });

    setReportData(final);
    setLoading(false);
  };

  const exportExcel = () => {
    let csv = "\ufeffردیف,تاریخ,کد ملی,نام,ترددها (ورود/خروج),پاس‌ها (شروع/پایان),دورکاری\n";
    reportData.forEach((row, i) => {
      const logsStr = row.clocks.map((l:any) => `${l.type === LogType.CLOCK_IN ? 'ورود' : 'خروج'}: ${l.time}`).join(' | ');
      const passStr = row.passes.map((p:any) => `${p.type === LogType.HOURLY_LEAVE_START ? 'شروع' : 'پایان'}: ${p.time}`).join(' | ');
      csv += `${i+1},${row.date},${row.nid},${row.name},"${logsStr}","${passStr}",${row.remote}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BaharTime_Report_${getShamsiDate()}.csv`;
    link.click();
  };

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 p-12 bg-white rounded-[3rem] shadow-2xl text-center border">
        <ShieldAlert size={50} className="mx-auto text-emerald-600 mb-6" />
        <h2 className="text-2xl font-black mb-8">ورود به مدیریت BaharTime</h2>
        <input type="password" placeholder="گذرواژه" className="w-full p-4 rounded-2xl bg-slate-50 mb-6 text-center font-black outline-none border focus:ring-2 focus:ring-emerald-500" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && password === 'admin123' && setAdminAuth(true)} />
        <button onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('نادرست')} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black">احراز هویت</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen -m-8">
      <aside className="w-full lg:w-64 bg-white border-l p-6 flex flex-col no-print">
        <h1 className="font-black text-emerald-600 text-xl mb-10 text-center tracking-tighter">Bahar Admin</h1>
        <nav className="space-y-2">
          <MenuBtn active={activeMenu === 'USERS'} label="کاربران" icon={<Users size={18}/>} onClick={() => setActiveMenu('USERS')} />
          <MenuBtn active={activeMenu === 'REQUESTS'} label="درخواست‌ها" icon={<Check size={18}/>} onClick={() => setActiveMenu('REQUESTS')} />
          <MenuBtn active={activeMenu === 'ATTENDANCE'} label="ترددها" icon={<Activity size={18}/>} onClick={() => setActiveMenu('ATTENDANCE')} />
          <MenuBtn active={activeMenu === 'REPORTS'} label="گزارشات" icon={<FileSpreadsheet size={18}/>} onClick={() => setActiveMenu('REPORTS')} />
        </nav>
      </aside>

      <main className="flex-1 p-6 lg:p-10">
        {activeMenu === 'USERS' && (
          <div className="bg-white p-8 rounded-[3rem] border">
            <h2 className="text-xl font-black mb-8">مدیریت کاربران سامانه</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {employees.map(e => (
                <div key={e.id} className="p-4 bg-slate-50 rounded-2xl border flex justify-between items-center">
                  <div>
                    <p className="text-sm font-black text-slate-800">{e.name}</p>
                    <p className="text-[10px] font-mono text-slate-400">{e.nationalId}</p>
                  </div>
                  <button onClick={async () => { if(confirm('حذف شود؟')) { await supabase.from('employees').delete().eq('id', e.id); fetchData(); } }} className="text-rose-500 p-2"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeMenu === 'REQUESTS' && (
          <div className="bg-white p-8 rounded-[3rem] border">
            <h2 className="text-xl font-black mb-8">درخواست‌های معلق کارمندان</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {requests.filter(r => r.status === 'PENDING').map(r => (
                <div key={r.id} className="p-6 bg-slate-50 rounded-[2rem] border">
                  <div className="flex justify-between mb-2">
                    <span className="font-black text-slate-800">{r.employees?.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">{r.shamsi_date}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 italic mb-4">"{r.description || 'بدون شرح'}"</p>
                  <div className="flex gap-2">
                    <button onClick={() => updateRequest(r.id, 'APPROVED')} className="flex-1 bg-emerald-500 text-white py-2 rounded-xl text-xs font-black">تایید</button>
                    <button onClick={() => updateRequest(r.id, 'REJECTED')} className="flex-1 bg-rose-500 text-white py-2 rounded-xl text-xs font-black">رد</button>
                  </div>
                </div>
              ))}
              {requests.filter(r => r.status === 'PENDING').length === 0 && <p className="text-center text-slate-400 py-20 italic">درخواستی یافت نشد</p>}
            </div>
          </div>
        )}

        {activeMenu === 'ATTENDANCE' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[3rem] border flex gap-4 items-center">
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-400 block mb-2">انتخاب کارمند</label>
                <select className="w-full p-3 bg-slate-50 rounded-xl outline-none border" value={selectedEmp} onChange={e => fetchEmpLogs(e.target.value)}>
                  <option value="">انتخاب کنید...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              {selectedEmp && (
                <button onClick={() => setShowManualForm(true)} className="bg-indigo-600 text-white p-4 mt-6 rounded-xl flex gap-2 items-center font-black text-xs"><Plus size={16}/> ورود دستی</button>
              )}
            </div>

            {selectedEmp && (
              <div className="bg-white p-8 rounded-[3rem] border animate-in slide-in-from-bottom-4">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-4 rounded-r-2xl">تاریخ</th>
                      <th className="p-4">ساعت</th>
                      <th className="p-4">نوع</th>
                      <th className="p-4 rounded-l-2xl">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {empLogs.map(l => (
                      <tr key={l.id}>
                        <td className="p-4 font-mono font-bold">{l.shamsi_date}</td>
                        <td className="p-4 font-mono font-black">{l.time}</td>
                        <td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded-lg">{l.type.replace(/_/g, ' ')}</span></td>
                        <td className="p-4"><button onClick={() => deleteLog(l.id)} className="text-rose-500"><Trash2 size={16}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeMenu === 'REPORTS' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[3rem] border flex flex-col md:flex-row gap-4 items-end no-print">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400">از تاریخ</label>
                <input className="w-full p-3 bg-slate-50 rounded-xl border" value={reportRange.from} onChange={e => setReportRange({...reportRange, from: e.target.value})} />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400">تا تاریخ</label>
                <input className="w-full p-3 bg-slate-50 rounded-xl border" value={reportRange.to} onChange={e => setReportRange({...reportRange, to: e.target.value})} />
              </div>
              <button onClick={generateReport} className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-black text-sm flex gap-2 items-center"><Eye size={18}/> مشاهده گزارش</button>
              {reportData.length > 0 && <button onClick={exportExcel} className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-black text-sm flex gap-2 items-center"><Download size={18}/> اکسل</button>}
            </div>

            {reportData.length > 0 && (
              <div className="bg-white p-8 rounded-[3rem] border overflow-x-auto">
                <table className="w-full text-right text-[10px] border-collapse">
                  <thead className="bg-slate-50">
                    <tr className="border-b">
                      <th className="p-3 font-black">ردیف</th>
                      <th className="p-3 font-black">تاریخ</th>
                      <th className="p-3 font-black">نام</th>
                      <th className="p-3 font-black">ترددها (ورود / خروج)</th>
                      <th className="p-3 font-black">پاس‌ها</th>
                      <th className="p-3 font-black">دورکاری (h)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3">{i+1}</td>
                        <td className="p-3 font-mono">{row.date}</td>
                        <td className="p-3 font-black">{row.name}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {row.clocks.map((c:any, ci:number) => (
                              <span key={ci} className={`px-2 py-0.5 rounded border ${c.type === LogType.CLOCK_IN ? 'bg-emerald-50' : 'bg-rose-50'}`}>{c.time}</span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {row.passes.map((p:any, pi:number) => (
                              <span key={pi} className="px-2 py-0.5 rounded border bg-amber-50">{p.time}</span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 font-mono font-black text-indigo-600">{row.remote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {showManualForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm border">
            <h3 className="text-lg font-black mb-6">ثبت تردد دستی</h3>
            <div className="space-y-4">
              <input className="w-full p-3 bg-slate-50 rounded-xl border" placeholder="تاریخ (۱۴۰۳/۰۱/۰۱)" value={manualLog.date} onChange={e => setManualLog({...manualLog, date: e.target.value})} />
              <input className="w-full p-3 bg-slate-50 rounded-xl border" placeholder="ساعت (۰۸:۳۰)" value={manualLog.time} onChange={e => setManualLog({...manualLog, time: e.target.value})} />
              <select className="w-full p-3 bg-slate-50 rounded-xl border" value={manualLog.type} onChange={e => setManualLog({...manualLog, type: e.target.value as LogType})}>
                <option value={LogType.CLOCK_IN}>ورود</option>
                <option value={LogType.CLOCK_OUT}>خروج</option>
                <option value={LogType.HOURLY_LEAVE_START}>شروع پاس</option>
                <option value={LogType.HOURLY_LEAVE_END}>پایان پاس</option>
              </select>
              <div className="flex gap-2">
                <button onClick={handleManualAdd} className="flex-1 bg-emerald-600 text-white p-3 rounded-xl font-black">ذخیره</button>
                <button onClick={() => setShowManualForm(false)} className="flex-1 bg-slate-100 p-3 rounded-xl font-black">انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MenuBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-black text-sm transition-all ${
    active ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'
  }`}>
    {icon} <span>{label}</span>
  </button>
);

export default AdminPanel;
