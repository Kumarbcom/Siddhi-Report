
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem, SalesRecord } from '../types';
import { TrendingUp, TrendingDown, Package, ClipboardList, ShoppingCart, Calendar, Filter, PieChart as PieIcon, BarChart3, Users, ArrowRight, Activity, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, UserCircle, Minus, Plus, ChevronDown, ChevronUp, Link2Off, AlertTriangle, Layers, Clock, CheckCircle2, AlertCircle, User, Factory, Tag, ArrowLeft, BarChart4, Hourglass, History, AlertOctagon, ChevronRight, ListOrdered } from 'lucide-react';

const COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#6B7280', '#059669', '#2563EB'];

const formatLargeValue = (val: number, compact: boolean = false) => {
    if (isNaN(val) || val === null) return '-';
    if (val === 0) return '0';
    const absVal = Math.abs(val);
    const prefix = compact ? '' : 'Rs. ';
    
    if (absVal >= 10000000) return `${prefix}${(val / 10000000).toFixed(2)} Cr`;
    if (absVal >= 100000) return `${prefix}${(val / 100000).toFixed(2)} L`;
    return `${prefix}${Math.round(val).toLocaleString('en-IN')}`;
};

const getMergedGroupName = (groupName: string) => {
    const g = String(groupName || 'Unassigned').trim();
    if (g === 'Group-1' || g === 'Group-3') return 'Group-1 & 3';
    if (['Online Business', 'Online - Giridhar', 'Online - Veeresh'].includes(g)) return 'Online Business';
    return g;
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

  if (isNaN(maxVal) || maxVal <= 0) return <div className="flex items-center justify-center h-full text-gray-300 text-xs">No chart data</div>;

  return (
    <div 
      className="flex flex-col h-full select-none cursor-crosshair overflow-hidden" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      <div className="flex-1 relative min-h-0">
         {data.series.map((s: any, sIdx: number) => 
             s.active && s.data.map((val: number, i: number) => {
                 if (val === 0 || isNaN(val)) return null;
                 const x = (i / (data.labels.length - 1)) * 100;
                 const y = 100 - ((val / maxVal) * 100);
                 const yOffset = sIdx * 12; 
                 const isHovered = hoverIndex === i;
                 return (
                     <div 
                        key={`${sIdx}-${i}`} 
                        className={`absolute text-[8px] font-bold bg-white/80 backdrop-blur-[1px] px-1 rounded shadow-sm border border-gray-100 z-10 pointer-events-none transform -translate-x-1/2 transition-all duration-200 ${isHovered ? 'scale-125 z-20 border-blue-200' : 'opacity-80'}`}
                        style={{ left: `${x}%`, top: `calc(${y}% - ${15 + yOffset}px)`, color: s.color, opacity: hoverIndex !== null && hoverIndex !== i ? 0.2 : 1 }}
                     >
                         {formatLargeValue(val, true)}
                     </div>
                 );
             })
         )}
         {hoverIndex !== null && (
            <div className="absolute z-20 bg-gray-900/95 backdrop-blur-md text-white text-[10px] p-3 rounded-xl shadow-2xl border border-gray-700 pointer-events-none transition-all duration-100 ease-out min-w-[140px]" style={{ left: `${(hoverIndex / (data.labels.length - 1)) * 100}%`, top: '0', transform: `translateX(${hoverIndex > data.labels.length / 2 ? '-110%' : '10%'})` }}>
                <div className="font-bold border-b border-gray-600 pb-2 mb-2 text-gray-100 text-center uppercase tracking-wider text-[11px]">{data.labels[hoverIndex]}</div>
                <div className="flex flex-col gap-2">
                    {data.series.map((s: any, i: number) => (
                        <div key={i} className={`flex items-center justify-between gap-4 ${!s.active ? 'opacity-50' : ''}`}>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: s.color}}></div>
                                <span className="text-gray-300 font-medium whitespace-nowrap">{s.name}</span>
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
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {data.series.map((s: any, i: number) => {
               if (!s.active) return null;
               const points: [number, number][] = s.data.map((val: number, idx: number) => [(idx / (data.labels.length - 1)) * 100, 100 - ((val / maxVal) * 100)]).filter((p: any) => !isNaN(p[1]));
               if (points.length < 2) return null;
               const pathD = getSmoothPath(points);
               return (
                   <g key={i}>
                       <path d={`${pathD} L 100 100 L 0 100 Z`} fill={`url(#grad-${i})`} style={{opacity: hoverIndex !== null ? 0.8 : 0.6}} />
                       <path d={pathD} fill="none" stroke={s.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                   </g>
               )
            })}
         </svg>
      </div>
    </div>
  );
};

const SimpleDonut = ({ data, title, color }: { data: {label: string, value: number, color?: string}[], title: string, color: string }) => {
     if(data.length === 0) return <div className="h-32 flex items-center justify-center text-gray-400 text-xs">No Data</div>;
     const total = data.reduce((a,b) => a+(b.value || 0), 0);
     let cumPercent = 0;
     let displayData = data.length > 5 ? [...data.slice(0, 5), { label: 'Others', value: data.slice(5).reduce((a,b) => a+(b.value || 0), 0) }] : data;
     const colorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#9CA3AF'];
     return (
        <div className="flex flex-col h-full">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">{title}</h4>
            <div className="flex items-center gap-4 flex-1">
                <div className="w-16 h-16 relative flex-shrink-0">
                   <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                      {displayData.map((slice, i) => {
                          const percent = slice.value / (total || 1);
                          const startX = Math.cos(2 * Math.PI * cumPercent);
                          const startY = Math.sin(2 * Math.PI * cumPercent);
                          cumPercent += percent;
                          const endX = Math.cos(2 * Math.PI * cumPercent);
                          const endY = Math.sin(2 * Math.PI * cumPercent);
                          return ( <path key={i} d={`M ${startX} ${startY} A 1 1 0 ${percent > 0.5 ? 1 : 0} 1 ${endX} ${endY} L 0 0`} fill={slice.color || colorPalette[i % colorPalette.length]} stroke="white" strokeWidth="0.05" /> );
                      })}
                      <circle cx="0" cy="0" r="0.6" fill="white" />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <span className={`text-[7px] font-bold ${color === 'blue' ? 'text-blue-600' : 'text-green-600'}`}>{formatLargeValue(total, true)}</span>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar h-24 text-[9px]">
                    {displayData.map((d, i) => (
                        <div key={i} className="flex justify-between items-center mb-1">
                             <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor: d.color || colorPalette[i % colorPalette.length]}}></div>
                                <span className="text-gray-600 truncate" title={String(d.label)}>{d.label}</span>
                             </div>
                             <span className="font-bold text-gray-800 whitespace-nowrap ml-2">{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
     );
};

const HorizontalBarChart = ({ data, title, color }: { data: { label: string; value: number }[], title: string, color: string }) => {
    const sorted = [...data].sort((a,b) => (b.value || 0) - (a.value || 0)).slice(0, 10);
    const maxVal = Math.max(sorted[0]?.value || 1, 1);
    const barColorClass = color === 'blue' ? 'bg-blue-500' : color === 'emerald' ? 'bg-emerald-500' : color === 'purple' ? 'bg-purple-500' : 'bg-orange-500';
    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-3 border-b border-gray-100 pb-1">{title}</h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-1">
                <div className="flex flex-col gap-4">
                    {sorted.map((item, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="truncate text-gray-700 font-medium flex-1 min-w-0 pr-3" title={String(item.label)}>{item.label}</span>
                                <span className="font-bold text-gray-900 flex-shrink-0 bg-white pl-1">{formatLargeValue(item.value, true)}</span>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${barColorClass} transition-all duration-700`} style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Added missing components to fix errors ---

const ABCAnalysisChart = ({ data }: { data: { label: string, value: number, count: number, color: string }[] }) => {
  const totalVal = data.reduce((a, b) => a + (b.value || 0), 0);
  return (
    <div className="flex flex-col h-full w-full">
      <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-3 border-b border-gray-100 pb-1">ABC Inventory Analysis</h4>
      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 mt-2">
        {data.map((item) => (
          <div key={item.label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: item.color }}>{item.label}</span>
                <span className="text-xs font-bold text-gray-700">Category {item.label}</span>
              </div>
              <span className="text-xs font-black text-gray-900">{formatLargeValue(item.value, true)}</span>
            </div>
            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(item.value / (totalVal || 1)) * 100}%`, backgroundColor: item.color }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>{item.count} Items</span>
              <span>{((item.value / (totalVal || 1)) * 100).toFixed(1)}% of Value</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400 italic">
        A: Top 70% | B: Next 20% | C: Bottom 10%
      </div>
    </div>
  );
};

const InteractiveDrillDownChart = ({ hierarchyData, metric, totalValue }: { hierarchyData: any[], metric: Metric, totalValue: number }) => {
    const [selectedMake, setSelectedMake] = useState<string | null>(null);
    const displayData = selectedMake 
        ? hierarchyData.find(h => h.label === selectedMake)?.groups || []
        : hierarchyData;
    
    const maxVal = Math.max(...displayData.map((d: any) => d.value), 1);

    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-1">
                <h4 className="text-[11px] font-bold text-gray-600 uppercase">
                    {selectedMake ? `Groups: ${selectedMake}` : 'Stock by Make'}
                </h4>
                {selectedMake && (
                    <button 
                        onClick={() => setSelectedMake(null)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                        <ArrowLeft className="w-3 h-3" /> Back
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-1">
                <div className="flex flex-col gap-4">
                    {displayData.map((item: any, i: number) => (
                        <div 
                            key={i} 
                            className={`flex flex-col gap-1.5 ${!selectedMake ? 'cursor-pointer hover:bg-gray-50 p-1 rounded-md transition-colors' : ''}`}
                            onClick={() => !selectedMake && setSelectedMake(item.label)}
                        >
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="truncate text-gray-700 font-bold flex-1 min-w-0 pr-3" title={item.label}>{item.label}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-gray-400 font-medium">({((item.value / (totalValue || 1)) * 100).toFixed(1)}%)</span>
                                    <span className="font-bold text-gray-900">{metric === 'value' ? formatLargeValue(item.value, true) : item.value.toLocaleString()}</span>
                                    {!selectedMake && <ChevronRight className="w-3 h-3 text-gray-300" />}
                                </div>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${selectedMake ? 'bg-indigo-500' : 'bg-blue-600'} transition-all duration-500`} 
                                    style={{ width: `${(item.value / maxVal) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Dashboard View Component continues ---

const GroupedCustomerAnalysis = ({ data }: { data: { group: string, total: number, customers: { name: string, current: number, previous: number, diff: number }[] }[] }) => {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const toggleGroup = (group: string) => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-3 border-b border-gray-100 pb-1">Customer Group</h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {data.map((groupData) => (
                    <div key={groupData.group} className="border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
                        <button onClick={() => toggleGroup(groupData.group)} className="w-full flex items-center justify-between p-2.5 bg-gray-50 hover:bg-blue-50 transition-colors">
                            <div className="flex items-center gap-2">
                                {expandedGroups[groupData.group] ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                <span className="text-xs font-bold text-gray-800 uppercase tracking-tight">{groupData.group}</span>
                            </div>
                            <span className="text-xs font-black text-blue-700">{formatLargeValue(groupData.total, true)}</span>
                        </button>
                        {expandedGroups[groupData.group] && (
                            <div className="divide-y divide-gray-50 bg-white">
                                {groupData.customers.map((cust, idx) => (
                                    <div key={idx} className="p-2.5 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-bold text-gray-700 truncate w-3/5" title={cust.name}>{cust.name}</span>
                                            <span className="text-[10px] font-black text-gray-900">{formatLargeValue(cust.current, true)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] text-gray-400 uppercase font-medium">PY:</span>
                                                <span className="text-[9px] text-gray-500 font-mono">{formatLargeValue(cust.previous, true)}</span>
                                            </div>
                                            <div className={`flex items-center gap-0.5 text-[9px] font-bold ${cust.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {cust.diff >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                                <span>{formatLargeValue(Math.abs(cust.diff), true)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

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
  materials = [],
  closingStock = [],
  pendingSO = [],
  pendingPO = [],
  salesReportItems = [],
  customers = [],
  setActiveTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'inventory' | 'so' | 'po'>('sales');
  const [timeView, setTimeView] = useState<'FY' | 'MONTH' | 'WEEK'>('FY');
  const [selectedFY, setSelectedFY] = useState<string>('');
  const [invGroupMetric, setInvGroupMetric] = useState<Metric>('value');
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  const parseDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === 'number') { return new Date((val - 25569) * 86400 * 1000); }
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const getFiscalInfo = (date: Date) => {
    if (!date || isNaN(date.getTime())) return { fiscalYear: 'N/A', fiscalMonthIndex: 0, weekNumber: 0 };
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

  const enrichedSales = useMemo(() => {
      const custMap = new Map<string, CustomerMasterItem>();
      customers.forEach(c => { if(c.customerName) custMap.set(String(c.customerName).toLowerCase().trim(), c); });
      return salesReportItems.map(item => {
          const dateObj = parseDate(item.date);
          const fi = getFiscalInfo(dateObj);
          const cust = custMap.get(String(item.customerName || '').toLowerCase().trim());
          const mergedGroup = getMergedGroupName(cust?.group || 'Unassigned');
          return { ...item, ...fi, rawDate: dateObj, custGroup: mergedGroup, custStatus: cust?.status || 'Unknown' };
      });
  }, [salesReportItems, customers]);

  const uniqueFYs = useMemo(() => Array.from(new Set(enrichedSales.map(i => i.fiscalYear))).filter(f => f !== 'N/A').sort().reverse(), [enrichedSales]);
  
  useEffect(() => { 
    if (uniqueFYs.length > 0 && (!selectedFY || !uniqueFYs.includes(selectedFY))) {
        setSelectedFY(uniqueFYs[0]);
    }
  }, [uniqueFYs, selectedFY]);

  const currentData = useMemo(() => {
      return enrichedSales.filter(i => {
          if (i.fiscalYear !== selectedFY) return false;
          if (timeView === 'MONTH' && i.fiscalMonthIndex !== selectedMonth) return false;
          if (timeView === 'WEEK' && i.weekNumber !== selectedWeek) return false;
          return true;
      });
  }, [selectedFY, selectedMonth, selectedWeek, timeView, enrichedSales]);

  const previousDataForComparison = useMemo(() => {
      if (!selectedFY) return [];
      const parts = selectedFY.split('-');
      const pyStart = parseInt(parts[0]) - 1;
      const pyString = `${pyStart}-${pyStart + 1}`;
      return enrichedSales.filter(i => {
          if (i.fiscalYear !== pyString) return false;
          if (timeView === 'MONTH' && i.fiscalMonthIndex !== selectedMonth) return false;
          if (timeView === 'WEEK' && i.weekNumber !== selectedWeek) return false;
          return true;
      });
  }, [selectedFY, timeView, selectedMonth, selectedWeek, enrichedSales]);

  const kpis = useMemo(() => {
      const currVal = currentData.reduce((acc, i) => acc + (i.value || 0), 0);
      const uniqueCusts = new Set(currentData.map(i => String(i.customerName || ''))).size;
      const uniqueVouchers = new Set(currentData.map(i => String(i.voucherNo || ''))).size;
      return { currVal, currQty: currentData.reduce((acc, i) => acc + (i.quantity || 0), 0), uniqueCusts, avgOrder: uniqueVouchers ? currVal / uniqueVouchers : 0 };
  }, [currentData]);

  const groupedCustomerData = useMemo(() => {
      const groupMap = new Map<string, { total: number, customers: Map<string, { current: number, previous: number }> }>();
      currentData.forEach(i => {
          const group = i.custGroup;
          const name = String(i.customerName || 'Unknown');
          if (!groupMap.has(group)) groupMap.set(group, { total: 0, customers: new Map() });
          const groupObj = groupMap.get(group)!;
          groupObj.total += (i.value || 0);
          if (!groupObj.customers.has(name)) groupObj.customers.set(name, { current: 0, previous: 0 });
          groupObj.customers.get(name)!.current += (i.value || 0);
      });
      previousDataForComparison.forEach(i => {
          const group = i.custGroup;
          const name = String(i.customerName || 'Unknown');
          if (groupMap.has(group)) {
              const groupObj = groupMap.get(group)!;
              if (groupObj.customers.has(name)) groupObj.customers.set(name, { current: 0, previous: (i.value || 0) });
              else groupObj.customers.set(name, { current: 0, previous: (i.value || 0) });
          }
      });
      return Array.from(groupMap.entries()).map(([group, data]) => ({
          group,
          total: data.total,
          customers: Array.from(data.customers.entries()).map(([name, vals]) => ({ name, current: vals.current, previous: vals.previous, diff: vals.current - vals.previous })).sort((a, b) => b.current - a.current).slice(0, 10)
      })).sort((a, b) => b.total - a.total);
  }, [currentData, previousDataForComparison]);

  const soStats = useMemo(() => {
      const totalVal = pendingSO.reduce((a, b) => a + (b.value || 0), 0);
      const custMap = new Map<string, number>();
      const groupMap = new Map<string, number>();
      const ageingMap = { '0-30d': 0, '31-60d': 0, '61-90d': 0, '90d+': 0 };
      
      pendingSO.forEach(i => {
          custMap.set(i.partyName, (custMap.get(i.partyName) || 0) + (i.value || 0));
          const mat = materials.find(m => m.description.toLowerCase().trim() === i.itemName.toLowerCase().trim());
          const group = mat ? mat.materialGroup : 'Unspecified';
          groupMap.set(group, (groupMap.get(group) || 0) + (i.value || 0));
          
          const days = i.overDueDays || 0;
          if (days <= 30) ageingMap['0-30d'] += (i.value || 0);
          else if (days <= 60) ageingMap['31-60d'] += (i.value || 0);
          else if (days <= 90) ageingMap['61-90d'] += (i.value || 0);
          else ageingMap['90d+'] += (i.value || 0);
      });

      return {
          totalVal,
          count: pendingSO.length,
          custMix: Array.from(custMap.entries()).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value),
          groupMix: Array.from(groupMap.entries()).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value),
          ageing: Object.entries(ageingMap).map(([label, value]) => ({ label, value })),
          topItems: [...pendingSO].sort((a,b) => b.value - a.value).slice(0, 10)
      };
  }, [pendingSO, materials]);

  const poStats = useMemo(() => {
      const totalVal = pendingPO.reduce((a, b) => a + (b.value || 0), 0);
      const vendorMap = new Map<string, number>();
      const statusMap = { 'Overdue': 0, 'Due Today': 0, 'Due This Week': 0, 'Future': 0 };
      const groupMap = new Map<string, number>();

      const today = new Date();
      today.setHours(0,0,0,0);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 7);

      pendingPO.forEach(i => {
          vendorMap.set(i.partyName, (vendorMap.get(i.partyName) || 0) + (i.value || 0));
          const mat = materials.find(m => m.description.toLowerCase().trim() === i.itemName.toLowerCase().trim());
          const group = mat ? mat.materialGroup : 'Unspecified';
          groupMap.set(group, (groupMap.get(group) || 0) + (i.value || 0));

          const dueDate = parseDate(i.dueDate);
          if (dueDate < today) statusMap['Overdue'] += (i.value || 0);
          else if (dueDate.getTime() === today.getTime()) statusMap['Due Today'] += (i.value || 0);
          else if (dueDate <= weekEnd) statusMap['Due This Week'] += (i.value || 0);
          else statusMap['Future'] += (i.value || 0);
      });

      return {
          totalVal,
          count: pendingPO.length,
          vendorMix: Array.from(vendorMap.entries()).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value),
          dueMix: Object.entries(statusMap).map(([label, value]) => ({ label, value })),
          groupMix: Array.from(groupMap.entries()).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value),
          topItems: [...pendingPO].sort((a,b) => b.value - a.value).slice(0, 10)
      };
  }, [pendingPO, materials]);

  const lineChartData = useMemo(() => {
      const labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
      const getSeries = (fy: string) => { 
          const arr = new Array(12).fill(0); 
          enrichedSales.filter(i => i.fiscalYear === fy).forEach(i => {
              if (i.fiscalMonthIndex >= 0 && i.fiscalMonthIndex < 12) arr[i.fiscalMonthIndex] += (i.value || 0);
          }); 
          return arr; 
      };
      if (!selectedFY) return { labels, series: [] };
      const startYear = parseInt(selectedFY.split('-')[0]);
      return { 
        labels, 
        series: [ 
            { name: selectedFY, data: getSeries(selectedFY), color: '#3b82f6', active: true }, 
            { name: `${startYear - 1}-${startYear}`, data: getSeries(`${startYear - 1}-${startYear}`), color: '#a855f7', active: true },
            { name: `${startYear - 2}-${startYear - 1}`, data: getSeries(`${startYear - 2}-${startYear - 1}`), color: '#f59e0b', active: true }
        ] 
      };
  }, [selectedFY, enrichedSales]);

  const inventoryStats = useMemo(() => {
    const data = closingStock.map(i => { const mat = materials.find(m => String(m.description || '').toLowerCase().trim() === String(i.description || '').toLowerCase().trim()); return { ...i, make: mat ? mat.make : 'Unspecified', group: mat ? mat.materialGroup : 'Unspecified' }; });
    const totalVal = data.reduce((a, b) => a + (b.value || 0), 0);
    const hMap = new Map<string, any>();
    data.forEach(i => { const make = String(i.make || 'Unspecified'); if(!hMap.has(make)) hMap.set(make, { val: 0, qty: 0, groups: new Map() }); const m = hMap.get(make); m.val += (i.value || 0); m.qty += (i.quantity || 0); const group = String(i.group || 'Unspecified'); if(!m.groups.has(group)) m.groups.set(group, { val: 0, qty: 0 }); const g = m.groups.get(group); g.val += (i.value || 0); g.qty += (i.quantity || 0); });
    const hierarchy = Array.from(hMap.entries()).map(([label, d]) => ({ label, value: invGroupMetric === 'value' ? d.val : d.qty, groups: Array.from(d.groups.entries()).map(([gl, gd]) => ({ label: gl, value: invGroupMetric === 'value' ? gd.val : gd.qty })).sort((a,b) => b.value - a.value) })).sort((a,b) => b.value - a.value);
    let cVal = 0; const sorted = [...data].sort((a,b) => (b.value || 0) - (a.value || 0)); const abc = { A: { c: 0, v: 0 }, B: { c: 0, v: 0 }, C: { c: 0, v: 0 } };
    sorted.forEach(i => { cVal += (i.value || 0); const p = cVal / (totalVal || 1); if (p <= 0.7) { abc.A.c++; abc.A.v += (i.value || 0); } else if (p <= 0.9) { abc.B.c++; abc.B.v += (i.value || 0); } else { abc.C.c++; abc.C.v += (i.value || 0); } });
    return { totalVal, count: data.length, hierarchy, abcData: [ { label: 'A', value: abc.A.v, count: abc.A.c, color: '#10B981' }, { label: 'B', value: abc.B.v, count: abc.B.c, color: '#F59E0B' }, { label: 'C', value: abc.C.v, count: abc.C.c, color: '#EF4444' } ] };
  }, [closingStock, materials, invGroupMetric]);

  const chartMax = useMemo(() => Math.max(...lineChartData.series.flatMap(s => s.data), 1000) * 1.1, [lineChartData]);
  const formatAxisValue = (val: number) => { if(isNaN(val)) return '0'; if (val >= 10000000) return (val/10000000).toFixed(1) + 'Cr'; if (val >= 100000) return (val/100000).toFixed(1) + 'L'; if (val >= 1000) return (val/1000).toFixed(0) + 'k'; return Math.round(val).toString(); };

  return (
    <div className="h-full w-full flex flex-col bg-gray-50/50 overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between flex-shrink-0 shadow-sm z-10">
          <div className="flex bg-gray-100 p-1 rounded-lg">{(['sales', 'inventory', 'so', 'po'] as const).map(tab => (<button key={tab} onClick={() => setActiveSubTab(tab)} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeSubTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{tab === 'so' ? 'Pending SO' : tab === 'po' ? 'Pending PO' : tab}</button>))}</div>
          {activeSubTab === 'sales' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg">{(['FY', 'MONTH', 'WEEK'] as const).map(v => (<button key={v} onClick={() => setTimeView(v)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}> {v} </button>))}</div>
              <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium">{uniqueFYs.length > 0 ? uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>) : <option value="">No FY Data</option>}</select>
            </div>
          )}
      </div>
      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        {activeSubTab === 'sales' ? (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current Sales</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatLargeValue(kpis.currVal)}</h3></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Quantity</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{kpis.currQty.toLocaleString()}</h3></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Unique Customers</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{kpis.uniqueCusts}</h3></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avg Order</p><h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatLargeValue(kpis.avgOrder)}</h3></div></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-80 overflow-hidden"><h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> 3-Year Trend Analysis</h3><div className="flex flex-1 pt-2 overflow-hidden"><div className="flex flex-col justify-between text-[9px] text-gray-400 pr-3 pb-8 text-right w-12 border-r"><span>{formatAxisValue(chartMax)}</span><span>{formatAxisValue(chartMax*0.5)}</span><span>0</span></div><div className="flex-1 pl-4 pb-2 relative min-h-0"><SalesTrendChart data={lineChartData} maxVal={chartMax} /></div></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-80 overflow-hidden"><SimpleDonut data={groupedCustomerData.map(g => ({ label: g.group, value: g.total }))} title="Sales Mix by Group" color="blue" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-96 overflow-hidden">
                        <HorizontalBarChart data={groupedCustomerData.map(g => ({ label: g.group, value: g.total }))} title="Top Customer Groups (by Value)" color="blue" />
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-96 overflow-hidden">
                        <GroupedCustomerAnalysis data={groupedCustomerData} />
                    </div>
                </div>
            </div>
        ) : activeSubTab === 'inventory' ? (
             <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-emerald-600 font-bold uppercase">Stock Val</p><h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{formatLargeValue(inventoryStats.totalVal)}</h3></div><div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-blue-600 font-bold uppercase">Items</p><h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{inventoryStats.count}</h3></div></div>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><ABCAnalysisChart data={inventoryStats.abcData} /></div><div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><InteractiveDrillDownChart hierarchyData={inventoryStats.hierarchy} metric={invGroupMetric} totalValue={inventoryStats.totalVal} /></div></div>
             </div>
        ) : activeSubTab === 'so' ? (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-purple-600 font-bold uppercase">Total Pending SO</p><h3 className="text-xl font-extrabold text-gray-900 mt-1">{formatLargeValue(soStats.totalVal)}</h3></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-blue-600 font-bold uppercase">Open Lines</p><h3 className="text-xl font-extrabold text-gray-900 mt-1">{soStats.count}</h3></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-orange-600 font-bold uppercase">Overdue Orders</p><h3 className="text-xl font-extrabold text-gray-900 mt-1">{pendingSO.filter(i => i.overDueDays > 0).length}</h3></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-teal-600 font-bold uppercase">Unique Customers</p><h3 className="text-xl font-extrabold text-gray-900 mt-1">{soStats.custMix.length}</h3></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><SimpleDonut data={soStats.ageing} title="SO Ageing Analysis" color="blue" /></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><SimpleDonut data={soStats.groupMix} title="SO by Material Group" color="green" /></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><SimpleDonut data={soStats.custMix} title="Customer Concentration" color="blue" /></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-96">
                        <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-4 flex items-center gap-2"><ListOrdered className="w-4 h-4 text-purple-600" /> Top 10 High Value SOs</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[10px] text-left">
                                <thead className="bg-gray-50 text-gray-500 uppercase font-bold border-b border-gray-100">
                                    <tr><th className="py-2 px-2">Customer</th><th className="py-2 px-2">Item</th><th className="py-2 px-2 text-right">Qty</th><th className="py-2 px-2 text-right">Value</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {soStats.topItems.map(i => (
                                        <tr key={i.id} className="hover:bg-gray-50"><td className="py-2 px-2 font-medium truncate max-w-[120px]">{i.partyName}</td><td className="py-2 px-2 truncate max-w-[150px]">{i.itemName}</td><td className="py-2 px-2 text-right">{i.balanceQty}</td><td className="py-2 px-2 text-right font-bold text-purple-700">{formatLargeValue(i.value, true)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-96">
                        <HorizontalBarChart data={soStats.custMix} title="Pending SO by Customer" color="blue" />
                    </div>
                </div>
            </div>
        ) : activeSubTab === 'po' ? (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-orange-600 font-bold uppercase">Total Pending PO</p><h3 className="text-xl font-extrabold text-gray-900 mt-1">{formatLargeValue(poStats.totalVal)}</h3></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-blue-600 font-bold uppercase">Open POs</p><h3 className="text-xl font-extrabold text-gray-900 mt-1">{poStats.count}</h3></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-red-600 font-bold uppercase">Overdue Arrivals</p><h3 className="text-xl font-extrabold text-gray-900 mt-1">{pendingPO.filter(i => i.overDueDays > 0).length}</h3></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-emerald-600 font-bold uppercase">Active Vendors</p><h3 className="text-xl font-extrabold text-gray-900 mt-1">{poStats.vendorMix.length}</h3></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><SimpleDonut data={poStats.dueMix} title="PO Delivery Schedule" color="green" /></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><SimpleDonut data={poStats.groupMix} title="PO by Material Group" color="blue" /></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80"><SimpleDonut data={poStats.vendorMix} title="Vendor Concentration" color="green" /></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-96">
                        <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-4 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-orange-600" /> Top 10 High Value Open POs</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[10px] text-left">
                                <thead className="bg-gray-50 text-gray-500 uppercase font-bold border-b border-gray-100">
                                    <tr><th className="py-2 px-2">Vendor</th><th className="py-2 px-2">Item</th><th className="py-2 px-2 text-right">Qty</th><th className="py-2 px-2 text-right">Value</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {poStats.topItems.map(i => (
                                        <tr key={i.id} className="hover:bg-gray-50"><td className="py-2 px-2 font-medium truncate max-w-[120px]">{i.partyName}</td><td className="py-2 px-2 truncate max-w-[150px]">{i.itemName}</td><td className="py-2 px-2 text-right">{i.balanceQty}</td><td className="py-2 px-2 text-right font-bold text-orange-700">{formatLargeValue(i.value, true)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-96">
                        <HorizontalBarChart data={poStats.vendorMix} title="Pending PO by Vendor" color="emerald" />
                    </div>
                </div>
            </div>
        ) : null}
      </div>
    </div>
  );
};

export default DashboardView;
