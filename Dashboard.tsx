
import React, { useState } from 'react';
import { EmployeeData, LogType, AttendanceLog } from './types';
import { getShamsiDate, getShamsiTime, getDayName } from './jalali';
import { toBase64 } from './base64';
import { Clock, Play, Square, LogOut, Coffee, Share2, HelpCircle, UserPlus } from 'lucide-react';

interface Props {
  employee: EmployeeData | null;
  onSave: (data: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ employee, onSave }) => {
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !employeeId) return;
    onSave({ name, employeeId, logs: [] });
  };

  const addLog = (type: LogType) => {
    if (!employee) return;
    const now = new Date();
    const newLog: AttendanceLog = {
      id: crypto.randomUUID(),
      timestamp: now.getTime(),
      type,
      shamsiDate: getShamsiDate(now),
      time: getShamsiTime(now),
    };
    onSave({ ...employee, logs: [newLog, ...employee.logs] });
    alert('ثبت شد');
  };

  const copyDailyToken = () => {
    if (!employee) return;
    const today = getShamsiDate();
    const todayLogs = employee.logs.filter(l => l.shamsiDate === today);
    if (todayLogs.length === 0) {
      alert('ترددی برای امروز ندارید.');
      return;
    }
    const token = toBase64(JSON.stringify({ n: employee.name, i: employee.employeeId, d: today, l: todayLogs }));
    navigator.clipboard.writeText(token).then(() => alert('کد گزارش کپی شد.'));
  };

  if (!employee) {
    return (
      <div className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-xl mt-10 text-center">
        <UserPlus size={48} className="mx-auto mb-4 text-indigo-600" />
        <h2 className="text-2xl font-bold mb-6">ثبت‌نام کارمند</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <input required className="w-full p-4 border rounded-2xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="نام و نام خانوادگی" value={name} onChange={e => setName(e.target.value)} />
          <input required className="w-full p-4 border rounded-2xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="کد پرسنلی" value={employeeId} onChange={e => setEmployeeId(e.target.value)} />
          <button type="submit" className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold">ورود</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">{employee.name}</h2>
          <p className="text-slate-500">کد: {employee.employeeId}</p>
        </div>
        <div className="text-indigo-600 font-bold bg-indigo-50 px-4 py-2 rounded-xl">
          {getShamsiDate()}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ActionButton icon={<Play />} label="ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
        <ActionButton icon={<Square />} label="خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
        <ActionButton icon={<Coffee />} label="مرخصی" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_PASS_START)} />
        <ActionButton icon={<LogOut />} label="پایان" color="bg-slate-600" onClick={() => addLog(LogType.HOURLY_PASS_END)} />
      </div>

      <button onClick={copyDailyToken} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all">
        <Share2 size={20} /> کپی کد گزارش برای مدیر
      </button>

      <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
        <div className="p-4 bg-slate-50 font-bold border-b">ترددهای اخیر</div>
        <div className="max-h-80 overflow-y-auto">
          {employee.logs.length > 0 ? (
            employee.logs.map(log => (
              <div key={log.id} className="p-4 border-b flex justify-between text-sm hover:bg-slate-50">
                <span>{log.shamsiDate} - {log.time}</span>
                <span className="font-bold">{getLogLabel(log.type)}</span>
              </div>
            ))
          ) : (
            <p className="p-10 text-center text-slate-400">هنوز ترددی ثبت نشده است.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const ActionButton: React.FC<{ icon: any, label: string, color: string, onClick: () => void }> = ({ icon, label, color, onClick }) => (
  <button onClick={onClick} className={`${color} text-white p-6 rounded-3xl shadow-md flex flex-col items-center gap-2 active:scale-95 transition-all`}>
    {icon}
    <span className="font-bold text-xs">{label}</span>
  </button>
);

const getLogLabel = (type: LogType) => {
  switch (type) {
    case LogType.CLOCK_IN: return 'ورود';
    case LogType.CLOCK_OUT: return 'خروج';
    case LogType.HOURLY_PASS_START: return 'شروع مرخصی';
    case LogType.HOURLY_PASS_END: return 'پایان مرخصی';
    default: return type;
  }
};

export default Dashboard;
