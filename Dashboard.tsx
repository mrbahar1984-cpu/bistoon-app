
import React, { useState } from 'react';
import { EmployeeData, LogType, AttendanceLog } from './types';
import { getShamsiDate, getShamsiTime, getDayName } from './jalali';
import { toBase64 } from './base64';
import { Clock, Play, Square, Coffee, LogOut, Share2, UserPlus, LogIn, Fingerprint } from 'lucide-react';

interface Props {
  currentUser: EmployeeData | null;
  onLogin: (user: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ currentUser, onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', nationalId: '', password: '' });

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      const newUser: EmployeeData = { ...formData, logs: [] };
      localStorage.setItem(`user_${formData.nationalId}`, JSON.stringify(newUser));
      onLogin(newUser);
      localStorage.setItem('current_user', JSON.stringify(newUser));
    } else {
      const saved = localStorage.getItem(`user_${formData.nationalId}`);
      if (saved) {
        const user = JSON.parse(saved);
        if (user.password === formData.password) {
          onLogin(user);
          localStorage.setItem('current_user', JSON.stringify(user));
        } else alert('رمز عبور اشتباه است');
      } else alert('کاربری با این کد ملی یافت نشد');
    }
  };

  const addLog = (type: LogType) => {
    if (!currentUser) return;
    const now = new Date();
    const newLog: AttendanceLog = {
      id: crypto.randomUUID(),
      timestamp: now.getTime(),
      type,
      shamsiDate: getShamsiDate(now),
      time: getShamsiTime(now),
    };
    const updated = { ...currentUser, logs: [newLog, ...currentUser.logs] };
    onLogin(updated);
    localStorage.setItem(`user_${currentUser.nationalId}`, JSON.stringify(updated));
    localStorage.setItem('current_user', JSON.stringify(updated));
  };

  const shareToken = () => {
    if (!currentUser) return;
    const today = getShamsiDate();
    const todayLogs = currentUser.logs.filter(l => l.shamsiDate === today);
    const token = toBase64(JSON.stringify({ n: currentUser.name, i: currentUser.nationalId, d: today, l: todayLogs }));
    navigator.clipboard.writeText(token).then(() => alert('گزارش کپی شد! برای مدیر ارسال کنید.'));
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-white/50 backdrop-blur-sm">
          <div className="flex justify-center mb-8">
            <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-lg shadow-indigo-200">
              <Fingerprint size={40} />
            </div>
          </div>
          <h2 className="text-2xl font-black text-center text-slate-800 mb-2">
            {isRegister ? 'ساخت حساب کاربری' : 'خوش آمدید'}
          </h2>
          <p className="text-center text-slate-400 text-sm mb-8">سامانه هوشمند تردد بیستون</p>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && (
              <input 
                required 
                className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                placeholder="نام و نام خانوادگی" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            )}
            <input 
              required 
              className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
              placeholder="کد ملی" 
              value={formData.nationalId}
              onChange={e => setFormData({...formData, nationalId: e.target.value})}
            />
            <input 
              required 
              type="password"
              className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
              placeholder="رمز عبور" 
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
            <button className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
              {isRegister ? <UserPlus size={20} /> : <LogIn size={20} />}
              {isRegister ? 'ثبت‌نام و ورود' : 'ورود به پنل'}
            </button>
          </form>
          
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="w-full mt-6 text-indigo-600 text-sm font-bold"
          >
            {isRegister ? 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید' : 'حساب ندارید؟ ثبت‌نام کنید'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 font-bold text-xl">
                 {getShamsiTime()}
               </div>
               <div>
                 <p className="font-bold text-slate-800">{getDayName(new Date())}</p>
                 <p className="text-xs text-slate-400">{getShamsiDate()}</p>
               </div>
            </div>
            <button onClick={shareToken} className="bg-slate-900 text-white px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-all">
               <Share2 size={16} /> ارسال گزارش
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ActionButton icon={<Play />} label="ثبت ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
            <ActionButton icon={<Square />} label="ثبت خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
            <ActionButton icon={<Coffee />} label="مرخصی ساعتی" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
            <ActionButton icon={<LogOut />} label="پایان مرخصی" color="bg-slate-700" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
          </div>

          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-6 border-b border-slate-50 font-bold text-slate-700">ترددهای امروز</div>
             <div className="p-6">
               {currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).map(log => (
                 <div key={log.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                    <span className="text-xs font-bold">{getLogLabel(log.type)}</span>
                    <span className="font-mono font-bold text-slate-600">{log.time}</span>
                 </div>
               ))}
               {currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length === 0 && (
                 <p className="text-center text-slate-300 py-8 italic text-sm">هنوز ترددی ثبت نشده است.</p>
               )}
             </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Clock size={18} /> وضعیت آنلاین تیم
              </h3>
              <p className="text-xs text-indigo-100 leading-relaxed">
                این بخش بر اساس آخرین همگام‌سازی مدیر نمایش داده می‌شود. (در این نسخه آفلاین، فقط وضعیت خودتان را می‌بینید)
              </p>
              <div className="mt-6 space-y-3">
                 <div className="flex items-center justify-between bg-white/10 p-3 rounded-xl">
                    <span className="text-sm">{currentUser.name}</span>
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const ActionButton: React.FC<{ icon: any, label: string, color: string, onClick: () => void }> = ({ icon, label, color, onClick }) => (
  <button onClick={onClick} className={`${color} text-white p-8 rounded-[2rem] shadow-lg flex flex-col items-center gap-4 active:scale-95 transition-all hover:brightness-105`}>
    <div className="bg-white/20 p-3 rounded-2xl">{icon}</div>
    <span className="font-bold text-sm">{label}</span>
  </button>
);

const getLogLabel = (type: LogType) => {
  switch (type) {
    case LogType.CLOCK_IN: return 'ورود';
    case LogType.CLOCK_OUT: return 'خروج';
    case LogType.HOURLY_LEAVE_START: return 'شروع مرخصی';
    case LogType.HOURLY_LEAVE_END: return 'پایان مرخصی';
  }
};

export default Dashboard;
