
import React, { useState, useEffect } from 'react';
import { EmployeeData, LogType, AttendanceLog, LeaveRequest, LeaveType } from './types';
import { getShamsiDate, getShamsiTime, getDayName } from './jalali';
import { supabase } from './supabaseClient';
import { Play, Square, Coffee, LogOut, UserPlus, LogIn, Fingerprint, RefreshCcw, Wifi, MessageSquare, Send, Users, Flower2, Clock, Calendar } from 'lucide-react';

interface Props {
  currentUser: EmployeeData | null;
  onLogin: (user: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ currentUser, onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', nationalId: '', password: '' });
  const [syncing, setSyncing] = useState(false);
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveData, setLeaveData] = useState({ type: 'HOURLY_PASS' as LeaveType, description: '', amount: 1 });

  // تابعی برای بروزرسانی سوابق کاربر فعلی از دیتابیس (برای همگام‌سازی چند دستگاهی)
  const refreshUserLogs = async () => {
    if (!currentUser?.id) return;
    const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', currentUser.id).order('timestamp', { ascending: false });
    if (logs) {
      onLogin({ 
        ...currentUser, 
        logs: logs.map(l => ({ 
          id: l.id, 
          timestamp: l.timestamp, 
          type: l.type as LogType, 
          shamsiDate: l.shamsi_date, 
          time: l.time 
        })) 
      });
    }
  };

  const fetchColleagues = async () => {
    try {
      const today = getShamsiDate();
      const { data } = await supabase.from('attendance_logs')
        .select('*, employees(name)')
        .eq('shamsi_date', today)
        .order('timestamp', { ascending: false });
      
      if (data) {
        const lastStatuses: any = {};
        data.forEach((log: any) => {
          if (!lastStatuses[log.employee_id] && log.employees) {
            lastStatuses[log.employee_id] = {
              name: log.employees.name,
              time: log.time,
              type: log.type
            };
          }
        });
        setColleagues(Object.values(lastStatuses));
      }
    } catch (e) { console.error(e); }
  };

  const fetchMyRequests = async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase.from('leave_requests').select('*').eq('employee_id', currentUser.id).order('timestamp', { ascending: false }).limit(5);
    if (data) setLeaveRequests(data);
  };

  useEffect(() => {
    if (currentUser) {
      fetchColleagues();
      fetchMyRequests();
      refreshUserLogs(); // همگام‌سازی با سرور به محض ورود

      const channel = supabase.channel('attendance_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
          fetchColleagues();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [currentUser?.id]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    try {
      if (isRegister) {
        const { data, error } = await supabase.from('employees').insert([{ 
          name: formData.name, 
          national_id: formData.nationalId, 
          password: formData.password 
        }]).select();
        if (error) throw error;
        onLogin({ ...data[0], id: data[0].id, nationalId: data[0].national_id, logs: [] });
      } else {
        const { data, error } = await supabase.from('employees').select('*').eq('national_id', formData.nationalId).eq('password', formData.password).single();
        if (error || !data) throw new Error('کد ملی یا رمز عبور اشتباه است');
        
        const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', data.id).order('timestamp', { ascending: false });

        onLogin({ 
          id: data.id, 
          name: data.name, 
          nationalId: data.national_id, 
          password: data.password, 
          logs: logs?.map(l => ({ 
            id: l.id, 
            timestamp: l.timestamp, 
            type: l.type as LogType, 
            shamsiDate: l.shamsi_date, 
            time: l.time 
          })) || [] 
        });
      }
    } catch (err: any) { alert('❌ خطا: ' + err.message); }
    setSyncing(false);
  };

  const addLog = async (type: LogType) => {
    if (!currentUser?.id) return;
    setSyncing(true);
    const now = new Date();
    try {
      const { data, error } = await supabase.from('attendance_logs').insert([{
        employee_id: currentUser.id,
        type: type,
        shamsi_date: getShamsiDate(now), 
        time: getShamsiTime(now),
        timestamp: now.getTime(),
      }]).select();
      if (error) throw error;
      if (data) {
        await refreshUserLogs();
      }
    } catch (err: any) { alert(`❌ خطا: ${err.message}`); }
    setSyncing(false);
  };

  const submitLeaveRequest = async () => {
    if (!leaveData.description || !currentUser?.id) return;
    setSyncing(true);
    try {
      const { error } = await supabase.from('leave_requests').insert([{
        employee_id: currentUser.id,
        type: leaveData.type,
        amount: leaveData.amount,
        description: leaveData.description,
        shamsi_date: getShamsiDate(),
        status: 'PENDING',
        timestamp: Date.now()
      }]);
      if (error) throw error;
      alert('✅ درخواست با موفقیت ارسال شد.');
      setLeaveData({ type: 'HOURLY_PASS', description: '', amount: 1 });
      fetchMyRequests();
    } catch (err: any) { alert('❌ خطا در ارسال'); }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
          <div className="flex justify-center mb-6">
             <div className="bg-emerald-500 p-4 rounded-3xl text-white shadow-lg shadow-emerald-100"><Flower2 size={32}/></div>
          </div>
          <h2 className="text-xl font-black text-center text-slate-800 mb-8">ورود به BaharTime</h2>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && <input required className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 outline-none focus:border-emerald-500" placeholder="نام و نام خانوادگی" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
            <input required className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 outline-none focus:border-emerald-500" placeholder="کد ملی" value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} />
            <input required type="password" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 outline-none focus:border-emerald-500" placeholder="رمز عبور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <button disabled={syncing} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-3">
              {syncing ? <RefreshCcw className="animate-spin" /> : (isRegister ? <UserPlus size={20} /> : <LogIn size={20} />)}
              {isRegister ? 'ایجاد حساب' : 'ورود به پنل'}
            </button>
          </form>
          <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-slate-400 text-[10px] font-bold">
            {isRegister ? 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید' : 'حساب ندارید؟ ثبت‌نام کنید'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 font-black text-2xl">{getShamsiTime()}</div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">{getDayName(new Date())}</h2>
                  <p className="text-slate-400 text-[10px] font-bold">{getShamsiDate()}</p>
                </div>
             </div>
             <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black bg-emerald-50 px-3 py-1.5 rounded-full">
                <Wifi size={14} className="animate-pulse" /> وضعیت آنی
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <ActionBtn icon={<Play />} label="ثبت ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
             <ActionBtn icon={<Square />} label="ثبت خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
             <ActionBtn icon={<Coffee />} label="شروع پاس" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
             <ActionBtn icon={<Clock />} label="پایان پاس" color="bg-indigo-500" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-5 border-b border-slate-50 font-black text-slate-700 flex items-center gap-2"><Users size={18}/> همکاران در محل (بروزرسانی لحظه‌ای)</div>
             <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto custom-scrollbar">
                {colleagues.length === 0 ? <p className="col-span-2 text-center text-slate-400 py-4 text-xs">در حال حاضر کسی حضور ندارد</p> : 
                  colleagues.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 border-r-4 border-r-emerald-400">
                      <span className="text-xs font-bold text-slate-700">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] px-2 py-0.5 rounded-full text-white font-black ${c.type === 'CLOCK_IN' || c.type === 'HOURLY_LEAVE_END' ? 'bg-emerald-400' : 'bg-rose-300'}`}>
                          {c.type === 'CLOCK_IN' || c.type === 'HOURLY_LEAVE_END' ? 'حاضر' : 'خارج شده'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{c.time}</span>
                      </div>
                    </div>
                  ))
                }
             </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 font-black text-slate-700 mb-4"><MessageSquare size={18}/> درخواست جدید</div>
             <div className="space-y-4">
                <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl">
                   <button onClick={() => setLeaveData({...leaveData, type: 'HOURLY_PASS'})} className={`flex-1 p-3 rounded-xl text-[10px] font-black transition-all ${leaveData.type === 'HOURLY_PASS' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>پاس ساعتی</button>
                   <button onClick={() => setLeaveData({...leaveData, type: 'DAILY_LEAVE'})} className={`flex-1 p-3 rounded-xl text-[10px] font-black transition-all ${leaveData.type === 'DAILY_LEAVE' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>مرخصی روزانه</button>
                </div>
                
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                   <span className="text-[10px] font-black text-slate-500">مقدار ({leaveData.type === 'HOURLY_PASS' ? 'ساعت' : 'روز'}):</span>
                   <input type="number" min="1" className="bg-white border border-slate-100 rounded-lg p-2 w-16 text-center font-black text-emerald-600" value={leaveData.amount} onChange={e => setLeaveData({...leaveData, amount: Number(e.target.value)})} />
                </div>

                <textarea className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-emerald-500 text-sm h-20" placeholder="علت درخواست..." value={leaveData.description} onChange={e => setLeaveData({...leaveData, description: e.target.value})}></textarea>
                
                <button onClick={submitLeaveRequest} disabled={syncing} className="w-full bg-emerald-600 text-white p-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-50">
                  {syncing ? <RefreshCcw className="animate-spin" /> : <Send size={16}/>} ثبت درخواست
                </button>
             </div>
          </div>
        </div>

        <div className="md:col-span-4 space-y-6">
           <div className="bg-gradient-to-br from-emerald-500 to-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-xl font-black">{currentUser.name}</h3>
                    <p className="text-[9px] opacity-70">پنل کاربری BaharTime</p>
                 </div>
                 <Flower2 size={24} className="opacity-50" />
              </div>
              <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-md">
                 <p className="text-4xl font-black">{currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length}</p>
                 <p className="text-[10px] opacity-70 font-bold mt-2">تردد ثبت شده امروز</p>
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h4 className="font-black text-slate-700 text-xs mb-4">آخرین وضعیت درخواست‌ها</h4>
              <div className="space-y-3">
                 {leaveRequests.length === 0 ? <p className="text-[9px] text-slate-400 text-center">سابقه درخواستی ندارید</p> : 
                   leaveRequests.map(req => (
                     <div key={req.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-center mb-1">
                           <span className="text-[9px] font-black">{req.type === 'DAILY_LEAVE' ? 'مرخصی' : 'پاس'} ({req.amount})</span>
                           <span className={`text-[8px] px-2 py-0.5 rounded-full font-black ${req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : req.status === 'REJECTED' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                              {req.status === 'APPROVED' ? 'تایید شده' : req.status === 'REJECTED' ? 'رد شده' : 'در انتظار'}
                           </span>
                        </div>
                        <p className="text-[8px] text-slate-400 truncate">{req.description}</p>
                     </div>
                   ))
                 }
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const ActionBtn = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-5 rounded-[2rem] flex flex-col items-center gap-2 shadow-lg active:scale-95 transition-all hover:brightness-105`}>
    {icon}
    <span className="text-[10px] font-black">{label}</span>
  </button>
);

export default Dashboard;
