
import React, { useState } from 'react';
import { EmployeeData, LogType, AttendanceLog } from './types';
import { getShamsiDate, getShamsiTime, getDayName } from './jalali';
import { supabase } from './supabaseClient';
import { Clock, Play, Square, Coffee, LogOut, UserPlus, LogIn, Fingerprint, RefreshCcw, Wifi, Zap, CheckCircle, AlertTriangle } from 'lucide-react';

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
        if (error || !data) throw new Error('کد ملی یا رمز عبور اشتباه است');
        
        const { data: logs, error: logsError } = await supabase.from('attendance_logs').select('*').eq('employee_id', data.id).order('timestamp', { ascending: false });
        if (logsError) throw logsError;

        onLogin({ 
          id: data.id, 
          name: data.name, 
          nationalId: data.national_id, 
          password: data.password, 
          logs: logs?.map(l => ({ 
            id: l.id, 
            timestamp: l.timestamp, 
            type: l.type as LogType, 
            shamsiDate: l.shams_date, 
            time: l.time 
          })) || [] 
        });
      }
    } catch (err: any) {
      alert('❌ خطای ورود: ' + (err.message || 'ارتباط برقرار نشد'));
    }
    setSyncing(false);
  };

  const addLog = async (type: LogType) => {
    if (!currentUser?.id) {
      alert('ابتدا وارد حساب خود شوید');
      return;
    }
    setSyncing(true);
    const now = new Date();
    const currentShamsi = getShamsiDate(now);
    const currentTime = getShamsiTime(now);
    
    try {
      const { data, error } = await supabase.from('attendance_logs').insert([{
        employee_id: currentUser.id,
        type: type,
        shams_date: currentShamsi,
        time: currentTime,
        timestamp: now.getTime(),
      }]).select();

      if (error) {
        console.error('Supabase Error:', error);
        throw new Error(error.message);
      }

      if (data && data.length > 0) {
        const newLog: AttendanceLog = { 
          id: data[0].id, 
          timestamp: data[0].timestamp, 
          type: data[0].type as LogType, 
          shamsiDate: data[0].shams_date, 
          time: data[0].time 
        };
        onLogin({ ...currentUser, logs: [newLog, ...currentUser.logs] });
      }
    } catch (err: any) {
      console.error('Catch Error:', err);
      alert('❌ خطای ثبت ابری: ' + (err.message || 'اینترنت را چک کنید'));
    }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-[#1e293b] p-10 rounded-[3.5rem] shadow-2xl border border-slate-700">
          <div className="flex justify-center mb-6">
             <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-lg shadow-indigo-500/20"><Fingerprint size={32}/></div>
          </div>
          <h2 className="text-2xl font-black text-center text-white mb-8">
            {isRegister ? 'عضویت در سامانه' : 'ورود به بیستون 5.2'}
          </h2>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && <input required className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-indigo-500 transition-all" placeholder="نام و نام خانوادگی" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
            <input required className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-indigo-500 transition-all" placeholder="کد ملی" value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} />
            <input required type="password" className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white outline-none focus:border-indigo-500 transition-all" placeholder="رمز عبور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <button disabled={syncing} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20">
              {syncing ? <RefreshCcw className="animate-spin" /> : (isRegister ? <UserPlus size={20} /> : <LogIn size={20} />)}
              {isRegister ? 'ایجاد حساب' : 'ورود به پنل'}
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
           <span>وضعیت: ابری (پایدار)</span>
        </div>
        <div className="px-3 py-1 bg-indigo-500/20 rounded-full">نسخه ۵.۲</div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-700 flex items-center justify-between shadow-xl">
             <div className="flex items-center gap-6">
                <div className="bg-indigo-600 p-5 rounded-2xl text-white font-black text-3xl shadow-lg shadow-indigo-500/20">{getShamsiTime()}</div>
                <div>
                  <h2 className="text-2xl font-black text-white">{getDayName(new Date())}</h2>
                  <p className="text-slate-400 text-xs font-bold">{getShamsiDate()}</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <ActionButton icon={<Play size={24}/>} label="ثبت ورود" color="bg-emerald-600" onClick={() => addLog(LogType.CLOCK_IN)} />
             <ActionButton icon={<Square size={24}/>} label="ثبت خروج" color="bg-rose-600" onClick={() => addLog(LogType.CLOCK_OUT)} />
             <ActionButton icon={<Coffee size={24}/>} label="شروع مرخصی" color="bg-amber-600" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
             <ActionButton icon={<LogOut size={24}/>} label="پایان مرخصی" color="bg-slate-600" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
          </div>

          <div className="bg-[#1e293b] rounded-[2.5rem] border border-slate-700 overflow-hidden shadow-xl">
             <div className="p-6 bg-slate-800/50 border-b border-slate-700 font-black text-slate-300 flex justify-between items-center">
                <span>لیست ترددهای امروز</span>
                {syncing && <RefreshCcw size={16} className="animate-spin text-indigo-400" />}
             </div>
             <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                {currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs font-bold">هنوز ترددی ثبت نشده است</div>
                ) : (
                  currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).map(log => (
                    <div key={log.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-2xl border border-slate-700 hover:border-indigo-500/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${log.type === LogType.CLOCK_IN ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          <span className="text-xs font-bold text-slate-300">
                            {log.type === LogType.CLOCK_IN ? 'ورود' : log.type === LogType.CLOCK_OUT ? 'خروج' : 'مرخصی'}
                          </span>
                        </div>
                        <span className="font-mono font-black text-xl text-indigo-400">{log.time}</span>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[3rem] shadow-xl text-white text-center h-fit sticky top-4">
           <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/20">
              <Fingerprint size={40} />
           </div>
           <h3 className="text-xl font-black">{currentUser.name}</h3>
           <p className="text-[10px] mt-2 opacity-60 font-mono">ID: {currentUser.nationalId}</p>
           
           <div className="mt-12 bg-black/20 p-8 rounded-[2.5rem] backdrop-blur-md border border-white/5">
              <p className="text-6xl font-black">{currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length}</p>
              <p className="text-[10px] mt-4 font-bold uppercase tracking-widest opacity-70">کل ثبت‌های امروز</p>
           </div>
           
           <div className="mt-8 flex items-center justify-center gap-2 text-emerald-300 text-[10px] font-black">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
              داده‌ها در ابر بیستون ایمن هستند
           </div>
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-8 rounded-[2rem] shadow-lg flex flex-col items-center justify-center gap-3 active:scale-95 transition-all hover:brightness-110 group`}>
    <div className="group-hover:scale-110 transition-transform">{icon}</div>
    <span className="font-black text-[10px]">{label}</span>
  </button>
);

export default Dashboard;
