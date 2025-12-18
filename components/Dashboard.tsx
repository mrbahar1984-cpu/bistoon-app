
import React, { useState } from 'react';
import { EmployeeData, LogType, AttendanceLog } from '../types';
import { getShamsiDate, getShamsiTime, getDayName, isHoliday } from '../utils/jalali';
import { toBase64 } from '../utils/base64';
import { Clock, Play, Square, LogOut, Coffee, Info, Share2, HelpCircle, Download } from 'lucide-react';

interface Props {
  employee: EmployeeData | null;
  onSave: (data: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ employee, onSave }) => {
  const [name, setName] = useState(employee?.name || '');
  // Fix: Property 'employeeId' does not exist on type 'EmployeeData'. Replaced with 'nationalId'.
  const [employeeId, setEmployeeId] = useState(employee?.nationalId || '');
  const [showHelp, setShowHelp] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    // Fix: Object literal may only specify known properties. Replaced 'employeeId' with 'nationalId' and added required 'password'.
    onSave({ name, nationalId: employeeId, password: '', logs: [] });
  };

  const addLog = (type: LogType) => {
    if (!employee) return;
    const now = new Date();
    const shamsi = getShamsiDate(now);
    
    const newLog: AttendanceLog = {
      id: crypto.randomUUID(),
      timestamp: now.getTime(),
      type,
      shamsiDate: shamsi,
      time: getShamsiTime(now),
    };

    onSave({
      ...employee,
      logs: [newLog, ...employee.logs],
    });
  };

  const downloadReport = () => {
    if (!employee) return;
    const today = getShamsiDate();
    const todayLogs = employee.logs.filter(l => l.shamsiDate === today);
    // Fix: Property 'employeeId' does not exist on type 'EmployeeData'. Replaced with 'nationalId'.
    const data = JSON.stringify({ n: employee.name, i: employee.nationalId, d: today, l: todayLogs }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Fix: Property 'employeeId' does not exist on type 'EmployeeData'. Replaced with 'nationalId'.
    a.download = `Report_${employee.nationalId}_${today.replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyDailyToken = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!employee) return;
    const today = getShamsiDate();
    const todayLogs = employee.logs.filter(l => l.shamsiDate === today);
    if (todayLogs.length === 0) {
      alert('امروز هنوز ترددی ثبت نکرده‌اید!');
      return;
    }
    // Fix: Property 'employeeId' does not exist on type 'EmployeeData'. Replaced with 'nationalId'.
    const jsonStr = JSON.stringify({ n: employee.name, i: employee.nationalId, d: today, l: todayLogs });
    
    const token = toBase64(jsonStr);
    if (token) {
      navigator.clipboard.writeText(token).then(() => {
        alert('توکن گزارش امروز کپی شد. آن را در پیام‌رسان برای مدیر بفرستید.');
      }).catch(() => {
        alert('کپی خودکار انجام نشد. لطفا کد را دستی کپی کنید.');
      });
    }
  };

  if (!employee) {
    return (
      <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg mt-10">
        <h2 className="text-2xl font-bold mb-6 text-center text-indigo-900">ثبت‌نام اولیه کارمند</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نام و نام خانوادگی</label>
            <input 
              required
              className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: علی محمدی"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">کد پرسنلی</label>
            <input 
              required
              className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="مثال: ۱۲۳۴۵"
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg active:scale-95">
            شروع به کار
          </button>
        </form>
      </div>
    );
  }

  const today = new Date();
  const shamsiToday = getShamsiDate(today);
  const isTodayHoliday = isHoliday(shamsiToday, today);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{employee.name}</h2>
          {/* Fix: Property 'employeeId' does not exist on type 'EmployeeData'. Replaced with 'nationalId'. */}
          <p className="text-slate-500">کد پرسنلی: {employee.nationalId}</p>
        </div>
        <div className="text-center md:text-left bg-indigo-50 px-6 py-3 rounded-2xl w-full md:w-auto">
          <p className="text-indigo-600 font-bold text-lg">{getDayName(today)}، {shamsiToday}</p>
          <p className={`text-sm mt-1 font-medium ${isTodayHoliday ? 'text-rose-500' : 'text-emerald-600'}`}>
            {isTodayHoliday ? 'روز تعطیل' : 'روز کاری'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ActionButton 
          icon={<Play size={28} />} 
          label="ثبت ورود" 
          color="bg-emerald-500" 
          onClick={() => addLog(LogType.CLOCK_IN)}
        />
        <ActionButton 
          icon={<Square size={28} />} 
          label="ثبت خروج" 
          color="bg-rose-500" 
          onClick={() => addLog(LogType.CLOCK_OUT)}
        />
        <ActionButton 
          icon={<Coffee size={28} />} 
          label="پاس ساعتی" 
          color="bg-amber-500" 
          // Fix: Property 'HOURLY_PASS_START' does not exist on type 'typeof LogType'. Corrected to 'HOURLY_LEAVE_START'.
          onClick={() => addLog(LogType.HOURLY_LEAVE_START)}
        />
        <ActionButton 
          icon={<LogOut size={28} />} 
          label="پایان مرخصی" 
          color="bg-slate-600" 
          // Fix: Property 'HOURLY_PASS_END' does not exist on type 'typeof LogType'. Corrected to 'HOURLY_LEAVE_END'.
          onClick={() => addLog(LogType.HOURLY_LEAVE_END)}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button 
            onClick={copyDailyToken}
            className="flex-[2] bg-indigo-600 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 active:scale-95 transition-all shadow-md"
        >
            <Share2 size={24} />
            کپی کد گزارش (ارسال به مدیر)
        </button>
        <button 
            onClick={downloadReport}
            className="flex-1 bg-white border-2 border-slate-200 text-slate-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-all"
        >
            <Download size={20} />
            دانلود فایل
        </button>
        <button 
            onClick={() => setShowHelp(!showHelp)}
            className="bg-slate-100 text-slate-600 p-4 rounded-2xl hover:bg-slate-200 flex items-center justify-center"
        >
            <HelpCircle size={24} />
        </button>
      </div>

      {showHelp && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-sm text-amber-800 leading-relaxed animate-in fade-in duration-300">
          <strong>راهنمای سریع:</strong><br/>
          ۱. در هر ورود یا خروج، دکمه رنگی مربوطه را بزنید.<br/>
          ۲. در پایان شیفت، دکمه آبی «کپی کد گزارش» را بزنید.<br/>
          ۳. کد کپی شده را در ایتا، تلگرام یا واتس‌اپ برای مدیر بفرستید.
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Clock size={18} />
            ترددهای اخیر
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">تاریخ</th>
                <th className="p-4 font-medium">زمان</th>
                <th className="p-4 font-medium">نوع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employee.logs.slice(0, 15).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-sm text-slate-600">{log.shamsiDate}</td>
                  <td className="p-4 font-mono font-bold text-slate-800">{log.time}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-lg text-[11px] font-bold ${getLogColor(log.type)}`}>
                      {getLogLabel(log.type)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ActionButton: React.FC<{ icon: React.ReactNode, label: string, color: string, onClick: () => void }> = ({ icon, label, color, onClick }) => (
  <button 
    onClick={onClick}
    type="button"
    className={`${color} text-white p-5 rounded-3xl shadow-lg flex flex-col items-center justify-center gap-3 hover:brightness-110 transition-all active:scale-90 select-none`}
  >
    <div className="bg-white/20 p-2 rounded-xl">
      {icon}
    </div>
    <span className="font-bold text-sm">{label}</span>
  </button>
);

const getLogLabel = (type: LogType) => {
  switch (type) {
    case LogType.CLOCK_IN: return 'ورود';
    case LogType.CLOCK_OUT: return 'خروج';
    // Fix: Corrected property names to match LogType enum in types.ts.
    case LogType.HOURLY_LEAVE_START: return 'شروع مرخصی';
    case LogType.HOURLY_LEAVE_END: return 'پایان مرخصی';
    default: return type;
  }
};

const getLogColor = (type: LogType) => {
  switch (type) {
    case LogType.CLOCK_IN: return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    case LogType.CLOCK_OUT: return 'bg-rose-50 text-rose-600 border border-rose-100';
    // Fix: Corrected property names to match LogType enum in types.ts.
    case LogType.HOURLY_LEAVE_START: return 'bg-amber-50 text-amber-600 border border-amber-100';
    case LogType.HOURLY_LEAVE_END: return 'bg-slate-100 text-slate-600 border border-slate-200';
    default: return 'bg-gray-50 text-gray-600';
  }
};

export default Dashboard;
