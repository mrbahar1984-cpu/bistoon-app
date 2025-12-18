
import React, { useState } from 'react';
import { EmployeeData, LogType, AttendanceLog } from './types';
import { getShamsiDate, getShamsiTime, getDayName } from './utils/jalali';
import { supabase } from './supabaseClient';
import { Clock, Play, Square, Coffee, LogOut, UserPlus, LogIn, Fingerprint, RefreshCcw, Wifi, Zap } from 'lucide-react';

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
        onLogin({ ...data[0], logs: [] });
      } else {
        const { data, error } = await supabase.from('employees').select('*').eq('national_id', formData.nationalId).eq('password', formData.password).single();
        if (error || !data) throw new Error('کاربر یافت نشد');
        const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', data.id).order('timestamp', { ascending: false });
        onLogin({ id: data.id, name: data.name, nationalId: data.national_id, password: data.password, logs: logs?.map(l => ({ id: l.id, timestamp: l.timestamp, type: l.type as LogType, shamsiDate: l.shamsi_date, time: l.time })) || [] });
      }
    } catch (err: any) {
      alert('❌ خطا: ' + (err.message || 'مشکل در اتصال'));
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
        shamsi_date: getShamsiDate(now),
        time: getShamsiTime(now),
        timestamp: now.getTime(),
      }]).select();
      if (error) throw error;
      const newLog: AttendanceLog = { id: data[0].id, timestamp: data[0].timestamp, type: data[0].type as LogType, shamsiDate: data[0].shamsi_date, time: data[0].time };
      onLogin({ ...currentUser, logs: [newLog, ...currentUser.logs] });
    } catch (err) {
      alert('خطا در ثبت ابری!');
    }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-[#1e293b] p-10 rounded-[3rem] shadow-2xl border border-slate-700 relative overflow-hidden">
          <div className="bg-indigo-500/10 text-indigo-400 p-3 rounded-full text-[10px] font-black text-center mb-6 border border-indigo-500/20">
            DASHBOARD V3.0 - CLOUD ACTIVE
          </div>
          <div className="flex justify-center mb-8">
            <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl">
              <Fingerprint size={40} />
            </div>
          </div>
          <h2 className="text-3xl font-black text-center text-white mb-8">
            {isRegister ? 'ثبت‌نام پرسنل' : 'ورود کارمند'}
          </h2>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && <input required className="w-full p-5 rounded-2xl bg-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none text-sm font-bold text-white" placeholder="نام و نام خانوادگی" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
            <input required className="w-full p-5 rounded-2xl bg-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none text-sm font-bold text-white" placeholder="کد ملی" value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} />
            <input required type="password" className="w-full p-5 rounded-2xl bg-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none text-sm font-bold text-white" placeholder="رمز عبور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <button disabled={syncing} className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 text-lg mt-6">
              {syncing ? <RefreshCcw className="animate-spin" /> : (isRegister ? <UserPlus /> : <LogIn />)}
              {isRegister ? 'تایید و ثبت‌نام' : 'ورود به پنل'}
            </button>
          </form>
          <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-slate-400 text-xs font-black hover:text-indigo-400">
            {isRegister ? 'حساب دارید؟ وارد شوید' : 'حساب ندارید؟ ثبت‌نام کنید'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-2xl text-[11px] font-black flex items-center justify-between border border-emerald-500/20">
        <div className="flex items-center gap-3">
           <Wifi size={16} />
           <span>سرور ابری بیستون: فعال و آنلاین</span>
        </div>
        <span className="opacity-50 font-mono">DB: ffbbykkvo...</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#1e293b] p-10 rounded-[3rem] border border-slate-700 flex items-center justify-between shadow-xl">
             <div className="flex items-center gap-6">
                <div className="bg-indigo-500 p-5 rounded-3xl text-white font-black text-3xl">{getShamsiTime()}</div>
                <div>
                  <h2 className="text-2xl font-black text-white">{getDayName(new Date())}</h2>
                  <p className="text-slate-400 text-sm font-bold">{getShamsiDate()}</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <ActionButton icon={<Play />} label="ثبت ورود" color="bg-emerald-600" onClick={() => addLog(LogType.CLOCK_IN)} />
             <ActionButton icon={<Square />} label="ثبت خروج" color="bg-rose-600" onClick={() => addLog(LogType.CLOCK_OUT)} />
             <ActionButton icon={<Coffee />} label="مرخصی" color="bg-amber-600" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
             <ActionButton icon={<LogOut />} label="پایان مرخصی" color="bg-slate-600" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
          </div>

          <div className="bg-[#1e293b] rounded-[3rem] border border-slate-700 overflow-hidden shadow-xl">
             <div className="p-6 bg-slate-800/50 border-b border-slate-700 font-black text-slate-300">ترددهای امروز شما</div>
             <div className="p-6 space-y-3">
                {currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).map(log => (
                  <div key={log.id} className="flex items-center justify-between p-5 bg-slate-800 rounded-2xl border border-slate-700">
                     <span className="text-sm font-bold text-slate-300">{getLogLabel(log.type)}</span>
                     <span className="font-mono font-black text-xl text-indigo-400">{log.time}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-10 rounded-[3rem] shadow-2xl text-white flex flex-col justify-between relative overflow-hidden">
           <Zap className="absolute -bottom-10 -right-10 w-40 h-40 text-white/10" />
           <div className="relative z-10">
              <h3 className="text-2xl font-black mb-2">خوش آمدید</h3>
              <p className="text-indigo-100 font-bold">{currentUser.name}</p>
           </div>
           <div className="bg-white/10 p-6 rounded-2xl mt-12 backdrop-blur-md border border-white/10 relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-2">گزارش روزانه</p>
              <p className="text-4xl font-black">{currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length} <span className="text-sm font-normal">ثبت</span></p>
           </div>
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-8 rounded-[2rem] shadow-lg flex flex-col items-center gap-3 active:scale-95 transition-all hover:brightness-110`}>
    <div className="bg-white/20 p-3 rounded-xl">{icon}</div>
    <span className="font-black text-[11px]">{label}</span>
  </button>
);

const getLogLabel = (type: LogType) => {
  switch (type) {
    case LogType.CLOCK_IN: return 'ورود';
    case LogType.CLOCK_OUT: return 'خروج';
    case LogType.HOURLY_LEAVE_START: return 'شروع مرخصی';
    case LogType.HOURLY_LEAVE_END: return 'پایان مرخصی';
    default: return '';
  }
};

export default Dashboard;
