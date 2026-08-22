import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  X, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { 
  getShamsiDate, 
  shamsiMonthNames, 
  shamsiWeekDays, 
  getDaysInShamsiMonth, 
  getFirstDayOfWeekInShamsiMonth,
  parseShamsiDate,
  formatShamsiDate,
  formatShamsiLong,
  toEnglishDigits
} from './jalali';

export interface ShamsiDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  allowClear?: boolean;
  align?: 'right' | 'left' | 'center';
  minYear?: number;
  maxYear?: number;
  theme?: 'emerald' | 'indigo' | 'slate' | 'blue';
  showLongDateSubtitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ShamsiDatePicker: React.FC<ShamsiDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = '1403/01/01',
  disabled = false,
  required = false,
  className = '',
  inputClassName = '',
  allowClear = true,
  align = 'right',
  minYear = 1390,
  maxYear = 1420,
  theme = 'emerald',
  showLongDateSubtitle = false,
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value or fallback to today
  const todayStr = getShamsiDate();
  const parsedToday = parseShamsiDate(todayStr) || { year: 1403, month: 1, day: 1 };

  const parsedVal = parseShamsiDate(value) || parsedToday;

  const [viewYear, setViewYear] = useState<number>(parsedVal.year);
  const [viewMonth, setViewMonth] = useState<number>(parsedVal.month);

  // Sync view when value changes and picker is opened
  useEffect(() => {
    if (value) {
      const p = parseShamsiDate(value);
      if (p) {
        setViewYear(p.year);
        setViewMonth(p.month);
      }
    }
  }, [value, isOpen]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formatted = formatShamsiDate(viewYear, viewMonth, day);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(todayStr);
    setViewYear(parsedToday.year);
    setViewMonth(parsedToday.month);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  const handleFirstOfMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const formatted = formatShamsiDate(viewYear, viewMonth, 1);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleEndOfMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const totalDays = getDaysInShamsiMonth(viewYear, viewMonth);
    const formatted = formatShamsiDate(viewYear, viewMonth, totalDays);
    onChange(formatted);
    setIsOpen(false);
  };

  // Generate day items for calendar grid
  const daysInMonth = getDaysInShamsiMonth(viewYear, viewMonth);
  const firstDayWeekOffset = getFirstDayOfWeekInShamsiMonth(viewYear, viewMonth); // 0 to 6

  // Years array
  const yearsList: number[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    yearsList.push(y);
  }

  // Theme color styles
  const themeColors = {
    emerald: {
      activeDay: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30',
      todayRing: 'ring-2 ring-emerald-500 text-emerald-700 font-black',
      headerBg: 'bg-emerald-50 text-emerald-950 border-emerald-100',
      iconBtn: 'hover:bg-emerald-100 text-emerald-800',
      focusBorder: 'focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accentBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white'
    },
    indigo: {
      activeDay: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30',
      todayRing: 'ring-2 ring-indigo-500 text-indigo-700 font-black',
      headerBg: 'bg-indigo-50 text-indigo-950 border-indigo-100',
      iconBtn: 'hover:bg-indigo-100 text-indigo-800',
      focusBorder: 'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      accentBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white'
    },
    blue: {
      activeDay: 'bg-blue-600 text-white shadow-md shadow-blue-600/30',
      todayRing: 'ring-2 ring-blue-500 text-blue-700 font-black',
      headerBg: 'bg-blue-50 text-blue-950 border-blue-100',
      iconBtn: 'hover:bg-blue-100 text-blue-800',
      focusBorder: 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      accentBtn: 'bg-blue-600 hover:bg-blue-700 text-white'
    },
    slate: {
      activeDay: 'bg-slate-800 text-white shadow-md shadow-slate-800/30',
      todayRing: 'ring-2 ring-slate-600 text-slate-800 font-black',
      headerBg: 'bg-slate-100 text-slate-900 border-slate-200',
      iconBtn: 'hover:bg-slate-200 text-slate-800',
      focusBorder: 'focus:ring-2 focus:ring-slate-500 focus:border-slate-500',
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      accentBtn: 'bg-slate-800 hover:bg-slate-900 text-white'
    }
  };

  const currentTheme = themeColors[theme] || themeColors.emerald;

  const sizeClasses = {
    sm: 'py-1.5 px-3 text-xs',
    md: 'py-2.5 px-3.5 text-xs',
    lg: 'p-4 text-sm'
  };

  return (
    <div className={`relative inline-block text-right select-none ${className}`} ref={containerRef} dir="rtl">
      {label && (
        <label className="block text-[11px] font-black text-slate-600 mb-1.5 flex items-center justify-between">
          <span>{label}</span>
          {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
      )}

      {/* Input box with clickable trigger */}
      <div 
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`flex items-center justify-between bg-white border border-slate-200 rounded-2xl cursor-pointer shadow-sm hover:border-slate-300 transition-all group ${
          isOpen ? 'ring-2 ring-emerald-500/80 border-emerald-500' : ''
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''} ${inputClassName}`}
      >
        <div className="flex items-center gap-2 px-3 py-2 flex-1 overflow-hidden">
          <CalendarIcon 
            size={16} 
            className={`shrink-0 transition-colors ${
              isOpen ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-600'
            }`} 
          />
          <span className={`font-mono font-bold text-xs truncate ${value ? 'text-slate-800' : 'text-slate-400'}`}>
            {value ? toEnglishDigits(value) : placeholder}
          </span>
        </div>

        {value && allowClear && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            title="پاک کردن تاریخ"
            className="p-1.5 mr-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {showLongDateSubtitle && value && (
        <p className="text-[10px] text-slate-400 font-bold mt-1 px-1 truncate">
          {formatShamsiLong(value)}
        </p>
      )}

      {/* POPUP CALENDAR DROPDOWN */}
      {isOpen && (
        <div 
          className={`absolute top-full mt-2 z-50 bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 w-72 sm:w-80 text-right animate-in fade-in zoom-in-95 duration-150 ${
            align === 'left' ? 'left-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'
          }`}
          style={{ minWidth: '280px' }}
        >
          {/* Header with Month & Year Selectors and Prev/Next buttons */}
          <div className="flex items-center justify-between gap-1 pb-3 mb-3 border-b border-slate-100">
            {/* Previous Month Button (In RTL, prev points right or next in Shamsi) */}
            <button
              type="button"
              onClick={handlePrevMonth}
              title="ماه قبل"
              className={`p-1.5 rounded-xl border border-slate-200 transition-all ${currentTheme.iconBtn}`}
            >
              <ChevronRight size={16} />
            </button>

            {/* Select Month and Year */}
            <div className="flex items-center gap-1.5 flex-1 justify-center">
              <select
                value={viewMonth}
                onChange={e => setViewMonth(parseInt(e.target.value, 10))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-black text-slate-800 outline-none cursor-pointer focus:ring-1 focus:ring-emerald-500 transition-all"
              >
                {shamsiMonthNames.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={e => setViewYear(parseInt(e.target.value, 10))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-xs font-mono font-black text-slate-800 outline-none cursor-pointer focus:ring-1 focus:ring-emerald-500 transition-all"
              >
                {yearsList.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Next Month Button */}
            <button
              type="button"
              onClick={handleNextMonth}
              title="ماه بعد"
              className={`p-1.5 rounded-xl border border-slate-200 transition-all ${currentTheme.iconBtn}`}
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {shamsiWeekDays.map((wd, index) => (
              <div 
                key={index} 
                className={`text-[11px] font-black py-1 ${
                  wd.isWeekend ? 'text-rose-500' : 'text-slate-400'
                }`}
              >
                {wd.short}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots for leading days */}
            {Array.from({ length: firstDayWeekOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8 w-8" />
            ))}

            {/* Day buttons */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = formatShamsiDate(viewYear, viewMonth, dayNum);
              const isSelected = value === dateStr;
              const isToday = todayStr === dateStr;
              const dayOfWeek = (firstDayWeekOffset + i) % 7;
              const isFriday = dayOfWeek === 6;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-8 w-8 mx-auto rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center relative ${
                    isSelected
                      ? `${currentTheme.activeDay}`
                      : isToday
                      ? `bg-emerald-50 text-emerald-700 border border-emerald-300 font-black`
                      : isFriday
                      ? 'text-rose-500 hover:bg-rose-50'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{dayNum}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-600" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Preset Shortcuts Footer */}
          <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-[11px] gap-1">
              <button
                type="button"
                onClick={handleSelectToday}
                className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-black text-center transition-all flex items-center justify-center gap-1 border border-emerald-200"
              >
                <Sparkles size={12} className="text-emerald-600" /> امروز
              </button>

              <button
                type="button"
                onClick={handleFirstOfMonth}
                className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-center transition-all border border-slate-200"
              >
                اول ماه
              </button>

              <button
                type="button"
                onClick={handleEndOfMonth}
                className="py-1.5 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-center transition-all border border-slate-200"
              >
                آخر ماه
              </button>
            </div>

            {/* Selected Date Summary & Close button */}
            <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 font-bold">
              <span>{value ? formatShamsiLong(value) : 'تاریخی انتخاب نشده'}</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-slate-800 font-black px-2 py-0.5"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShamsiDatePicker;
