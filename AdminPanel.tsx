
import React, { useState } from 'react';
import { analyzeAttendance } from './geminiService';
import { fromBase64 } from './base64';
import { FileUp, Zap, Loader2, ClipboardList, Trash2 } from 'lucide-react';

const AdminPanel: React.FC = () => {
  const [token, setToken] = useState('');
  const [importedData, setImportedData] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = () => {
    try {
      const decoded = JSON.parse(fromBase64(token.trim()));
      setImportedData([...importedData, decoded]);
      setToken('');
    } catch (e) {
      alert('کد نامعتبر است.');
    }
  };

  const handleAI = async () => {
    setLoading(true);
    const result = await analyzeAttendance(JSON.stringify(importedData));
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
        <h2 className="text-2xl font-bold">پنل مدیریت</h2>
        <p className="text-slate-400">تحلیل گزارشات دریافتی از کارمندان</p>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border">
        <h3 className="font-bold mb-4 flex items-center gap-2"><FileUp size={20} /> وارد کردن کد گزارش</h3>
        <textarea 
          className="w-full h-24 p-4 border rounded-2xl mb-4 bg-slate-50 text-[10px] font-mono" 
          placeholder="کد را اینجا بچسبانید..." 
          value={token} 
          onChange={e => setToken(e.target.value)} 
        />
        <button className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold" onClick={handleImport}>ثبت در لیست</button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white p-6 rounded-3xl shadow-sm border">
          <h3 className="font-bold mb-4 flex items-center gap-2"><ClipboardList size={18} /> لیست گزارشات</h3>
          <div className="space-y-2">
            {importedData.map((d, i) => (
              <div key={i} className="p-2 bg-slate-50 rounded-lg text-xs font-bold">{d.n} ({d.d})</div>
            ))}
          </div>
          {importedData.length > 0 && (
            <button className="w-full mt-4 bg-emerald-600 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2" onClick={handleAI}>
              {loading ? <Loader2 className="animate-spin" /> : <Zap size={18} />} تحلیل هوشمند
            </button>
          )}
        </div>

        <div className="md:col-span-2 bg-white p-6 rounded-3xl shadow-sm border min-h-[300px]">
          <h3 className="font-bold mb-4 border-b pb-2 text-indigo-600">نتیجه تحلیل قانون کار</h3>
          {analysis ? (
            <div className="text-sm leading-loose whitespace-pre-line">{analysis}</div>
          ) : (
            <p className="text-slate-400 italic text-center mt-20">هنوز تحلیلی انجام نشده است.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
