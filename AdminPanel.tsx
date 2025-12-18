
import React, { useState } from 'react';
import { fromBase64 } from './base64';
import { calculateWorkDetails } from './utils/calculations';
import { FileUp, ClipboardList, Trash2, Printer, Calculator, CheckCircle2 } from 'lucide-react';
import { CalculationResult } from './types';

const AdminPanel: React.FC = () => {
  const [token, setToken] = useState('');
  const [importedData, setImportedData] = useState<any[]>([]);
  const [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');

  const handleImport = () => {
    try {
      const decoded = JSON.parse(fromBase64(token.trim()));
      setImportedData([...importedData, decoded]);
      
      // محاسبه خودکار
      const calc = calculateWorkDetails(decoded.l);
      setResults(prev => ({ ...prev, [decoded.i]: calc }));
      
      setToken('');
      alert('گزارش با موفقیت تحلیل و اضافه شد.');
    } catch (e) {
      alert('کد نامعتبر است.');
    }
  };

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white p-10 rounded-[2.5rem] shadow-xl text-center">
        <div className="bg-slate-900 w-16 h-16 rounded-3xl flex items-center justify-center text-white mx-auto mb-6">
          <Calculator size={32} />
        </div>
        <h2 className="text-xl font-bold mb-6">ورود به پنل مدیریت</h2>
        <input 
          type="password" 
          placeholder="رمز عبور مدیریت" 
          className="w-full p-4 rounded-2xl bg-slate-50 mb-4 outline-none border-2 border-transparent focus:border-indigo-500"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button 
          onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('غلط است (پیش‌فرض: admin123)')}
          className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold"
        >
          تایید هویت
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 text-right">میز کارشناس منابع انسانی</h2>
          <p className="text-sm text-slate-400 mt-1">محاسبه دقیق کارکرد بر اساس متد ریاضی</p>
        </div>
        <button onClick={() => window.print()} className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl hover:bg-indigo-100 transition-all">
          <Printer size={24} />
        </button>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <FileUp size={18} className="text-indigo-600" /> ثبت گزارش جدید
              </h3>
              <textarea 
                className="w-full h-40 p-4 bg-slate-50 rounded-2xl text-[10px] font-mono mb-4 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="کد گزارش کارمند را اینجا قرار دهید..."
                value={token}
                onChange={e => setToken(e.target.value)}
              />
              <button 
                onClick={handleImport}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                تحلیل و ثبت در سیستم
              </button>
           </div>

           <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <ClipboardList size={18} /> گزارشات فعال
              </h3>
              <div className="space-y-3">
                {importedData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/10 p-3 rounded-xl">
                    <span className="text-xs font-bold">{d.n}</span>
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  </div>
                ))}
                {importedData.length === 0 && <p className="text-center text-slate-500 py-6 italic text-xs">لیست خالی است</p>}
              </div>
              {importedData.length > 0 && (
                <button onClick={() => setImportedData([])} className="mt-6 text-rose-400 text-xs flex items-center gap-1 mx-auto">
                  <Trash2 size={14} /> پاکسازی کل لیست
                </button>
              )}
           </div>
        </div>

        <div className="md:col-span-2 space-y-6">
           {importedData.map((data, idx) => {
             const res = results[data.i];
             return (
               <div key={idx} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500"></div>
                  <div className="flex justify-between items-start mb-8">
                     <div>
                        <h4 className="text-xl font-black text-slate-800">{data.n}</h4>
                        <p className="text-xs text-slate-400 mt-1">کد ملی: {data.i} | گزارش تاریخ: {data.d}</p>
                     </div>
                     <div className="bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold text-slate-500">
                        {data.l.length} تردد ثبت شده
                     </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                     <ResultCard label="کل کارکرد واقعی" value={res?.formattedTotal} color="text-emerald-600" />
                     <ResultCard label="اضافه‌کاری (تخمینی)" value={res?.formattedOvertime} color="text-indigo-600" />
                     <ResultCard label="تعطیل‌کاری" value={res?.formattedHoliday} color="text-rose-600" />
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50">
                     <p className="text-xs text-slate-400 leading-relaxed italic">
                       * این محاسبات بر اساس ساعات ورود و خروج مستقیم انجام شده است. برای محاسبات نهایی مالیات و بیمه، این مقادیر را به نرم‌افزار حسابداری منتقل کنید.
                     </p>
                  </div>
               </div>
             );
           })}
           {importedData.length === 0 && (
             <div className="h-[400px] bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                <Calculator size={64} className="mb-4 opacity-20" />
                <p className="font-bold">در انتظار وارد کردن کد گزارش کارمندان...</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const ResultCard = ({ label, value, color }: any) => (
  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
    <p className="text-[10px] text-slate-400 mb-2 font-bold">{label}</p>
    <p className={`text-sm font-black ${color}`}>{value || '۰ ساعت'}</p>
  </div>
);

export default AdminPanel;
