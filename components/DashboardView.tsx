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
         {data.series.map((s: any, sIdx: number) => 
             s.active && s.data.map((val: number, i: number) => {
                 if (val === 0) return null;
                 const x = (i / (data.labels.length - 1)) * 100;
                 const y = 100 - ((val / maxVal) * 100);
                 const yOffset = sIdx * 12;
                 const isHovered = hoverIndex === i;
                 return (
                     <div 
                        key={`${sIdx}-${i}`} 
                        className={`absolute text-[8px] font-bold bg-white/80 backdrop-blur-[1px] px-1 rounded shadow-sm border border-gray-100 z-10 pointer-events-none transform -translate-x-1/2 transition-all duration-200 ${isHovered ? 'scale-125 z-20 border-blue-200' : 'opacity-80'}`}
                        style={{ 
                            left: `${x}%`, 
                            top: `calc(${y}% - ${15 + yOffset}px)`, 
                            color: s.color,
                            opacity: hoverIndex !== null && hoverIndex !== i ? 0.2 : 1
                        }}
                     >
                         {formatLargeValue(val, true)}
                     </div>
                 );
             })
         )}

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
               if (!s.active) return null;
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
                if (!s.active) return null;
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

const HorizontalBarChart = ({ data, title, color }: { data: { label: string; value: number }[], title: string, color: string }) => {
    const sorted = [...data].sort((a,b) => b.value - a.value).slice(0, 10);
    const maxVal = sorted[0]?.value || 1;
    const barColorClass = color === 'blue' ? 'bg-blue-500' : color === 'red' ? 'bg-red-500' : 'bg-orange-500';
    
    return (
        <div className="flex flex-col h-full w-full">
            <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-3 border-b border-gray-100 pb-1">{title}</h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-1">
                <div className="flex flex-col gap-4">
                    {sorted.map((item, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="truncate text-gray-700 font-medium flex-1 min-w-0 pr-3" title={item.label}>{item.label}</span>
                                <span className="font-bold text-gray-900 flex-shrink-0 bg-white pl-1">{formatLargeValue(item.value, true)}</span>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColorClass}`} style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
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
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
                    <div 
                        key={i} 
                        className="flex flex-col gap-0.5 group cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <div className="flex justify-between items-end text-[9px] h-4">
                            <span className={`font-medium truncate w-1/3 transition-colors ${hoveredIndex === i ? 'text-purple-600' : 'text-gray-700'}`} title={item.label}>{item.label}</span>
                            
                            {hoveredIndex === i ? (
                                <div className="flex gap-2 items-center animate-in fade-in duration-200">
                                    <div className="flex items-center gap-1" title={`Due: ${formatLargeValue(item.due)}`}>
                                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                                        <span className="text-red-700 font-bold">{formatLargeValue(item.due, true)}</span>
                                    </div>
                                    <div className="flex items-center gap-1" title={`Scheduled: ${formatLargeValue(item.scheduled)}`}>
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                        <span className="text-blue-700 font-bold">{formatLargeValue(item.scheduled, true)}</span>
                                    </div>
                                </div>
                            ) : (
                                <span className="text-gray-900 font-bold">{formatLargeValue(item.total, true)}</span>
                            )}
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden flex relative">
                            <div className="h-full bg-red-500 transition-all duration-500 relative group/bar" style={{ width: `${(item.due / maxVal) * 100}%` }}></div>
                            <div className="h-full bg-blue-500 transition-all duration-500 relative group/bar" style={{ width: `${(item.scheduled / maxVal) * 100}%` }}></div>
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

const SimpleDonut = ({ data, title, color }: { data: {label: string, value: number, color?: string}[], title: string, color: string }) => {
     if(data.length === 0) return <div className="h-32 flex items-center justify-center text-gray-400 text-xs">No Data</div>;
     const total = data.reduce((a,b) => a+b.value, 0);
     let cumPercent = 0;
     let displayData = data;
     if (data.length > 5) {
         const top5 = data.slice(0, 5);
         const otherVal = data.slice(5).reduce((a,b) => a+b.value, 0);
         displayData = [...top5, { label: 'Others', value: otherVal }];
     }
     const colorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#9CA3AF'];
     
     return (
        <div className="flex flex-col h-full">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">{title}</h4>
            <div className="flex items-center gap-4 flex-1">
                <div className="w-20 h-20 relative flex-shrink-0">
                   <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                      {displayData.map((slice, i) => {
                          const percent = slice.value / (total || 1);
                          const startX = Math.cos(2 * Math.PI * cumPercent);
                          const startY = Math.sin(2 * Math.PI * cumPercent);
                          cumPercent += percent;
                          const endX = Math.cos(2 * Math.PI * cumPercent);
                          const endY = Math.sin(2 * Math.PI * cumPercent);
                          const largeArc = percent > 0.5 ? 1 : 0;
                          const sliceColor = slice.color || colorPalette[i % colorPalette.length];
                          return ( <path key={i} d={`M ${startX} ${startY} A 1 1 0 ${largeArc} 1 ${endX} ${endY} L 0 0`} fill={sliceColor} stroke="white" strokeWidth="0.05" /> );
                      })}
                      <circle cx="0" cy="0" r="0.6" fill="white" />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <span className={`text-[8px] font-bold ${color === 'blue' ? 'text-blue-600' : 'text-green-600'}`}>{formatLargeValue(total, true)}</span>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar h-24 text-[9px]">
                    {displayData.map((d, i) => (
                        <div key={i} className={`flex justify-between items-center mb-1`}>
                             <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor: d.color || colorPalette[i % colorPalette.length]}}></div>
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
  sales1Year,
  sales3Months,
  setActiveTab
}) => {
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

  // --- Helpers ---
  const parseDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) {
        const d = new Date(val.getTime());
        d.setHours(12, 0, 0, 0);
        return d;
    }
    if (typeof val === 'number') {
        const d = new Date((val - (25567 + 2)) * 86400 * 1000);
        d.setHours(12, 0, 0, 0);
        return d;
    }
    if (typeof val === 'string') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
            d.setHours(12, 0, 0, 0);
            return d;
        }
        const parts = val.split(/[-/.]/);
        if (parts.length === 3) {
            const d2 = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12, 0, 0);
            return d2;
        }
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
    const dayOfWeek = fyFirstThu.getDay();
    if (dayOfWeek <= 4) {
      fyFirstThu.setDate(fyFirstThu.getDate() + (4 - dayOfWeek));
    } else {
      fyFirstThu.setDate(fyFirstThu.getDate() + (4 - dayOfWeek + 7));
    }
    const checkDate = new Date(date); 
    checkDate.setHours(0,0,0,0);
    const baseDate = new Date(fyFirstThu); 
    baseDate.setHours(0,0,0,0);
    const diffTime = checkDate.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weekNumber = diffDays >= 0 ? Math.floor(diffDays / 7) + 2 : 1; 
    return { fiscalYear, fiscalMonthIndex, weekNumber, year, month };
  };

  const getFiscalMonthName = (idx: number) => ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"][idx];

  // --- Data Logic ---
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
      const startYearRaw = selectedFY.split('-')[0];
      const startYear = parseInt(startYearRaw);
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

  const recentVouchers = useMemo(() => {
      const seen = new Set<string>();
      const result: any[] = [];
      const sorted = [...currentData].sort((a,b) => b.rawDate.getTime() - a.rawDate.getTime());
      for (const s of sorted) {
          const vNo = s.voucherNo || 'N/A';
          if (!seen.has(vNo)) { seen.add(vNo); result.push({ voucherNo: vNo, customerName: s.customerName, value: s.value, date: s.date, item: s.particulars }); }
          if (result.length >= 10) break;
      }
      return result;
  }, [currentData]);

  const kpis = useMemo(() => {
      const currVal = currentData.reduce((acc, i) => acc + i.value, 0);
      const prevVal = previousData.reduce((acc, i) => acc + i.value, 0);
      const currQty = currentData.reduce((acc, i) => acc + i.quantity, 0);
      const uniqueCustsSet = new Set<string>();
      const statusBreakdown: Record<string, number> = {};
      currentData.forEach(i => {
          if (!uniqueCustsSet.has(i.customerName)) {
              uniqueCustsSet.add(i.customerName);
              const s = i.custStatus || 'Unknown';
              statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
          }
      });
      const uniqueCusts = uniqueCustsSet.size;
      const avgOrder = currentData.length ? currVal / currentData.length : 0;
      const diff = currVal - prevVal;
      const pct = prevVal ? ((diff / prevVal) * 100) : 0;
      return { currVal, prevVal, diff, pct, currQty, uniqueCusts, avgOrder, statusBreakdown };
  }, [currentData, previousData]);

  const lineChartData = useMemo(() => {
      if (timeView === 'FY' && selectedFY) {
          const labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
          const startYear = parseInt(selectedFY.split('-')[0]);
          if(isNaN(startYear)) return { labels: [], series: [] };
          const fy1 = selectedFY;
          const fy2 = `${startYear - 1}-${startYear}`;
          const fy3 = `${startYear - 2}-${startYear - 1}`;
          const getSeries = (fy: string) => {
              const arr = new Array(12).fill(0);
              enrichedSales.filter(i => i.fiscalYear === fy).forEach(i => arr[i.fiscalMonthIndex] += i.value);
              return arr;
          };
          return { labels, series: [ { name: fy1, data: getSeries(fy1), color: '#3b82f6', active: true }, { name: fy2, data: getSeries(fy2), color: '#a855f7', active: true }, { name: fy3, data: getSeries(fy3), color: '#9ca3af', active: true } ] };
      } else {
          const daysInView = timeView === 'MONTH' ? 31 : 7;
          const labels = Array.from({length: daysInView}, (_, i) => (i + 1).toString());
          const currSeries = new Array(daysInView).fill(0);
          const prevSeries = new Array(daysInView).fill(0);
          currentData.forEach(i => { let idx = 0; if (timeView === 'MONTH') idx = i.rawDate.getDate() - 1; else idx = i.rawDate.getDay(); if (idx >= 0 && idx < daysInView) currSeries[idx] += i.value; });
          previousData.forEach(i => { let idx = 0; if (timeView === 'MONTH') idx = i.rawDate.getDate() - 1; else idx = i.rawDate.getDay(); if (idx >= 0 && idx < daysInView) prevSeries[idx] += i.value; });
          return { labels, series: [ { name: 'Current', data: currSeries, color: '#3b82f6', active: true }, { name: comparisonMode === 'PREV_YEAR' ? 'Last Year' : 'Prev Period', data: prevSeries, color: '#cbd5e1', active: true } ] };
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
      currentData.forEach(i => { 
        const key = i.derivedGroup; 
        const existing = currentMap.get(key) || { value: 0, isGroup: false }; 
        existing.value += i.value; 
        if (i.isGrouped) existing.isGroup = true; 
        currentMap.set(key, existing); 
      });
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

  const inventoryStats = useMemo(() => {
    const data = closingStock.map(i => {
        const mat = materials.find(m => m.description.toLowerCase().trim() === i.description.toLowerCase().trim());
        return { ...i, make: mat ? mat.make : 'Unspecified', group: mat ? mat.materialGroup : 'Unspecified' };
    });
    const totalVal = data.reduce((a, b) => a + b.value, 0);
    const totalQty = data.reduce((a, b) => a + b.quantity, 0);
    
    const hierarchyMap = new Map<string, { qty: number, val: number, groups: Map<string, { qty: number, val: number }> }>();
    data.forEach(i => {
        const mKey = i.make; const gKey = i.group;
        if(!hierarchyMap.has(mKey)) hierarchyMap.set(mKey, { qty: 0, val: 0, groups: new Map() });
        const mEntry = hierarchyMap.get(mKey)!; mEntry.qty += i.quantity; mEntry.val += i.value;
        if(!mEntry.groups.has(gKey)) mEntry.groups.set(gKey, { qty: 0, val: 0 });
        const gEntry = mEntry.groups.get(gKey)!; gEntry.qty += i.quantity; gEntry.val += i.value;
    });

    const hierarchy = Array.from(hierarchyMap.entries()).map(([make, mData]) => ({
        label: make, value: invGroupMetric === 'value' ? mData.val : mData.qty,
        groups: Array.from(mData.groups.entries()).map(([group, gData]) => ({ label: group, value: invGroupMetric === 'value' ? gData.val : gData.qty })).sort((a,b) => b.value - a.value)
    })).sort((a,b) => b.value - a.value);

    const sortedByVal = [...data].sort((a,b) => b.value - a.value);
    const abc = { A: { count: 0, val: 0 }, B: { count: 0, val: 0 }, C: { count: 0, val: 0 } };
    let cumVal = 0;
    sortedByVal.forEach(i => {
        cumVal += i.value;
        const pct = cumVal / (totalVal || 1);
        if (pct <= 0.70) { abc.A.count++; abc.A.val += i.value; } 
        else if (pct <= 0.90) { abc.B.count++; abc.B.val += i.value; } 
        else { abc.C.count++; abc.C.val += i.value; }
    });
    const abcData = [ { label: 'A', value: abc.A.val, count: abc.A.count, color: '#10B981' }, { label: 'B', value: abc.B.val, count: abc.B.count, color: '#F59E0B' }, { label: 'C', value: abc.C.val, count: abc.C.count, color: '#EF4444' } ];

    return { totalVal, totalQty, count: data.length, hierarchy, abcData };
  }, [closingStock, materials, invGroupMetric]);

  const poStats = useMemo(() => {
    const totalVal = pendingPO.reduce((a,b) => a + (b.balanceQty * b.rate), 0);
    const today = new Date();
    const dueVal = pendingPO.reduce((a,b) => {
        const d = b.dueDate ? new Date(b.dueDate) : null;
        return (d && d < today) ? a + (b.balanceQty * b.rate) : a;
    }, 0);
    return { totalVal, count: pendingPO.length, dueVal, scheduledVal: totalVal - dueVal };
  }, [pendingPO]);

  const soStats = useMemo(() => {
      const totalVal = pendingSO.reduce((a,b) => a + (b.balanceQty * b.rate), 0);
      const aging = { 'Future': 0, '0-30': 0, '30-60': 0, '60-90': 0, '90+': 0 };
      const today = new Date();
      pendingSO.forEach(s => {
          const due = s.dueDate ? new Date(s.dueDate) : null;
          const val = s.balanceQty * s.rate;
          if (!due || due > today) aging['Future'] += val;
          else {
              const diff = Math.floor((today.getTime() - due.getTime()) / (24*3600*1000));
              if (diff <= 30) aging['0-30'] += val;
              else if (diff <= 60) aging['30-60'] += val;
              else if (diff <= 90) aging['60-90'] += val;
              else aging['90+'] += val;
          }
      });
      const agingData = Object.entries(aging).map(([label, value]) => ({ label, value }));
      return { totalVal, count: pendingSO.length, agingData };
  }, [pendingSO]);

  // Use explicit typing for chartMax to ensure arithmetic operations are valid.
  const chartMax = useMemo<number>(() => {
    const allValues = lineChartData.series.flatMap(s => (s.data as number[]) || []);
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
    return Number(Math.max(maxValue, 1000)) * 1.1;
  }, [lineChartData]);

  // Ensure val is treated as a number for arithmetic operations on line 811.
  const formatAxisValue = (val: number): string => {
    const n = Number(val);
    if (n >= 10000000) return (n / 10000000).toFixed(1) + 'Cr';
    if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'k';
    return n.toFixed(0);
  };

  const comparisonLabel = useMemo(() => comparisonMode === 'PREV_YEAR' ? 'Last Year' : 'Prev Period', [comparisonMode]);

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
                  {(timeView === 'MONTH' || timeView === 'WEEK') && (<select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500">{[0,1,2,3,4,5,6,7,8,9,10,11].map(m => <option key={m} value={m}>{getFiscalMonthName(m)}</option>)}</select>)}
                  <div className="w-px h-6 bg-gray-300 mx-1"></div>
                  <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-gray-400 uppercase hidden md:inline">Compare:</span><div className="flex bg-gray-100 p-1 rounded-lg"><button onClick={() => setComparisonMode('PREV_YEAR')} className={`px-2 py-1 rounded text-[10px] font-bold ${comparisonMode === 'PREV_YEAR' ? 'bg-white text-purple-600 shadow' : 'text-gray-500'}`}>Last Year</button><button onClick={() => setComparisonMode('PREV_PERIOD')} className={`px-2 py-1 rounded text-[10px] font-bold ${comparisonMode === 'PREV_PERIOD' ? 'bg-white text-purple-600 shadow' : 'text-gray-500'}`}>Previous</button></div></div>
              </div>
          )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        {activeSubTab === 'sales' ? (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current Sales</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatLargeValue(kpis.currVal)}</h3></div><div className="bg-blue-50 p-2 rounded-lg text-blue-600"><DollarSign className="w-5 h-5" /></div></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100"><span className={`flex items-center text-xs font-bold ${kpis.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{kpis.diff >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}{Math.abs(kpis.pct).toFixed(1)}%</span></div><span className="text-[10px] text-gray-400 font-medium">{comparisonLabel}: {formatLargeValue(kpis.prevVal, true)}</span></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sales Quantity</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{kpis.currQty.toLocaleString()}</h3></div><div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Package className="w-5 h-5" /></div></div><p className="mt-3 text-[10px] text-gray-400">Total units sold in period</p></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Customers</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{kpis.uniqueCusts}</h3></div><div className="bg-teal-50 p-2 rounded-lg text-teal-600"><Users className="w-5 h-5" /></div></div><div className="mt-3 flex flex-wrap gap-1.5">{Object.entries(kpis.statusBreakdown).sort((a,b) => b[1] - a[1]).map(([status, count]) => (<span key={status} className={`text-[9px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap bg-gray-100`}>{status}: {count}</span>))}</div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-start"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avg Order Value</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatLargeValue(kpis.avgOrder)}</h3></div><div className="bg-purple-50 p-2 rounded-lg text-purple-600"><Activity className="w-5 h-5" /></div></div><p className="mt-3 text-[10px] text-gray-400">Revenue per transaction</p></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-96"><div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> Sales Trend Analysis</h3></div><div className="flex flex-1 pt-2"><div className="flex flex-col justify-between text-[9px] text-gray-400 font-medium pr-3 pb-8 text-right w-12 border-r border-gray-50"><span>{formatAxisValue(chartMax)}</span><span>{formatAxisValue(chartMax * 0.5)}</span><span>0</span></div><div className="flex-1 relative pl-4 pb-2"><SalesTrendChart data={lineChartData} maxVal={chartMax} /></div></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-96"><div className="flex justify-between items-center mb-2"><h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><PieIcon className="w-4 h-4 text-purple-600" /> Sales Mix</h3></div><div className="flex-1 flex flex-col gap-4 overflow-hidden"><div className="flex-1 pb-2 border-b border-dashed border-gray-200"><SimpleDonut data={pieDataGroup} title="Account Group" color="blue" /></div><div className="flex-1 pt-2"><SimpleDonut data={pieDataStatus} title="By Status" color="green" /></div></div></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col"><h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-gray-600" /> Top Customers</h3><table className="w-full text-left text-xs"><thead><tr className="text-[10px] text-gray-500 uppercase border-b border-gray-100"><th className="py-2 pl-2">Name</th><th className="py-2 text-right">Sales</th><th className="py-2 text-right">Growth</th></tr></thead><tbody>{topCustomers.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50"><td className="py-3 pl-2"><div className="flex items-center gap-2 font-bold text-gray-800">{item.label}</div></td><td className="py-3 text-right font-bold text-gray-900">{formatLargeValue(item.value)}</td><td className="py-3 text-right"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.pct >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{item.pct.toFixed(1)}%</span></td></tr>
                    ))}</tbody></table></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col"><h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Hash className="w-4 h-4 text-blue-600" /> Recent Vouchers</h3><table className="w-full text-left text-xs"><thead><tr className="text-[10px] text-gray-500 uppercase border-b border-gray-100"><th className="py-2">Voucher No</th><th className="py-2">Date</th><th className="py-2 text-right">Value</th></tr></thead><tbody>{recentVouchers.map((v, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50"><td className="py-3 font-mono font-bold text-blue-700">{v.voucherNo}</td><td className="py-3 text-gray-500">{new Date(v.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td><td className="py-3 text-right font-bold text-gray-900">{formatLargeValue(v.value, true)}</td></tr>
                    ))}</tbody></table></div>
                </div>
            </div>
        ) : activeSubTab === 'inventory' ? (
             <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-emerald-600 font-bold uppercase">Stock Val</p><h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{formatLargeValue(inventoryStats.totalVal)}</h3></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-blue-600 font-bold uppercase">Items</p><h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{inventoryStats.count}</h3></div>
                     <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-gray-500 font-bold uppercase">Qty</p><h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{inventoryStats.totalQty.toLocaleString()}</h3></div>
                 </div>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><h4 className="text-xs font-bold text-gray-700 mb-2"><BarChart4 className="w-4 h-4 text-indigo-600 inline mr-1"/> ABC Analysis</h4><ABCAnalysisChart data={inventoryStats.abcData} /></div>
                      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><h4 className="text-xs font-bold text-gray-700 mb-2"><Layers className="w-4 h-4 text-blue-600 inline mr-1"/> Composition</h4><InteractiveDrillDownChart hierarchyData={inventoryStats.hierarchy} metric={invGroupMetric} totalValue={inventoryStats.totalVal} /></div>
                 </div>
             </div>
        ) : activeSubTab === 'so' ? (
            <div className="flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col"><h4 className="text-sm font-bold text-gray-800 mb-4">Pending SO Aging</h4><div className="flex-1"><AgingBarChart data={soStats.agingData} /></div></div>
            </div>
        ) : (
            <div className="flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col"><h4 className="text-sm font-bold text-gray-800 mb-4">Pending PO Overview</h4><div className="flex items-center justify-center gap-8 h-full">
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase font-bold">Overdue</p>
                        <p className="text-3xl font-extrabold text-red-600">{formatLargeValue(poStats.dueVal)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase font-bold">Scheduled</p>
                        <p className="text-3xl font-extrabold text-blue-600">{formatLargeValue(poStats.scheduledVal)}</p>
                    </div>
                </div></div>
            </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;