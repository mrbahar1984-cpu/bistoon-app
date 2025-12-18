
import React, { useState } from 'react';
import { EmployeeData, LogType, AttendanceLog } from './types';
import { getShamsiDate, getShamsiTime, getDayName } from './jalali';
import { supabase } from './supabaseClient';
import { Clock, Play, Square, Coffee, LogOut, UserPlus, LogIn, Fingerprint, RefreshCcw, Wifi, Zap, CheckCircle } from 'lucide-react';

interface Props {
  currentUser: EmployeeData | null;
  onLogin: (user: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ currentUser, onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', nationalId: '', password: '' });
  const [syncing, setSyncing] = useState(false);

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
        if (error || !data) throw new Error('کاربر یافت نشد یا رمز عبور اشتباه است');
        const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', data.id).order('timestamp', { ascending: false });
        onLogin({ 
          id: data.id, 
          name: data.name, 
          nationalId: data.national_id, 
          password: data.password, 
          logs: logs?.map(l => ({ id: l.id, timestamp: l.timestamp, type: l.type as LogType, shamsiDate: l.shams_date, time: l.time })) || [] 
        });
      }
    } catch (err: any) {
      alert('❌ خطا: ' + (err.message || 'مشکل در ارتباط با دیتابیس ابری'));
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
        type,
        shams_date: getShamsiDate(now),
        time: getShamsiTime(now),
        timestamp: now.getTime(),
      }]).select();
      if (error) throw error;
      const newLog: AttendanceLog = { id: data[0].id, timestamp: data[0].timestamp, type: data[0].type as LogType, shamsiDate: data[0].shams_date, time: data[0].time };
      onLogin({ ...currentUser, logs: [newLog, ...currentUser.logs] });
    } catch (err) {
      alert('خطا در ثبت ابری! اینترنت خود را چک کنید.');
    }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-[#1e293b] p-10 rounded-[3.5rem] shadow-2xl border border-slate-700">
          <div className="flex justify-center mb-6">
             <div className="bg-indigo-600 p-4 rounded-3xl text-white"><Fingerprint size={32}/></div>
          </div>
          <h2 className="text-2xl font-black text-center text-white mb-8">
            {isRegister ? 'ثبت‌نام پرسنل جدید' : 'ورود به سامانه بیستون'}
          </h2>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && <input required className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-indigo-500" placeholder="نام و نام خانوادگی" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
            <input required className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-indigo-500" placeholder="کد ملی" value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} />
            <input required type="password" className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-indigo-500" placeholder="رمز عبور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <button disabled={syncing} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
              {syncing ? <RefreshCcw className="animate-spin" /> : (isRegister ? <UserPlus size={20} /> : <LogIn size={20} />)}
              {isRegister ? 'ایجاد حساب کاربری' : 'ورود به پنل'}
            </button>
          </form>
          <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-slate-500 text-xs font-bold hover:text-slate-300">
            {isRegister ? 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید' : 'حساب ندارید؟ ثبت‌نام کنید'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      <div className="bg-indigo-500/10 text-indigo-300 p-4 rounded-[2rem] text-[10px] font-black flex items-center justify-between border border-indigo-500/20">
        <div className="flex items-center gap-3">
           <Wifi size={16} className="text-emerald-400" />
           <span>پایگاه داده ابری: متصل (v5.1)</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-700 flex items-center justify-between shadow-xl">
             <div className="flex items-center gap-6">
                <div className="bg-indigo-600 p-5 rounded-2xl text-white font-black text-3xl">{getShamsiTime()}</div>
                <div>
                  <h2 className="text-2xl font-black text-white">{getDayName(new Date())}</h2>
                  <p className="text-slate-400 text-xs font-bold">{getShamsiDate()}</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <ActionButton icon={<Play size={24}/>} label="ورود" color="bg-emerald-600" onClick={() => addLog(LogType.CLOCK_IN)} />
             <ActionButton icon={<Square size={24}/>} label="خروج" color="bg-rose-600" onClick={() => addLog(LogType.CLOCK_OUT)} />
             <ActionButton icon={<Coffee size={24}/>} label="مرخصی" color="bg-amber-600" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
             <ActionButton icon={<LogOut size={24}/>} label="پایان مرخصی" color="bg-slate-600" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
          </div>

          <div className="bg-[#1e293b] rounded-[2.5rem] border border-slate-700 overflow-hidden shadow-xl">
             <div className="p-6 bg-slate-800/50 border-b border-slate-700 font-black text-slate-300">ترددهای امروز</div>
             <div className="p-6 space-y-3">
                {currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).map(log => (
                   <div key={log.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-700">
                      <span className="text-xs font-bold text-slate-400">
                        {log.type === LogType.CLOCK_IN ? 'ورود' : log.type === LogType.CLOCK_OUT ? 'خروج' : 'مرخصی'}
                      </span>
                      <span className="font-mono font-black text-xl text-indigo-400">{log.time}</span>
                   </div>
                ))}
             </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[3rem] shadow-xl text-white text-center">
           <h3 className="text-xl font-black">{currentUser.name}</h3>
           <p className="text-[10px] mt-1 opacity-60">کد ملی: {currentUser.nationalId}</p>
           <div className="mt-12 bg-black/20 p-8 rounded-[2.5rem]">
              <p className="text-6xl font-black">{currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length}</p>
              <p className="text-[10px] mt-4 font-bold uppercase tracking-widest opacity-70">تعداد ثبت امروز</p>
           </div>
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-8 rounded-[2rem] shadow-lg flex flex-col items-center justify-center gap-3 active:scale-95 transition-all hover:brightness-110`}>
    {icon}
    <span className="font-black text-[10px]">{label}</span>
  </button>
);

export default Dashboard;
