import React, { useState, useEffect, useMemo } from 'react';
import { EmployeeData, EmployeeScore, ScoreType } from './types';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { 
  fetchAllScores, 
  recordEmployeeScore, 
  deleteEmployeeScore, 
  POSITIVE_CATEGORIES, 
  NEGATIVE_CATEGORIES,
  getLocalScores,
  SCORES_UPDATED_EVENT,
  parseShamsiYearMonthDay
} from './scoringService';
import { getShamsiDate, getShamsiTime, toEnglishDigits, shamsiMonthNames } from './jalali';
import { 
  Award, ThumbsUp, ThumbsDown, Plus, Trash2, Search, Download, 
  CheckCircle2, AlertTriangle, Star, Trophy, Sparkles, Filter, 
  Calendar, Users, ArrowUpRight, ArrowDownRight, RefreshCcw, FileSpreadsheet, X
} from 'lucide-react';

interface Props {
  employees: EmployeeData[];
  preselectedEmpId?: string;
  onClearPreselectedEmp?: () => void;
}

export const EmployeeScoringManager: React.FC<Props> = ({
  employees,
  preselectedEmpId,
  onClearPreselectedEmp
}) => {
  const [scores, setScores] = useState<EmployeeScore[]>(() => getLocalScores());
  const [subTab, setSubTab] = useState<'RECORD_AND_LIST' | 'LEADERBOARD'>('RECORD_AND_LIST');

  // Form state
  const [selectedEmpId, setSelectedEmpId] = useState<string>(preselectedEmpId || '');
  const [scoreType, setScoreType] = useState<ScoreType>('POSITIVE');
  const [points, setPoints] = useState<number>(10);
  const [category, setCategory] = useState<string>(POSITIVE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState<string>('');
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [scoreDate, setScoreDate] = useState<string>(getShamsiDate());
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter state for table
  const [filterEmpId, setFilterEmpId] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'POSITIVE' | 'NEGATIVE'>('ALL');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>(() => {
    const today = getShamsiDate();
    const parts = today.split('/');
    return parts.length === 3 ? `${parts[0]}/${parts[1]}/01` : '1403/01/01';
  });
  const [filterEndDate, setFilterEndDate] = useState<string>(getShamsiDate());

  // Modal to inspect an employee's detailed score card
  const [inspectEmployee, setInspectEmployee] = useState<EmployeeData | null>(null);

  // Preselected employee sync
  useEffect(() => {
    if (preselectedEmpId) {
      setSelectedEmpId(preselectedEmpId);
    }
  }, [preselectedEmpId]);

  // Load and listen to scores
  useEffect(() => {
    fetchAllScores().then(s => setScores(s));

    const handleUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setScores(e.detail);
      } else {
        setScores(getLocalScores());
      }
    };

    window.addEventListener(SCORES_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(SCORES_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Update default category when scoreType changes
  const handleScoreTypeChange = (type: ScoreType) => {
    setScoreType(type);
    setIsCustomCategory(false);
    setCustomCategory('');
    if (type === 'POSITIVE') {
      setCategory(POSITIVE_CATEGORIES[0]);
      if (points <= 0) setPoints(10);
    } else {
      setCategory(NEGATIVE_CATEGORIES[0]);
      if (points <= 0) setPoints(5);
    }
  };

  // Submit new score
  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      setStatusMessage({ type: 'error', text: 'لطفاً ابتدا یک کارمند را انتخاب کنید.' });
      return;
    }

    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) {
      setStatusMessage({ type: 'error', text: 'کارمند انتخاب شده یافت نشد.' });
      return;
    }

    const finalPoints = Math.max(1, Math.abs(Number(points)) || 1);
    const finalCategory = isCustomCategory && customCategory.trim() ? customCategory.trim() : category;

    if (!finalCategory) {
      setStatusMessage({ type: 'error', text: 'لطفاً موضوع یا دسته‌بندی امتیاز را مشخص کنید.' });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      await recordEmployeeScore({
        employee_id: emp.id,
        employee_name: emp.name,
        national_id: emp.nationalId || emp.national_id,
        type: scoreType,
        points: finalPoints,
        category: finalCategory,
        description: description.trim(),
        shamsi_date: scoreDate || getShamsiDate(),
        time: getShamsiTime(),
        registered_by: 'مدیر سیستم'
      });

      setScores(getLocalScores());
      setDescription('');
      setCustomCategory('');
      setIsCustomCategory(false);
      setStatusMessage({
        type: 'success',
        text: `امتیاز ${scoreType === 'POSITIVE' ? 'مثبت +' : 'منفی -'}${finalPoints} با موفقیت برای «${emp.name}» ثبت شد.`
      });

      if (onClearPreselectedEmp) onClearPreselectedEmp();

      // Clear status message after 5 seconds
      setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'خطا در ثبت امتیاز: ' + (err.message || 'خطای نامشخص') });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete score
  const handleDeleteScore = async (score: EmployeeScore) => {
    const typeLabel = score.type === 'POSITIVE' ? 'مثبت (+)' : 'منفی (-)';
    if (confirm(`آیا از حذف امتیاز ${typeLabel} ${score.points} برای «${score.employee_name || 'کارمند'}» با موضوع «${score.category}» اطمینان دارید؟`)) {
      await deleteEmployeeScore(score.id);
      setScores(getLocalScores());
      setStatusMessage({ type: 'success', text: 'امتیاز با موفقیت حذف گردید.' });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Filtered scores for the table
  const filteredScores = useMemo(() => {
    return scores.filter(s => {
      if (filterEmpId !== 'ALL' && s.employee_id !== filterEmpId) return false;
      if (filterType !== 'ALL' && s.type !== filterType) return false;
      
      const sDate = toEnglishDigits(s.shamsi_date || '');
      if (filterStartDate && sDate && sDate < toEnglishDigits(filterStartDate)) return false;
      if (filterEndDate && sDate && sDate > toEnglishDigits(filterEndDate)) return false;

      if (filterSearch.trim()) {
        const query = filterSearch.trim().toLowerCase();
        const nameMatch = (s.employee_name || '').toLowerCase().includes(query);
        const catMatch = (s.category || '').toLowerCase().includes(query);
        const descMatch = (s.description || '').toLowerCase().includes(query);
        const natMatch = (s.national_id || '').includes(query);
        if (!nameMatch && !catMatch && !descMatch && !natMatch) return false;
      }

      return true;
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [scores, filterEmpId, filterType, filterStartDate, filterEndDate, filterSearch]);

  // Global KPIs
  const kpis = useMemo(() => {
    let totalPositive = 0;
    let totalNegative = 0;
    scores.forEach(s => {
      const p = Math.abs(Number(s.points) || 0);
      if (s.type === 'POSITIVE') totalPositive += p;
      else totalNegative += p;
    });

    const net = totalPositive - totalNegative;

    // Leaderboards
    const empMap: Record<string, { positive: number; negative: number; name: string }> = {};
    scores.forEach(s => {
      if (!empMap[s.employee_id]) {
        empMap[s.employee_id] = { positive: 0, negative: 0, name: s.employee_name || 'کارمند' };
      }
      const p = Math.abs(Number(s.points) || 0);
      if (s.type === 'POSITIVE') empMap[s.employee_id].positive += p;
      else empMap[s.employee_id].negative += p;
    });

    const topEmployeeEntry = Object.values(empMap).reduce<{ name: string; positive: number } | null>(
      (acc, curr) => {
        if (!acc || curr.positive > acc.positive) {
          return { name: curr.name, positive: curr.positive };
        }
        return acc;
      },
      null
    );

    return {
      totalPositive,
      totalNegative,
      net,
      totalCount: scores.length,
      topEmployee: topEmployeeEntry && topEmployeeEntry.positive > 0 ? topEmployeeEntry : null
    };
  }, [scores]);

  // Employee Leaderboard & Summary
  const leaderboard = useMemo(() => {
    return employees.map(emp => {
      const empScores = scores.filter(s => s.employee_id === emp.id);
      let positive = 0;
      let negative = 0;
      empScores.forEach(s => {
        const p = Math.abs(Number(s.points) || 0);
        if (s.type === 'POSITIVE') positive += p;
        else negative += p;
      });
      const net = positive - negative;

      let badge = { text: 'عادی', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      if (net >= 30) {
        badge = { text: 'عملکرد عالی (A+)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      } else if (net >= 15) {
        badge = { text: 'بسیار خوب (A)', color: 'bg-teal-100 text-teal-800 border-teal-300' };
      } else if (net > 0) {
        badge = { text: 'مثبت (B)', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      } else if (net === 0 && empScores.length > 0) {
        badge = { text: 'تراز صفر', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      } else if (net < 0 && net >= -10) {
        badge = { text: 'نیازمند دقت (C)', color: 'bg-orange-100 text-orange-800 border-orange-300' };
      } else if (net < -10) {
        badge = { text: 'نیازمند بهبود (D)', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      }

      return {
        employee: emp,
        empId: emp.id,
        empName: emp.name,
        nationalId: emp.nationalId || emp.national_id || '---',
        positive,
        negative,
        net,
        totalCount: empScores.length,
        badge,
        scores: empScores
      };
    }).sort((a, b) => b.net - a.net);
  }, [employees, scores]);

  // Export to CSV
  const handleExportCSV = () => {
    let csv = "\uFEFF"; // UTF-8 BOM
    csv += "نام کارمند,کد ملی,نوع امتیاز,میزان امتیاز,دسته‌بندی,توضیحات و دلیل,تاریخ شمسی,ساعت ثبت,ثبت‌کننده\n";
    filteredScores.forEach(s => {
      const typeText = s.type === 'POSITIVE' ? 'مثبت (تشویقی)' : 'منفی (تذکر/انضباطی)';
      const pts = `${s.type === 'POSITIVE' ? '+' : '-'}${s.points}`;
      const cat = (s.category || '').replace(/"/g, '""');
      const desc = (s.description || '').replace(/"/g, '""').replace(/\n/g, ' ');
      csv += `"${s.employee_name || 'نامشخص'}","${s.national_id || '---'}",${typeText},${pts},"${cat}","${desc}",${s.shamsi_date},"${s.time || ''}","${s.registered_by || 'مدیر سیستم'}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `employee_scores_${getShamsiDate().replace(/\//g, '-')}.csv`;
    link.click();
  };

  const selectedEmployeeName = useMemo(() => {
    if (!selectedEmpId) return '';
    const found = employees.find(e => e.id === selectedEmpId);
    return found ? found.name : '';
  }, [selectedEmpId, employees]);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* پیام بازخورد عملیات */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-black flex items-center justify-between gap-3 animate-in slide-in-from-top-2 ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600"/> : <AlertTriangle size={18} className="text-rose-600"/>}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="p-1 hover:bg-black/5 rounded-lg">
            <X size={14}/>
          </button>
        </div>
      )}

      {/* سربرگ معرفی بخش */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20 shadow-sm">
              <Award size={26} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                سیستم امتیازدهی و ارزشیابی کارمندان
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5">
                ثبت امتیازات مثبت (تشویقی) و منفی (تذکر/انضباطی) پرسنل و نمایش خودکار در میز کار هر کارمند
              </p>
            </div>
          </div>
        </div>

        {/* دکمه‌های سوئیچ زیرتب‌ها */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl self-start md:self-auto border border-slate-200/60">
          <button
            onClick={() => setSubTab('RECORD_AND_LIST')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
              subTab === 'RECORD_AND_LIST' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus size={15}/> فرم ثبت و تاریخچه امتیازات
          </button>
          <button
            onClick={() => setSubTab('LEADERBOARD')}
            className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
              subTab === 'LEADERBOARD' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy size={15}/> کارنامه و رتبه‌بندی پرسنل
          </button>
        </div>
      </div>

      {/* کارت‌های شاخص کلی امتیازات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ۱. مجموع امتیازات مثبت */}
        <div className="bg-emerald-50/80 border border-emerald-200/90 p-5 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-xs font-black">مجموع امتیازات مثبت (تشویقی)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ThumbsUp size={16} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-emerald-700 font-mono my-1 flex items-baseline gap-1">
            <span>+{kpis.totalPositive}</span>
            <span className="text-xs font-bold text-emerald-600">امتیاز</span>
          </div>
          <span className="text-[11px] font-bold text-emerald-600/90 border-t border-emerald-200/60 pt-2 mt-1">
            ثبت شده برای ارتقای انگیزه و کیفیت کار
          </span>
        </div>

        {/* ۲. مجموع امتیازات منفی */}
        <div className="bg-rose-50/80 border border-rose-200/90 p-5 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-800 mb-2">
            <span className="text-xs font-black">مجموع امتیازات منفی (تذکر)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <ThumbsDown size={16} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-rose-700 font-mono my-1 flex items-baseline gap-1">
            <span>-{kpis.totalNegative}</span>
            <span className="text-xs font-bold text-rose-600">امتیاز</span>
          </div>
          <span className="text-[11px] font-bold text-rose-600/90 border-t border-rose-200/60 pt-2 mt-1">
            موارد تاخیر، غیبت یا سهل‌انگاری
          </span>
        </div>

        {/* ۳. تراز خالص امتیازات */}
        <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-300 mb-2">
            <span className="text-xs font-black">تراز خالص امتیازات سازمانی</span>
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center border border-slate-700">
              <Sparkles size={16} />
            </div>
          </div>
          <div className={`text-2xl md:text-3xl font-black font-mono my-1 flex items-baseline gap-1 ${
            kpis.net > 0 ? 'text-emerald-400' : kpis.net < 0 ? 'text-rose-400' : 'text-slate-300'
          }`}>
            <span>{kpis.net > 0 ? `+${kpis.net}` : kpis.net}</span>
            <span className="text-xs font-bold text-slate-400">امتیاز خالص</span>
          </div>
          <span className="text-[11px] font-bold text-slate-400 border-t border-slate-800 pt-2 mt-1">
            تفاضل امتیازات مثبت از منفی (کل سازمان)
          </span>
        </div>

        {/* ۴. پرسنل پیشرو */}
        <div className="bg-amber-50/80 border border-amber-200/90 p-5 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-900 mb-2">
            <span className="text-xs font-black">بیشترین تشویق ماه</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Trophy size={16} />
            </div>
          </div>
          <div className="my-1">
            <strong className="text-base font-black text-slate-900 block truncate">
              {kpis.topEmployee ? kpis.topEmployee.name : 'هنوز رکوردی نیست'}
            </strong>
            <span className="text-xs font-mono font-black text-amber-700">
              {kpis.topEmployee ? `+${kpis.topEmployee.positive} امتیاز مثبت` : '---'}
            </span>
          </div>
          <span className="text-[11px] font-bold text-amber-700/90 border-t border-amber-200/60 pt-2 mt-1">
            بالاترین امتیاز تشویقی ثبت‌شده
          </span>
        </div>
      </div>

      {/* زیرتب ۱: فرم ثبت امتیاز + جدول تاریخچه امتیازات */}
      {subTab === 'RECORD_AND_LIST' && (
        <div className="space-y-6">
          {/* فرم ثبت امتیاز جدید */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Plus size={20} />
                </div>
                <h3 className="text-base font-black text-slate-800">
                  ثبت امتیاز جدید برای کارمند
                  {selectedEmployeeName && (
                    <span className="text-emerald-600 mr-2 text-sm font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      برای: {selectedEmployeeName}
                    </span>
                  )}
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">
                امتیاز ثبت‌شده بلافاصله در «میز کار» کارمند منعکس می‌گردد
              </span>
            </div>

            <form onSubmit={handleSubmitScore} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* انتخاب کارمند */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Users size={15} className="text-emerald-600"/> انتخاب کارمند: <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedEmpId}
                    onChange={e => setSelectedEmpId(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  >
                    <option value="">-- لطفاً یک کارمند را انتخاب کنید --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.nationalId || e.national_id || 'کد ملی نامشخص'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* نوع امتیاز: سوئیچ مثبت / منفی */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    نوع امتیاز: <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleScoreTypeChange('POSITIVE')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs transition-all ${
                        scoreType === 'POSITIVE'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      <ThumbsUp size={15} />
                      <span>امتیاز مثبت (+)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScoreTypeChange('NEGATIVE')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs transition-all ${
                        scoreType === 'NEGATIVE'
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                          : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                    >
                      <ThumbsDown size={15} />
                      <span>امتیاز منفی (-)</span>
                    </button>
                  </div>
                </div>

                {/* میزان امتیاز (با مقادیر سریع) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 flex items-center justify-between">
                    <span>میزان امتیاز (عدد): <span className="text-rose-500">*</span></span>
                    <span className={`font-mono text-xs font-black ${scoreType === 'POSITIVE' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {scoreType === 'POSITIVE' ? `+${points}` : `-${points}`}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      required
                      min={1}
                      max={500}
                      value={points}
                      onChange={e => setPoints(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-black text-sm text-center outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                    {/* کلیدهای سریع مقدار امتیاز */}
                    <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                      {(scoreType === 'POSITIVE' ? [5, 10, 15, 20, 50] : [3, 5, 10, 15, 20]).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setPoints(val)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-black font-mono border transition-all ${
                            points === val
                              ? scoreType === 'POSITIVE'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {scoreType === 'POSITIVE' ? `+${val}` : `-${val}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* موضوع و دسته‌بندی امتیاز */}
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700">
                      موضوع و دسته‌بندی ارزیابی: <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(!isCustomCategory)}
                      className="text-[11px] font-bold text-emerald-600 hover:underline"
                    >
                      {isCustomCategory ? 'انتخاب از لیست آماده' : 'نوشتن دسته‌بندی دلخواه'}
                    </button>
                  </div>

                  {isCustomCategory ? (
                    <input
                      type="text"
                      placeholder="عنوان دسته‌بندی دلخواه را تایپ کنید..."
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  ) : (
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    >
                      {(scoreType === 'POSITIVE' ? POSITIVE_CATEGORIES : NEGATIVE_CATEGORIES).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* تاریخ ثبت شمسی */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Calendar size={15} className="text-emerald-600"/> تاریخ موثر (شمسی): <span className="text-rose-500">*</span>
                  </label>
                  <ShamsiDatePicker
                    value={scoreDate}
                    onChange={d => setScoreDate(d)}
                    theme="emerald"
                    className="w-full"
                    inputClassName="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold font-mono"
                  />
                </div>
              </div>

              {/* توضیحات تکمیلی و شرح دلیل */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 flex items-center justify-between">
                  <span>توضیحات و شرح دلیل اعطای امتیاز:</span>
                  <span className="text-[11px] font-bold text-slate-400">این توضیح برای کارمند در بخش خلاصه عملکرد ماه جاری قابل مشاهده خواهد بود</span>
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="مثال: به دلیل ارائه راهکار خلاقانه در بهینه‌سازی فرآیند و نظم کامل در گزارش‌دهی هفتگی..."
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              {/* دکمه ثبت امتیاز */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {preselectedEmpId && onClearPreselectedEmp && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmpId('');
                      onClearPreselectedEmp();
                    }}
                    className="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all"
                  >
                    لغو انتخاب کارمند
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-8 py-3.5 rounded-2xl text-white font-black text-xs flex items-center gap-2 shadow-lg transition-all ${
                    scoreType === 'POSITIVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  } disabled:opacity-50`}
                >
                  {submitting ? (
                    <RefreshCcw size={16} className="animate-spin" />
                  ) : scoreType === 'POSITIVE' ? (
                    <ThumbsUp size={16} />
                  ) : (
                    <ThumbsDown size={16} />
                  )}
                  <span>
                    {submitting
                      ? 'در حال ثبت امتیاز...'
                      : scoreType === 'POSITIVE'
                      ? `ثبت امتیاز مثبت (+${points}) برای کارمند`
                      : `ثبت امتیاز منفی (-${points}) برای کارمند`}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* فیلترها و جدول امتیازات ثبت شده */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-4">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-emerald-600" />
                  لیست و تاریخچه کامل امتیازات ثبت‌شده
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-0.5">
                  تعداد کل رکوردهای یافت‌شده: <span className="font-mono font-black text-emerald-600">{filteredScores.length}</span> مورد
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center gap-1.5 transition-all"
                  title="خروجی فایل اکسل"
                >
                  <Download size={14}/> خروجی اکسل (CSV)
                </button>
              </div>
            </div>

            {/* نوار فیلترهای جدول */}
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* فیلتر کارمند */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-600 flex items-center gap-1">
                    <Users size={13} className="text-emerald-600"/> فیلتر کارمند:
                  </label>
                  <select
                    value={filterEmpId}
                    onChange={e => setFilterEmpId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ALL">همه پرسنل (بدون فیلتر)</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>

                {/* فیلتر نوع امتیاز */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-600 flex items-center gap-1">
                    <Filter size={13} className="text-emerald-600"/> نوع امتیاز:
                  </label>
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ALL">همه انواع (مثبت و منفی)</option>
                    <option value="POSITIVE">فقط امتیازات مثبت (+ تشویقی)</option>
                    <option value="NEGATIVE">فقط امتیازات منفی (- تذکر)</option>
                  </select>
                </div>

                {/* فیلتر از تاریخ */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-600">از تاریخ:</label>
                  <ShamsiDatePicker
                    value={filterStartDate}
                    onChange={d => setFilterStartDate(d)}
                    placeholder="1403/01/01"
                    theme="emerald"
                    className="w-full"
                    inputClassName="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold font-mono"
                  />
                </div>

                {/* فیلتر تا تاریخ */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-600">تا تاریخ:</label>
                  <ShamsiDatePicker
                    value={filterEndDate}
                    onChange={d => setFilterEndDate(d)}
                    placeholder="1403/12/29"
                    theme="emerald"
                    className="w-full"
                    inputClassName="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold font-mono"
                  />
                </div>
              </div>

              {/* جستجوی متنی و کلیدهای میانبر تاریخ */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                  <Search size={15} className="text-slate-400" />
                  <input
                    type="text"
                    placeholder="جستجو بر اساس نام کارمند، موضوع یا توضیحات..."
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-bold">میانبرها:</span>
                  <button
                    onClick={() => {
                      const today = getShamsiDate();
                      const parts = today.split('/');
                      const sMonth = parts.length === 3 ? `${parts[0]}/${parts[1]}/01` : today;
                      setFilterStartDate(sMonth);
                      setFilterEndDate(today);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border text-[11px] font-bold"
                  >
                    ماه جاری
                  </button>
                  <button
                    onClick={() => {
                      setFilterStartDate('');
                      setFilterEndDate('');
                      setFilterType('ALL');
                      setFilterEmpId('ALL');
                      setFilterSearch('');
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border text-[11px] font-bold"
                  >
                    نمایش همه
                  </button>
                </div>
              </div>
            </div>

            {/* جدول امتیازات */}
            <div className="rounded-[2rem] border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr className="text-[11px] font-black">
                      <th className="p-4">نام کارمند</th>
                      <th className="p-4 text-center">نوع و مقدار</th>
                      <th className="p-4">موضوع / دسته‌بندی</th>
                      <th className="p-4">توضیحات و شرح دلیل</th>
                      <th className="p-4 text-center">تاریخ و ساعت</th>
                      <th className="p-4 text-center">ثبت‌کننده</th>
                      <th className="p-4 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {filteredScores.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Award size={36} className="text-slate-300" />
                            <p className="font-black text-xs">هیچ امتیازی با فیلترهای انتخابی یافت نشد.</p>
                            <span className="text-[11px]">با استفاده از فرم بالا می‌توانید امتیاز جدید ثبت کنید.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredScores.map(score => {
                        const isPos = score.type === 'POSITIVE';
                        return (
                          <tr key={score.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-4">
                              <strong className="text-slate-900 block text-xs">{score.employee_name || 'کارمند'}</strong>
                              <span className="text-[10px] text-slate-400 font-mono">
                                کد ملی: {score.national_id || '---'}
                              </span>
                            </td>

                            <td className="p-4 text-center">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black font-mono border ${
                                isPos
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {isPos ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                                <span>{isPos ? `+${score.points}` : `-${score.points}`}</span>
                              </span>
                              <span className="block text-[9px] text-slate-400 mt-0.5">
                                {isPos ? 'تشویقی' : 'تذکر/انضباطی'}
                              </span>
                            </td>

                            <td className="p-4">
                              <span className="font-black text-slate-800 block text-xs">{score.category}</span>
                            </td>

                            <td className="p-4 max-w-xs">
                              <p className="text-slate-600 text-xs leading-relaxed line-clamp-2">
                                {score.description || '---'}
                              </p>
                            </td>

                            <td className="p-4 text-center">
                              <span className="font-mono text-xs font-black text-slate-700 block">{score.shamsi_date}</span>
                              <span className="font-mono text-[10px] text-slate-400">{score.time || '--:--'}</span>
                            </td>

                            <td className="p-4 text-center">
                              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {score.registered_by || 'مدیر سیستم'}
                              </span>
                            </td>

                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleDeleteScore(score)}
                                className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all"
                                title="حذف این امتیاز"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* زیرتب ۲: کارنامه و لیدربورد پرسنل */}
      {subTab === 'LEADERBOARD' && (
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-3">
            <div>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Trophy size={20} className="text-amber-500" />
                کارنامه و رتبه‌بندی تجمیعی عملکرد پرسنل
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-0.5">
                محاسبه مجموع امتیازات مثبت، منفی و امتیاز خالص (Net Score) هر کارمند
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr className="text-[11px] font-black">
                    <th className="p-4 text-center w-12">رتبه</th>
                    <th className="p-4">نام و مشخصات کارمند</th>
                    <th className="p-4 text-center">امتیازات مثبت (+)</th>
                    <th className="p-4 text-center">امتیازات منفی (-)</th>
                    <th className="p-4 text-center">امتیاز خالص نهایی</th>
                    <th className="p-4 text-center">سطح ارزیابی</th>
                    <th className="p-4 text-center">تعداد ثبت‌ها</th>
                    <th className="p-4 text-center">اقدام سریع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {leaderboard.map((item, idx) => {
                    const isTop3 = idx < 3;
                    return (
                      <tr key={item.empId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 text-center">
                          <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black font-mono mx-auto ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-sm'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-800 border border-slate-300'
                              : idx === 2
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : 'text-slate-400'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {idx === 0 && <Star size={16} className="text-amber-500 fill-amber-500 shrink-0" />}
                            <div>
                              <strong className="text-slate-900 block text-xs">{item.empName}</strong>
                              <span className="text-[10px] text-slate-400 font-mono">کد ملی: {item.nationalId}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-center">
                          <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            +{item.positive}
                          </span>
                        </td>

                        <td className="p-4 text-center">
                          <span className="font-mono font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                            -{item.negative}
                          </span>
                        </td>

                        <td className="p-4 text-center">
                          <span className={`font-mono font-black text-sm px-3 py-1 rounded-xl border ${
                            item.net > 0
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : item.net < 0
                              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}>
                            {item.net > 0 ? `+${item.net}` : item.net}
                          </span>
                        </td>

                        <td className="p-4 text-center">
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${item.badge.color}`}>
                            {item.badge.text}
                          </span>
                        </td>

                        <td className="p-4 text-center font-mono text-slate-500">
                          {item.totalCount} مورد
                        </td>

                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedEmpId(item.empId);
                                setSubTab('RECORD_AND_LIST');
                              }}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition-all"
                            >
                              + ثبت امتیاز
                            </button>
                            <button
                              onClick={() => setInspectEmployee(item.employee)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                            >
                              ریز سوابق
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* مودال مشاهده ریز سوابق یک کارمند */}
      {inspectEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[85vh] flex flex-col text-right rtl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Award className="text-amber-500" size={20} />
                  ریز سوابق امتیازات «{inspectEmployee.name}»
                </h3>
                <span className="text-[11px] font-bold text-slate-400 font-mono">
                  کد ملی: {inspectEmployee.nationalId || inspectEmployee.national_id || '---'}
                </span>
              </div>
              <button
                onClick={() => setInspectEmployee(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar my-4 space-y-3 pr-1">
              {scores.filter(s => s.employee_id === inspectEmployee.id).length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Award size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-black">هنوز امتیازی برای این کارمند ثبت نشده است.</p>
                </div>
              ) : (
                scores
                  .filter(s => s.employee_id === inspectEmployee.id)
                  .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                  .map(s => {
                    const isPos = s.type === 'POSITIVE';
                    return (
                      <div
                        key={s.id}
                        className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
                          isPos ? 'bg-emerald-50/50 border-emerald-200/80' : 'bg-rose-50/50 border-rose-200/80'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isPos ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {isPos ? <ThumbsUp size={16} /> : <ThumbsDown size={16} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-md ${
                                isPos ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                              }`}>
                                {isPos ? `+${s.points}` : `-${s.points}`}
                              </span>
                              <strong className="text-xs font-black text-slate-800">{s.category}</strong>
                            </div>
                            {s.description && (
                              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                                {s.description}
                              </p>
                            )}
                            <div className="text-[10px] text-slate-400 font-bold mt-2 flex items-center gap-3">
                              <span>تاریخ: <strong className="font-mono text-slate-600">{s.shamsi_date}</strong></span>
                              {s.time && <span>ساعت: <strong className="font-mono text-slate-600">{s.time}</strong></span>}
                              <span>ثبت: {s.registered_by || 'مدیر سیستم'}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteScore(s)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100/60 rounded-lg transition-all shrink-0"
                          title="حذف این امتیاز"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button
                onClick={() => setInspectEmployee(null)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-all"
              >
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
