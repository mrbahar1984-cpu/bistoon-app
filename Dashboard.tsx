
import React, { useState, useEffect } from 'react';
import { EmployeeData, LogType, AttendanceLog, LeaveRequest, LeaveType } from './types';
import { getShamsiDate, getShamsiTime, getDayName, toEnglishDigits } from './jalali';
import { supabase } from './supabaseClient';
import { Play, Square, Coffee, LogOut, UserPlus, LogIn, RefreshCcw, Wifi, MessageSquare, Send, Users, Flower2, Clock, Calendar, ListChecks, ArrowLeftRight } from 'lucide-react';

interface Props {
  currentUser: EmployeeData | null;
  onLogin: (user: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ currentUser, onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', nationalId: '', password: '' });
  const [syncing, setSyncing] = useState(false);
  const [colleagues, setColleagues] = useState<any[]>([]);

  const refreshUserLogs = async () => {
    if (!currentUser?.id) return;
    const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', currentUser.id).order('shamsi_date', { ascending: false }).order('time', { ascending: false }).limit(20);
    if (logs) {
      onLogin({ 
        ...currentUser, 
        logs: logs.map(l => ({ 
          id: l.id, 
          timestamp: l.timestamp, 
          type: l.type as LogType, 
          shamsiDate: l.shamsi_date, 
          time: l.time,
          is_manual: l.is_manual,
          is_edited: l.is_edited
        })) 
      });
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    const cleanId = toEnglishDigits(formData.nationalId);
    try {
      if (isRegister) {
        const { data, error } = await supabase.from('employees').insert([{ 
          name: formData.name, 
          national_id: cleanId, 
          password: formData.password 
        }]).select();
        if (error) throw error;
        onLogin({ ...data[0], id: data[0].id, nationalId: data[0].national_id, logs: [] });
      } else {
        const { data, error } = await supabase.from('employees').select('*').eq('national_id', cleanId).eq('password', formData.password).single();
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
            time: l.time,
            is_manual: l.is_manual,
            is_edited: l.is_edited
          })) || [] 
        });
      }
    } catch (err: any) { alert('❌ خطا: ' + err.message); }
    setSyncing(false);
  };

  const fetchColleagues = async () => {
    try {
      const today = getShamsiDate();
      const { data } = await supabase.from('attendance_logs').select('*, employees(name)').eq('shamsi_date', today).order('timestamp', { ascending: false });
      if (data) {
        const lastStatuses: any = {};
        data.forEach((log: any) => {
          if (!lastStatuses[log.employee_id] && log.employees) {
            lastStatuses[log.employee_id] = { name: log.employees.name, time: log.time, type: log.type };
          }
        });
        setColleagues(Object.values(lastStatuses));
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (currentUser) {
      fetchColleagues();
      refreshUserLogs();
      const channel = supabase.channel('attendance_dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
          fetchColleagues();
          refreshUserLogs();
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [currentUser?.id]);

  const addLog = async (type: LogType) => {
    if (!currentUser?.id) return;
    setSyncing(true);
    const now = new Date();
    try {
      const { error } = await supabase.from('attendance_logs').insert([{
        employee_id: currentUser.id,
        type: type,
        shamsi_date: getShamsiDate(now), 
        time: getShamsiTime(now),
        timestamp: now.getTime()
      }]);
      if (error) throw error;
      await refreshUserLogs();
    } catch (err: any) { alert(`❌ خطا: ${err.message}`); }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
          <div className="flex justify-center mb-6"><div className="bg-emerald-500 p-4 rounded-3xl text-white shadow-lg shadow-emerald-100"><Flower2 size={32}/></div></div>
          <h2 className="text-xl font-black text-center text-slate-800 mb-8">ورود به BaharTime</h2>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && (
              <input required className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 outline-none focus:border-emerald-500" placeholder="نام و نام خانوادگی" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            )}
            <input required className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 outline-none focus:border-emerald-500 font-mono" placeholder="کد ملی" value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} />
            <input required type="password" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-800 outline-none focus:border-emerald-500" placeholder="رمز عبور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            
            <button disabled={syncing} type="submit" className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-50">
              {syncing ? <RefreshCcw className="animate-spin" /> : (isRegister ? <UserPlus size={20} /> : <LogIn size={20} />)}
              {isRegister ? 'ایجاد حساب کاربری' : 'ورود به پنل شخصی'}
            </button>
          </form>
          
          <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-slate-400 text-[10px] font-bold hover:text-emerald-600 transition-colors">
            {isRegister ? 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید' : 'حساب ندارید؟ ثبت‌نام کنید (هماهنگی با ادمین)'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 font-black text-2xl animate-pulse">{getShamsiTime()}</div>
                <div><h2 className="text-lg font-black text-slate-800">{getDayName(new Date())}</h2><p className="text-slate-400 text-[10px] font-bold">{getShamsiDate()}</p></div>
             </div>
             <div className="bg-slate-50 p-3 rounded-2xl flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                <span className="text-[10px] font-black text-slate-600">ارتباط آنی برقرار است</span>
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <ActionBtn icon={<Play />} label="ثبت ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
             <ActionBtn icon={<Square />} label="ثبت خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
             <ActionBtn icon={<Coffee />} label="شروع پاس" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
             <ActionBtn icon={<Clock />} label="پایان پاس" color="bg-indigo-500" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><ListChecks size={18}/> تاریخچه ترددهای اخیر من</div>
             <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {currentUser.logs.length === 0 ? <p className="text-center text-slate-400 text-xs py-10">هنوز ترددی در سیستم برای شما ثبت نشده است.</p> : 
                  currentUser.logs.map((log, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-emerald-200 transition-all">
                       <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${log.type === LogType.CLOCK_IN ? 'bg-emerald-100 text-emerald-600' : log.type === LogType.CLOCK_OUT ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                             <ArrowLeftRight size={16}/>
                          </div>
                          <div>
                            <span className="text-[11px] font-black text-slate-700 block">{log.type === LogType.CLOCK_IN ? 'ورود به مجموعه' : log.type === LogType.CLOCK_OUT ? 'خروج از مجموعه' : 'پاس ساعتی'}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{log.shamsiDate}</span>
                          </div>
                       </div>
                       <div className="text-left flex flex-col items-end gap-2">
                          <span className="text-sm font-black text-slate-800 font-mono">{log.time}</span>
                          <div className="flex gap-1">
                             {log.is_manual && <span className="text-[7px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-black">ثبت دستی ادمین</span>}
                             {log.is_edited && <span className="text-[7px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-black">اصلاح شده توسط ادمین</span>}
                          </div>
                       </div>
                    </div>
                  ))
                }
             </div>
          </div>
        </div>

        <div className="md:col-span-4 space-y-6">
           <div className="bg-gradient-to-br from-emerald-600 to-indigo-700 p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <h3 className="text-xl font-black mb-1">{currentUser.name}</h3>
              <p className="text-[10px] opacity-70 mb-8">کاربر گرامی، خوش آمدید</p>
              <div className="bg-white/10 p-6 rounded-3xl backdrop-blur-md border border-white/10">
                 <p className="text-5xl font-black">{currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length}</p>
                 <p className="text-[11px] opacity-80 font-bold mt-3">تردد ثبت شده در تاریخ امروز</p>
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><Users size={18}/> همکاران حاضر</div>
              <div className="space-y-3">
                 {colleagues.filter(c => c.type === LogType.CLOCK_IN).length === 0 ? <p className="text-[10px] text-slate-400 text-center py-4">در حال حاضر همکاری در محل نیست.</p> : 
                   colleagues.filter(c => c.type === LogType.CLOCK_IN).map((c, i) => (
                     <div key={i} className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <span className="text-[11px] font-black text-emerald-700">{c.name}</span>
                        <span className="text-[9px] font-mono text-emerald-500">ورود: {c.time}</span>
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
  <button onClick={onClick} className={`${color} text-white p-6 rounded-[2.5rem] flex flex-col items-center gap-3 shadow-lg active:scale-95 transition-all hover:brightness-105 shadow-${color.split('-')[1]}-100`}>
    <div className="p-2 bg-white/20 rounded-xl">{icon}</div>
    <span className="text-xs font-black">{label}</span>
  </button>
);

export default Dashboard;
