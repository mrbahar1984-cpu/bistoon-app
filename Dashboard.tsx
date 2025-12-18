
import React, { useState, useEffect } from 'react';
import { EmployeeData, LogType, AttendanceLog } from './types';
import { getShamsiDate, getShamsiTime, getDayName } from './utils/jalali';
import { supabase } from './supabaseClient';
import { Clock, Play, Square, Coffee, LogOut, UserPlus, LogIn, Fingerprint, RefreshCcw, Wifi } from 'lucide-react';

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
        const { data, error } = await supabase
          .from('employees')
          .insert([{ 
            name: formData.name, 
            national_id: formData.nationalId, 
            password: formData.password 
          }])
          .select();
        
        if (error) alert('خطا: ' + error.message);
        else if (data) onLogin({ ...data[0], logs: [] });
      } else {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('national_id', formData.nationalId)
          .eq('password', formData.password)
          .single();
        
        if (error || !data) alert('کد ملی یا رمز عبور اشتباه است');
        else {
          const { data: logs } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('employee_id', data.id)
            .order('timestamp', { ascending: false });
          
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
      }
    } catch (err) {
      alert('خطا در ارتباط با سرور.');
    }
    setSyncing(false);
  };

  const addLog = async (type: LogType) => {
    if (!currentUser || !currentUser.id) return;
    setSyncing(true);
    const now = new Date();
    const logEntry = {
      employee_id: currentUser.id,
      type,
      shamsi_date: getShamsiDate(now),
      time: getShamsiTime(now),
      timestamp: now.getTime(),
    };

    const { data, error } = await supabase
      .from('attendance_logs')
      .insert([logEntry])
      .select();

    if (error) {
      alert('خطا در ثبت تردد. لطفاً اتصال اینترنت را چک کنید.');
    } else if (data) {
      const newLog: AttendanceLog = {
        id: data[0].id,
        timestamp: data[0].timestamp,
        type: data[0].type as LogType,
        shamsiDate: data[0].shamsi_date,
        time: data[0].time,
      };
      onLogin({ ...currentUser, logs: [newLog, ...currentUser.logs] });
    }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50">
          <div className="flex justify-center mb-10">
            <div className="bg-indigo-600 p-5 rounded-[1.5rem] text-white shadow-xl shadow-indigo-200">
              <Fingerprint size={48} />
            </div>
          </div>
          <h2 className="text-3xl font-black text-center text-slate-800 mb-2">
            {isRegister ? 'ثبت‌نام بیستون' : 'سامانه بیستون'}
          </h2>
          <p className="text-center text-slate-400 text-sm mb-10 font-bold">سیستم حضور و غیاب ابری (Cloud)</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && (
              <input 
                required 
                className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none text-sm font-bold transition-all" 
                placeholder="نام و نام خانوادگی" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            )}
            <input 
              required 
              className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none text-sm font-bold transition-all" 
              placeholder="کد ملی (نام کاربری)" 
              value={formData.nationalId}
              onChange={e => setFormData({...formData, nationalId: e.target.value})}
            />
            <input 
              required 
              type="password"
              className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none text-sm font-bold transition-all" 
              placeholder="رمز عبور" 
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
            <button 
              disabled={syncing}
              className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 text-lg mt-4 active:scale-95"
            >
              {syncing ? <RefreshCcw className="animate-spin" size={24} /> : (isRegister ? <UserPlus size={24} /> : <LogIn size={24} />)}
              {isRegister ? 'ایجاد حساب' : 'ورود به پنل'}
            </button>
          </form>
          
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="w-full mt-8 text-indigo-600 text-sm font-black hover:text-indigo-800 transition-colors"
          >
            {isRegister ? 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید' : 'حساب ندارید؟ ثبت‌نام کنید'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-0 animate-in fade-in duration-500">
      <div className="bg-emerald-50 text-emerald-700 p-5 rounded-2xl text-xs font-black flex items-center justify-between border border-emerald-100 shadow-sm">
        <div className="flex items-center gap-2">
           <Wifi size={16} />
           <span>وضعیت: متصل به مرکز (آنلاین)</span>
        </div>
        {syncing && <RefreshCcw size={16} className="animate-spin" />}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-6">
               <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 font-black text-2xl shadow-inner">
                 {getShamsiTime()}
               </div>
               <div>
                 <p className="font-black text-2xl text-slate-800">{getDayName(new Date())}</p>
                 <p className="text-sm text-slate-400 font-bold mt-1">{getShamsiDate()}</p>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <ActionButton icon={<Play size={24}/>} label="ثبت ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
            <ActionButton icon={<Square size={24}/>} label="ثبت خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
            <ActionButton icon={<Coffee size={24}/>} label="مرخصی ساعتی" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
            <ActionButton icon={<LogOut size={24}/>} label="پایان مرخصی" color="bg-slate-700" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-8 border-b border-slate-50 font-black text-xl text-slate-700">ترددهای امروز</div>
             <div className="p-8 space-y-4">
               {currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).map(log => (
                 <div key={log.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                    <span className="text-sm font-black text-slate-700">{getLogLabel(log.type)}</span>
                    <span className="font-mono font-black text-lg text-indigo-600">{log.time}</span>
                 </div>
               ))}
               {currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length === 0 && (
                 <p className="text-center text-slate-300 py-12 italic font-bold">هنوز ترددی ثبت نشده است.</p>
               )}
             </div>
          </div>
        </div>

        <div className="space-y-8">
           <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>
              <h3 className="font-black mb-4 flex items-center gap-3 text-xl relative z-10">
                <Clock size={24} className="text-indigo-400" /> پنل شخصی
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-8 relative z-10 font-bold">
                خوش آمدید، {currentUser.name}. ترددهای شما همزمان برای مدیریت ارسال می‌گردد.
              </p>
              <div className="space-y-4 relative z-10">
                 <div className="bg-white/5 p-6 rounded-2xl text-center border border-white/5">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">تردد امروز</p>
                    <p className="text-3xl font-black">{currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length}</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const ActionButton: React.FC<{ icon: any, label: string, color: string, onClick: () => void }> = ({ icon, label, color, onClick }) => (
  <button onClick={onClick} className={`${color} text-white p-8 rounded-[2rem] shadow-xl flex flex-col items-center justify-center gap-4 active:scale-90 transition-all hover:brightness-110 group`}>
    <div className="bg-white/20 p-3 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
    <span className="font-black text-xs">{label}</span>
  </button>
);

const getLogLabel = (type: LogType) => {
  switch (type) {
    case LogType.CLOCK_IN: return 'ورود به شرکت';
    case LogType.CLOCK_OUT: return 'خروج از شرکت';
    case LogType.HOURLY_LEAVE_START: return 'شروع مرخصی';
    case LogType.HOURLY_LEAVE_END: return 'پایان مرخصی';
    default: return type;
  }
};

export default Dashboard;
