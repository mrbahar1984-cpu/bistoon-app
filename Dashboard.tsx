
import React, { useState, useEffect } from 'react';
import { EmployeeData, LogType, AttendanceLog, LeaveRequest, LeaveType } from './types';
import { getShamsiDate, getShamsiTime, getDayName } from './jalali';
import { supabase } from './supabaseClient';
import { Play, Square, Coffee, LogOut, UserPlus, LogIn, Fingerprint, RefreshCcw, Wifi, MessageSquare, Send, Users } from 'lucide-react';

interface Props {
  currentUser: EmployeeData | null;
  onLogin: (user: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ currentUser, onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', nationalId: '', password: '' });
  const [syncing, setSyncing] = useState(false);
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [leaveData, setLeaveData] = useState({ type: 'HOURLY_PASS' as LeaveType, description: '' });

  const fetchColleagues = async () => {
    try {
      const today = getShamsiDate();
      const { data } = await supabase.from('attendance_logs')
        .select('*, employees(name)')
        .eq('shamsi_date', today)
        .order('timestamp', { ascending: false });
      
      if (data) {
        // فیلتر کردن آخرین وضعیت هر همکار
        const lastStatuses: any = {};
        data.forEach((log: any) => {
          if (!lastStatuses[log.employee_id]) {
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

  useEffect(() => {
    if (currentUser) {
      fetchColleagues();
      const timer = setInterval(fetchColleagues, 30000); // هر ۳۰ ثانیه بروزرسانی
      return () => clearInterval(timer);
    }
  }, [currentUser]);

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
    } catch (err: any) {
      alert('❌ خطا: ' + (err.message || 'ارتباط برقرار نشد'));
    }
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
        onLogin({ ...currentUser, logs: [{ id: data[0].id, timestamp: data[0].timestamp, type: data[0].type as LogType, shamsiDate: data[0].shamsi_date, time: data[0].time }, ...currentUser.logs] });
        fetchColleagues();
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
        description: leaveData.description,
        shamsi_date: getShamsiDate(),
        status: 'PENDING',
        timestamp: Date.now()
      }]);
      if (error) throw error;
      alert('✅ درخواست شما با موفقیت ارسال شد و در انتظار تایید مدیریت است.');
      setLeaveData({ type: 'HOURLY_PASS', description: '' });
    } catch (err: any) { alert('❌ خطا در ارسال درخواست'); }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
          <div className="flex justify-center mb-6">
             <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-lg shadow-indigo-200"><Fingerprint size={32}/></div>
          </div>
          <h2 className="text-xl font-black text-center text-slate-800 mb-8">
            {isRegister ? 'ثبت‌نام همکار جدید' : 'ورود به سامانه بیستون'}
          </h2>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && <input required className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 outline-none focus:border-indigo-500" placeholder="نام و نام خانوادگی" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
            <input required className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 outline-none focus:border-indigo-500" placeholder="کد ملی" value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} />
            <input required type="password" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 outline-none focus:border-indigo-500" placeholder="رمز عبور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <button disabled={syncing} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-100">
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
        {/* بخش اصلی ابزارها */}
        <div className="md:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 font-black text-2xl">{getShamsiTime()}</div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">{getDayName(new Date())}</h2>
                  <p className="text-slate-400 text-[10px] font-bold">{getShamsiDate()}</p>
                </div>
             </div>
             <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black bg-emerald-50 px-3 py-1.5 rounded-full">
                <Wifi size={14} /> متصل به ابر
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <ActionBtn icon={<Play />} label="ثبت ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
             <ActionBtn icon={<Square />} label="ثبت خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
             <ActionBtn icon={<Coffee />} label="شروع پاس" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
             <ActionBtn icon={<LogOut />} label="پایان پاس" color="bg-slate-500" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-5 border-b border-slate-50 font-black text-slate-700 flex items-center gap-2"><Users size={18}/> وضعیت همکاران امروز</div>
             <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                {colleagues.length === 0 ? <p className="col-span-2 text-center text-slate-400 py-4 text-xs">فعلا همکاری ثبت نشده</p> : 
                  colleagues.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-xs font-bold text-slate-700">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full text-white font-black ${c.type === 'CLOCK_IN' ? 'bg-emerald-400' : 'bg-rose-400'}`}>
                          {c.type === 'CLOCK_IN' ? 'وارد شده' : 'خارج شده'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{c.time}</span>
                      </div>
                    </div>
                  ))
                }
             </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 font-black text-slate-700 mb-4"><MessageSquare size={18}/> درخواست مرخصی / پاس</div>
             <div className="space-y-4">
                <div className="flex gap-2">
                   <button onClick={() => setLeaveData({...leaveData, type: 'HOURLY_PASS'})} className={`flex-1 p-3 rounded-xl text-xs font-black border transition-all ${leaveData.type === 'HOURLY_PASS' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-100'}`}>پاس ساعتی</button>
                   <button onClick={() => setLeaveData({...leaveData, type: 'DAILY_LEAVE'})} className={`flex-1 p-3 rounded-xl text-xs font-black border transition-all ${leaveData.type === 'DAILY_LEAVE' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-100'}`}>مرخصی روزانه</button>
                </div>
                <textarea className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-indigo-500 text-sm h-24" placeholder="علت درخواست خود را اینجا بنویسید..." value={leaveData.description} onChange={e => setLeaveData({...leaveData, description: e.target.value})}></textarea>
                <button onClick={submitLeaveRequest} disabled={syncing} className="w-full bg-slate-800 text-white p-4 rounded-xl font-black text-sm flex items-center justify-center gap-2">
                  {syncing ? <RefreshCcw className="animate-spin" /> : <Send size={16}/>} ارسال درخواست
                </button>
             </div>
          </div>
        </div>

        {/* سایدبار اطلاعات */}
        <div className="md:col-span-4 space-y-6">
           <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-lg shadow-indigo-100">
              <h3 className="text-xl font-black mb-1">{currentUser.name}</h3>
              <p className="text-[10px] opacity-70 font-mono tracking-widest uppercase">{currentUser.nationalId}</p>
              <div className="mt-8 bg-white/10 p-6 rounded-2xl backdrop-blur-sm">
                 <p className="text-4xl font-black">{currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length}</p>
                 <p className="text-[10px] opacity-60 font-bold mt-2">کل فعالیت‌های امروز شما</p>
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h4 className="font-black text-slate-700 text-xs mb-4">تاریخچه تردد امروز</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                 {currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).map(log => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                       <span className="text-[10px] font-black text-slate-500">{log.type === 'CLOCK_IN' ? 'ورود' : 'خروج'}</span>
                       <span className="text-sm font-black text-indigo-600">{log.time}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const ActionBtn = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-5 rounded-3xl flex flex-col items-center gap-2 shadow-lg active:scale-95 transition-all hover:brightness-105`}>
    {icon}
    <span className="text-[10px] font-black">{label}</span>
  </button>
);

export default Dashboard;
