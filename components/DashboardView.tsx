
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesRecord, SalesReportItem, CustomerMasterItem } from '../types';
import { TrendingUp, TrendingDown, Package, ClipboardList, ShoppingCart, Calendar, Filter, PieChart as PieIcon, BarChart3, Users, ArrowRight, Activity, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, UserCircle, Minus, Plus, ChevronDown, ChevronUp, Link2Off, AlertTriangle, Layers, Clock, CheckCircle2, AlertCircle, User, Factory, Tag, ArrowLeft, BarChart4, Hourglass, History } from 'lucide-react';

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

type TimeView = 'FY' | 'MONTH' | 'WEEK';
type ComparisonMode = 'PREV_PERIOD' | 'PREV_YEAR';
type Metric = 'quantity' | 'value';

const COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#6B7280', '#059669', '#2563EB'];

// --- Helpers ---
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

// --- Sub-Components ---

const SalesTrendChart = ({ data, maxVal }: { data: { labels: string[], series: any[] }, maxVal: number }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const idx = Math.round((x / width) * (data.labels.length - 1));
    const clampedIdx = Math.max(0, Math.min(idx, data.labels.length - 1));
    setHoverIndex(clampedIdx);
  };

  return (
    <div 
      className="flex flex-col h-full select-none cursor-crosshair" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <div className="flex-1 relative min-h-0">
         {/* Data Labels - Always Visible for Primary Series */}
         {data.series.length > 0 && data.series[0].data.map((val: number, i: number) => {
             if (val === 0) return null;
             const x = (i / (data.labels.length - 1)) * 100;
             const y = 100 - ((val / maxVal) * 100);
             return (
                 <div 
                    key={i} 
                    className="absolute text-[9px] font-bold text-blue-700 bg-white/80 backdrop-blur-sm px-1 rounded shadow-sm border border-blue-100 z-10 pointer-events-none transform -translate-x-1/2 -translate-y-[140%]"
                    style={{ left: `${x}%`, top: `${y}%`, opacity: hoverIndex !== null && hoverIndex !== i ? 0.3 : 1 }}
                 >
                     {formatLargeValue(val, true)}
                 </div>
             );
         })}

         {hoverIndex !== null && (
            <div 
              className="absolute z-20 bg-gray-900/95 backdrop-blur-md text-white text-[10px] p-3 rounded-xl shadow-2xl border border-gray-700 pointer-events-none transition-all duration-100 ease-out min-w-[140px]"
              style={{ 
                left: `${(hoverIndex / (data.labels.length - 1)) * 100}%`, 
                top: '0',
                transform: `translateX(${hoverIndex > data.labels.length / 2 ? '-110%' : '10%'})`,
              }}
            >
                <div className="font-bold border-b border-gray-600 pb-2 mb-2 text-gray-100 text-center uppercase tracking-wider text-[11px]">{data.labels[hoverIndex]}</div>
                <div className="flex flex-col gap-2">
                    {data.series.map((s: any, i: number) => (
                        <div key={i} className={`flex items-center justify-between gap-4 ${!s.active ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" style={{backgroundColor: s.color}}></div>
                                <span className="text-gray-300 font-medium">{s.name}</span>
                            </div>
                            <span className="font-mono font-bold text-white text-xs">{formatLargeValue(s.data[hoverIndex], true)}</span>
                        </div>
                    ))}
                </div>
            </div>
         )}
         <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              {data.series.map((s: any, i: number) => (
                <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.4" />
                  <stop offset="70%" stopColor={s.color} stopOpacity="0.05" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {data.labels.map((_, i) => (
                <line key={i} x1={(i / (data.labels.length - 1)) * 100} y1="0" x2={(i / (data.labels.length - 1)) * 100} y2="100" stroke="#f3f4f6" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>
            ))}
             {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                <line key={i} x1="0" y1={p * 100} x2="100" y2={p * 100} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4" vectorEffect="non-scaling-stroke"/>
            ))}
            {data.series.map((s: any, i: number) => {
               const points: [number, number][] = s.data.map((val: number, idx: number) => [
                   (idx / (data.labels.length - 1)) * 100,
                   100 - ((val / maxVal) * 100)
               ]);
               const pathD = getSmoothPath(points);
               const areaD = `${pathD} L 100 100 L 0 100 Z`;
               return (
                   <g key={i}>
                       <path d={areaD} fill={`url(#grad-${i})`} className="transition-opacity duration-300" style={{opacity: hoverIndex !== null ? 0.8 : 0.6}} />
                       <path d={pathD} fill="none" stroke={s.color} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" className="drop-shadow-sm transition-all duration-300" style={{ strokeWidth: hoverIndex !== null ? 3.5 : 2.5 }} />
                   </g>
               )
            })}
            {hoverIndex !== null && (
                 <line x1={(hoverIndex / (data.labels.length - 1)) * 100} y1="0" x2={(hoverIndex / (data.labels.length - 1)) * 100} y2="100" stroke="#4b5563" strokeWidth="1.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            )}
            {hoverIndex !== null && data.series.map((s: any, i: number) => {
                const val = s.data[hoverIndex];
                const cx = (hoverIndex / (data.labels.length - 1)) * 100;
                const cy = 100 - ((val / maxVal) * 100);
                return ( <circle key={i} cx={cx} cy={cy} r="5" fill="white" stroke={s.color} strokeWidth="3" vectorEffect="non-scaling-stroke" className="drop-shadow-lg transition-transform duration-100 ease-out" /> );
            })}
         </svg>
      </div>
      <div className="flex justify-between mt-3 text-[9px] text-gray-400 font-medium border-t border-gray-100 pt-2">
          {data.labels.map((l: string, i: number) => (
              <span key={i} className={`flex-1 text-center transition-colors duration-200 ${hoverIndex === i ? 'text-blue-600 font-bold scale-110' : ''}`}>{l}</span>
          ))}
      </div>
    </div>
  );
};

const InventoryToggle: React.FC<{ value: Metric; onChange: (m: Metric) => void; colorClass: string }> = ({ value, onChange, colorClass }) => (
  <div className="flex bg-gray-100 p-0.5 rounded-md border border-gray-200">
    <button onClick={() => onChange('quantity')} className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-all ${value === 'quantity' ? `bg-white shadow-sm ${colorClass}` : 'text-gray-500 hover:text-gray-700'}`}>Qty</button>
    <button onClick={() => onChange('value')} className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-all ${value === 'value' ? `bg-white shadow-sm ${colorClass}` : 'text-gray-500 hover:text-gray-700'}`}>Value</button>
  </div>
);

const InteractiveDrillDownChart = ({ hierarchyData, metric, totalValue }: { hierarchyData: any[], metric: Metric, totalValue: number }) => {
    const [view, setView] = useState<'MAKE' | 'GROUP'>('MAKE');
    const [selectedMake, setSelectedMake] = useState<string | null>(null);
    const [animationKey, setAnimationKey] = useState(0);

    const activeData = useMemo(() => {
        if (view === 'MAKE') {
            return hierarchyData.map(d => ({ label: d.label, value: d.value, color: '#3B82F6', id: d.label }));
        } else if (selectedMake) {
            const makeData = hierarchyData.find(d => d.label === selectedMake);
            return makeData ? makeData.groups.map((g: any, i: number) => ({ label: g.label, value: g.value, color: COLORS[i % COLORS.length], id: g.label })) : [];
        }
        return [];
    }, [view, selectedMake, hierarchyData]);

    const handleBarClick = (id: string) => {
        if (view === 'MAKE') {
            setSelectedMake(id);
            setView('GROUP');
            setAnimationKey(k => k + 1);
        }
    };

    const handleBack = () => {
        setView('MAKE');
        setSelectedMake(null);
        setAnimationKey(k => k + 1);
    };

    if (activeData.length === 0) return <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Data</div>;
    const maxVal = Math.max(...activeData.map((d: any) => d.value), 1);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {view === 'GROUP' && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 animate-in slide-in-from-left-2">
                    <button onClick={handleBack} className="p-1 hover:bg-gray-100 rounded-full text-gray-500"><ArrowLeft className="w-3.5 h-3.5" /></button>
                    <span className="text-xs font-bold text-gray-700">{selectedMake} <span className="font-normal text-gray-400">/ Breakdown</span></span>
                </div>
            )}
            <div key={animationKey} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 animate-in fade-in duration-300">
                {activeData.map((item: any, i: number) => (
                    <div key={i} className={`group flex flex-col gap-1 ${view === 'MAKE' ? 'cursor-pointer' : ''}`} onClick={() => handleBarClick(item.id)}>
                        <div className="flex justify-between items-end text-[10px]">
                            <span className={`font-medium truncate w-3/4 transition-colors ${view === 'MAKE' ? 'text-gray-700 group-hover:text-blue-600' : 'text-gray-600'}`}>{item.label}</span>
                            <div className="flex gap-2">
                                <span className="text-gray-500 font-medium">
                                    {totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) + '%' : '0%'}
                                </span>
                                <span className="font-bold text-gray-900">{metric === 'value' ? formatLargeValue(item.value, true) : item.value.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden relative">
                            <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${(item.value / maxVal) * 100}%`, backgroundColor: item.color }}></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ABCAnalysisChart = ({ data }: { data: { label: string, value: number, count: number, color: string }[] }) => {
    const totalVal = data.reduce((a, b) => a + b.value, 0);
    let startAngle = 0;
    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-center py-2 flex-1">
                <div className="relative w-32 h-32">
                    <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full">
                        {data.map((slice, i) => {
                            const pct = slice.value / (totalVal || 1);
                            const endAngle = startAngle + pct * 2 * Math.PI;
                            const x1 = Math.cos(startAngle);
                            const y1 = Math.sin(startAngle);
                            const x2 = Math.cos(endAngle);
                            const y2 = Math.sin(endAngle);
                            const largeArc = pct > 0.5 ? 1 : 0;
                            const pathData = [`M ${x1} ${y1}`, `A 1 1 0 ${largeArc} 1 ${x2} ${y2}`, `L ${x2 * 0.65} ${y2 * 0.65}`, `A 0.65 0.65 0 ${largeArc} 0 ${x1 * 0.65} ${y1 * 0.65}`, 'Z'].join(' ');
                            startAngle = endAngle;
                            return ( <path key={i} d={pathData} fill={slice.color} stroke="white" strokeWidth="0.02" className="hover:opacity-80 transition-opacity cursor-pointer"><title>{slice.label}: {Math.round(pct * 100)}%</title></path> );
                        })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] text-gray-400 font-bold">Total Val</span>
                        <span className="text-xs font-extrabold text-gray-800">{formatLargeValue(totalVal, true)}</span>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-1 border-t border-gray-100 pt-2">
                {data.map((item, i) => (
                    <div key={i} className="flex flex-col items-center text-center">
                        <span className="text-[9px] font-bold" style={{color: item.color}}>Class {item.label}</span>
                        <span className="text-[9px] font-medium text-gray-600">{item.count} items</span>
                        <span className="text-[9px] font-bold text-gray-800">{formatLargeValue(item.value, true)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ValueDistributionChart = ({ data }: { data: { label: string, value: number }[] }) => {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end justify-between gap-2 h-full pt-4 pb-1">
            {data.map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                    <span className="text-[9px] font-bold text-gray-600 mb-1">{formatLargeValue(bar.value, true)}</span>
                    <div className="w-full bg-indigo-100 rounded-t-sm hover:bg-indigo-300 transition-all relative group" style={{ height: `${(bar.value / maxVal) * 100}%` }}></div>
                    <span className="text-[8px] text-gray-400 font-medium text-center leading-tight">{bar.label}</span>
                </div>
            ))}
        </div>
    );
};

const StackedBarChart = ({ data, title }: { data: { label: string; due: number; scheduled: number; total: number }[]; title: string }) => {
    if (data.length === 0) return <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Data</div>;
    const chartData = [...data].sort((a,b) => b.total - a.total).slice(0, 6);
    const maxVal = Math.max(...chartData.map(d => d.total), 1);
    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase">{title}</h4>
                <div className="flex gap-2 text-[9px]">
                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>Due</span>
                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>Sch</span>
                </div>
            </div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1">
                {chartData.map((item, i) => (
                    <div key={i} className="flex flex-col gap-0.5 group">
                        <div className="flex justify-between text-[9px]">
                            <span className="text-gray-700 font-medium truncate w-1/2" title={item.label}>{item.label}</span>
                            <span className="text-gray-900 font-bold">{formatLargeValue(item.total, true)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden flex">
                            <div className="h-full bg-red-500 transition-all duration-500 relative group/bar" style={{ width: `${(item.due / maxVal) * 100}%` }}><title>Due: {formatLargeValue(item.due)}</title></div>
                            <div className="h-full bg-blue-500 transition-all duration-500 relative group/bar" style={{ width: `${(item.scheduled / maxVal) * 100}%` }}><title>Scheduled: {formatLargeValue(item.scheduled)}</title></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AgingBarChart = ({ data }: { data: { label: string; value: number }[] }) => {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex flex-col h-full">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Hourglass className="w-3 h-3 text-red-500"/> Overdue Aging (Value)</h4>
            <div className="flex items-end justify-between gap-3 h-full pb-1">
                {data.map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                        <span className="text-[9px] font-bold text-gray-600 mb-1">{formatLargeValue(bar.value, true)}</span>
                        <div className={`w-full rounded-t-sm hover:opacity-80 transition-all ${i === 0 ? 'bg-blue-300' : i === 1 ? 'bg-orange-300' : 'bg-red-400'}`} style={{ height: `${(bar.value / maxVal) * 100}%` }}></div>
                        <span className="text-[9px] text-gray-500 font-medium text-center leading-tight whitespace-nowrap">{bar.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const HorizontalBarChart = ({ data, title, color }: { data: { label: string; value: number }[], title: string, color: string }) => {
    const sorted = [...data].sort((a,b) => b.value - a.value).slice(0, 8);
    const maxVal = sorted[0]?.value || 1;
    return (
        <div className="flex flex-col h-full">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">{title}</h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1.5">
                {sorted.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[9px]">
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between mb-0.5">
                                <span className="truncate text-gray-600 font-medium" title={item.label}>{item.label}</span>
                                <span className="font-bold text-gray-800">{formatLargeValue(item.value, true)}</span>
                            </div>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full bg-${color}-500`} style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DeliveryScheduleChart = ({ data }: { data: { label: string; value: number }[] }) => {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex flex-col h-full">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Clock className="w-3 h-3 text-blue-500"/> Delivery Schedule (Future)</h4>
            <div className="flex items-end justify-between gap-2 h-full pb-1">
                {data.map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                        <span className="text-[9px] font-bold text-gray-600 mb-1">{formatLargeValue(bar.value, true)}</span>
                        <div className="w-full rounded-t-sm hover:opacity-80 transition-all bg-indigo-300" style={{ height: `${(bar.value / maxVal) * 100}%` }}></div>
                        <span className="text-[9px] text-gray-500 font-medium text-center leading-tight whitespace-nowrap">{bar.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ... (Rest of the component remains the same, just keeping the updated charts above)

const SimpleDonut = ({ data, title, color }: { data: {label: string, value: number}[], title: string, color: string }) => {
     if(data.length === 0) return <div className="h-32 flex items-center justify-center text-gray-400 text-xs">No Data</div>;
     const total = data.reduce((a,b) => a+b.value, 0);
     let cumPercent = 0;
     let displayData = data;
     if (data.length > 5) {
         const top5 = data.slice(0, 5);
         const otherVal = data.slice(5).reduce((a,b) => a+b.value, 0);
         displayData = [...top5, { label: 'Others', value: otherVal }];
     }
     return (
        <div className="flex flex-col h-full">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">{title}</h4>
            <div className="flex items-center gap-4 flex-1">
                <div className="w-20 h-20 relative flex-shrink-0">
                   <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                      {displayData.map((slice, i) => {
                          const percent = slice.value / total;
                          const startX = Math.cos(2 * Math.PI * cumPercent);
                          const startY = Math.sin(2 * Math.PI * cumPercent);
                          cumPercent += percent;
                          const endX = Math.cos(2 * Math.PI * cumPercent);
                          const endY = Math.sin(2 * Math.PI * cumPercent);
                          const largeArc = percent > 0.5 ? 1 : 0;
                          const sliceColor = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#9CA3AF'][i % 6];
                          return ( <path key={i} d={`M ${startX} ${startY} A 1 1 0 ${largeArc} 1 ${endX} ${endY} L 0 0`} fill={sliceColor} stroke="white" strokeWidth="0.05" /> );
                      })}
                      <circle cx="0" cy="0" r="0.6" fill="white" />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <span className={`text-[8px] font-bold text-${color}-600`}>{formatLargeValue(total, true)}</span>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar h-24 text-[9px]">
                    {displayData.map((d, i) => (
                        <div key={i} className="flex justify-between items-center mb-1">
                             <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#9CA3AF'][i % 6]}}></div>
                                <span className="text-gray-600 truncate" title={d.label}>{d.label}</span>
                             </div>
                             <span className="font-bold text-gray-800 whitespace-nowrap ml-2">{formatLargeValue(d.value, true)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
     );
};

const SimpleBarChart = ({ data, title, color }: { data: {label: string, value: number}[], title: string, color: string }) => {
      if(data.length === 0) return <div className="h-32 flex items-center justify-center text-gray-400 text-xs">No Data</div>;
      const sorted = [...data].sort((a,b) => b.value - a.value).slice(0, 6);
      const maxVal = sorted[0].value || 1;
      return (
          <div className="flex flex-col h-full">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">{title}</h4>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1">
                  {sorted.map((item, i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                          <div className="flex justify-between text-[9px]">
                              <span className="text-gray-700 truncate font-medium">{item.label}</span>
                              <span className="text-gray-900 font-bold">{formatLargeValue(item.value, true)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full bg-${color}-500`} style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
};

const DashboardView: React.FC<DashboardViewProps> = ({
  materials,
  closingStock,
  pendingSO,
  pendingPO,
  salesReportItems = [],
  customers,
  sales1Year,
  sales3Months,
  setActiveTab
}) => {
  // ... (Component logic remains largely the same, just ensuring correct props and state)
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'inventory' | 'so' | 'po'>('sales');
  
  const [timeView, setTimeView] = useState<TimeView>('FY');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('PREV_YEAR');
  const [selectedFY, setSelectedFY] = useState<string>('');
  
  const [invGroupMetric, setInvGroupMetric] = useState<Metric>('value');
  const [invTopMetric, setInvTopMetric] = useState<Metric>('value');
  const [invSelectedMake, setInvSelectedMake] = useState<string>('ALL');
  const [showMakeInTop10, setShowMakeInTop10] = useState<boolean>(false);
  const [abcTab, setAbcTab] = useState<'A' | 'B' | 'C'>('A');
  const [showNonMoving, setShowNonMoving] = useState<boolean>(false);

  const [soFilterMake, setSoFilterMake] = useState<string>('ALL');
  const [soFilterGroup, setSoFilterGroup] = useState<string>('ALL');

  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const m = new Date().getMonth();
    return m >= 3 ? m - 3 : m + 9;
  });
  
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedPendingCustomers, setExpandedPendingCustomers] = useState<Set<string>>(new Set());

  const toggleGroup = (groupName: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(groupName)) newSet.delete(groupName);
    else newSet.add(groupName);
    setExpandedGroups(newSet);
  };

  const togglePendingCustomer = (custName: string) => {
    const newSet = new Set(expandedPendingCustomers);
    if (newSet.has(custName)) newSet.delete(custName);
    else newSet.add(custName);
    setExpandedPendingCustomers(newSet);
  };

  const parseDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date((val - (25567 + 2)) * 86400 * 1000);
    if (typeof val === 'string') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        const parts = val.split(/[-/.]/);
        if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date();
  };

  const getFiscalInfo = (date: Date) => {
    const month = date.getMonth(); 
    const year = date.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    const fiscalYear = `${startYear}-${startYear + 1}`;
    const fiscalMonthIndex = month >= 3 ? month - 3 : month + 9;
    const fyStart = new Date(startYear, 3, 1);
    let fyFirstThu = new Date(fyStart);
    if (fyFirstThu.getDay() <= 4) fyFirstThu.setDate(fyFirstThu.getDate() + (4 - fyFirstThu.getDay()));
    else fyFirstThu.setDate(fyFirstThu.getDate() + (4 - fyFirstThu.getDay() + 7));
    const checkDate = new Date(date); checkDate.setHours(0,0,0,0);
    const baseDate = new Date(fyFirstThu); baseDate.setHours(0,0,0,0);
    const diffTime = checkDate.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weekNumber = diffDays >= 0 ? Math.floor(diffDays / 7) + 2 : 1; 
    return { fiscalYear, fiscalMonthIndex, weekNumber, year, month };
  };

  const getFiscalMonthName = (idx: number) => ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"][idx];

  const enrichedSales = useMemo(() => {
      const custMap = new Map<string, CustomerMasterItem>();
      customers.forEach(c => custMap.set(c.customerName.toLowerCase().trim(), c));
      return salesReportItems.map(item => {
          const dateObj = parseDate(item.date);
          const fi = getFiscalInfo(dateObj);
          const cust = custMap.get(item.customerName.toLowerCase().trim());
          const primaryGroup = cust?.customerGroup?.trim(); 
          const accountGroup = cust?.group?.trim(); 
          return { ...item, ...fi, rawDate: dateObj, custGroup: accountGroup, customerMasterGroup: primaryGroup || 'Unspecified', custStatus: cust?.status || 'Unknown', salesRep: cust?.salesRep || 'Unassigned', derivedGroup: primaryGroup || item.customerName, isGrouped: !!(primaryGroup && primaryGroup !== 'Unassigned') };
      });
  }, [salesReportItems, customers]);

  const uniqueFYs = useMemo(() => {
      const set = new Set(enrichedSales.map(i => i.fiscalYear));
      return Array.from(set).filter(Boolean).sort().reverse();
  }, [enrichedSales]);

  useEffect(() => { if (uniqueFYs.length > 0 && (!selectedFY || !uniqueFYs.includes(selectedFY))) setSelectedFY(uniqueFYs[0]); }, [uniqueFYs, selectedFY]);

  const getDataForPeriod = (fy: string, monthIdx?: number, week?: number) => {
      return enrichedSales.filter(i => {
          if (i.fiscalYear !== fy) return false;
          if (timeView === 'MONTH' && monthIdx !== undefined && i.fiscalMonthIndex !== monthIdx) return false;
          if (timeView === 'WEEK' && week !== undefined && i.weekNumber !== week) return false;
          return true;
      });
  };

  const currentData = useMemo(() => getDataForPeriod(selectedFY, selectedMonth, selectedWeek), [enrichedSales, selectedFY, selectedMonth, selectedWeek, timeView]);
  const previousData = useMemo(() => {
      if (!selectedFY) return [];
      const startYear = parseInt(selectedFY.split('-')[0]);
      if (isNaN(startYear)) return [];
      if (comparisonMode === 'PREV_YEAR') {
          const prevFY = `${startYear - 1}-${startYear}`;
          return getDataForPeriod(prevFY, selectedMonth, selectedWeek);
      } else {
          if (timeView === 'FY') { const prevFY = `${startYear - 1}-${startYear}`; return getDataForPeriod(prevFY); }
          else if (timeView === 'MONTH') { let prevM = selectedMonth - 1; let targetFY = selectedFY; if (prevM < 0) { prevM = 11; targetFY = `${startYear - 1}-${startYear}`; } return getDataForPeriod(targetFY, prevM); }
          else { let prevW = selectedWeek - 1; return getDataForPeriod(selectedFY, selectedMonth, prevW); }
      }
  }, [enrichedSales, selectedFY, selectedMonth, selectedWeek, timeView, comparisonMode]);

  const kpis = useMemo(() => {
      const currVal = currentData.reduce((acc, i) => acc + i.value, 0);
      const prevVal = previousData.reduce((acc, i) => acc + i.value, 0);
      const currQty = currentData.reduce((acc, i) => acc + i.quantity, 0);
      const uniqueCusts = new Set(currentData.map(i => i.customerName)).size;
      const avgOrder = currentData.length ? currVal / currentData.length : 0;
      const diff = currVal - prevVal;
      const pct = prevVal ? ((diff / prevVal) * 100) : 0;
      return { currVal, prevVal, diff, pct, currQty, uniqueCusts, avgOrder };
  }, [currentData, previousData]);

  const lineChartData = useMemo(() => {
      if (timeView === 'FY' && selectedFY) {
          const labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
          const startYear = parseInt(selectedFY.split('-')[0]);
          if(isNaN(startYear)) return { labels: [], series: [], isMultiYear: true };
          const fy1 = selectedFY;
          const fy2 = `${startYear - 1}-${startYear}`;
          const fy3 = `${startYear - 2}-${startYear - 1}`;
          const getSeries = (fy: string) => {
              const arr = new Array(12).fill(0);
              enrichedSales.filter(i => i.fiscalYear === fy).forEach(i => arr[i.fiscalMonthIndex] += i.value);
              return arr;
          };
          return { labels, series: [ { name: fy1, data: getSeries(fy1), color: '#3b82f6', active: true }, { name: fy2, data: getSeries(fy2), color: '#a855f7', active: true }, { name: fy3, data: getSeries(fy3), color: '#9ca3af', active: true } ], isMultiYear: true };
      } else {
          const daysInView = timeView === 'MONTH' ? 31 : 7;
          const labels = Array.from({length: daysInView}, (_, i) => (i + 1).toString());
          const currSeries = new Array(daysInView).fill(0);
          const prevSeries = new Array(daysInView).fill(0);
          currentData.forEach(i => { let idx = 0; if (timeView === 'MONTH') idx = i.rawDate.getDate() - 1; else idx = i.rawDate.getDay(); if (idx >= 0 && idx < daysInView) currSeries[idx] += i.value; });
          previousData.forEach(i => { let idx = 0; if (timeView === 'MONTH') idx = i.rawDate.getDate() - 1; else idx = i.rawDate.getDay(); if (idx >= 0 && idx < daysInView) prevSeries[idx] += i.value; });
          return { labels, series: [ { name: 'Current', data: currSeries, color: '#3b82f6', active: true }, { name: comparisonMode === 'PREV_YEAR' ? 'Last Year' : 'Prev Period', data: prevSeries, color: '#cbd5e1', active: true } ], isMultiYear: false };
      }
  }, [currentData, previousData, timeView, selectedFY, enrichedSales, comparisonMode]);

  const pieDataGroup = useMemo(() => {
      const map = new Map<string, number>();
      currentData.forEach(i => { let key = i.custGroup || 'Unassigned'; const lowerKey = key.toLowerCase().trim(); if (lowerKey === 'group-giridhar-peenya' || lowerKey === 'group-peenya') { key = 'Group-Giridhar'; } else if (lowerKey.includes('online')) { key = 'Online'; } map.set(key, (map.get(key) || 0) + i.value); });
      return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [currentData]);

  const pieDataStatus = useMemo(() => {
    const map = new Map<string, number>();
    currentData.forEach(i => { let key = i.custStatus || 'Unknown'; map.set(key, (map.get(key) || 0) + i.value); });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [currentData]);

  const topCustomers = useMemo(() => {
      const currentMap = new Map<string, { value: number, isGroup: boolean }>();
      currentData.forEach(i => { const key = i.derivedGroup; const existing = currentMap.get(key) || { value: 0, isGroup: false }; existing.value += i.value; if (i.isGrouped) existing.isGroup = true; currentMap.set(key, existing); });
      const prevMap = new Map<string, number>();
      previousData.forEach(i => { const key = i.derivedGroup; prevMap.set(key, (prevMap.get(key) || 0) + i.value); });
      return Array.from(currentMap.entries()).map(([label, { value, isGroup }]) => { const prevValue = prevMap.get(label) || 0; const diff = value - prevValue; const pct = prevValue !== 0 ? (diff / prevValue) * 100 : 0; return { label, value, prevValue, diff, pct, isGroup }; }).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [currentData, previousData]);

  const getGroupBreakdown = (groupName: string) => {
    const breakdownMap = new Map<string, { current: number; prev: number }>();
    currentData.filter(i => i.derivedGroup === groupName).forEach(i => { const existing = breakdownMap.get(i.customerName) || { current: 0, prev: 0 }; existing.current += i.value; breakdownMap.set(i.customerName, existing); });
    previousData.filter(i => i.derivedGroup === groupName).forEach(i => { const existing = breakdownMap.get(i.customerName) || { current: 0, prev: 0 }; existing.prev += i.value; breakdownMap.set(i.customerName, existing); });
    return Array.from(breakdownMap.entries()).map(([name, data]) => { const diff = data.current - data.prev; const pct = data.prev !== 0 ? (diff / data.prev) * 100 : 0; return { name, value: data.current, prevValue: data.prev, pct }; }).sort((a, b) => b.value - a.value);
  };

  const enrichedStock = useMemo(() => {
    const lastSaleMap = new Map<string, number>();
    salesReportItems.forEach(s => {
        const key = s.particulars.toLowerCase().trim();
        const date = parseDate(s.date).getTime();
        const current = lastSaleMap.get(key) || 0;
        if(date > current) lastSaleMap.set(key, date);
    });

    const now = Date.now();
    const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

    return closingStock.map(item => { 
        const itemDesc = item.description.toLowerCase().trim(); 
        const mat = materials.find(m => m.description.toLowerCase().trim() === itemDesc); 
        const lastSaleDate = lastSaleMap.get(itemDesc);
        const daysSinceLastSale = lastSaleDate ? Math.floor((now - lastSaleDate) / (24 * 60 * 60 * 1000)) : 9999;
        const isNonMoving = daysSinceLastSale > 60;

        return { 
            ...item, 
            make: mat ? mat.make : 'Unspecified', 
            group: mat ? mat.materialGroup : 'Unspecified', 
            isLinked: !!mat,
            isNonMoving,
            daysSinceLastSale
        }; 
    });
  }, [closingStock, materials, salesReportItems]);

  const inventoryUniqueMakes = useMemo(() => {
     const makes = new Set(enrichedStock.map(i => i.make));
     const list = Array.from(makes).sort();
     return ['ALL', ...list];
  }, [enrichedStock]);

  const filteredStock = useMemo(() => {
      let data = enrichedStock;
      if (invSelectedMake !== 'ALL') {
          data = data.filter(i => i.make === invSelectedMake);
      }
      if (showNonMoving) {
          data = data.filter(i => i.isNonMoving);
      }
      return data;
  }, [enrichedStock, invSelectedMake, showNonMoving]);

  const inventoryStats = useMemo(() => {
    const data = filteredStock; 
    const totalQty = data.reduce((acc, i) => acc + i.quantity, 0);
    const totalVal = data.reduce((acc, i) => acc + i.value, 0);
    const count = data.length;
    const totalUnmatched = data.filter(i => !i.isLinked).length;
    const hierarchyMap = new Map<string, { qty: number, val: number, groups: Map<string, { qty: number, val: number }> }>();
    const sortedByVal = [...data].sort((a,b) => b.value - a.value);
    const abc = { A: { count: 0, val: 0 }, B: { count: 0, val: 0 }, C: { count: 0, val: 0 } };
    const abcLists = { A: [] as any[], B: [] as any[], C: [] as any[] };
    let cumVal = 0;
    const distMap = { '0-1k': 0, '1k-10k': 0, '10k-50k': 0, '50k+': 0 };

    data.forEach(i => {
        const mKey = i.make; const gKey = i.group;
        if(!hierarchyMap.has(mKey)) hierarchyMap.set(mKey, { qty: 0, val: 0, groups: new Map() });
        const mEntry = hierarchyMap.get(mKey)!; mEntry.qty += i.quantity; mEntry.val += i.value;
        if(!mEntry.groups.has(gKey)) mEntry.groups.set(gKey, { qty: 0, val: 0 });
        const gEntry = mEntry.groups.get(gKey)!; gEntry.qty += i.quantity; gEntry.val += i.value;
        if (i.value <= 1000) distMap['0-1k']++; else if (i.value <= 10000) distMap['1k-10k']++; else if (i.value <= 50000) distMap['10k-50k']++; else distMap['50k+']++;
    });

    sortedByVal.forEach(i => {
        cumVal += i.value;
        const pct = cumVal / (totalVal || 1);
        if (pct <= 0.70) { 
            abc.A.count++; abc.A.val += i.value; 
            abcLists.A.push(i);
        } else if (pct <= 0.90) { 
            abc.B.count++; abc.B.val += i.value; 
            abcLists.B.push(i);
        } else { 
            abc.C.count++; abc.C.val += i.value; 
            abcLists.C.push(i);
        }
    });

    const hierarchy = Array.from(hierarchyMap.entries()).map(([make, mData]) => {
        const mValue = invGroupMetric === 'value' ? mData.val : mData.qty;
        return { label: make, value: mValue, displayValue: formatLargeValue(mValue, true), groups: Array.from(mData.groups.entries()).map(([group, gData]) => ({ label: group, value: invGroupMetric === 'value' ? gData.val : gData.qty })).sort((a,b) => b.value - a.value) };
    }).sort((a,b) => b.value - a.value);

    const abcData = [ { label: 'A', value: abc.A.val, count: abc.A.count, color: '#10B981' }, { label: 'B', value: abc.B.val, count: abc.B.count, color: '#F59E0B' }, { label: 'C', value: abc.C.val, count: abc.C.count, color: '#EF4444' } ];
    const distData = [ { label: '< 1k', value: distMap['0-1k'] }, { label: '1k-10k', value: distMap['1k-10k'] }, { label: '10k-50k', value: distMap['10k-50k'] }, { label: '> 50k', value: distMap['50k+'] } ];
    const topArticles = [...data].sort((a, b) => { const valA = invTopMetric === 'value' ? a.value : a.quantity; const valB = invTopMetric === 'value' ? b.value : b.quantity; return valB - valA; }).slice(0, 10).map(i => ({ label: i.description, make: i.make, value: invTopMetric === 'value' ? i.value : i.quantity }));
    const formatVal = (val: number, type: Metric) => type === 'value' ? formatLargeValue(val) : Math.round(val).toLocaleString('en-IN');
    return { totalQty, totalVal, count, totalUnmatched, hierarchy, topArticles, abcData, distData, formatVal, abcLists };
  }, [filteredStock, invGroupMetric, invTopMetric]);

  const processedSOData = useMemo(() => {
    const today = new Date();
    const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0); endOfCurrentMonth.setHours(23, 59, 59, 999);
    const matMap = new Map<string, string>(); materials.forEach(m => matMap.set(m.description.toLowerCase().trim(), m.make));
    const custMap = new Map<string, string>(); customers.forEach(c => custMap.set(c.customerName.toLowerCase().trim(), c.customerGroup || 'Unassigned'));
    const groupedItems: Record<string, PendingSOItem[]> = {}; pendingSO.forEach(item => { const key = item.itemName.toLowerCase().trim(); if (!groupedItems[key]) groupedItems[key] = []; groupedItems[key].push(item); });
    const results: any[] = [];
    Object.keys(groupedItems).forEach(key => {
        const groupOrders = groupedItems[key];
        const stockItem = closingStock.find(s => s.description.toLowerCase().trim() === key);
        const totalStock = stockItem ? stockItem.quantity : 0; let runningStock = totalStock;
        groupOrders.sort((a, b) => { const dateA = new Date(a.dueDate || '9999-12-31').getTime(); const dateB = new Date(b.dueDate || '9999-12-31').getTime(); return dateA - dateB; });
        groupOrders.forEach(order => {
            const dueDate = order.dueDate ? new Date(order.dueDate) : new Date('9999-12-31');
            const isFuture = dueDate > endOfCurrentMonth;
            const diffTime = today.getTime() - dueDate.getTime(); const isOverdue = diffTime > 0; const overdueDays = isOverdue ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
            let allocated = 0; let shortage = order.balanceQty;
            if (!isFuture) { const required = order.balanceQty; allocated = Math.min(runningStock, required); shortage = required - allocated; runningStock = Math.max(0, runningStock - allocated); }
            const val = (order.balanceQty || 0) * (order.rate || 0); const allocatedVal = allocated * (order.rate || 0); const shortageVal = shortage * (order.rate || 0);
            results.push({ ...order, make: matMap.get(key) || 'Unspecified', customerGroup: custMap.get(order.partyName.toLowerCase().trim()) || 'Unassigned', isFuture, isOverdue, overdueDays, allocated, shortage, val, allocatedVal, shortageVal });
        });
    });
    return results;
  }, [pendingSO, materials, customers, closingStock]);

  const filteredSOData = useMemo(() => {
      return processedSOData.filter(item => { if (soFilterMake !== 'ALL' && item.make !== soFilterMake) return false; if (soFilterGroup !== 'ALL' && item.customerGroup !== soFilterGroup) return false; return true; });
  }, [processedSOData, soFilterMake, soFilterGroup]);

  const soStats = useMemo(() => {
      const stats = {
          totalOrdered: { qty: 0, val: 0, count: 0 },
          totalBalance: { qty: 0, val: 0 },
          due: { available: { qty: 0, val: 0 }, shortage: { qty: 0, val: 0 }, total: { qty: 0, val: 0 } },
          scheduled: { available: { qty: 0, val: 0 }, shortage: { qty: 0, val: 0 }, total: { qty: 0, val: 0 } },
          byGroup: new Map<string, { due: number, scheduled: number, total: number }>(),
          byMake: new Map<string, { due: number, scheduled: number, total: number }>(),
          byCustomer: new Map<string, { due: number, scheduled: number, total: number, items: any[] }>(),
          aging: { 'Future': 0, '0-30': 0, '30-60': 0, '60-90': 0, '90+': 0 },
          topItems: new Map<string, number>(),
          futureSchedule: new Map<string, { val: number, sortKey: string }>()
      };
      const uniqueOrders = new Set<string>();
      filteredSOData.forEach(item => {
          if (item.orderNo) uniqueOrders.add(item.orderNo);
          stats.totalOrdered.qty += item.orderedQty; stats.totalOrdered.val += (item.orderedQty * (item.rate || 0));
          stats.totalBalance.qty += item.balanceQty; stats.totalBalance.val += item.val;
          const isDue = !item.isFuture;
          if (isDue) {
              stats.due.total.val += item.val; stats.due.total.qty += item.balanceQty;
              if (item.overdueDays <= 30) stats.aging['0-30'] += item.val; else if (item.overdueDays <= 60) stats.aging['30-60'] += item.val; else if (item.overdueDays <= 90) stats.aging['60-90'] += item.val; else stats.aging['90+'] += item.val;
          } else {
              stats.scheduled.total.val += item.val; stats.scheduled.total.qty += item.balanceQty;
              stats.aging['Future'] += item.val;
              if (item.dueDate) {
                  const d = new Date(item.dueDate);
                  const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
                  const sortKey = d.toISOString().slice(0, 7);
                  const existing = stats.futureSchedule.get(label) || { val: 0, sortKey };
                  existing.val += item.val;
                  stats.futureSchedule.set(label, existing);
              }
          }
          const aggregate = (map: Map<string, any>, key: string) => {
              const entry = map.get(key) || { due: 0, scheduled: 0, total: 0, items: [] };
              if (isDue) entry.due += item.val; else entry.scheduled += item.val;
              entry.total += item.val;
              if(map === stats.byCustomer) entry.items.push(item);
              map.set(key, entry);
          };
          aggregate(stats.byGroup, item.customerGroup); aggregate(stats.byMake, item.make); aggregate(stats.byCustomer, item.partyName);
          stats.topItems.set(item.itemName, (stats.topItems.get(item.itemName) || 0) + item.val);
      });
      stats.totalOrdered.count = uniqueOrders.size;
      return stats;
  }, [filteredSOData]);

  const soChartsData = useMemo(() => {
      const formatStacked = (map: Map<string, any>) => Array.from(map.entries()).map(([label, d]) => ({ label, ...d }));
      const topCustomers = Array.from(soStats.byCustomer.entries()).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total).slice(0, 10);
      const agingData = [ { label: 'Future', value: soStats.aging['Future'] }, { label: '0-30 Days', value: soStats.aging['0-30'] }, { label: '30-60 Days', value: soStats.aging['30-60'] }, { label: '60-90 Days', value: soStats.aging['60-90'] }, { label: '>90 Days', value: soStats.aging['90+'] } ];
      const topItems = Array.from(soStats.topItems.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
      const deliverySchedule = Array.from(soStats.futureSchedule.entries()).map(([label, data]) => ({ label, value: data.val, sortKey: data.sortKey })).sort((a,b) => a.sortKey.localeCompare(b.sortKey));
      return { byGroup: formatStacked(soStats.byGroup), byMake: formatStacked(soStats.byMake), topCustomers, agingData, topItems, deliverySchedule };
  }, [soStats]);

  const soSlicerOptions = useMemo(() => {
      const makes = new Set(processedSOData.map(i => i.make));
      const groups = new Set(processedSOData.map(i => i.customerGroup));
      return { makes: ['ALL', ...Array.from(makes).sort()], groups: ['ALL', ...Array.from(groups).sort()] };
  }, [processedSOData]);

  const comparisonLabel = useMemo(() => {
    if (comparisonMode === 'PREV_YEAR') return 'Last Year';
    if (timeView === 'FY') return 'Prev FY';
    if (timeView === 'MONTH') { const prevM = selectedMonth - 1; return prevM < 0 ? 'Mar (Prev FY)' : getFiscalMonthName(prevM); }
    return 'Prev Period';
  }, [comparisonMode, timeView, selectedMonth]);

  const chartMax = useMemo(() => { const allValues = lineChartData.series.flatMap(s => s.data); return Math.max(...allValues, 1000) * 1.1; }, [lineChartData]);
  const formatAxisValue = (val: number) => { if (val >= 10000000) return (val / 10000000).toFixed(1) + 'Cr'; if (val >= 100000) return (val / 100000).toFixed(1) + 'L'; if (val >= 1000) return (val / 1000).toFixed(0) + 'k'; return val.toFixed(0); };
  const formatCurrency = (val: number) => formatLargeValue(val);
  const formatCompactNumber = (val: number) => formatLargeValue(val, true);

  return (
    <div className="h-full w-full flex flex-col bg-gray-50/50 overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between flex-shrink-0 shadow-sm z-10">
          <div className="flex bg-gray-100 p-1 rounded-lg flex-shrink-0">
             {(['sales', 'inventory', 'so', 'po'] as const).map(tab => (
                 <button key={tab} onClick={() => setActiveSubTab(tab)} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeSubTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{tab === 'so' ? 'Pending SO' : tab === 'po' ? 'Pending PO' : tab}</button>
             ))}
          </div>
          {activeSubTab === 'sales' && (
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  <div className="flex bg-gray-100 p-1 rounded-lg">{(['FY', 'MONTH', 'WEEK'] as const).map(v => (<button key={v} onClick={() => setTimeView(v)} className={`px-3 py-1 rounded-md text-xs font-bold ${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>{v}</button>))}</div>
                  <div className="flex items-center gap-1.5"><span className="text-[10px] text-gray-500 font-bold uppercase hidden md:inline">Fiscal Year:</span><select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium outline-none focus:ring-2 focus:ring-blue-500">{uniqueFYs.length > 0 ? (uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)) : <option value="">No Data</option>}</select></div>
                  {(timeView === 'MONTH' || timeView === 'WEEK') && (<select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium outline-none focus:ring-2 focus:ring-blue-500">{[0,1,2,3,4,5,6,7,8,9,10,11].map(m => <option key={m} value={m}>{getFiscalMonthName(m)}</option>)}</select>)}
                  {timeView === 'WEEK' && (<div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md px-2 py-1"><span className="text-[10px] text-gray-500 font-bold uppercase">Week</span><input type="number" min={1} max={53} value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} className="w-10 text-xs outline-none font-bold text-center" /></div>)}
                  <div className="w-px h-6 bg-gray-300 mx-1"></div>
                  <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-gray-400 uppercase hidden md:inline">Compare:</span><div className="flex bg-gray-100 p-1 rounded-lg"><button onClick={() => setComparisonMode('PREV_YEAR')} className={`px-2 py-1 rounded text-[10px] font-bold ${comparisonMode === 'PREV_YEAR' ? 'bg-white text-purple-600 shadow' : 'text-gray-500'}`}>Last Year</button><button onClick={() => setComparisonMode('PREV_PERIOD')} className={`px-2 py-1 rounded text-[10px] font-bold ${comparisonMode === 'PREV_PERIOD' ? 'bg-white text-purple-600 shadow' : 'text-gray-500'}`}>Previous</button></div></div>
              </div>
          )}
          {activeSubTab === 'inventory' && (
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  <div className="flex items-center gap-1.5"><Filter className="w-3.5 h-3.5 text-gray-500" /><span className="text-[10px] text-gray-500 font-bold uppercase hidden md:inline">Filter Make:</span><select value={invSelectedMake} onChange={e => setInvSelectedMake(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]">{inventoryUniqueMakes.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                  <button onClick={() => setShowNonMoving(!showNonMoving)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase border transition-all ${showNonMoving ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}><History className="w-3.5 h-3.5" /> Show Non-Moving (>60 Days)</button>
              </div>
          )}
          {activeSubTab === 'so' && (
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-lg border border-gray-200">
                      <Filter className="w-3.5 h-3.5 text-purple-500 ml-1" />
                      <div className="flex flex-col px-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Make</label><select value={soFilterMake} onChange={e => setSoFilterMake(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-24">{soSlicerOptions.makes.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                      <div className="w-px h-6 bg-gray-300 mx-1"></div>
                      <div className="flex flex-col px-1"><label className="text-[9px] font-bold text-gray-400 uppercase">Cust Group</label><select value={soFilterGroup} onChange={e => setSoFilterGroup(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-28">{soSlicerOptions.groups.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                  </div>
              </div>
          )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        {activeSubTab === 'sales' ? (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current Sales</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatCurrency(kpis.currVal)}</h3></div><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><DollarSign className="w-5 h-5" /></div></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100"><span className={`flex items-center text-xs font-bold ${kpis.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{kpis.diff >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}{Math.abs(kpis.pct).toFixed(1)}%</span></div><span className="text-[10px] text-gray-400 font-medium">{comparisonLabel}: {formatCompactNumber(kpis.prevVal)}</span></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sales Quantity</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{kpis.currQty.toLocaleString()}</h3></div><div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Package className="w-5 h-5" /></div></div><p className="mt-3 text-[10px] text-gray-400">Total units sold in period</p></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Customers</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{kpis.uniqueCusts}</h3></div><div className="bg-teal-50 p-2 rounded-lg text-teal-600"><Users className="w-5 h-5" /></div></div><p className="mt-3 text-[10px] text-gray-400">Unique billed parties</p></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avg Order Value</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatCurrency(kpis.avgOrder)}</h3></div><div className="bg-purple-50 p-2 rounded-lg text-purple-600"><Activity className="w-5 h-5" /></div></div><p className="mt-3 text-[10px] text-gray-400">Revenue per transaction</p></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-96">
                    <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-[350px] overflow-hidden"><div className="flex justify-between items-center mb-4 flex-shrink-0"><h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> Sales Trend Analysis</h3><div className="flex items-center gap-4 text-[10px] flex-wrap">{lineChartData.series.map((s, i) => (<span key={i} className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-full border border-gray-100"><div className="w-2 h-2 rounded-full" style={{backgroundColor: s.color}}></div><span className="text-gray-600 font-medium">{s.name}</span></span>))}</div></div><div className="flex flex-1 min-h-0 pt-2 relative"><div className="flex flex-col justify-between text-[9px] text-gray-400 font-medium pr-3 pb-8 h-full text-right w-12 shrink-0 select-none border-r border-gray-50"><span>{formatAxisValue(chartMax)}</span><span>{formatAxisValue(chartMax * 0.75)}</span><span>{formatAxisValue(chartMax * 0.5)}</span><span>{formatAxisValue(chartMax * 0.25)}</span><span>0</span></div><div className="flex-1 flex flex-col min-w-0 relative pl-4 pb-2"><SalesTrendChart data={lineChartData} maxVal={chartMax} /></div></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-[350px]"><div className="flex justify-between items-center mb-2 flex-shrink-0"><h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><PieIcon className="w-4 h-4 text-purple-600" /> Sales Mix</h3></div><div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0"><div className="flex-1 min-h-0 border-b border-dashed border-gray-200 pb-2"><SimpleDonut data={pieDataGroup} title="Account Group (Consolidated)" color="blue" /></div><div className="flex-1 min-h-0 pt-2"><SimpleDonut data={pieDataStatus} title="By Status" color="green" /></div></div></div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col"><div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Layers className="w-4 h-4 text-gray-600" /> Top Customers / Groups</h3></div><div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="text-[10px] text-gray-500 uppercase border-b border-gray-100"><th className="py-2 pl-2 w-8">#</th><th className="py-2">Name</th><th className="py-2 text-right">Sales</th><th className="py-2 text-right hidden sm:table-cell">Prev</th><th className="py-2 text-right">Growth</th></tr></thead><tbody className="text-xs">{topCustomers.map((item, idx) => (<React.Fragment key={idx}><tr className={`border-b border-gray-50 hover:bg-gray-50 ${expandedGroups.has(item.label) ? 'bg-gray-50' : ''}`}><td className="py-3 pl-2 text-gray-400 font-mono text-[10px]">{idx + 1}</td><td className="py-3"><div className="flex flex-col"><div className="flex items-center gap-2">{item.isGroup && (<button onClick={() => toggleGroup(item.label)} className="p-0.5 hover:bg-gray-200 rounded">{expandedGroups.has(item.label) ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}</button>)}<span className="font-bold text-gray-800">{item.label}</span>{item.isGroup && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-wide">Group</span>}</div><div className="w-full max-w-md h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.value / (topCustomers[0]?.value || 1)) * 100}%` }}></div></div></div></td><td className="py-3 text-right font-bold text-gray-900">{formatLargeValue(item.value)}</td><td className="py-3 text-right text-gray-500 hidden sm:table-cell">{formatLargeValue(item.prevValue)}</td><td className="py-3 text-right"><span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${item.pct >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{item.pct >= 0 ? <Plus className="w-2 h-2 mr-0.5" /> : <Minus className="w-2 h-2 mr-0.5" />}{Math.abs(item.pct).toFixed(1)}%</span></td></tr>{item.isGroup && expandedGroups.has(item.label) && (<tr><td colSpan={5} className="p-0"><div className="bg-gray-50/50 p-3 border-b border-gray-100 animate-in slide-in-from-top-1"><table className="w-full text-xs"><thead><tr className="text-[9px] text-gray-400 uppercase border-b border-gray-100 text-right"><th className="py-1 text-left pl-8">Customer Name</th><th className="py-1">Prev</th><th className="py-1">Current</th><th className="py-1">Growth</th></tr></thead><tbody>{getGroupBreakdown(item.label).map((sub, sIdx) => (<tr key={sIdx} className="border-b border-gray-100 last:border-0 hover:bg-gray-100/50"><td className="py-2 pl-8 text-gray-600 w-1/2 font-medium">{sub.name}</td><td className="py-2 text-right text-gray-400">{formatLargeValue(sub.prevValue)}</td><td className="py-2 text-right font-bold text-gray-800">{formatLargeValue(sub.value)}</td><td className="py-2 text-right"><span className={`text-[10px] font-bold ${sub.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{sub.pct > 0 ? '+' : ''}{Math.round(sub.pct)}%</span></td></tr>))}</tbody></table></div></td></tr>)}</React.Fragment>))}</tbody></table></div></div>
            </div>
        ) : activeSubTab === 'inventory' ? (
             <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-emerald-600 font-bold uppercase">Total Value</p><h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{formatLargeValue(inventoryStats.totalVal)}</h3></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-blue-600 font-bold uppercase">Total Items</p><h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{inventoryStats.count.toLocaleString()}</h3></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-gray-500 font-bold uppercase">Total Qty</p><h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{inventoryStats.totalQty.toLocaleString()}</h3></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex items-center gap-1">{inventoryStats.totalUnmatched > 0 ? <Link2Off className="w-3.5 h-3.5 text-red-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}<p className="text-[10px] text-gray-500 font-bold uppercase">Master Status</p></div><h3 className={`text-xl font-extrabold mt-0.5 ${inventoryStats.totalUnmatched > 0 ? 'text-red-600' : 'text-green-600'}`}>{inventoryStats.totalUnmatched > 0 ? `${inventoryStats.totalUnmatched} Unmatched` : 'All Linked'}</h3></div>
                 </div>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-96">
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col"><div className="flex justify-between items-center mb-2"><h4 className="text-xs font-bold text-gray-700 flex items-center gap-2"><BarChart4 className="w-4 h-4 text-indigo-600"/> ABC Analysis</h4></div><div className="flex-1 min-h-0"><ABCAnalysisChart data={inventoryStats.abcData} /></div><div className="mt-2 text-[9px] text-center text-gray-400">Class A (Top 70%), B (Next 20%), C (Bottom 10%) by Value</div></div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col relative overflow-hidden"><div className="flex justify-between items-center mb-2"><h4 className="text-xs font-bold text-gray-700 flex items-center gap-2"><Layers className="w-4 h-4 text-blue-600"/> Stock Composition {showNonMoving && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded ml-1">Non-Moving Only</span>}</h4><InventoryToggle value={invGroupMetric} onChange={setInvGroupMetric} colorClass="text-blue-700" /></div><InteractiveDrillDownChart hierarchyData={inventoryStats.hierarchy} metric={invGroupMetric} totalValue={inventoryStats.totalVal} /></div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col"><div className="flex justify-between items-center mb-2"><div className="flex items-center gap-2"><h4 className="text-xs font-bold text-gray-700">Top 10 Articles</h4><button onClick={() => setShowMakeInTop10(!showMakeInTop10)} className={`p-1 rounded transition-colors ${showMakeInTop10 ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:bg-gray-100'}`} title="Toggle Make visibility"><Tag className="w-3 h-3" /></button></div><InventoryToggle value={invTopMetric} onChange={setInvTopMetric} colorClass="text-emerald-700" /></div><div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">{inventoryStats.topArticles.map((a, i) => (<div key={i} className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</span><div className="flex-1 min-w-0"><div className="flex items-baseline justify-between"><p className="text-[10px] font-medium text-gray-800 truncate flex-1" title={a.label}>{a.label}</p>{showMakeInTop10 && <span className="text-[9px] text-gray-400 ml-2 italic shrink-0">{a.make}</span>}</div><div className="w-full bg-gray-100 h-1 rounded-full mt-1"><div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(a.value / (inventoryStats.topArticles[0]?.value || 1)) * 100}%` }}></div></div></div><div className="flex flex-col items-end"><span className="text-[10px] font-bold text-gray-900">{inventoryStats.formatVal(a.value, invTopMetric)}</span>{showNonMoving && <span className="text-[9px] text-gray-400">{((a.value / inventoryStats.totalVal) * 100).toFixed(1)}%</span>}</div></div>))}</div></div>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-48"><div className="flex justify-between items-center mb-1"><h4 className="text-xs font-bold text-gray-700">Stock Value Distribution (Item Count)</h4></div><div className="flex-1 min-h-0"><ValueDistributionChart data={inventoryStats.distData} /></div></div>
                 
                 <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2"><BarChart4 className="w-4 h-4 text-indigo-600"/> ABC Classification Details {showNonMoving && "(Non-Moving Only)"}</h3>
                    <div className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded mb-3 border border-gray-100">
                        <strong>Basis: </strong> 
                        <span className="text-emerald-700 font-bold px-1">Class A</span> (Top 70% Value), 
                        <span className="text-yellow-600 font-bold px-1">Class B</span> (Next 20%), 
                        <span className="text-red-600 font-bold px-1">Class C</span> (Bottom 10%). 
                        Items are ranked by descending value.
                    </div>
                    <div className="flex gap-2 mb-2 border-b border-gray-200">
                        {(['A', 'B', 'C'] as const).map(cls => (
                            <button 
                                key={cls}
                                onClick={() => setAbcTab(cls)}
                                className={`px-4 py-1.5 text-xs font-bold border-b-2 transition-colors ${abcTab === cls ? (cls === 'A' ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : cls === 'B' ? 'border-yellow-500 text-yellow-700 bg-yellow-50' : 'border-red-500 text-red-700 bg-red-50') : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                                Class {cls} ({inventoryStats.abcData.find(d => d.label === cls)?.count || 0})
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 overflow-auto max-h-64 custom-scrollbar border border-gray-100 rounded-lg">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 sticky top-0 z-10 text-[10px] text-gray-500 uppercase font-bold">
                                <tr>
                                    <th className="py-2 px-3">Description</th>
                                    <th className="py-2 px-3">Make</th>
                                    <th className="py-2 px-3 text-right">Qty</th>
                                    <th className="py-2 px-3 text-right">Value</th>
                                    {showNonMoving && <th className="py-2 px-3 text-right">Last Billed</th>}
                                </tr>
                            </thead>
                            <tbody className="text-xs divide-y divide-gray-100">
                                {inventoryStats.abcLists[abcTab].map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="py-1.5 px-3 truncate max-w-[200px]" title={item.description}>{item.description}</td>
                                        <td className="py-1.5 px-3 text-gray-500">{item.make}</td>
                                        <td className="py-1.5 px-3 text-right text-gray-600">{item.quantity}</td>
                                        <td className="py-1.5 px-3 text-right font-medium text-gray-900">{formatLargeValue(item.value)}</td>
                                        {showNonMoving && <td className="py-1.5 px-3 text-right text-red-500">{item.daysSinceLastSale > 365 ? '> 1 Year' : item.daysSinceLastSale + ' Days'}</td>}
                                    </tr>
                                ))}
                                {inventoryStats.abcLists[abcTab].length === 0 && (
                                    <tr><td colSpan={showNonMoving ? 5 : 4} className="py-4 text-center text-gray-400 text-xs">No items in this class.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                 </div>
             </div>
        ) : activeSubTab === 'so' ? (
            <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                     <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                         <div className="flex justify-between items-start"><div><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Balance Overview</p><h3 className="text-3xl font-extrabold text-gray-900 mt-1">{formatCurrency(soStats.totalBalance.val)}</h3><p className="text-xs text-gray-400 font-medium">{soStats.totalBalance.qty.toLocaleString()} Units</p></div><div className="bg-purple-50 p-2 rounded-lg text-purple-600"><ClipboardList className="w-6 h-6" /></div></div>
                         <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-3">
                             <div><div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-red-500"></div><p className="text-[10px] font-bold text-gray-500 uppercase">Immediate Due</p></div><p className="text-sm font-bold text-red-600">{formatCurrency(soStats.due.total.val)}</p><p className="text-[10px] text-gray-400 font-medium">Qty: {soStats.due.total.qty.toLocaleString()}</p></div>
                             <div><div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div><p className="text-[10px] font-bold text-gray-500 uppercase">Scheduled</p></div><p className="text-sm font-bold text-blue-600">{formatCurrency(soStats.scheduled.total.val)}</p><p className="text-[10px] text-gray-400 font-medium">Qty: {soStats.scheduled.total.qty.toLocaleString()}</p></div>
                         </div>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-48 lg:h-auto"><AgingBarChart data={soChartsData.agingData} /></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-48 lg:h-auto flex flex-col"><DeliveryScheduleChart data={soChartsData.deliverySchedule} /></div>
                 </div>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-64">
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><StackedBarChart data={soChartsData.byGroup} title="Pending by Group (Due vs Scheduled)" /></div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><StackedBarChart data={soChartsData.byMake} title="Pending by Make (Due vs Scheduled)" /></div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><HorizontalBarChart data={soChartsData.topItems} title="Top 10 Items (Pending Val)" color="purple" /></div>
                 </div>
                 <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-gray-600" /> Top Pending Customers</h3>
                     <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="text-[10px] text-gray-500 uppercase border-b border-gray-100"><th className="py-2 pl-2">Customer Name</th><th className="py-2 text-right">Total Pending</th><th className="py-2 text-right text-red-600">Immediate Due</th><th className="py-2 text-right text-blue-600">Scheduled</th></tr></thead><tbody className="text-xs">{soChartsData.topCustomers.map((cust, idx) => (<React.Fragment key={idx}><tr className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${expandedPendingCustomers.has(cust.name) ? 'bg-gray-50' : ''}`} onClick={() => togglePendingCustomer(cust.name)}><td className="py-3 pl-2 flex items-center gap-2 font-medium text-gray-800">{expandedPendingCustomers.has(cust.name) ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}{cust.name}</td><td className="py-3 text-right font-bold">{formatLargeValue(cust.total)}</td><td className="py-3 text-right text-red-600 font-medium">{formatLargeValue(cust.due)}</td><td className="py-3 text-right text-blue-600 font-medium">{formatLargeValue(cust.scheduled)}</td></tr>{expandedPendingCustomers.has(cust.name) && (<tr><td colSpan={4} className="p-0"><div className="bg-gray-50/50 p-3 border-b border-gray-100 animate-in slide-in-from-top-1"><table className="w-full text-xs"><thead className="text-[9px] text-gray-400 uppercase text-right"><tr><th className="text-left pl-8 pb-1">Item</th><th className="pb-1">Qty</th><th className="pb-1">Value</th><th className="pb-1">Status</th></tr></thead><tbody>{cust.items.slice(0, 5).map((item: any, iIdx: number) => (<tr key={iIdx} className="border-b border-gray-200/50 last:border-0"><td className="py-1.5 pl-8 text-gray-600 w-1/2 truncate" title={item.itemName}>{item.itemName}</td><td className="py-1.5 text-right text-gray-500">{item.balanceQty}</td><td className="py-1.5 text-right text-gray-800 font-medium">{formatLargeValue(item.val)}</td><td className="py-1.5 text-right"><span className={`text-[9px] px-1.5 py-0.5 rounded ${!item.isFuture ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{!item.isFuture ? 'Due' : 'Sch'}</span></td></tr>))}{cust.items.length > 5 && (<tr><td colSpan={4} className="text-center text-[9px] text-gray-400 pt-1 italic">...and {cust.items.length - 5} more items</td></tr>)}</tbody></table></div></td></tr>)}</React.Fragment>))}</tbody></table></div>
                 </div>
            </div>
        ) : (
            <div className="flex flex-col gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center"><ShoppingCart className="w-12 h-12 text-blue-300 mx-auto mb-3" /><h3 className="text-lg font-bold text-blue-900">Purchase Orders Overview</h3><p className="text-sm text-blue-600 mb-6"> {pendingPO.length} Pending Orders</p><div className="flex justify-center gap-8"><div className="text-center"><p className="text-xs uppercase font-bold text-blue-400">Total Ordered</p><p className="text-2xl font-bold text-blue-800">{pendingPO.reduce((acc, i) => acc + (i.orderedQty || 0), 0).toLocaleString()}</p></div><div className="text-center"><p className="text-xs uppercase font-bold text-blue-400">Pending Qty</p><p className="text-2xl font-bold text-blue-800">{pendingPO.reduce((acc, i) => acc + (i.balanceQty || 0), 0).toLocaleString()}</p></div><div className="text-center"><p className="text-xs uppercase font-bold text-blue-400">Pending Value</p><p className="text-2xl font-bold text-blue-800">{formatCurrency(pendingPO.reduce((acc, i) => acc + ((i.balanceQty || 0) * (i.rate || 0)), 0))}</p></div></div></div>
            </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
