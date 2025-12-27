
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, AttendanceLog } from './types';
import { getShamsiDate, toEnglishDigits, shamsiMonthNames } from './jalali';
import { 
  ShieldAlert, Users, FileText, Check, Trash2, Calendar, 
  Menu, RefreshCcw, Activity, FileSpreadsheet, Eye, X, 
  ChevronRight, ChevronLeft, Download, Edit2, Plus, Save, Clock, Database, Eraser
} from 'lucide-react';

type AdminMenu = 'USERS' | 'REQUESTS' | 'ATTENDANCE_EDIT' | 'DYNAMO_REPORTS' | 'DATABASE_MAINTENANCE';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('USERS');
  const [loading, setLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<string>('');
  
  // States for Dynamo Reports
  const [reportRange, setReportRange] = useState({ from: getShamsiDate(), to: getShamsiDate() });
  const [reportFilterEmpId, setReportFilterEmpId] = useState<string>(''); 
  const [dynamoData, setDynamoData] = useState<any[]>([]);
  const [maxClocks, setMaxClocks] = useState(1);
  const [maxPasses, setMaxPasses] = useState(1);

  // States for Database Maintenance
  const [cleanupDate, setCleanupDate] = useState(getShamsiDate());

  // States for Attendance Edit
  const [empLogs, setEmpLogs] = useState<AttendanceLog[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualLog, setManualLog] = useState({ date: getShamsiDate(), time: '08:00', type: LogType.CLOCK_IN });

  const fetchData = async () => {
    setLoading(true);
    const { data: emps } = await supabase.from('employees').select('*');
    if (emps) setEmployees(emps.map(e => ({ ...e, nationalId: e.national_id, logs: [] })));
    const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name, national_id)').order('timestamp', { ascending: false });
    if (reqs) setRequests(reqs);
    setLoading(false);
  };

  useEffect(() => { if (adminAuth) fetchData(); }, [adminAuth]);

  const handleManualAdd = async () => {
    if (!selectedEmp) return;
    setLoading(true);
    const logDate = toEnglishDigits(manualLog.date);
    await supabase.from('attendance_logs').insert([{
      employee_id: selectedEmp,
      shamsi_date: logDate,
      time: manualLog.time,
      type: manualLog.type,
      timestamp: Date.now(),
      is_manual: true
    }]);
    await fetchEmpLogs(selectedEmp);
    setShowManualForm(false);
    setLoading(false);
  };

  const fetchEmpLogs = async (id: string) => {
    setSelectedEmp(id);
    const { data } = await supabase.from('attendance_logs').select('*').eq('employee_id', id).order('timestamp', { ascending: false });
    if (data) setEmpLogs(data);
  };

  const deleteLog = async (id: string) => {
    if(!confirm('آیا از حذف این تردد اطمینان دارید؟')) return;
    await supabase.from('attendance_logs').delete().eq('id', id);
    fetchEmpLogs(selectedEmp);
  };

  const updateRequestStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await supabase.from('leave_requests').update({ status }).eq('id', id);
    fetchData();
  };

  const deleteRequest = async (id: string) => {
    if(!confirm('آیا از حذف این درخواست اطمینان دارید؟')) return;
    await supabase.from('leave_requests').delete().eq('id', id);
    fetchData();
  };

  const editRequestAmount = async (id: string, currentAmount: number, type: string) => {
    const label = type === 'REMOTE_WORK' ? 'ساعت' : 'روز';
    const newVal = window.prompt(`مقدار جدید (${label}) را وارد کنید:`, currentAmount.toString());
    if (newVal !== null && !isNaN(Number(newVal))) {
      await supabase.from('leave_requests').update({ amount: Number(newVal) }).eq('id', id);
      fetchData();
    }
  };

  const generateDynamoReport = async () => {
    setLoading(true);
    const from = toEnglishDigits(reportRange.from);
    const to = toEnglishDigits(reportRange.to);

    let logsQuery = supabase.from('attendance_logs')
      .select('*')
      .gte('shamsi_date', from)
      .lte('shamsi_date', to);
    
    if (reportFilterEmpId) {
      logsQuery = logsQuery.eq('employee_id', reportFilterEmpId);
    }

    const { data: logs, error: logErr } = await logsQuery.order('timestamp', { ascending: true });
    if (logErr) console.error("Report Log Query Error:", logErr);
    
    let reqsQuery = supabase.from('leave_requests')
      .select('*')
      .eq('status', 'APPROVED')
      .gte('shamsi_date', from)
      .lte('shamsi_date', to);
    
    if (reportFilterEmpId) {
      reqsQuery = reqsQuery.eq('employee_id', reportFilterEmpId);
    }

    const { data: approvedReqs } = await reqsQuery;

    const grouped: Record<string, any> = {};
    let tempMaxClocks = 1;
    let tempMaxPasses = 1;

    logs?.forEach(log => {
      const key = `${log.employee_id}_${log.shamsi_date}`;
      if (!grouped[key]) {
        const emp = employees.find(e => e.id === log.employee_id);
        grouped[key] = { 
          date: log.shamsi_date, 
          empName: emp?.name || 'ناشناس', 
          nid: emp?.nationalId || '---', 
          clocks: [], 
          passes: [],
          remoteHours: 0,
          dailyLeave: 0
        };
      }
      if (log.type === LogType.CLOCK_IN || log.type === LogType.CLOCK_OUT) grouped[key].clocks.push(log);
      else grouped[key].passes.push(log);
    });

    Object.keys(grouped).forEach(key => {
      const item = grouped[key];
      const empId = key.split('_')[0];
      const date = item.date;
      
      const remote = approvedReqs?.filter(r => r.employee_id === empId && r.shamsi_date === date && r.type === 'REMOTE_WORK')
        .reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
      
      const daily = approvedReqs?.filter(r => r.employee_id === empId && r.shamsi_date === date && r.type === 'DAILY_LEAVE')
        .reduce((sum, r) => sum + (r.amount || 0), 0) || 0;

      item.remoteHours = remote.toFixed(2);
      item.dailyLeave = daily;
      
      const clockPairsCount = Math.ceil(item.clocks.length / 2);
      if (clockPairsCount > tempMaxClocks) tempMaxClocks = clockPairsCount;
      
      const passPairsCount = Math.ceil(item.passes.length / 2);
      if (passPairsCount > tempMaxPasses) tempMaxPasses = passPairsCount;
    });

    setMaxClocks(tempMaxClocks || 1);
    setMaxPasses(tempMaxPasses || 1);
    setDynamoData(Object.values(grouped).sort((a,b) => b.date.localeCompare(a.date)));
    setLoading(false);
  };

  const exportExcel = () => {
    let csv = "\ufeffردیف,تاریخ,کد ملی,نام و نام خانوادگی";
    for(let i=1; i<=maxClocks; i++) csv += `,ورود ${i},خروج ${i}`;
    for(let i=1; i<=maxPasses; i++) csv += `,شروع پاس ${i},پایان پاس ${i}`;
    csv += ",ساعت دورکاری,مرخصی روزانه\n";

    dynamoData.forEach((row, idx) => {
      csv += `${idx+1},${row.date},${row.nid},${row.empName}`;
      for(let i=0; i < maxClocks * 2; i++) { csv += `,${row.clocks[i] ? row.clocks[i].time : ''}`; }
      for(let i=0; i < maxPasses * 2; i++) { csv += `,${row.passes[i] ? row.passes[i].time : ''}`; }
      csv += `,${row.remoteHours},${row.dailyLeave}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BaharTime_Report_${getShamsiDate()}.csv`;
    link.click();
  };

  const handleBackupAndCleanup = async () => {
    const targetDate = toEnglishDigits(cleanupDate);
    if (!confirm(`هشدار قطعی: تمامی ترددهای ثبت شده تا تاریخ ${targetDate} ابتدا پشتیبان‌گیری و سپس برای همیشه حذف خواهند شد. ادامه می‌دهید؟`)) return;

    setLoading(true);
    const { data: logsToBackup, error: backupErr } = await supabase.from('attendance_logs').select('*').lte('shamsi_date', targetDate);
    
    if (logsToBackup && logsToBackup.length > 0) {
        let csv = "\ufeffشناسه کارمند,تاریخ,ساعت,نوع,سیستمی/دستی\n";
        logsToBackup.forEach(l => {
            csv += `${l.employee_id},${l.shamsi_date},${l.time},${l.type},${l.is_manual ? 'دستی' : 'سیستمی'}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `BaharTime_Database_Backup_${targetDate}.csv`;
        link.click();

        const { error: delErr } = await supabase.from('attendance_logs').delete().lte('shamsi_date', targetDate);
        if (!delErr) {
            alert(`پشتیبان‌گیری انجام شد و ${logsToBackup.length} مورد تردد قدیمی با موفقیت حذف گردید.`);
            if (activeMenu === 'ATTENDANCE_EDIT' && selectedEmp) fetchEmpLogs(selectedEmp);
        } else {
            alert('خطا در حذف داده‌ها: ' + delErr.message);
        }
    } else {
        alert('هیچ داده‌ای در این بازه زمانی برای حذف یافت نشد.');
    }
    setLoading(false);
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
      <aside className="w-full lg:w-64 bg-white border-l p-6 flex flex-col no-print">
        <h1 className="font-black text-emerald-600 text-2xl mb-12 text-center tracking-tighter uppercase">Bahar Admin</h1>
        <nav className="space-y-3">
          <MenuBtn active={activeMenu === 'USERS'} label="بانک کاربران" icon={<Users size={20}/>} onClick={() => setActiveMenu('USERS')} />
          <MenuBtn active={activeMenu === 'REQUESTS'} label="مدیریت درخواست‌ها" icon={<Check size={20}/>} onClick={() => setActiveMenu('REQUESTS')} />
          <MenuBtn active={activeMenu === 'ATTENDANCE_EDIT'} label="مدیریت ترددها" icon={<Clock size={20}/>} onClick={() => setActiveMenu('ATTENDANCE_EDIT')} />
          <MenuBtn active={activeMenu === 'DYNAMO_REPORTS'} label="گزارشات پیشرفته" icon={<FileSpreadsheet size={20}/>} onClick={() => setActiveMenu('DYNAMO_REPORTS')} />
          <MenuBtn active={activeMenu === 'DATABASE_MAINTENANCE'} label="نگهداری سیستم" icon={<Database size={20}/>} onClick={() => setActiveMenu('DATABASE_MAINTENANCE')} />
        </nav>
      </aside>

      <main className="flex-1 p-6 lg:p-10 bg-slate-50/50 overflow-x-hidden">
        {activeMenu === 'USERS' && (
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border animate-in fade-in">
            <h2 className="text-2xl font-black mb-10 text-slate-800 border-b pb-6">لیست پرسنل سامانه</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {employees.map(e => (
                <div key={e.id} className="p-6 bg-slate-50 rounded-[2.5rem] border flex justify-between items-center group hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center font-black text-lg">{e.name[0]}</div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{e.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 font-bold">{e.nationalId}</p>
                    </div>
                  </div>
                  <button onClick={async () => { if(confirm(`آیا از حذف ${e.name} اطمینان دارید؟`)) { await supabase.from('employees').delete().eq('id', e.id); fetchData(); } }} className="text-slate-300 hover:text-rose-600 p-3 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeMenu === 'REQUESTS' && (
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border animate-in fade-in">
            <h2 className="text-2xl font-black mb-6 text-slate-800 border-b pb-6">تایید و مدیریت درخواست‌ها</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {requests.map(r => (
                <div key={r.id} className={`p-8 rounded-[3rem] border border-slate-100 hover:shadow-lg transition-all ${r.status === 'PENDING' ? 'bg-slate-50' : r.status === 'APPROVED' ? 'bg-emerald-50/30' : 'bg-rose-50/30'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="font-black text-slate-800 text-lg block mb-1">{r.employees?.name}</span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">{r.shamsi_date}</span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-sm ${r.status === 'APPROVED' ? 'bg-emerald-500 text-white' : r.status === 'REJECTED' ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white'}`}>
                            {r.type.replace(/_/g, ' ')} ({r.status === 'PENDING' ? 'در انتظار' : r.status === 'APPROVED' ? 'تایید شده' : 'رد شده'})
                        </span>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl mb-8">
                    <p className="text-xs text-slate-500 italic leading-loose">"{r.description || 'بدون شرح مختصر'}"</p>
                    <p className="text-[10px] font-black text-indigo-600 mt-3 border-t pt-3">
                        {r.type === 'REMOTE_WORK' ? `مقدار: ${r.amount} ساعت` :
                         r.type === 'DAILY_LEAVE' ? `تعداد روز: ${r.amount} روز` : 'پاس ساعتی'}
                    </p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {r.status === 'PENDING' && (
                        <>
                            <button onClick={() => updateRequestStatus(r.id, 'APPROVED')} className="flex-1 bg-emerald-500 text-white py-3 rounded-2xl text-xs font-black hover:bg-emerald-600 active:scale-95 transition-all">تایید</button>
                            <button onClick={() => updateRequestStatus(r.id, 'REJECTED')} className="flex-1 bg-rose-500 text-white py-3 rounded-2xl text-xs font-black hover:bg-rose-600 active:scale-95 transition-all">رد</button>
                        </>
                    )}
                    {r.status === 'APPROVED' && (r.type === 'REMOTE_WORK' || r.type === 'DAILY_LEAVE') && (
                        <>
                            <button onClick={() => editRequestAmount(r.id, r.amount, r.type)} className="flex-1 bg-amber-500 text-white py-3 rounded-2xl text-xs font-black hover:bg-amber-600 transition-all flex items-center justify-center gap-2"><Edit2 size={14}/> ویرایش مقدار</button>
                            <button onClick={() => deleteRequest(r.id)} className="flex-1 bg-slate-800 text-white py-3 rounded-2xl text-xs font-black hover:bg-slate-900 transition-all flex items-center justify-center gap-2"><Trash2 size={14}/> حذف کامل</button>
                        </>
                    )}
                    {r.status !== 'PENDING' && r.type === 'HOURLY_PASS' && (
                        <button onClick={() => deleteRequest(r.id)} className="flex-1 bg-slate-800 text-white py-3 rounded-2xl text-xs font-black hover:bg-slate-900 transition-all flex items-center justify-center gap-2"><Trash2 size={14}/> حذف درخواست</button>
                    )}
                    {r.status === 'REJECTED' && (
                        <button onClick={() => deleteRequest(r.id)} className="flex-1 bg-slate-800 text-white py-3 rounded-2xl text-xs font-black hover:bg-slate-900 transition-all flex items-center justify-center gap-2"><Trash2 size={14}/> حذف</button>
                    )}
                  </div>
                </div>
              ))}
              {requests.length === 0 && <p className="text-center text-slate-300 py-32 italic font-bold text-lg col-span-full">هیچ درخواستی یافت نشد.</p>}
            </div>
          </div>
        )}

        {activeMenu === 'ATTENDANCE_EDIT' && (
          <div className="space-y-6">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1 w-full">
                <label className="text-[11px] font-black text-slate-400 block mb-3 mr-2 uppercase tracking-widest">انتخاب کارمند جهت مدیریت</label>
                <select className="w-full p-4 bg-slate-50 rounded-2xl outline-none border focus:ring-2 focus:ring-emerald-500 transition-all font-bold" value={selectedEmp} onChange={e => fetchEmpLogs(e.target.value)}>
                  <option value="">-- لیست کارکنان را باز کنید --</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.nationalId})</option>)}
                </select>
              </div>
              {selectedEmp && (
                <button onClick={() => setShowManualForm(true)} className="w-full md:w-auto bg-indigo-600 text-white px-10 py-4 mt-6 rounded-2xl flex gap-3 items-center justify-center font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"><Plus size={20}/> ثبت تردد دستی (فراموشی)</button>
              )}
            </div>

            {selectedEmp && (
              <div className="bg-white p-10 rounded-[3rem] shadow-sm border animate-in slide-in-from-bottom-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-5 rounded-r-[2rem] font-black text-slate-400">تاریخ ثبت شده</th>
                        <th className="p-5 font-black text-slate-400">ساعت دقیق</th>
                        <th className="p-5 font-black text-slate-400">نوع رویداد</th>
                        <th className="p-5 rounded-l-[2rem] font-black text-slate-400">عملیات مدیریت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {empLogs.map(l => (
                        <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-5 font-mono font-bold text-slate-600">{l.shamsi_date}</td>
                          <td className="p-5 font-mono font-black text-emerald-600 text-lg">{l.time}</td>
                          <td className="p-5"><span className={`px-4 py-1 rounded-full text-[10px] font-black ${l.is_manual ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-100 text-slate-500'}`}>{l.type.replace(/_/g, ' ')} {l.is_manual ? '(دستی)' : ''}</span></td>
                          <td className="p-5"><button onClick={() => deleteLog(l.id)} className="text-rose-300 hover:text-rose-600 p-3 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={20}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeMenu === 'DYNAMO_REPORTS' && (
          <div className="space-y-6">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border flex flex-wrap gap-6 items-end no-print">
              <div className="w-full md:w-[200px] space-y-2">
                <label className="text-[11px] font-black text-slate-400 mr-2 tracking-widest uppercase">انتخاب کارمند</label>
                <select className="w-full p-4 bg-slate-50 rounded-2xl border font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={reportFilterEmpId} onChange={e => setReportFilterEmpId(e.target.value)}>
                  <option value="">همه پرسنل</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[150px] space-y-2">
                <label className="text-[11px] font-black text-slate-400 mr-2 tracking-widest uppercase">از تاریخ</label>
                <input className="w-full p-4 bg-slate-50 rounded-2xl border font-mono font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={reportRange.from} onChange={e => setReportRange({...reportRange, from: e.target.value})} />
              </div>
              <div className="flex-1 min-w-[150px] space-y-2">
                <label className="text-[11px] font-black text-slate-400 mr-2 tracking-widest uppercase">تا تاریخ</label>
                <input className="w-full p-4 bg-slate-50 rounded-2xl border font-mono font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={reportRange.to} onChange={e => setReportRange({...reportRange, to: e.target.value})} />
              </div>
              <button onClick={generateDynamoReport} className="w-full md:w-auto bg-emerald-600 text-white px-10 py-5 rounded-2xl font-black text-sm flex gap-3 items-center justify-center shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all">
                {loading ? <RefreshCcw className="animate-spin" /> : <Eye size={20}/>} مشاهده گزارش جامع
              </button>
              {dynamoData.length > 0 && <button onClick={exportExcel} className="w-full md:w-auto bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-sm flex gap-3 items-center justify-center shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"><Download size={20}/> دریافت خروجی Excel</button>}
            </div>

            {dynamoData.length > 0 && (
              <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border overflow-x-auto printable-area">
                <table className="w-full text-right text-[10px] border-collapse min-w-[1200px]">
                  <thead className="bg-slate-50">
                    <tr className="border-b">
                      <th className="p-4 font-black border-l">ردیف</th>
                      <th className="p-4 font-black border-l">تاریخ</th>
                      <th className="p-4 font-black border-l">کد ملی</th>
                      <th className="p-4 font-black border-l">نام و نام خانوادگی</th>
                      {[...Array(maxClocks)].map((_, i) => (
                        <React.Fragment key={`h-c-${i}`}>
                          <th className="p-4 font-black border-l bg-emerald-50/30">ورود {i+1}</th>
                          <th className="p-4 font-black border-l bg-emerald-50/30">خروج {i+1}</th>
                        </React.Fragment>
                      ))}
                      {[...Array(maxPasses)].map((_, i) => (
                        <React.Fragment key={`h-p-${i}`}>
                          <th className="p-4 font-black border-l bg-amber-50/30">شروع پاس {i+1}</th>
                          <th className="p-4 font-black border-l bg-amber-50/30">پایان پاس {i+1}</th>
                        </React.Fragment>
                      ))}
                      <th className="p-4 font-black text-indigo-600">دورکاری (h)</th>
                      <th className="p-4 font-black text-rose-600">مرخصی (روز)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dynamoData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 border-l font-bold">{i+1}</td>
                        <td className="p-4 border-l font-mono text-slate-400">{row.date}</td>
                        <td className="p-4 border-l font-mono text-slate-400">{row.nid}</td>
                        <td className="p-4 border-l font-black text-slate-800">{row.empName}</td>
                        {[...Array(maxClocks * 2)].map((_, idx) => (
                          <td key={`c-${idx}`} className={`p-4 border-l font-mono font-black text-center ${idx%2===0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {row.clocks[idx] ? row.clocks[idx].time : '-'}
                          </td>
                        ))}
                        {[...Array(maxPasses * 2)].map((_, idx) => (
                          <td key={`p-${idx}`} className="p-4 border-l font-mono font-black text-amber-600 text-center">
                            {row.passes[idx] ? row.passes[idx].time : '-'}
                          </td>
                        ))}
                        <td className="p-4 font-mono font-black text-indigo-700 text-center text-base">{row.remoteHours}</td>
                        <td className="p-4 font-mono font-black text-rose-700 text-center text-base">{row.dailyLeave}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeMenu === 'DATABASE_MAINTENANCE' && (
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border animate-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-black mb-10 text-slate-800 border-b pb-6 flex items-center gap-3"><Eraser className="text-rose-500"/> مدیریت و پاکسازی دیتابیس</h2>
            <div className="max-w-xl space-y-8">
                <div className="bg-amber-50 p-8 rounded-[2rem] border border-amber-200">
                    <div className="flex gap-4 mb-6">
                        <Database className="text-amber-600 shrink-0" size={32} />
                        <p className="text-sm font-black text-amber-900 leading-loose">
                            برای حفظ سرعت سامانه، توصیه می‌شود ترددهای قدیمی را بصورت دوره‌ای پاکسازی کنید. 
                            <br/>سیستم قبل از حذف، فایل Excel پشتیبان را بصورت خودکار برای شما دانلود می‌کند.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-amber-700 block mb-2 mr-2">پاکسازی تمامی ترددها تا تاریخ (مثال: 1403/01/01):</label>
                            <input className="w-full p-4 bg-white rounded-2xl border border-amber-200 font-mono font-bold text-center outline-none focus:ring-2 focus:ring-amber-400" value={cleanupDate} onChange={e => setCleanupDate(e.target.value)} />
                        </div>
                        <button onClick={handleBackupAndCleanup} disabled={loading} className="w-full bg-rose-600 text-white p-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all">
                            {loading ? <RefreshCcw className="animate-spin" /> : <Download size={20}/>}
                            دریافت پشتیبان و حذف داده‌های قدیمی
                        </button>
                    </div>
                </div>
            </div>
          </div>
        )}
      </main>

      {showManualForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-sm border shadow-2xl scale-in-center">
            <h3 className="text-xl font-black mb-8 text-slate-800 flex items-center gap-3"><Plus className="text-indigo-600"/> ثبت تردد دستی پرسنل</h3>
            <div className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 mr-2">تاریخ (شمسی)</label>
                <input className="w-full p-4 bg-slate-50 rounded-2xl border outline-none font-mono font-bold text-center" value={manualLog.date} onChange={e => setManualLog({...manualLog, date: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 mr-2">ساعت (08:30)</label>
                <input className="w-full p-4 bg-slate-50 rounded-2xl border outline-none font-mono font-bold text-center" value={manualLog.time} onChange={e => setManualLog({...manualLog, time: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 mr-2">نوع تردد</label>
                <select className="w-full p-4 bg-slate-50 rounded-2xl border outline-none font-black text-sm" value={manualLog.type} onChange={e => setManualLog({...manualLog, type: e.target.value as LogType})}>
                  <option value={LogType.CLOCK_IN}>ثبت ورود</option>
                  <option value={LogType.CLOCK_OUT}>ثبت خروج</option>
                  <option value={LogType.HOURLY_LEAVE_START}>شروع پاس ساعتی</option>
                  <option value={LogType.HOURLY_LEAVE_END}>پایان پاس ساعتی</option>
                </select>
              </div>
              <div className="flex gap-3 mt-8">
                <button onClick={handleManualAdd} className="flex-1 bg-emerald-600 text-white p-4 rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">ذخیره تردد</button>
                <button onClick={() => setShowManualForm(false)} className="flex-1 bg-slate-100 text-slate-500 p-4 rounded-2xl font-black hover:bg-slate-200 transition-all">انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print { .no-print { display: none !important; } .printable-area { border: none !important; box-shadow: none !important; width: 100%; margin: 0 !important; } main { padding: 0 !important; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const MenuBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-5 rounded-2xl font-black text-sm transition-all ${
    active ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-100 scale-105' : 'text-slate-400 hover:bg-slate-50'
  }`}>
    <div className={active ? 'text-white' : 'text-slate-300'}>{icon}</div>
    <span>{label}</span>
  </button>
);

export default AdminPanel;
