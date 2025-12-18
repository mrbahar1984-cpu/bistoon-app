
import React, { useState } from 'react';
import { analyzeAttendance } from '../geminiService';
import { fromBase64 } from '../utils/base64';
import { FileUp, ClipboardList, Zap, Loader2, Download } from 'lucide-react';

const AdminPanel: React.FC = () => {
  const [token, setToken] = useState('');
  const [importedData, setImportedData] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    try {
      const decodedStr = fromBase64(token.trim());
      const decoded = JSON.parse(decodedStr);
      setImportedData(prev => [...prev, decoded]);
      setToken('');
      alert(`گزارش ${decoded.n} با موفقیت اضافه شد.`);
    } catch (e) {
      console.error('Import error:', e);
      alert('توکن نامعتبر است یا به درستی کپی نشده است!');
    }
  };

  const handleAIAnalyze = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (importedData.length === 0) return;
    setLoading(true);
    const result = await analyzeAttendance(JSON.stringify(importedData));
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-indigo-600 text-white p-8 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold mb-2">پنل مدیریت و تحلیل کارکرد</h2>
        <p className="text-indigo-100 opacity-80">دریافت گزارشات روزانه از کارمندان بدون نیاز به سرور</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4 text-slate-700 font-bold">
            <FileUp size={20} />
            <h3>وارد کردن گزارش جدید</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">توکن دریافتی از کارمند را در فیلد زیر جایگذاری کنید:</p>
          <form onSubmit={handleImport}>
            <textarea 
              className="w-full h-32 p-4 border border-slate-200 rounded-xl mb-4 text-xs font-mono bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="توکن را اینجا Paste کنید..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button 
              type="submit"
              disabled={!token.trim()}
              className="w-full bg-slate-900 text-white p-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all"
            >
              تایید و ثبت در لیست
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4 text-slate-700 font-bold">
            <ClipboardList size={20} />
            <h3>لیست گزارشات دریافتی</h3>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {importedData.map((data, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="font-bold text-slate-800">{data.n}</p>
                  <p className="text-xs text-slate-500">تاریخ: {data.d} | تعداد تردد: {data.l?.length || 0}</p>
                </div>
                <div className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md text-[10px] font-bold">دریافت شده</div>
              </div>
            ))}
            {importedData.length === 0 && (
              <p className="text-center text-slate-400 py-10 italic">هنوز گزارشی وارد نشده است.</p>
            )}
          </div>
          {importedData.length > 0 && (
            <button 
              onClick={handleAIAnalyze}
              className="w-full mt-4 bg-indigo-600 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700"
              disabled={loading}
              type="button"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Zap size={18} />}
              تحلیل هوشمند (Gemini)
            </button>
          )}
        </div>
      </div>

      {analysis && (
        <div className="bg-white p-8 rounded-2xl shadow-md border border-indigo-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <Zap className="text-amber-500 fill-amber-500" />
            <h3 className="text-xl font-bold text-slate-800">گزارش تحلیلی هوش مصنوعی</h3>
          </div>
          <div className="prose prose-slate max-w-none text-right leading-relaxed whitespace-pre-line text-slate-700">
            {analysis}
          </div>
          <div className="mt-8 flex gap-3">
             <button 
               onClick={(e) => { e.preventDefault(); window.print(); }}
               className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
               type="button"
             >
               <Download size={18} />
               نسخه چاپی (PDF)
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
