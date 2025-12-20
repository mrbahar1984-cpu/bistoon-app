
import React, { useState, useEffect } from 'react';
import { EmployeeData, LogType, AttendanceLog, LeaveRequest, LeaveType } from './types';
import { getShamsiDate, getShamsiTime, getDayName } from './jalali';
import { supabase } from './supabaseClient';
import { Play, Square, Coffee, LogOut, UserPlus, LogIn, RefreshCcw, Wifi, MessageSquare, Send, Users, Flower2, Clock, Calendar, ListChecks } from 'lucide-react';

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
          time: l.time,
          is_manual: l.is_manual,
          is_edited: l.is_edited
        })) 
      });
    }
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
      const channel = supabase.channel('attendance_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
          fetchColleagues();
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [currentUser?.id]);

  const addLog = async (type: LogType) => {
    if (!currentUser?.id) return;
    setSyncing(true);
    const now = new Date();
    try {
      await supabase.from('attendance_logs').insert([{
        employee_id: currentUser.id,
        type: type,
        shamsi_date: getShamsiDate(now), 
        time: getShamsiTime(now),
        timestamp: now.getTime(),
        is_manual: false
      }]);
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
          {/* فرم لاگین مشابه نسخه قبل */}
          <button onClick={() => {}} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black">ورود به پنل</button>
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
                <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 font-black text-2xl">{getShamsiTime()}</div>
                <div><h2 className="text-lg font-black text-slate-800">{getDayName(new Date())}</h2><p className="text-slate-400 text-[10px] font-bold">{getShamsiDate()}</p></div>
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <ActionBtn icon={<Play />} label="ثبت ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
             <ActionBtn icon={<Square />} label="ثبت خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
             <ActionBtn icon={<Coffee />} label="شروع پاس" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
             <ActionBtn icon={<Clock />} label="پایان پاس" color="bg-indigo-500" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
          </div>

          {/* سابقه تردد کاربر */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 font-black text-slate-700 mb-4 border-b pb-4"><ListChecks size={18}/> سوابق تردد اخیر من</div>
             <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {currentUser.logs.length === 0 ? <p className="text-center text-slate-400 text-xs py-4">هنوز ترددی ثبت نشده است</p> : 
                  currentUser.logs.slice(0, 10).map((log, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-700">{log.type}</span>
                          <span className="text-[8px] text-slate-400 font-mono">{log.shamsiDate}</span>
                       </div>
                       <div className="flex items-center gap-3">
                          {log.is_manual && <span className="text-[7px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-black">ثبت دستی ادمین</span>}
                          {log.is_edited && <span className="text-[7px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-black">اصلاح شده</span>}
                          <span className="text-xs font-black text-emerald-600 font-mono">{log.time}</span>
                       </div>
                    </div>
                  ))
                }
             </div>
          </div>
        </div>

        <div className="md:col-span-4 space-y-6">
           <div className="bg-gradient-to-br from-emerald-500 to-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl">
              <h3 className="text-xl font-black mb-1">{currentUser.name}</h3>
              <p className="text-[9px] opacity-70 mb-6">پنل کاربری BaharTime</p>
              <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-md">
                 <p className="text-4xl font-black">{currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length}</p>
                 <p className="text-[10px] opacity-70 font-bold mt-2">تردد ثبت شده امروز</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const ActionBtn = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-5 rounded-[2rem] flex flex-col items-center gap-2 shadow-lg active:scale-95 transition-all hover:brightness-105`}>
    {icon}<span className="text-[10px] font-black">{label}</span>
  </button>
);

export default Dashboard;
