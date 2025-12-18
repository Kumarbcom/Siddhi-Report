import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem, SalesRecord } from '../types';
import { TrendingUp, TrendingDown, Package, ClipboardList, ShoppingCart, Calendar, Filter, PieChart as PieIcon, BarChart3, Users, ArrowRight, Activity, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, UserCircle, Minus, Plus, ChevronDown, ChevronUp, Link2Off, AlertTriangle, Layers, Clock, CheckCircle2, AlertCircle, User, Factory, Tag, ArrowLeft, BarChart4, Hourglass, History, AlertOctagon, Hash, ExternalLink } from 'lucide-react';

const COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#6B7280', '#059669', '#2563EB'];

const formatLargeValue = (val: number, compact: boolean = false) => {
    if (val === 0) return '0';
    const absVal = Math.abs(val);
    const prefix = compact ? '' : 'Rs. ';
    if (absVal >= 10000000) return `${prefix}${(val / 10000000).toFixed(2)} Cr`;
    if (absVal >= 100000) return `${prefix}${(val / 100000).toFixed(2)} L`;
    return `${prefix}${Math.round(val).toLocaleString('en-IN')}`;
};

const getSmoothPath = (points: [number, number][]) => {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[0];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
};

const SalesTrendChart = ({ data, maxVal }: { data: { labels: string[], series: any[] }, maxVal: number }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x / rect.width) * (data.labels.length - 1));
    setHoverIndex(Math.max(0, Math.min(idx, data.labels.length - 1)));
  };
  return (
    <div className="flex flex-col h-full select-none cursor-crosshair" ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIndex(null)}>
      <div className="flex-1 relative min-h-0">
         {data.series.map((s: any, sIdx: number) => s.active && s.data.map((val: number, i: number) => {
             if (val === 0) return null;
             const x = (i / (data.labels.length - 1)) * 100;
             const y = 100 - ((val / maxVal) * 100);
             const yOffset = sIdx * 12;
             const isHovered = hoverIndex === i;
             return (<div key={`${sIdx}-${i}`} className={`absolute text-[8px] font-bold bg-white/80 backdrop-blur-[1px] px-1 rounded shadow-sm border border-gray-100 z-10 pointer-events-none transform -translate-x-1/2 transition-all duration-200 ${isHovered ? 'scale-125 z-20 border-blue-200' : 'opacity-80'}`} style={{ left: `${x}%`, top: `calc(${y}% - ${15 + yOffset}px)`, color: s.color, opacity: hoverIndex !== null && hoverIndex !== i ? 0.2 : 1 }}>{formatLargeValue(val, true)}</div>);
         }))}
         {hoverIndex !== null && (
            <div className="absolute z-20 bg-gray-900/95 backdrop-blur-md text-white text-[10px] p-3 rounded-xl shadow-2xl border border-gray-700 pointer-events-none transition-all duration-100 ease-out min-w-[140px]" style={{ left: `${(hoverIndex / (data.labels.length - 1)) * 100}%`, top: '0', transform: `translateX(${hoverIndex > data.labels.length / 2 ? '-110%' : '10%'})` }}>
                <div className="font-bold border-b border-gray-600 pb-2 mb-2 text-gray-100 text-center uppercase tracking-wider text-[11px]">{data.labels[hoverIndex]}</div>
                <div className="flex flex-col gap-2">{data.series.map((s: any, i: number) => (
                    <div key={i} className={`flex items-center justify-between gap-4 ${!s.active ? 'opacity-50' : ''}`}><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" style={{backgroundColor: s.color}}></div><span className="text-gray-300 font-medium">{s.name}</span></div><span className="font-mono font-bold text-white text-xs">{formatLargeValue(s.data[hoverIndex], true)}</span></div>
                ))}</div>
            </div>
         )}
         <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              {data.series.map((s: any, i: number) => (<linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity="0.4" /><stop offset="70%" stopColor={s.color} stopOpacity="0.05" /><stop offset="100%" stopColor={s.color} stopOpacity="0" /></linearGradient>))}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            {data.labels.map((_, i) => (<line key={i} x1={(i / (data.labels.length - 1)) * 100} y1="0" x2={(i / (data.labels.length - 1)) * 100} y2="100" stroke="#f3f4f6" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>))}
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (<line key={i} x1="0" y1={p * 100} x2="100" y2={p * 100} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" vectorEffect="non-scaling-stroke"/>))}
            {data.series.map((s: any, i: number) => {
               if (!s.active) return null;
               const points: [number, number][] = s.data.map((val: number, idx: number) => [(idx / (data.labels.length - 1)) * 100, 100 - ((val / maxVal) * 100)]);
               const pathD = getSmoothPath(points);
               return (<g key={i}><path d={`${pathD} L 100 100 L 0 100 Z`} fill={`url(#grad-${i})`} className="transition-opacity duration-300" style={{opacity: hoverIndex !== null ? 0.8 : 0.6}} /><path d={pathD} fill="none" stroke={s.color} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" className="drop-shadow-sm transition-all duration-300" style={{ strokeWidth: hoverIndex !== null ? 3.5 : 2.5 }} /></g>);
            })}
            {hoverIndex !== null && (<line x1={(hoverIndex / (data.labels.length - 1)) * 100} y1="0" x2={(hoverIndex / (data.labels.length - 1)) * 100} y2="100" stroke="#4b5563" strokeWidth="1.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />)}
            {hoverIndex !== null && data.series.map((s: any, i: number) => {
                if (!s.active) return null;
                const cx = (hoverIndex / (data.labels.length - 1)) * 100;
                const cy = 100 - ((s.data[hoverIndex] / maxVal) * 100);
                return ( <circle key={i} cx={cx} cy={cy} r="5" fill="white" stroke={s.color} strokeWidth="3" vectorEffect="non-scaling-stroke" className="drop-shadow-lg transition-transform duration-100 ease-out" /> );
            })}
         </svg>
      </div>
      <div className="flex justify-between mt-3 text-[9px] text-gray-400 font-medium border-t border-gray-100 pt-2">{data.labels.map((l: string, i: number) => (<span key={i} className={`flex-1 text-center transition-colors duration-200 ${hoverIndex === i ? 'text-blue-600 font-bold scale-110' : ''}`}>{l}</span>))}</div>
    </div>
  );
};

const SimpleDonut = ({ data, title, color }: { data: {label: string, value: number, color?: string}[], title: string, color: string }) => {
     if(data.length === 0) return <div className="h-32 flex items-center justify-center text-gray-400 text-xs">No Data</div>;
     const total = data.reduce((a,b) => a+b.value, 0);
     let cumPercent = 0;
     let displayData = data.length > 5 ? [...data.slice(0, 5), { label: 'Others', value: data.slice(5).reduce((a,b) => a+b.value, 0) }] : data;
     const colorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#9CA3AF'];
     return (
        <div className="flex flex-col h-full"><h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">{title}</h4><div className="flex items-center gap-4 flex-1"><div className="w-20 h-20 relative flex-shrink-0"><svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
            {displayData.map((slice, i) => {
                const percent = slice.value / (total || 1);
                const startX = Math.cos(2 * Math.PI * cumPercent); const startY = Math.sin(2 * Math.PI * cumPercent);
                cumPercent += percent;
                const endX = Math.cos(2 * Math.PI * cumPercent); const endY = Math.sin(2 * Math.PI * cumPercent);
                return ( <path key={i} d={`M ${startX} ${startY} A 1 1 0 ${percent > 0.5 ? 1 : 0} 1 ${endX} ${endY} L 0 0`} fill={slice.color || colorPalette[i % colorPalette.length]} stroke="white" strokeWidth="0.05" /> );
            })}<circle cx="0" cy="0" r="0.6" fill="white" />
        </svg><div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className={`text-[8px] font-bold ${color === 'blue' ? 'text-blue-600' : 'text-green-600'}`}>{formatLargeValue(total, true)}</span></div></div>
        <div className="flex-1 overflow-y-auto custom-scrollbar h-24 text-[9px]">{displayData.map((d, i) => (
            <div key={i} className="flex justify-between items-center mb-1"><div className="flex items-center gap-1.5 truncate flex-1 min-w-0"><div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor: d.color || colorPalette[i % colorPalette.length]}}></div><span className="text-gray-600 truncate" title={d.label}>{d.label}</span></div><span className="font-bold text-gray-800 whitespace-nowrap ml-2">{formatLargeValue(d.value, true)}</span></div>
        ))}</div></div></div>
     );
};

const InteractiveDrillDownChart = ({ hierarchyData, metric, totalValue }: { hierarchyData: any[], metric: Metric, totalValue: number }) => {
    const [view, setView] = useState<'MAKE' | 'GROUP'>('MAKE');
    const [selectedMake, setSelectedMake] = useState<string | null>(null);
    const activeData = useMemo(() => {
        if (view === 'MAKE') return hierarchyData.map(d => ({ label: d.label, value: d.value, color: '#3B82F6', id: d.label }));
        if (selectedMake) { const makeData = hierarchyData.find(d => d.label === selectedMake); return makeData ? makeData.groups.map((g: any, i: number) => ({ label: g.label, value: g.value, color: COLORS[i % COLORS.length], id: g.label })) : []; }
        return [];
    }, [view, selectedMake, hierarchyData]);
    const handleBarClick = (id: string) => { if (view === 'MAKE') { setSelectedMake(id); setView('GROUP'); } };
    const handleBack = () => { setView('MAKE'); setSelectedMake(null); };
    if (activeData.length === 0) return <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Data</div>;
    const maxVal = Math.max(...activeData.map((d: any) => d.value), 1);
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {view === 'GROUP' && (<div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100"><button onClick={handleBack} className="p-1 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft className="w-3.5 h-3.5" /></button><span className="text-xs font-bold text-gray-700">{selectedMake} breakdown</span></div>)}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">{activeData.map((item: any, i: number) => (
                <div key={i} className={`group flex flex-col gap-1 ${view === 'MAKE' ? 'cursor-pointer' : ''}`} onClick={() => handleBarClick(item.id)}>
                    <div className="flex justify-between items-end text-[10px]"><span className={`font-medium truncate w-3/4 ${view === 'MAKE' ? 'text-gray-700 group-hover:text-blue-600' : 'text-gray-600'}`}>{item.label}</span><div className="flex gap-2"><span className="text-gray-500 font-medium">{totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) + '%' : '0%'}</span><span className="font-bold text-gray-900">{metric === 'value' ? formatLargeValue(item.value, true) : item.value.toLocaleString()}</span></div></div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(item.value / maxVal) * 100}%`, backgroundColor: item.color }}></div></div>
                </div>
            ))}</div>
        </div>
    );
};

const ABCAnalysisChart = ({ data }: { data: { label: string, value: number, count: number, color: string }[] }) => {
    const totalVal = data.reduce((a, b) => a + b.value, 0);
    let startAngle = 0;
    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-center py-2 flex-1"><div className="relative w-32 h-32"><svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full">
                {data.map((slice, i) => {
                    const pct = slice.value / (totalVal || 1);
                    const endAngle = startAngle + pct * 2 * Math.PI;
                    const x1 = Math.cos(startAngle); const y1 = Math.sin(startAngle);
                    const x2 = Math.cos(endAngle); const y2 = Math.sin(endAngle);
                    const largeArc = pct > 0.5 ? 1 : 0;
                    const pathData = [`M ${x1} ${y1}`, `A 1 1 0 ${largeArc} 1 ${x2} ${y2}`, `L ${x2 * 0.65} ${y2 * 0.65}`, `A 0.65 0.65 0 ${largeArc} 0 ${x1 * 0.65} ${y1 * 0.65}`, 'Z'].join(' ');
                    startAngle = endAngle;
                    return ( <path key={i} d={pathData} fill={slice.color} stroke="white" strokeWidth="0.02" className="hover:opacity-80 transition-opacity cursor-pointer"><title>{slice.label}: {Math.round(pct * 100)}%</title></path> );
                })}
            </svg><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-[10px] text-gray-400 font-bold">Stock Val</span><span className="text-xs font-extrabold text-gray-800">{formatLargeValue(totalVal, true)}</span></div></div></div>
            <div className="grid grid-cols-3 gap-1 border-t border-gray-100 pt-2">{data.map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center"><span className="text-[9px] font-bold" style={{color: item.color}}>Class {item.label}</span><span className="text-[9px] font-medium text-gray-600">{item.count} items</span></div>
            ))}</div>
        </div>
    );
};

type TimeView = 'FY' | 'MONTH' | 'WEEK';
type ComparisonMode = 'PREV_PERIOD' | 'PREV_YEAR';
type Metric = 'quantity' | 'value';

interface DashboardViewProps {
  materials: Material[];
  closingStock: ClosingStockItem[];
  pendingSO: PendingSOItem[];
  pendingPO: PendingPOItem[];
  salesReportItems: SalesReportItem[];
  customers: CustomerMasterItem[];
  sales1Year: SalesRecord[];
  sales3Months: SalesRecord[];
  setActiveTab: (tab: any) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  materials,
  closingStock,
  pendingSO,
  pendingPO,
  salesReportItems = [],
  customers,
  setActiveTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'inventory' | 'so' | 'po'>('sales');
  const [timeView, setTimeView] = useState<TimeView>('FY');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('PREV_YEAR');
  const [selectedFY, setSelectedFY] = useState<string>('');
  const [invGroupMetric, setInvGroupMetric] = useState<Metric>('value');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const m = new Date().getMonth();
    return m >= 3 ? m - 3 : m + 9;
  });
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // FIXED: ROBUST DATE PARSER FOR DASHBOARD
  const parseDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) {
        return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 12, 0, 0);
    }
    if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    }
    if (typeof val === 'string') {
        const parts = val.split(/[-/.]/);
        if (parts.length === 3) {
            let y, m, d;
            if (parts[0].length === 4) [y, m, d] = parts.map(Number);
            else if (parts[2].length === 4) [d, m, y] = parts.map(Number);
            if (y && m && d) return new Date(y, m - 1, d, 12, 0, 0);
        }
        const parsed = new Date(val);
        if (!isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
    }
    return new Date();
  };

  const getFiscalInfo = (date: Date) => {
    const month = date.getMonth(); const year = date.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    const fiscalYear = `${startYear}-${startYear + 1}`;
    const fiscalMonthIndex = month >= 3 ? month - 3 : month + 9;
    const fyStart = new Date(startYear, 3, 1);
    let firstThu = new Date(fyStart);
    if (firstThu.getDay() <= 4) firstThu.setDate(firstThu.getDate() + (4 - firstThu.getDay()));
    else firstThu.setDate(firstThu.getDate() + (4 - firstThu.getDay() + 7));
    const diffDays = Math.floor((date.getTime() - firstThu.getTime()) / (1000 * 3600 * 24));
    return { fiscalYear, fiscalMonthIndex, weekNumber: diffDays >= 0 ? Math.floor(diffDays / 7) + 2 : 1 };
  };

  const getFiscalMonthName = (idx: number) => ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"][idx];

  const enrichedSales = useMemo(() => {
      const custMap = new Map<string, CustomerMasterItem>();
      customers.forEach(c => custMap.set(c.customerName.toLowerCase().trim(), c));
      return salesReportItems.map(item => {
          const dateObj = parseDate(item.date);
          const fi = getFiscalInfo(dateObj);
          const cust = custMap.get(item.customerName.toLowerCase().trim());
          return { ...item, ...fi, rawDate: dateObj, custGroup: cust?.group || 'Unassigned', custStatus: cust?.status || 'Unknown' };
      });
  }, [salesReportItems, customers]);

  const uniqueFYs = useMemo(() => Array.from(new Set(enrichedSales.map(i => i.fiscalYear))).filter(Boolean).sort().reverse(), [enrichedSales]);
  useEffect(() => { if (uniqueFYs.length > 0 && (!selectedFY || !uniqueFYs.includes(selectedFY))) setSelectedFY(uniqueFYs[0]); }, [uniqueFYs, selectedFY]);

  const getDataForPeriod = (fy: string, monthIdx?: number, week?: number) => {
      return enrichedSales.filter(i => {
          if (i.fiscalYear !== fy) return false;
          if (timeView === 'MONTH' && monthIdx !== undefined && i.fiscalMonthIndex !== monthIdx) return false;
          if (timeView === 'WEEK' && week !== undefined && i.weekNumber !== week) return false;
          return true;
      });
  };

  const currentData = useMemo(() => getDataForPeriod(selectedFY, selectedMonth, selectedWeek), [selectedFY, selectedMonth, selectedWeek, timeView, enrichedSales]);
  const previousData = useMemo(() => {
      if (!selectedFY) return [];
      const startYear = parseInt(selectedFY.split('-')[0]);
      if (comparisonMode === 'PREV_YEAR') return getDataForPeriod(`${startYear - 1}-${startYear}`, selectedMonth, selectedWeek);
      if (timeView === 'FY') return getDataForPeriod(`${startYear - 1}-${startYear}`);
      if (timeView === 'MONTH') { let m = selectedMonth - 1; let fy = selectedFY; if (m < 0) { m = 11; fy = `${startYear - 1}-${startYear}`; } return getDataForPeriod(fy, m); }
      return getDataForPeriod(selectedFY, selectedMonth, selectedWeek - 1);
  }, [selectedFY, selectedMonth, selectedWeek, timeView, comparisonMode, enrichedSales]);

  const kpis = useMemo(() => {
      const currVal = currentData.reduce((acc, i) => acc + i.value, 0);
      const prevVal = previousData.reduce((acc, i) => acc + i.value, 0);
      const uniqueCusts = new Set(currentData.map(i => i.customerName)).size;
      return { 
          currVal, 
          prevVal, 
          diff: currVal - prevVal, 
          pct: prevVal ? ((currVal - prevVal) / prevVal) * 100 : 0, 
          currQty: currentData.reduce((acc, i) => acc + i.quantity, 0), 
          uniqueCusts, 
          avgOrder: currentData.length ? currVal / currentData.length : 0 
      };
  }, [currentData, previousData]);

  const pieDataGroup = useMemo(() => {
      const map = new Map<string, number>();
      currentData.forEach(i => {
          const val = map.get(i.custGroup) || 0;
          map.set(i.custGroup, val + i.value);
      });
      return Array.from(map.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value);
  }, [currentData]);

  const pieDataStatus = useMemo(() => {
      const map = new Map<string, number>();
      currentData.forEach(i => {
          const val = map.get(i.custStatus) || 0;
          map.set(i.custStatus, val + i.value);
      });
      return Array.from(map.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value);
  }, [currentData]);

  const lineChartData = useMemo(() => {
      if (timeView === 'FY' && selectedFY) {
          const labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
          const startYear = parseInt(selectedFY.split('-')[0]);
          const getSeries = (fy: string) => { const arr = new Array(12).fill(0); enrichedSales.filter(i => i.fiscalYear === fy).forEach(i => arr[i.fiscalMonthIndex] += i.value); return arr; };
          return { labels, series: [ { name: selectedFY, data: getSeries(selectedFY), color: '#3b82f6', active: true }, { name: `${startYear - 1}-${startYear}`, data: getSeries(`${startYear - 1}-${startYear}`), color: '#a855f7', active: true } ] };
      }
      const days = timeView === 'MONTH' ? 31 : 7;
      const currArr = new Array(days).fill(0); const prevArr = new Array(days).fill(0);
      currentData.forEach(i => { const idx = timeView === 'MONTH' ? i.rawDate.getDate() - 1 : i.rawDate.getDay(); if (idx >= 0 && idx < days) currArr[idx] += i.value; });
      previousData.forEach(i => { const idx = timeView === 'MONTH' ? i.rawDate.getDate() - 1 : i.rawDate.getDay(); if (idx >= 0 && idx < days) prevArr[idx] += i.value; });
      return { labels: Array.from({length: days}, (_, i) => (i + 1).toString()), series: [ { name: 'Current', data: currArr, color: '#3b82f6', active: true }, { name: 'Previous', data: prevArr, color: '#cbd5e1', active: true } ] };
  }, [currentData, previousData, timeView, selectedFY, enrichedSales]);

  const inventoryStats = useMemo(() => {
    const data = closingStock.map(i => { const mat = materials.find(m => m.description.toLowerCase().trim() === i.description.toLowerCase().trim()); return { ...i, make: mat ? mat.make : 'Unspecified', group: mat ? mat.materialGroup : 'Unspecified' }; });
    const totalVal = data.reduce((a, b) => a + b.value, 0);
    const hMap = new Map<string, any>();
    data.forEach(i => { if(!hMap.has(i.make)) hMap.set(i.make, { val: 0, qty: 0, groups: new Map() }); const m = hMap.get(i.make); m.val += i.value; m.qty += i.quantity; if(!m.groups.has(i.group)) m.groups.set(i.group, { val: 0, qty: 0 }); const g = m.groups.get(i.group); g.val += i.value; g.qty += i.quantity; });
    const hierarchy = Array.from(hMap.entries()).map(([label, d]) => ({ label, value: invGroupMetric === 'value' ? d.val : d.qty, groups: Array.from(d.groups.entries()).map(([gl, gd]) => ({ label: gl, value: invGroupMetric === 'value' ? gd.val : gd.qty })).sort((a,b) => b.value - a.value) })).sort((a,b) => b.value - a.value);
    let cVal = 0; const sorted = [...data].sort((a,b) => b.value - a.value); const abc = { A: { c: 0, v: 0 }, B: { c: 0, v: 0 }, C: { c: 0, v: 0 } };
    sorted.forEach(i => { cVal += i.value; const p = cVal / (totalVal || 1); if (p <= 0.7) { abc.A.c++; abc.A.v += i.value; } else if (p <= 0.9) { abc.B.c++; abc.B.v += i.value; } else { abc.C.c++; abc.C.v += i.value; } });
    return { totalVal, count: data.length, hierarchy, abcData: [ { label: 'A', value: abc.A.v, count: abc.A.c, color: '#10B981' }, { label: 'B', value: abc.B.v, count: abc.B.c, color: '#F59E0B' }, { label: 'C', value: abc.C.v, count: abc.C.c, color: '#EF4444' } ] };
  }, [closingStock, materials, invGroupMetric]);

  const chartMax = useMemo(() => Math.max(...lineChartData.series.flatMap(s => s.data), 1000) * 1.1, [lineChartData]);
  const formatAxisValue = (val: number) => { if (val >= 10000000) return (val/10000000).toFixed(1) + 'Cr'; if (val >= 100000) return (val/100000).toFixed(1) + 'L'; if (val >= 1000) return (val/1000).toFixed(0) + 'k'; return Math.round(val).toString(); };

  return (
    <div className="h-full w-full flex flex-col bg-gray-50/50 overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between flex-shrink-0 shadow-sm z-10">
          <div className="flex bg-gray-100 p-1 rounded-lg">{(['sales', 'inventory', 'so', 'po'] as const).map(tab => (<button key={tab} onClick={() => setActiveSubTab(tab)} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase ${activeSubTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>{tab === 'so' ? 'Pending SO' : tab === 'po' ? 'Pending PO' : tab}</button>))}</div>
          {activeSubTab === 'sales' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {(['FY', 'MONTH', 'WEEK'] as const).map(v => (
                  <button 
                    key={v} 
                    onClick={() => setTimeView(v)} 
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium">
                {uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
              </select>
            </div>
          )}
      </div>
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        {activeSubTab === 'sales' ? (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current Sales</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatLargeValue(kpis.currVal)}</h3></div><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><DollarSign className="w-5 h-5" /></div></div><div className="mt-3 flex items-center justify-between"><span className={`text-xs font-bold ${kpis.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{kpis.pct.toFixed(1)}% vs {comparisonMode === 'PREV_YEAR' ? 'LY' : 'Prev'}</span><span className="text-[10px] text-gray-400 font-medium">Prev: {formatLargeValue(kpis.prevVal, true)}</span></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Quantity</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{kpis.currQty.toLocaleString()}</h3></div><div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Package className="w-5 h-5" /></div></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Customers</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{kpis.uniqueCusts}</h3></div><div className="bg-teal-50 p-2 rounded-lg text-teal-600"><Users className="w-5 h-5" /></div></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avg Order</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatLargeValue(kpis.avgOrder)}</h3></div><div className="bg-purple-50 p-2 rounded-lg text-purple-600"><Activity className="w-5 h-5" /></div></div></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-96"><h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> Sales Trend Analysis</h3><div className="flex flex-1 pt-2"><div className="flex flex-col justify-between text-[9px] text-gray-400 pr-3 pb-8 text-right w-12 border-r border-gray-50"><span>{formatAxisValue(chartMax)}</span><span>{formatAxisValue(chartMax*0.5)}</span><span>0</span></div><div className="flex-1 pl-4 pb-2"><SalesTrendChart data={lineChartData} maxVal={chartMax} /></div></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-96"><h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><PieIcon className="w-4 h-4 text-purple-600" /> Sales Mix</h3><div className="flex-1 flex flex-col gap-4 overflow-hidden"><div className="flex-1 pb-2 border-b border-dashed border-gray-200"><SimpleDonut data={pieDataGroup} title="Account Group" color="blue" /></div><div className="flex-1 pt-2"><SimpleDonut data={pieDataStatus} title="By Status" color="green" /></div></div></div>
                </div>
            </div>
        ) : activeSubTab === 'inventory' ? (
             <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-emerald-600 font-bold uppercase">Stock Val</p><h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{formatLargeValue(inventoryStats.totalVal)}</h3></div><div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-blue-600 font-bold uppercase">Items</p><h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{inventoryStats.count}</h3></div></div>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><h4 className="text-xs font-bold text-gray-700 mb-2"><BarChart4 className="w-4 h-4 text-indigo-600 inline mr-1"/> ABC Analysis</h4><ABCAnalysisChart data={inventoryStats.abcData} /></div><div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><h4 className="text-xs font-bold text-gray-700 mb-2"><Layers className="w-4 h-4 text-blue-600 inline mr-1"/> Composition</h4><InteractiveDrillDownChart hierarchyData={inventoryStats.hierarchy} metric={invGroupMetric} totalValue={inventoryStats.totalVal} /></div></div>
             </div>
        ) : null}
      </div>
    </div>
  );
};

export default DashboardView;