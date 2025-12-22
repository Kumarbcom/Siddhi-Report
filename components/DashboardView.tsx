
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem, SalesRecord } from '../types';
import { TrendingUp, TrendingDown, Package, ClipboardList, ShoppingCart, Calendar, Filter, PieChart as PieIcon, BarChart3, Users, ArrowRight, Activity, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, UserCircle, Minus, Plus, ChevronDown, ChevronUp, Link2Off, AlertTriangle, Layers, Clock, CheckCircle2, AlertCircle, User, Factory, Tag, ArrowLeft, BarChart4, Hourglass, History, AlertOctagon, ChevronRight, ListOrdered, Table, X, Search, ArrowUpDown, ArrowUp, ArrowDown, Globe } from 'lucide-react';

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

const getBrandLogo = (brand: string) => {
    const b = brand.toLowerCase().trim();
    if (b === 'unspecified' || b === 'unknown' || b === 'all') return null;
    let domain = `${b.replace(/[^a-z0-9]/g, '')}.com`;
    if (b.includes('schneider')) domain = 'se.com';
    if (b.includes('lapp')) domain = 'lapp.com';
    if (b.includes('eaton')) domain = 'eaton.com';
    if (b.includes('hager')) domain = 'hager.com';
    if (b.includes('phoenix')) domain = 'phoenixcontact.com';
    if (b.includes('mitsubishi')) domain = 'mitsubishielectric.com';
    if (b.includes('siemens')) domain = 'siemens.com';
    if (b.includes('skf')) domain = 'skf.com';
    if (b.includes('festo')) domain = 'festo.com';
    if (b.includes('danfoss')) domain = 'danfoss.com';
    if (b.includes('rockwell')) domain = 'rockwellautomation.com';
    
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
};

const getMergedGroupName = (groupName: string) => {
    const g = String(groupName || 'Unassigned').trim();
    const lowerG = g.toLowerCase();
    if (lowerG.includes('group-1') || lowerG.includes('group-3') || lowerG.includes('peenya') || lowerG.includes('dcv')) return 'Group-1 Giridhar';
    if (lowerG.includes('online')) return 'Online Business';
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

const SimpleDonut = ({ data, title, color, isCurrency = false }: { data: {label: string, value: number, color?: string}[], title: string, color: string, isCurrency?: boolean }) => {
     if(data.length === 0) return <div className="h-32 flex items-center justify-center text-gray-400 text-xs">No Data</div>;
     const total = data.reduce((a,b) => a+(b.value || 0), 0);
     let cumPercent = 0;
     let displayData = data.length > 7 ? [...data.slice(0, 7), { label: 'Others', value: data.slice(7).reduce((a,b) => a+(b.value || 0), 0) }] : data;
     const colorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#9CA3AF', '#6366F1', '#EC4899'];
     
     return (
        <div className="flex flex-col h-full">
            <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-3 border-b border-gray-100 pb-1">{title}</h4>
            <div className="flex flex-col lg:flex-row items-center gap-6 flex-1 min-h-0">
                <div className="w-48 h-48 relative flex-shrink-0 mx-auto lg:mx-0">
                   <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                      {displayData.map((slice, i) => {
                          const percent = slice.value / (total || 1);
                          const startX = Math.cos(2 * Math.PI * cumPercent);
                          const startY = Math.sin(2 * Math.PI * cumPercent);
                          cumPercent += percent;
                          const endX = Math.cos(2 * Math.PI * cumPercent);
                          const endY = Math.sin(2 * Math.PI * cumPercent);
                          return ( <path key={i} d={`M ${startX} ${startY} A 1 1 0 ${percent > 0.5 ? 1 : 0} 1 ${endX} ${endY} L 0 0`} fill={slice.color || colorPalette[i % colorPalette.length]} stroke="white" strokeWidth="0.04" className="hover:opacity-80 transition-opacity cursor-pointer" /> );
                      })}
                      <circle cx="0" cy="0" r="0.7" fill="white" />
                   </svg>
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                       <span className={`text-[12px] font-black leading-none ${color === 'blue' ? 'text-blue-700' : 'text-green-700'}`}>{formatLargeValue(total, true)}</span>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar w-full max-h-40 lg:max-h-none">
                    {displayData.map((d, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0 hover:bg-gray-50 px-1 rounded transition-colors">
                             <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: d.color || colorPalette[i % colorPalette.length]}}></div>
                                <span className="text-[10px] text-gray-600 font-medium truncate" title={String(d.label)}>{d.label}</span>
                             </div>
                             <div className="flex items-center gap-2 ml-4">
                                <span className="text-[9px] font-bold text-gray-400">{isCurrency ? formatLargeValue(d.value, true) : Math.round(d.value).toLocaleString()}</span>
                                <span className="text-[10px] font-black text-gray-800 w-8 text-right">{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
     );
};

const HorizontalBarChart = ({ data, title, color, totalForPercentage }: { data: { label: string; value: number, previous?: number }[], title: string, color: string, totalForPercentage?: number }) => {
    const sorted = [...data].sort((a,b) => (b.value || 0) - (a.value || 0)).slice(0, 10);
    const maxVal = Math.max(sorted[0]?.value || 1, sorted[0]?.previous || 1);
    const barColorClass = color === 'blue' ? 'bg-blue-500' : color === 'emerald' ? 'bg-emerald-500' : color === 'purple' ? 'bg-purple-500' : 'bg-orange-500';
    
    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-3 border-b border-gray-100 pb-1">{title}</h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-1">
                <div className="flex flex-col gap-4">
                    {sorted.map((item, i) => {
                        const growth = item.previous && item.previous > 0 ? ((item.value - item.previous) / item.previous) * 100 : 0;
                        const hasPY = item.previous !== undefined && item.previous > 0;
                        
                        return (
                            <div key={i} className="flex flex-col gap-1.5">
                                <div className="flex justify-between items-end text-[10px]">
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-gray-700 font-bold" title={String(item.label)}>{item.label}</span>
                                            {hasPY && (
                                                <span className={`text-[8px] font-black px-1 py-px rounded flex items-center gap-0.5 ${growth >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                                    {growth >= 0 ? <ArrowUpRight className="w-2 h-2"/> : <ArrowDownRight className="w-2 h-2"/>}
                                                    {Math.abs(growth).toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {item.previous !== undefined && (
                                                <span className="text-[8px] text-gray-400 font-medium">PY: {formatLargeValue(item.previous, true)}</span>
                                            )}
                                            {totalForPercentage && (
                                                <span className="text-[8px] bg-gray-50 px-1 rounded font-bold text-gray-500">
                                                    Share: {((item.value / totalForPercentage) * 100).toFixed(1)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="font-black text-gray-900 flex-shrink-0 bg-white pl-1">{formatLargeValue(item.value, true)}</span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden relative">
                                    {item.previous !== undefined && (
                                        <div className="absolute inset-0 bg-gray-200/50" style={{ width: `${(item.previous / maxVal) * 100}%` }}></div>
                                    )}
                                    <div className={`h-full rounded-full ${barColorClass} transition-all duration-700 relative z-10`} style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const GroupedCustomerAnalysis = ({ data }: { data: { group: string, total: number, totalPrevious: number, customers: { name: string, current: number, previous: number, diff: number }[] }[] }) => {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const toggleGroup = (group: string) => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-3 border-b border-gray-100 pb-1">Account Group Comparison (vs PY)</h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {data.map((groupData) => (
                    <div key={groupData.group} className="border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
                        <button onClick={() => toggleGroup(groupData.group)} className="w-full flex items-center justify-between p-2.5 bg-gray-50 hover:bg-blue-50 transition-colors">
                            <div className="flex items-center gap-2">
                                {expandedGroups[groupData.group] ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                <span className="text-xs font-bold text-gray-800 uppercase tracking-tight">{groupData.group}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-blue-700">{formatLargeValue(groupData.total, true)}</span>
                                <div className="flex items-center gap-1.5 leading-none">
                                    <span className="text-[8px] text-gray-400 uppercase font-medium">PY: {formatLargeValue(groupData.totalPrevious, true)}</span>
                                    <span className={`text-[8px] font-bold px-1 rounded-sm ${groupData.total >= groupData.totalPrevious ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                        {groupData.totalPrevious > 0 ? (((groupData.total - groupData.totalPrevious) / groupData.totalPrevious) * 100).toFixed(0) : '100'}%
                                    </span>
                                </div>
                            </div>
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

const KPICard = ({ label, value, growth, prefix = '' }: { label: string, value: string, growth: number, prefix?: string }) => {
    const isPositive = growth > 0;
    const isZero = growth === 0;
    return (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between transition-all hover:shadow-md">
            <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
                <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{value}</h3>
            </div>
            <div className="mt-3 flex items-center gap-2">
                <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${isZero ? 'bg-gray-100 text-gray-500' : isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isZero ? <Minus className="w-3 h-3" /> : isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    <span>{Math.abs(growth).toFixed(1)}%</span>
                </div>
                <span className="text-[9px] text-gray-400 font-medium italic">vs Previous Year</span>
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
  const getInitialFiscalMonth = () => {
    const now = new Date();
    const m = now.getMonth();
    return m >= 3 ? m - 3 : m + 9;
  };

  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'inventory' | 'so' | 'po'>('sales');
  const [timeView, setTimeView] = useState<'FY' | 'MONTH' | 'WEEK'>('MONTH'); // Default to MONTH for immediate relevance
  const [selectedFY, setSelectedFY] = useState<string>('');
  const [invGroupMetric, setInvGroupMetric] = useState<Metric>('value');
  const [selectedMonth, setSelectedMonth] = useState<number>(getInitialFiscalMonth());
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedSoItem, setSelectedSoItem] = useState<PendingSOItem | null>(null);

  const [invTableSearch, setInvTableSearch] = useState('');
  const [invTableSort, setInvTableSort] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [selectedInvMake, setSelectedInvMake] = useState<string>('ALL');

  const parseDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date((val - (25567 + 2)) * 86400 * 1000);
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
          if (i.fiscalYear === pyString) {
              if (timeView === 'MONTH' && i.fiscalMonthIndex !== selectedMonth) return false;
              if (timeView === 'WEEK' && i.weekNumber !== selectedWeek) return false;
              return true;
          }
          return false;
      });
  }, [selectedFY, timeView, selectedMonth, selectedWeek, enrichedSales]);

  const kpis = useMemo(() => {
      const getStats = (data: any[]) => {
          const val = data.reduce((acc, i) => acc + (i.value || 0), 0);
          const qty = data.reduce((acc, i) => acc + (i.quantity || 0), 0);
          const custs = new Set(data.map(i => String(i.customerName || ''))).size;
          const vouchers = new Set(data.map(i => String(i.voucherNo || ''))).size;
          const avg = vouchers ? val / vouchers : 0;
          return { val, qty, custs, avg };
      };
      const curr = getStats(currentData);
      const prev = getStats(previousDataForComparison);
      const getGrowth = (c: number, p: number) => p > 0 ? ((c - p) / p) * 100 : (c > 0 ? 100 : 0);
      return {
          sales: { curr: curr.val, growth: getGrowth(curr.val, prev.val) },
          qty: { curr: curr.qty, growth: getGrowth(curr.qty, prev.qty) },
          custs: { curr: curr.custs, growth: getGrowth(curr.custs, prev.custs) },
          avgOrder: { curr: curr.avg, growth: getGrowth(curr.avg, prev.avg) }
      };
  }, [currentData, previousDataForComparison]);

  const groupedCustomerData = useMemo(() => {
      const groupMap = new Map<string, { total: number, totalPrevious: number, customers: Map<string, { current: number, previous: number }> }>();
      currentData.forEach(i => {
          const group = i.custGroup;
          const name = String(i.customerName || 'Unknown');
          if (!groupMap.has(group)) groupMap.set(group, { total: 0, totalPrevious: 0, customers: new Map() });
          const groupObj = groupMap.get(group)!;
          groupObj.total += (i.value || 0);
          if (!groupObj.customers.has(name)) groupObj.customers.set(name, { current: 0, previous: 0 });
          groupObj.customers.get(name)!.current += (i.value || 0);
      });
      previousDataForComparison.forEach(i => {
          const group = i.custGroup;
          const name = String(i.customerName || 'Unknown');
          if (!groupMap.has(group)) groupMap.set(group, { total: 0, totalPrevious: 0, customers: new Map() });
          const groupObj = groupMap.get(group)!;
          groupObj.totalPrevious += (i.value || 0);
          if (!groupObj.customers.has(name)) groupObj.customers.set(name, { current: 0, previous: 0 });
          groupObj.customers.get(name)!.previous += (i.value || 0);
      });
      return Array.from(groupMap.entries()).map(([group, data]) => ({
          group,
          total: data.total,
          totalPrevious: data.totalPrevious,
          customers: Array.from(data.customers.entries()).map(([name, vals]) => ({ 
              name, current: vals.current, previous: vals.previous, diff: vals.current - vals.previous 
          })).sort((a, b) => b.current - a.current).slice(0, 10)
      })).sort((a, b) => b.total - a.total);
  }, [currentData, previousDataForComparison]);

  const inventoryStats = useMemo(() => {
    let data = closingStock.map(i => { 
        const mat = materials.find(m => String(m.description || '').toLowerCase().trim() === String(i.description || '').toLowerCase().trim()); 
        return { ...i, make: mat ? mat.make : 'Unspecified', group: mat ? mat.materialGroup : 'Unspecified' }; 
    });
    const uniqueMakes = Array.from(new Set(data.map(i => i.make))).sort();
    let dashboardData = data;
    if (selectedInvMake !== 'ALL') dashboardData = dashboardData.filter(i => i.make === selectedInvMake);
    const rawTotalVal = dashboardData.reduce((a, b) => a + (b.value || 0), 0);
    const rawTotalQty = dashboardData.reduce((a, b) => a + (b.quantity || 0), 0);
    const makeMap = new Map<string, number>();
    const groupMap = new Map<string, number>();
    dashboardData.forEach(i => {
        const makeKey = i.make || 'Unspecified';
        const groupKey = i.group || 'Unspecified';
        const val = invGroupMetric === 'value' ? (i.value || 0) : (i.quantity || 0);
        makeMap.set(makeKey, (makeMap.get(makeKey) || 0) + val);
        groupMap.set(groupKey, (groupMap.get(groupKey) || 0) + val);
    });
    let tableItems = [...dashboardData];
    if (invTableSearch) {
        const lower = invTableSearch.toLowerCase();
        tableItems = tableItems.filter(i => i.description.toLowerCase().includes(lower) || i.make.toLowerCase().includes(lower) || i.group.toLowerCase().includes(lower));
    }
    if (invTableSort) {
        tableItems.sort((a, b) => {
            const valA = (a as any)[invTableSort.key];
            const valB = (b as any)[invTableSort.key];
            if (valA < valB) return invTableSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return invTableSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return {
        totalVal: rawTotalVal, totalQty: rawTotalQty, count: dashboardData.length, items: tableItems, uniqueMakes,
        makeMix: Array.from(makeMap.entries()).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value),
        groupMix: Array.from(groupMap.entries()).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value),
        topStock: dashboardData.sort((a,b) => b.value - a.value).slice(0, 10).map(i => ({ label: i.description, value: i.value }))
    };
  }, [closingStock, materials, invGroupMetric, invTableSearch, invTableSort, selectedInvMake]);

  const soStats = useMemo(() => {
      const totalVal = pendingSO.reduce((a, b) => a + (b.value || 0), 0);
      const custMap = new Map<string, number>();
      const groupMap = new Map<string, number>();
      const itemSet = new Set<string>();
      const ageingMap = { '0-30d': 0, '31-60d': 0, '61-90d': 0, '90d+': 0 };
      let dueValue = 0; let scheduledValue = 0;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      pendingSO.forEach(i => {
          custMap.set(i.partyName, (custMap.get(i.partyName) || 0) + (i.value || 0));
          const itemName = i.itemName.trim(); itemSet.add(itemName.toLowerCase());
          const mat = materials.find(m => m.description.toLowerCase().trim() === itemName.toLowerCase());
          const group = mat ? mat.materialGroup : 'Unspecified';
          groupMap.set(group, (groupMap.get(group) || 0) + (i.value || 0));
          const days = i.overDueDays || 0;
          if (days <= 30) ageingMap['0-30d'] += (i.value || 0);
          else if (days <= 60) ageingMap['31-60d'] += (i.value || 0);
          else if (days <= 90) ageingMap['61-90d'] += (i.value || 0);
          else ageingMap['90d+'] += (i.value || 0);
          const dueDate = parseDate(i.dueDate);
          if (days > 0 || (dueDate.getTime() > 0 && dueDate <= today)) dueValue += (i.value || 0);
          else scheduledValue += (i.value || 0);
      });
      return { totalVal, dueValue, scheduledValue, count: pendingSO.length, uniqueItemCount: itemSet.size,
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
      const today = new Date(); today.setHours(0,0,0,0);
      const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
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
      return { totalVal, count: pendingPO.length,
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
      return { labels, series: [ 
            { name: selectedFY, data: getSeries(selectedFY), color: '#3b82f6', active: true }, 
            { name: `${startYear - 1}-${startYear}`, data: getSeries(`${startYear - 1}-${startYear}`), color: '#a855f7', active: true },
            { name: `${startYear - 2}-${startYear - 1}`, data: getSeries(`${startYear - 2}-${startYear - 1}`), color: '#f59e0b', active: true }
        ] 
      };
  }, [selectedFY, enrichedSales]);

  const chartMax = useMemo(() => Math.max(...lineChartData.series.flatMap(s => s.data), 1000) * 1.1, [lineChartData]);
  const formatAxisValue = (val: number) => { if(isNaN(val)) return '0'; if (val >= 10000000) return (val/10000000).toFixed(1) + 'Cr'; if (val >= 100000) return (val/100000).toFixed(1) + 'L'; if (val >= 1000) return (val/1000).toFixed(0) + 'k'; return Math.round(val).toString(); };
  const toggleSort = (key: string) => { let direction: 'asc' | 'desc' = 'asc'; if (invTableSort && invTableSort.key === key && invTableSort.direction === 'asc') direction = 'desc'; setInvTableSort({ key, direction }); };
  const renderSortIcon = (key: string) => { if (!invTableSort || invTableSort.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-300" />; return invTableSort.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />; };

  return (
    <div className="h-full w-full flex flex-col bg-gray-50/50 overflow-hidden relative">
      {selectedSoItem && (
          <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
                  <div className="bg-purple-600 px-6 py-4 flex justify-between items-center text-white">
                      <div className="flex items-center gap-2"><ClipboardList className="w-5 h-5" /><h3 className="font-bold text-lg uppercase tracking-tight">Sales Order Details</h3></div>
                      <button onClick={() => setSelectedSoItem(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div><p className="text-[10px] font-bold text-gray-400 uppercase">Order Number</p><p className="text-sm font-black text-gray-900">{selectedSoItem.orderNo}</p></div>
                          <div><p className="text-[10px] font-bold text-gray-400 uppercase">Order Date</p><p className="text-sm font-bold text-gray-700">{selectedSoItem.date}</p></div>
                      </div>
                      <div className="border-t border-gray-100 pt-4"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Customer / Party</p><p className="text-sm font-bold text-gray-900">{selectedSoItem.partyName}</p></div>
                      <div className="border-t border-gray-100 pt-4"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Item Details</p><p className="text-sm font-bold text-gray-800 leading-tight">{selectedSoItem.itemName}</p><p className="text-[10px] text-gray-500 font-mono mt-1">Part No: {selectedSoItem.partNo || '-'}</p></div>
                      <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-4">
                          <div><p className="text-[10px] font-bold text-gray-400 uppercase">Pending Qty</p><p className="text-base font-black text-purple-700">{selectedSoItem.balanceQty}</p></div>
                          <div><p className="text-[10px] font-bold text-gray-400 uppercase">Unit Rate</p><p className="text-sm font-bold text-gray-700">Rs. {selectedSoItem.rate.toLocaleString()}</p></div>
                          <div><p className="text-[10px] font-bold text-gray-400 uppercase">Order Value</p><p className="text-base font-black text-emerald-600">{formatLargeValue(selectedSoItem.value)}</p></div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center border border-gray-100">
                          <div><p className="text-[10px] font-bold text-gray-400 uppercase">Due Date</p><p className="text-sm font-black text-gray-900">{selectedSoItem.dueDate}</p></div>
                          {selectedSoItem.overDueDays > 0 && <div className="text-right"><span className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase ring-4 ring-red-50">{selectedSoItem.overDueDays} Days Overdue</span></div>}
                      </div>
                  </div>
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                      <button onClick={() => setSelectedSoItem(null)} className="px-5 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors uppercase tracking-widest shadow-xl active:scale-95">Close Details</button>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between flex-shrink-0 shadow-sm z-10">
          <div className="flex bg-gray-100 p-1 rounded-lg">{(['sales', 'inventory', 'so', 'po'] as const).map(tab => (<button key={tab} onClick={() => setActiveSubTab(tab)} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeSubTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{tab === 'so' ? 'Pending SO' : tab === 'po' ? 'Pending PO' : tab}</button>))}</div>
          {activeSubTab === 'sales' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg">{(['FY', 'MONTH', 'WEEK'] as const).map(v => (<button key={v} onClick={() => setTimeView(v)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}> {v} </button>))}</div>
              <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium">{uniqueFYs.length > 0 ? uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>) : <option value="">No FY Data</option>}</select>
              {timeView === 'MONTH' && (
                  <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium">
                      {["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
              )}
            </div>
          )}
          {activeSubTab === 'inventory' && (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Metric:</span>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setInvGroupMetric('value')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${invGroupMetric === 'value' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Value</button>
                        <button onClick={() => setInvGroupMetric('quantity')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${invGroupMetric === 'quantity' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Qty</button>
                    </div>
                </div>
            </div>
          )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        {activeSubTab === 'sales' ? (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard label={`Sales ${timeView === 'MONTH' ? 'Month' : 'FY'}`} value={formatLargeValue(kpis.sales.curr)} growth={kpis.sales.growth} />
                    <KPICard label="Quantity Sold" value={kpis.qty.curr.toLocaleString()} growth={kpis.qty.growth} />
                    <KPICard label="Unique Customers" value={kpis.custs.curr.toString()} growth={kpis.custs.growth} />
                    <KPICard label="Avg Order Value" value={formatLargeValue(kpis.avgOrder.curr)} growth={kpis.avgOrder.growth} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-96 overflow-hidden"><h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> 3-Year Trend Analysis</h3><div className="flex flex-1 pt-2 overflow-hidden"><div className="flex flex-col justify-between text-[9px] text-gray-400 pr-3 pb-8 text-right w-12 border-r"><span>{formatAxisValue(chartMax)}</span><span>{formatAxisValue(chartMax*0.5)}</span><span>0</span></div><div className="flex-1 pl-4 pb-2 relative min-h-0"><SalesTrendChart data={lineChartData} maxVal={chartMax} /></div></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-96 overflow-hidden"><SimpleDonut data={groupedCustomerData.map(g => ({ label: g.group, value: g.total }))} title="Sales Mix by Account Group" color="blue" isCurrency={true} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-96 overflow-hidden">
                        <HorizontalBarChart data={groupedCustomerData.map(g => ({ label: g.group, value: g.total, previous: g.totalPrevious }))} title="Top Account Groups (Current vs PY)" color="blue" />
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-96 overflow-hidden">
                        <GroupedCustomerAnalysis data={groupedCustomerData} />
                    </div>
                </div>
            </div>
        ) : activeSubTab === 'inventory' ? (
             <div className="flex flex-col gap-4">
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col gap-2">
                    <div className="flex items-center justify-between"><h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Factory className="w-3 h-3" /> Filter by Manufacturer</h4><span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{inventoryStats.count} Items Filtered</span></div>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        <button onClick={() => setSelectedInvMake('ALL')} className={`flex flex-col items-center justify-center min-w-[80px] h-[80px] p-2 rounded-xl border-2 transition-all shrink-0 ${selectedInvMake === 'ALL' ? 'bg-blue-50 border-blue-600 shadow-md' : 'bg-white border-gray-100 hover:border-blue-200'}`}><div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center mb-1.5 shadow-sm"><Globe className="w-5 h-5" /></div><span className={`text-[10px] font-black uppercase ${selectedInvMake === 'ALL' ? 'text-blue-700' : 'text-gray-500'}`}>All Brands</span></button>
                        {inventoryStats.uniqueMakes.map((make) => {
                            const logo = getBrandLogo(make);
                            return (
                                <button key={make} onClick={() => setSelectedInvMake(make)} className={`flex flex-col items-center justify-center min-w-[80px] h-[80px] p-2 rounded-xl border-2 transition-all shrink-0 ${selectedInvMake === make ? 'bg-blue-50 border-blue-600 shadow-md' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                                    <div className="w-10 h-10 rounded-lg bg-white overflow-hidden flex items-center justify-center mb-1.5 border border-gray-100 shadow-sm relative group">
                                        {logo ? <img src={logo} alt={make} className="w-8 h-8 object-contain" onError={(e) => { (e.target as any).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>'; }} /> : <Factory className="w-5 h-5 text-gray-400" />}
                                    </div>
                                    <span className={`text-[9px] font-black uppercase truncate w-full text-center ${selectedInvMake === make ? 'text-blue-700' : 'text-gray-500'}`}>{make}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Stock Value</p><h3 className="text-xl font-extrabold text-gray-900 mt-1">{formatLargeValue(inventoryStats.totalVal)}</h3></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Filtered Qty</p><h3 className="text-xl font-extrabold text-gray-900 mt-1">{inventoryStats.totalQty.toLocaleString()}</h3></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">SKUs in View</p><h3 className="text-xl font-extrabold text-gray-900 mt-1">{inventoryStats.count}</h3></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm min-h-[380px] flex flex-col"><SimpleDonut data={inventoryStats.makeMix} title={`Inventory by Make (${invGroupMetric === 'value' ? 'Val' : 'Qty'})`} color="green" isCurrency={invGroupMetric === 'value'} /></div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm min-h-[380px] flex flex-col"><SimpleDonut data={inventoryStats.groupMix} title={`Inventory by Group (${invGroupMetric === 'value' ? 'Val' : 'Qty'})`} color="blue" isCurrency={invGroupMetric === 'value'} /></div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm min-h-[380px] flex flex-col"><HorizontalBarChart data={inventoryStats.topStock} title="Top 10 High Value Stock Items" color="emerald" totalForPercentage={inventoryStats.totalVal} /></div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 gap-4"><h4 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Table className="w-4 h-4 text-emerald-600" />Detailed Inventory Snapshot</h4><div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto"><div className="relative w-full sm:w-64"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div><input type="text" placeholder="Search in table..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-[10px] focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow" value={invTableSearch} onChange={(e) => setInvTableSearch(e.target.value)} /></div><span className="text-[9px] font-black text-gray-400 uppercase whitespace-nowrap">{inventoryStats.items.length} of {inventoryStats.count} Shown</span></div></div>
                    <div className="overflow-x-auto max-h-96 custom-scrollbar"><table className="w-full text-left border-collapse min-w-[800px]"><thead className="sticky top-0 z-10 bg-gray-100/90 backdrop-blur-md shadow-sm border-b border-gray-200"><tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest cursor-pointer select-none"><th className="py-3 px-4 hover:bg-gray-200 transition-colors" onClick={() => toggleSort('description')}><div className="flex items-center gap-1">Description {renderSortIcon('description')}</div></th><th className="py-3 px-4 hover:bg-gray-200 transition-colors" onClick={() => toggleSort('make')}><div className="flex items-center gap-1">Make {renderSortIcon('make')}</div></th><th className="py-3 px-4 hover:bg-gray-200 transition-colors" onClick={() => toggleSort('group')}><div className="flex items-center gap-1">Group {renderSortIcon('group')}</div></th><th className="py-3 px-4 text-right hover:bg-gray-200 transition-colors" onClick={() => toggleSort('quantity')}><div className="flex items-center justify-end gap-1">Quantity {renderSortIcon('quantity')}</div></th><th className="py-3 px-4 text-right hover:bg-gray-200 transition-colors" onClick={() => toggleSort('rate')}><div className="flex items-center justify-end gap-1">Rate {renderSortIcon('rate')}</div></th><th className="py-3 px-4 text-right hover:bg-gray-200 transition-colors" onClick={() => toggleSort('value')}><div className="flex items-center justify-end gap-1">Value {renderSortIcon('value')}</div></th></tr></thead><tbody className="divide-y divide-gray-100 text-xs text-gray-700">{inventoryStats.items.length === 0 ? (<tr><td colSpan={6} className="py-20 text-center text-gray-400 font-bold italic">No matching records found.</td></tr>) : inventoryStats.items.map((item, idx) => (<tr key={idx} className="hover:bg-blue-50/20 transition-colors"><td className="py-2.5 px-4 font-medium text-gray-900 max-w-xs truncate" title={item.description}>{item.description}</td><td className="py-2.5 px-4"><span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-gray-100 text-gray-700 border border-gray-200">{item.make}</span></td><td className="py-2.5 px-4 text-gray-500">{item.group}</td><td className="py-2.5 px-4 text-right font-mono">{item.quantity.toLocaleString()}</td><td className="py-2.5 px-4 text-right font-mono text-gray-400">{item.rate.toFixed(2)}</td><td className="py-2.5 px-4 text-right font-black text-emerald-700">{formatLargeValue(item.value, true)}</td></tr>))}</tbody></table></div>
                </div>
             </div>
        ) : activeSubTab === 'so' ? (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group"><div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign className="w-12 h-12" /></div><p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider mb-1">Total Pending SO</p><h3 className="text-xl font-black text-gray-900">{formatLargeValue(soStats.totalVal)}</h3><div className="mt-2 pt-2 border-t border-gray-50 flex flex-col gap-1"><div className="flex justify-between items-center text-[9px]"><span className="text-red-500 font-bold uppercase">Due: {formatLargeValue(soStats.dueValue, true)}</span><span className="text-blue-500 font-bold uppercase">Sch: {formatLargeValue(soStats.scheduledValue, true)}</span></div><div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden flex"><div className="bg-red-500 h-full" style={{ width: `${(soStats.dueValue / (soStats.totalVal || 1)) * 100}%` }}></div><div className="bg-blue-500 h-full" style={{ width: `${(soStats.scheduledValue / (soStats.totalVal || 1)) * 100}%` }}></div></div></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1">Open Lines</p><h3 className="text-xl font-black text-gray-900">{soStats.count}</h3></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mb-1">Unique Items</p><h3 className="text-xl font-black text-gray-900">{soStats.uniqueItemCount}</h3></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-1">Overdue Orders</p><h3 className="text-xl font-black text-red-600">{pendingSO.filter(i => i.overDueDays > 0).length}</h3></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-[10px] text-teal-600 font-bold uppercase tracking-wider mb-1">Unique Customers</p><h3 className="text-xl font-black text-gray-900">{soStats.custMix.length}</h3></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col"><SimpleDonut data={soStats.ageing} title="SO Ageing Analysis" color="blue" isCurrency={true} /></div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col"><SimpleDonut data={soStats.groupMix} title="SO by Material Group" color="green" isCurrency={true} /></div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col"><SimpleDonut data={soStats.custMix} title="Customer Concentration" color="blue" isCurrency={true} /></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-96 flex flex-col"><div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50"><h4 className="text-[11px] font-black text-gray-600 uppercase flex items-center gap-2"><ListOrdered className="w-4 h-4 text-purple-600" /> Top 10 High Value SOs</h4><span className="text-[9px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100 animate-pulse">Click Value for Details</span></div><div className="flex-1 overflow-x-auto"><table className="w-full text-[10px] text-left"><thead className="bg-gray-50 text-gray-500 uppercase font-bold border-b border-gray-100"><tr><th className="py-3 px-4">Customer</th><th className="py-3 px-4">Item</th><th className="py-3 px-4 text-right">Qty</th><th className="py-3 px-4 text-right">Value</th></tr></thead><tbody className="divide-y divide-gray-50">{soStats.topItems.map(i => (<tr key={i.id} className="hover:bg-purple-50 group cursor-default"><td className="py-3 px-4 font-medium text-gray-800 truncate max-w-[120px]">{i.partyName}</td><td className="py-3 px-4 truncate max-w-[150px] text-gray-600">{i.itemName}</td><td className="py-3 px-4 text-right font-mono">{i.balanceQty}</td><td className="py-3 px-4 text-right"><button onClick={() => setSelectedSoItem(i)} className="font-black text-purple-700 bg-purple-50 px-2 py-1 rounded border border-transparent hover:border-purple-300 hover:bg-white transition-all shadow-sm">{formatLargeValue(i.value, true)}</button></td></tr>))}</tbody></table></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-96"><HorizontalBarChart data={soStats.custMix} title="Pending SO by Customer" color="blue" /></div>
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
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col"><SimpleDonut data={poStats.dueMix} title="PO Delivery Schedule" color="green" isCurrency={true} /></div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col"><SimpleDonut data={poStats.groupMix} title="PO by Material Group" color="blue" isCurrency={true} /></div>
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col"><SimpleDonut data={poStats.vendorMix} title="Vendor Concentration" color="green" isCurrency={true} /></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-96"><h4 className="text-[11px] font-bold text-gray-600 uppercase mb-4 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-orange-600" /> Top 10 High Value Open POs</h4><div className="overflow-x-auto"><table className="w-full text-[10px] text-left"><thead className="bg-gray-50 text-gray-500 uppercase font-bold border-b border-gray-100"><tr><th className="py-2 px-2">Vendor</th><th className="py-2 px-2">Item</th><th className="py-2 px-2 text-right">Qty</th><th className="py-2 px-2 text-right">Value</th></tr></thead><tbody className="divide-y divide-gray-50">{poStats.topItems.map(i => (<tr key={i.id} className="hover:bg-gray-50"><td className="py-2 px-2 font-medium truncate max-w-[120px]">{i.partyName}</td><td className="py-2 px-2 truncate max-w-[150px]">{i.itemName}</td><td className="py-2 px-2 text-right">{i.balanceQty}</td><td className="py-2 px-2 text-right font-bold text-orange-700">{formatLargeValue(i.value, true)}</td></tr>))}</tbody></table></div></div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-96"><HorizontalBarChart data={poStats.vendorMix} title="Pending PO by Vendor" color="emerald" /></div>
                </div>
            </div>
        ) : null}
      </div>
    </div>
  );
};

export default DashboardView;
