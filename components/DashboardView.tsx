import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem, SalesRecord } from '../types';
import { TrendingUp, TrendingDown, Package, ClipboardList, ShoppingCart, Calendar, Filter, PieChart as PieIcon, BarChart3, Users, ArrowRight, Activity, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, UserCircle, Minus, Plus, ChevronDown, ChevronUp, Link2Off, AlertTriangle, Layers, Clock, CheckCircle2, AlertCircle, User, Factory, Tag, ArrowLeft, BarChart4, Hourglass, History, AlertOctagon, ChevronRight, ListOrdered, Table, X, ArrowUp, ArrowDown, Search, ArrowUpDown, FileText, UserPlus } from 'lucide-react';
import MOMView from './MOMView';
import AttendeeMasterView from './AttendeeMasterView';
import { momService } from '../services/momService';

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
    const lowerG = g.toLowerCase();
    if (lowerG.includes('group-1') || lowerG.includes('peenya')) return 'Group-1 Giridhar';
    if (lowerG.includes('group -4 office') || lowerG.includes('group-4') || lowerG.includes('dcv')) return 'Group - Office';
    if (lowerG.includes('online')) return 'Online';
    return g;
};

const getMergedMakeName = (makeName: string) => {
    const m = String(makeName || 'Unspecified').trim();
    const lowerM = m.toLowerCase();
    if (lowerM.includes('lapp')) return 'LAPP';
    if (lowerM.includes('luker')) return 'Luker';
    return m;
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
    const chartId = useMemo(() => Math.random().toString(36).substring(7), []);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const labelCount = data.labels.length;
        if (labelCount < 1) return;
        const idx = Math.round((x / width) * (labelCount - 1));
        const clampedIdx = Math.max(0, Math.min(idx, labelCount - 1));
        setHoverIndex(clampedIdx);
    };

    const labelCount = data.labels.length;
    const chartMax = Math.max(maxVal, 1);

    return (
        <div
            className="flex flex-col h-full select-none cursor-crosshair overflow-visible px-4"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
        >
            <div className="flex-1 relative min-h-0 pt-6">
                {/* Value Tags for peaks - only for active series */}
                {data.series.map((s: any, sIdx: number) =>
                    s.active && s.data.map((val: number, i: number) => {
                        if (val === 0 || isNaN(val)) return null;
                        const x = (i / (labelCount - 1)) * 100;
                        const y = 100 - ((val / chartMax) * 100);
                        const isHovered = hoverIndex === i;
                        return (
                            <div
                                key={`${sIdx}-${i}`}
                                className={`absolute text-[8px] font-bold bg-white/95 px-1 rounded shadow-sm border border-gray-100 z-10 pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all duration-200 ${isHovered ? 'scale-125 z-20 border-blue-200' : 'opacity-80'}`}
                                style={{ left: `${x}%`, top: `${y}%`, color: s.color, opacity: hoverIndex !== null && hoverIndex !== i ? 0.2 : 1 }}
                            >
                                {formatLargeValue(val, true)}
                            </div>
                        );
                    })
                )}

                {/* Tooltip */}
                {hoverIndex !== null && (
                    <div className="absolute z-30 bg-gray-900/95 backdrop-blur-md text-white text-[10px] p-3 rounded-xl shadow-2xl border border-gray-700 pointer-events-none transition-all duration-100 ease-out min-w-[140px]" style={{ left: `${(hoverIndex / (labelCount - 1)) * 100}%`, top: '0', transform: `translateX(${hoverIndex > labelCount / 2 ? '-110%' : '10%'})` }}>
                        <div className="font-bold border-b border-gray-600 pb-2 mb-2 text-gray-100 text-center uppercase tracking-wider text-[11px]">{data.labels[hoverIndex]}</div>
                        <div className="flex flex-col gap-2">
                            {data.series.map((s: any, i: number) => (
                                <div key={i} className={`flex items-center justify-between gap-4 ${!s.active ? 'opacity-50' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></div>
                                        <span className="text-gray-300 font-medium whitespace-nowrap">{s.name}</span>
                                    </div>
                                    <span className="font-mono font-bold text-white text-xs">{formatLargeValue(s.data[hoverIndex], true)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* SVG Chart */}
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="1.5" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                        {data.series.map((s: any, i: number) => (
                            <linearGradient key={i} id={`grad-${chartId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={s.color} stopOpacity="0.4" />
                                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                            </linearGradient>
                        ))}
                    </defs>

                    {/* X-Axis Rule */}
                    <line x1="0" y1="100" x2="100" y2="100" stroke="#f3f4f6" strokeWidth="1" vectorEffect="non-scaling-stroke" />

                    {data.series.map((s: any, i: number) => {
                        if (!s.active) return null;
                        const points: [number, number][] = s.data.map((val: number, idx: number) => [(idx / (labelCount - 1)) * 100, 100 - ((val / chartMax) * 100)]).filter((p: any) => !isNaN(p[1]));
                        if (points.length < 2) return null;
                        const pathD = getSmoothPath(points) || `M ${points.map(p => p.join(',')).join(' L ')}`;
                        return (
                            <g key={i}>
                                <path d={`${pathD} L 100 100 L 0 100 Z`} fill={`url(#grad-${chartId}-${i})`} className="transition-opacity duration-500" style={{ opacity: hoverIndex !== null ? 0.8 : 0.6 }} />
                                <path d={pathD} fill="none" stroke={s.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" className="transition-all duration-300" />
                                {points.length === 1 && (
                                    <circle cx={points[0][0]} cy={points[0][1]} r="2" fill="white" stroke={s.color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                                )}
                            </g>
                        )
                    })}
                </svg>
            </div>

            {/* X-Axis Labels Row */}
            <div className="h-6 relative mt-2 border-t border-gray-100">
                {data.labels.map((label, i) => {
                    const labelCount = data.labels.length;
                    const skip = labelCount > 15 && i % 5 !== 0 && i !== labelCount - 1;
                    if (skip) return null;
                    const x = (i / (labelCount - 1)) * 100;
                    return (
                        <div key={i} className="absolute top-0 flex flex-col items-center transform -translate-x-1/2" style={{ left: `${x}%` }}>
                            <div className="h-1.5 w-px bg-gray-300 mb-1" />
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter whitespace-nowrap">{label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ModernDonutChartDashboard: React.FC<{
    data: { label: string; value: number; color?: string }[],
    title: string,
    isCurrency?: boolean,
    centerColorClass?: string
}> = ({ data, title, isCurrency, centerColorClass }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    if (data.length === 0) return <div className="h-48 flex items-center justify-center text-gray-400 text-[10px] font-bold uppercase">No records found</div>;

    const total = data.reduce((a, b) => a + (b.value || 0), 0);
    const colorPalette = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#6B7280', '#059669', '#2563EB'];

    let cumulativePercent = 0;
    const slices = data.map((slice, i) => {
        const percent = slice.value / (total || 1);
        const startPercent = cumulativePercent;
        cumulativePercent += percent;
        return {
            ...slice,
            percent,
            startPercent,
            color: slice.color || colorPalette[i % colorPalette.length]
        };
    });

    const getCoordinatesForPercent = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    const centerLabel = hoveredIndex !== null ? slices[hoveredIndex].label : 'Total';
    const centerValue = hoveredIndex !== null ?
        (isCurrency ? formatLargeValue(slices[hoveredIndex].value, true) : Math.round(slices[hoveredIndex].value).toLocaleString()) :
        formatLargeValue(total, true);

    return (
        <div className="flex flex-col h-full">
            <h4 className="text-[11px] font-black text-gray-600 uppercase mb-3 border-b border-gray-50 pb-2 flex items-center gap-2">
                <PieIcon className="w-3.5 h-3.5 text-blue-500" />
                {title}
            </h4>
            <div className="flex flex-col items-center gap-4 flex-1 min-h-0">
                <div className="relative w-36 h-36 flex-shrink-0 group">
                    <div className="absolute inset-0 bg-gray-100 rounded-full scale-95 opacity-50"></div>
                    <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.1)] relative z-10">
                        {slices.map((slice, i) => {
                            if (slice.percent >= 0.999) return <circle key={i} cx="0" cy="0" r="0.85" fill="none" stroke={slice.color} strokeWidth="0.3" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} className="transition-all cursor-pointer hover:opacity-80" />;
                            const [startX, startY] = getCoordinatesForPercent(slice.startPercent);
                            const [endX, endY] = getCoordinatesForPercent(slice.startPercent + slice.percent);
                            const largeArcFlag = slice.percent > 0.5 ? 1 : 0;
                            return (
                                <path
                                    key={i}
                                    d={`M ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L ${endX * 0.72} ${endY * 0.72} A 0.72 0.72 0 ${largeArcFlag} 0 ${startX * 0.72} ${startY * 0.72} Z`}
                                    fill={slice.color}
                                    className={`transition-all duration-400 cursor-pointer ${hoveredIndex === i ? 'opacity-100 scale-[1.05] stroke-[0.03] stroke-white shadow-2xl' : 'opacity-90 hover:opacity-100 hover:scale-[1.03]'}`}
                                    onMouseEnter={() => setHoveredIndex(i)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                />
                            );
                        })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center z-20">
                        <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest truncate w-full mb-0.5">{centerLabel}</span>
                        <span className={`text-[12px] font-black leading-tight drop-shadow-sm transition-all duration-300 ${hoveredIndex !== null ? 'scale-110' : ''} ${centerColorClass || 'text-gray-900'}`}>{centerValue}</span>
                    </div>
                </div>

                <div className="flex-1 w-full overflow-y-auto custom-scrollbar pr-1">
                    <div className="space-y-1">
                        {slices.map((item, i) => (
                            <div
                                key={i}
                                className={`flex items-center justify-between text-[10px] p-1 rounded transition-all cursor-pointer ${hoveredIndex === i ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                                onMouseEnter={() => setHoveredIndex(i)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: item.color }}></span>
                                    <span className={`truncate font-bold ${hoveredIndex === i ? 'text-gray-900' : 'text-gray-600'}`} title={String(item.label)}>{item.label}</span>
                                </div>
                                <div className="flex gap-2 items-center flex-shrink-0 ml-2">
                                    <span className="text-gray-400 font-bold text-[9px]">{total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%</span>
                                    <span className={`font-black text-right w-16 ${hoveredIndex === i ? 'text-blue-600' : 'text-gray-900'}`}>{isCurrency ? formatLargeValue(item.value, true) : Math.round(item.value).toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


const HorizontalBarChart = ({
    data,
    title,
    color,
    totalForPercentage,
    compareLabel = 'PY',
    isStacked = false,
    secondaryLabel = 'Scheduled'
}: {
    data: { label: string; value: number, secondaryValue?: number, previous?: number, share?: number }[],
    title: string,
    color: string,
    totalForPercentage?: number,
    compareLabel?: string,
    isStacked?: boolean,
    secondaryLabel?: string
}) => {
    const sorted = [...data].sort((a, b) => ((b.value || 0) + (b.secondaryValue || 0)) - ((a.value || 0) + (a.secondaryValue || 0))).slice(0, 10);
    const maxVal = Math.max(sorted[0] ? (sorted[0].value + (sorted[0].secondaryValue || 0)) : 1, 1);
    const barColorClass = (color === 'blue' && isStacked) ? 'bg-red-500' : color === 'blue' ? 'bg-blue-500' : color === 'emerald' ? 'bg-emerald-500' : color === 'purple' ? 'bg-purple-500' : color === 'rose' ? 'bg-rose-500' : 'bg-orange-500';
    const secondaryColorClass = (color === 'blue' && isStacked) ? 'bg-blue-500' : color === 'blue' ? 'bg-indigo-300' : color === 'emerald' ? 'bg-teal-300' : 'bg-gray-300';

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2 border-b border-gray-100 pb-1 flex justify-between items-center">
                <span>{title}</span>
                {isStacked && (
                    <div className="flex gap-2 items-center">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-red-500"></div><span className="text-[8px]">Due</span></div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-blue-500"></div><span className="text-[8px]">{secondaryLabel}</span></div>
                    </div>
                )}
            </h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1.5 mt-0.5">
                <div className="flex flex-col gap-2.5">
                    {sorted.map((item, i) => {
                        const total = item.value + (item.secondaryValue || 0);
                        return (
                            <div key={i} className="flex flex-col gap-1">
                                <div className="flex justify-between items-center text-[10px]">
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-gray-700 font-bold" title={String(item.label)}>{item.label}</span>
                                            {(item.share !== undefined || totalForPercentage !== undefined) && (
                                                <span className="text-[9px] bg-gray-100 px-1 rounded font-black text-gray-500">
                                                    {item.share !== undefined ? item.share.toFixed(1) : ((total / (totalForPercentage || 1)) * 100).toFixed(1)}%
                                                </span>
                                            )}
                                        </div>
                                        {isStacked && (
                                            <div className="flex gap-2 text-[8px] font-bold">
                                                <span className="text-red-600">D: {formatLargeValue(item.value, true)}</span>
                                                <span className="text-blue-500">S: {formatLargeValue(item.secondaryValue || 0, true)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="font-bold text-gray-900 flex-shrink-0 bg-white pl-1">{formatLargeValue(total, true)}</span>
                                </div>
                                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden relative flex">
                                    {item.previous !== undefined && (
                                        <div className="absolute inset-0 bg-gray-200/50" style={{ width: `${(item.previous / maxVal) * 100}%` }}></div>
                                    )}
                                    <div className={`h-full ${barColorClass} transition-all duration-700 relative z-10`} style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                                    {item.secondaryValue !== undefined && (
                                        <div className={`h-full ${secondaryColorClass} transition-all duration-700 relative z-10`} style={{ width: `${(item.secondaryValue / maxVal) * 100}%` }}></div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const GroupedCustomerAnalysis = ({ data, compareLabel = 'PY' }: { data: { group: string, total: number, totalPrevious: number, customers: { name: string, current: number, previous: number, diff: number }[] }[], compareLabel?: string }) => {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const toggleGroup = (group: string) => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2 border-b border-gray-100 pb-1">Analytics (vs {compareLabel})</h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1.5 space-y-1.5">
                {data.map((groupData) => (
                    <div key={groupData.group} className="border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
                        <button onClick={() => toggleGroup(groupData.group)} className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-blue-50 transition-colors">
                            <div className="flex items-center gap-2">
                                {expandedGroups[groupData.group] ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                <span className="text-xs font-bold text-gray-800 uppercase tracking-tight">{groupData.group}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-blue-700">{formatLargeValue(groupData.total, true)}</span>
                                <div className="flex items-center gap-1.5 leading-none">
                                    <span className="text-[8px] text-gray-400 uppercase font-medium">{compareLabel}: {formatLargeValue(groupData.totalPrevious, true)}</span>
                                    <span className={`text-[8px] font-bold px-1 rounded-sm ${groupData.total >= groupData.totalPrevious ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                        {groupData.totalPrevious > 0 ? (((groupData.total - groupData.totalPrevious) / groupData.totalPrevious) * 100).toFixed(0) : '100'}%
                                    </span>
                                </div>
                            </div>
                        </button>
                        {expandedGroups[groupData.group] && (
                            <div className="divide-y divide-gray-50 bg-white">
                                {groupData.customers.map((cust, idx) => (
                                    <div key={idx} className="p-2 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-bold text-gray-700 truncate w-3/5" title={cust.name}>{cust.name}</span>
                                            <span className="text-[10px] font-black text-gray-900">{formatLargeValue(cust.current, true)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] text-gray-400 uppercase font-medium">{compareLabel}:</span>
                                                <span className="text-[9px] text-gray-500 font-mono">{formatLargeValue(cust.previous, true)}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <div className={`flex items-center gap-0.5 text-[9px] font-bold ${cust.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {cust.diff >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                                    <span>{formatLargeValue(Math.abs(cust.diff), true)}</span>
                                                </div>
                                                <span className={`text-[8px] font-bold ${cust.diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {cust.previous > 0 ? ((cust.diff / cust.previous) * 100).toFixed(0) : '100'}%
                                                </span>
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
    const [activeSubTab, setActiveSubTab] = useState<'sales' | 'inventory' | 'so' | 'po' | 'weekly'>('sales');
    const [relatedMomId, setRelatedMomId] = useState<string | null>(null);
    const [weeklyBenchmarks, setWeeklyBenchmarks] = useState<{ [key: string]: any }>(() => {
        const saved = localStorage.getItem('weeklyBenchmarks');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        localStorage.setItem('weeklyBenchmarks', JSON.stringify(weeklyBenchmarks));
    }, [weeklyBenchmarks]);

    useEffect(() => {
        const loadBenchmarksFromMOM = async () => {
            if (activeSubTab === 'weekly') {
                const moms = await momService.getAll();
                if (moms && moms.length > 0) {
                    // Find the most recent MOM before targetDate
                    const target = new Date(2026, 0, 1); // Matching hardcoded targetDate
                    const pastMoms = moms
                        .filter(m => new Date(m.date) < target && m.benchmarks)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    if (pastMoms.length > 0) {
                        setRelatedMomId(pastMoms[0].id);
                        if (pastMoms[0].benchmarks) {
                            setWeeklyBenchmarks(prev => ({
                                ...prev,
                                ...pastMoms[0].benchmarks
                            }));
                        }
                    }
                }
            }
        };
        loadBenchmarksFromMOM();
    }, [activeSubTab]);
    const [timeView, setTimeView] = useState<'FY' | 'MONTH' | 'WEEK'>('FY');
    const [selectedFY, setSelectedFY] = useState<string>('');
    const [invGroupMetric, setInvGroupMetric] = useState<Metric>('value');
    const [selectedMonth, setSelectedMonth] = useState<number>(0);
    const [selectedWeek, setSelectedWeek] = useState<number>(1);
    const [selectedMake, setSelectedMake] = useState<string>('ALL');
    const [selectedMatGroup, setSelectedMatGroup] = useState<string>('ALL');
    const [selectedSoItem, setSelectedSoItem] = useState<PendingSOItem | null>(null);
    const [invSearchTerm, setInvSearchTerm] = useState<string>('');
    const [invSortKey, setInvSortKey] = useState<string>('value');
    const [invSortOrder, setInvSortOrder] = useState<'asc' | 'desc'>('desc');
    const [groupingMode, setGroupingMode] = useState<'RAW' | 'MERGED'>('MERGED');

    const parseDate = (val: any): Date => {
        if (!val) return new Date();
        let d: Date;
        if (val instanceof Date) {
            d = new Date(val);
        } else if (typeof val === 'number') {
            d = new Date((Math.round(val) - 25568) * 86400 * 1000);
        } else if (typeof val === 'string') {
            d = new Date(val);
            if (isNaN(d.getTime())) {
                const parts = val.split(/[-/.]/);
                if (parts.length === 3) {
                    if (parts[0].length === 4) {
                        // YYYY-MM-DD
                        const d2 = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        d = !isNaN(d2.getTime()) ? d2 : new Date();
                    } else {
                        // DD-MM-YYYY or DD-MM-YY
                        let y = parseInt(parts[2]);
                        if (y < 100) y += 2000;
                        const d2 = new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0]));
                        d = !isNaN(d2.getTime()) ? d2 : new Date();
                    }
                } else {
                    d = new Date();
                }
            }
        } else {
            d = new Date(val);
        }
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const getFiscalInfo = (date: Date) => {
        if (!date || isNaN(date.getTime())) return { fiscalYear: 'N/A', fiscalMonthIndex: 0, weekNumber: 0 };
        const month = date.getMonth();
        const year = date.getFullYear();
        const startYear = month >= 3 ? year : year - 1;
        const fiscalYear = `${startYear}-${startYear + 1}`;
        const fiscalMonthIndex = month >= 3 ? month - 3 : month + 9;

        // Define weeks starting on Thursday and ending on Wednesday
        // Find the Thursday on or before April 1st of the current fiscal year
        const fyStart = new Date(startYear, 3, 1);
        const day = fyStart.getDay(); // 0=Sun, 4=Thu
        const daysToSubtract = (day >= 4) ? (day - 4) : (day + 3);
        const refThursday = new Date(fyStart);
        refThursday.setDate(fyStart.getDate() - daysToSubtract);
        refThursday.setHours(0, 0, 0, 0);

        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        const diffTime = targetDate.getTime() - refThursday.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

        // Week 1 starts on the Thursday on or before April 1st
        const weekNumber = Math.max(1, Math.floor(diffDays / 7) + 1);

        return { fiscalYear, fiscalMonthIndex, weekNumber };
    };

    const enrichedSales = useMemo(() => {
        const custMap = new Map<string, CustomerMasterItem>();
        customers.forEach(c => { if (c.customerName) custMap.set(String(c.customerName).toLowerCase().trim(), c); });

        const matByPartNo = new Map<string, { make: string, group: string }>();
        const matByDesc = new Map<string, { make: string, group: string }>();

        materials.forEach(m => {
            const info = { make: m.make, group: m.materialGroup };
            if (m.partNo) matByPartNo.set(String(m.partNo).toLowerCase().trim(), info);
            if (m.description) matByDesc.set(String(m.description).toLowerCase().trim(), info);
        });

        return salesReportItems.map(item => {
            const dateObj = parseDate(item.date);
            const fi = getFiscalInfo(dateObj);
            const cust = custMap.get(String(item.customerName || '').toLowerCase().trim());

            const rawGroup = cust?.customerGroup || 'Unassigned';
            const mergedGroup = getMergedGroupName(cust?.group || 'Unassigned');
            const custGroupName = groupingMode === 'RAW' ? rawGroup : mergedGroup;

            const searchKey = String(item.particulars || '').toLowerCase().trim();
            const matInfo = matByPartNo.get(searchKey) || matByDesc.get(searchKey);

            const rawMake = matInfo?.make || 'Unspecified';
            const mergedMake = getMergedMakeName(rawMake);

            return {
                ...item,
                ...fi,
                rawDate: dateObj,
                custGroup: custGroupName,
                custStatus: cust?.status || 'Unknown',
                make: mergedMake,
                matGroup: matInfo?.group || 'Unspecified'
            };
        });
    }, [salesReportItems, customers, materials, groupingMode]);

    const uniqueFYs = useMemo(() => Array.from(new Set(enrichedSales.map(i => i.fiscalYear))).filter(f => f !== 'N/A').sort().reverse(), [enrichedSales]);
    const uniqueMakes = useMemo(() => {
        // Collect all makes from materials and sales
        const allMakes = new Set<string>();
        materials.forEach(m => allMakes.add(getMergedMakeName(m.make)));
        enrichedSales.forEach(s => allMakes.add(s.make));

        let filtered = Array.from(allMakes);
        if (selectedMatGroup !== 'ALL') {
            const validMakes = new Set<string>();
            materials.forEach(m => {
                if (m.materialGroup === selectedMatGroup) validMakes.add(getMergedMakeName(m.make));
            });
            enrichedSales.forEach(s => {
                if (s.matGroup === selectedMatGroup) validMakes.add(s.make);
            });
            filtered = filtered.filter(m => validMakes.has(m));
        }
        return ['ALL', ...filtered.filter(m => m !== 'Unspecified' && m !== 'Unassigned').sort()];
    }, [materials, enrichedSales, selectedMatGroup]);

    const uniqueMatGroups = useMemo(() => {
        // Collect all groups from materials and sales
        const allGroups = new Set<string>();
        materials.forEach(m => allGroups.add(m.materialGroup));
        enrichedSales.forEach(s => allGroups.add(s.matGroup));

        let filtered = Array.from(allGroups);
        if (selectedMake !== 'ALL') {
            const validGroups = new Set<string>();
            materials.forEach(m => {
                if (getMergedMakeName(m.make) === selectedMake) validGroups.add(m.materialGroup);
            });
            enrichedSales.forEach(s => {
                if (s.make === selectedMake) validGroups.add(s.matGroup);
            });
            filtered = filtered.filter(g => validGroups.has(g));
        }
        return ['ALL', ...filtered.filter(g => g !== 'Unspecified' && g !== 'Unassigned').sort()];
    }, [materials, enrichedSales, selectedMake]);

    useEffect(() => {
        if (selectedMake !== 'ALL' && !uniqueMakes.includes(selectedMake)) {
            setSelectedMake('ALL');
        }
    }, [uniqueMakes, selectedMake]);

    useEffect(() => {
        if (selectedMatGroup !== 'ALL' && !uniqueMatGroups.includes(selectedMatGroup)) {
            setSelectedMatGroup('ALL');
        }
    }, [uniqueMatGroups, selectedMatGroup]);

    useEffect(() => {
        if (uniqueFYs.length > 0 && (!selectedFY || !uniqueFYs.includes(selectedFY))) {
            // Initialize to current period info
            const today = new Date();
            const info = getFiscalInfo(today);

            if (uniqueFYs.includes(info.fiscalYear)) {
                setSelectedFY(info.fiscalYear);
            } else {
                setSelectedFY(uniqueFYs[0]);
            }
            setSelectedMonth(info.fiscalMonthIndex);
            setSelectedWeek(info.weekNumber);
        }
    }, [uniqueFYs, selectedFY]);

    const currentData = useMemo(() => {
        return enrichedSales.filter(i => {
            if (i.fiscalYear !== selectedFY) return false;
            if (timeView === 'MONTH' && i.fiscalMonthIndex !== selectedMonth) return false;
            if (timeView === 'WEEK' && i.weekNumber !== selectedWeek) return false;
            if (selectedMake !== 'ALL' && i.make !== selectedMake) return false;
            if (selectedMatGroup !== 'ALL' && i.matGroup !== selectedMatGroup) return false;
            return true;
        });
    }, [selectedFY, selectedMonth, selectedWeek, timeView, enrichedSales, selectedMake, selectedMatGroup]);

    const previousDataForComparison = useMemo(() => {
        if (!selectedFY) return [];
        const parts = selectedFY.split('-');
        const pyStart = parseInt(parts[0]) - 1;
        const pyString = `${pyStart}-${pyStart + 1}`;

        let data = [];
        if (timeView === 'WEEK') {
            const isWeek1 = selectedWeek === 1;
            const targetFY = isWeek1 ? pyString : selectedFY;
            const targetWeek = isWeek1 ? 52 : selectedWeek - 1;
            data = enrichedSales.filter(i => i.fiscalYear === targetFY && i.weekNumber === targetWeek);
        } else if (timeView === 'MONTH') {
            const isMonth0 = selectedMonth === 0;
            const targetFY = isMonth0 ? pyString : selectedFY;
            const targetMonth = isMonth0 ? 11 : selectedMonth - 1;
            data = enrichedSales.filter(i => i.fiscalYear === targetFY && i.fiscalMonthIndex === targetMonth);
        } else {
            data = enrichedSales.filter(i => i.fiscalYear === pyString);
        }

        if (selectedMake !== 'ALL') data = data.filter(i => i.make === selectedMake);
        if (selectedMatGroup !== 'ALL') data = data.filter(i => i.matGroup === selectedMatGroup);
        return data;
    }, [selectedFY, timeView, selectedMonth, selectedWeek, enrichedSales, selectedMake, selectedMatGroup]);

    const yoyData = useMemo(() => {
        if (!selectedFY) return [];
        const parts = selectedFY.split('-');
        const pyStart = parseInt(parts[0]) - 1;
        const pyString = `${pyStart}-${pyStart + 1}`;

        let data = enrichedSales.filter(i => i.fiscalYear === pyString);

        if (timeView === 'MONTH') {
            data = data.filter(i => i.fiscalMonthIndex === selectedMonth);
        } else if (timeView === 'WEEK') {
            data = data.filter(i => i.weekNumber === selectedWeek);
        } else {
            // FY view: Filter previous year to only include months present in currentData (YTD comparison)
            const currentMonths = new Set(currentData.map(i => i.fiscalMonthIndex));
            data = data.filter(i => currentMonths.has(i.fiscalMonthIndex));
        }

        if (selectedMake !== 'ALL') data = data.filter(i => i.make === selectedMake);
        if (selectedMatGroup !== 'ALL') data = data.filter(i => i.matGroup === selectedMatGroup);
        return data;
    }, [selectedFY, currentData, timeView, selectedMonth, selectedWeek, enrichedSales, selectedMake, selectedMatGroup]);

    const kpis = useMemo(() => {
        const currVal = currentData.reduce((acc, i) => acc + (i.value || 0), 0);
        const currQty = currentData.reduce((acc, i) => acc + (i.quantity || 0), 0);
        const uniqueCusts = new Set(currentData.map(i => String(i.customerName || ''))).size;
        const uniqueVouchers = new Set(currentData.map(i => String(i.voucherNo || ''))).size;
        const avgOrder = uniqueVouchers ? currVal / uniqueVouchers : 0;

        const prevVal = previousDataForComparison.reduce((acc, i) => acc + (i.value || 0), 0);
        const prevQty = previousDataForComparison.reduce((acc, i) => acc + (i.quantity || 0), 0);
        const prevCusts = new Set(previousDataForComparison.map(i => String(i.customerName || ''))).size;
        const prevVouchers = new Set(previousDataForComparison.map(i => String(i.voucherNo || ''))).size;
        const prevAvgOrder = prevVouchers ? prevVal / prevVouchers : 0;

        const yoyVal = yoyData.reduce((acc, i) => acc + (i.value || 0), 0);
        const yoyQty = yoyData.reduce((acc, i) => acc + (i.quantity || 0), 0);
        const yoyCusts = new Set(yoyData.map(i => String(i.customerName || ''))).size;
        const yoyVouchers = new Set(yoyData.map(i => String(i.voucherNo || ''))).size;
        const yoyAvgOrder = yoyVouchers ? yoyVal / yoyVouchers : 0;

        return {
            currVal, currQty, uniqueCusts, avgOrder,
            prevVal, prevQty, prevCusts, prevAvgOrder,
            yoyVal, yoyQty, yoyCusts, yoyAvgOrder
        };
    }, [currentData, previousDataForComparison, yoyData]);

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

        const compData = timeView === 'FY' ? yoyData : previousDataForComparison;

        compData.forEach(i => {
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
                name,
                current: vals.current,
                previous: vals.previous,
                diff: vals.current - vals.previous
            })).sort((a, b) => b.current - a.current).slice(0, 10)
        })).sort((a, b) => b.total - a.total);
    }, [currentData, previousDataForComparison, yoyData, timeView]);

    const topTenCustomers = useMemo(() => {
        const custMap = new Map<string, { current: number, previous: number }>();
        currentData.forEach(i => {
            const name = String(i.customerName || 'Unknown');
            if (!custMap.has(name)) custMap.set(name, { current: 0, previous: 0 });
            custMap.get(name)!.current += (i.value || 0);
        });
        const compData = timeView === 'FY' ? yoyData : previousDataForComparison;
        compData.forEach(i => {
            const name = String(i.customerName || 'Unknown');
            if (!custMap.has(name)) custMap.set(name, { current: 0, previous: 0 });
            custMap.get(name)!.previous += (i.value || 0);
        });
        return Array.from(custMap.entries())
            .map(([label, v]) => ({ label, value: v.current, previous: v.previous }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [currentData, previousDataForComparison, yoyData, timeView]);

    const inventoryStats = useMemo(() => {
        // Build maps for O(1) matching
        const matByPartNo = new Map<string, { make: string, group: string }>();
        const matByDesc = new Map<string, { make: string, group: string }>();
        (materials || []).forEach(m => {
            if (!m) return;
            const info = { make: m.make || 'Unspecified', group: m.materialGroup || 'Unspecified' };
            if (m.partNo) matByPartNo.set(String(m.partNo).toLowerCase().trim(), info);
            if (m.description) matByDesc.set(String(m.description).toLowerCase().trim(), info);
        });

        const soMap = new Map<string, number>();
        (pendingSO || []).forEach(s => {
            if (!s || !s.itemName) return;
            const k = s.itemName.toLowerCase().trim();
            soMap.set(k, (soMap.get(k) || 0) + (s.balanceQty || 0));
        });

        const poMap = new Map<string, number>();
        (pendingPO || []).forEach(p => {
            if (!p || !p.itemName) return;
            const k = p.itemName.toLowerCase().trim();
            poMap.set(k, (poMap.get(k) || 0) + (p.balanceQty || 0));
        });

        const rawItems = (closingStock || []).map(i => {
            if (!i || !i.description) return null;
            const descLower = String(i.description || '').toLowerCase().trim();
            const matInfo = matByPartNo.get(descLower) || matByDesc.get(descLower);
            const mergedMake = getMergedMakeName(matInfo?.make || 'Unspecified');

            const sQty = soMap.get(descLower) || 0;
            const pQty = poMap.get(descLower) || 0;
            const excessQty = Math.max(0, (i.quantity || 0) + pQty - sQty);
            const excessVal = excessQty * (i.rate || 0);
            const totalAvail = (i.quantity || 0) + pQty;
            const excessPct = totalAvail > 0 ? (excessQty / totalAvail) * 100 : 0;

            return {
                ...i,
                make: mergedMake,
                group: matInfo?.group || 'Unspecified',
                excessVal,
                excessPct
            };
        }).filter((i): i is any => i !== null);

        // Apply Slicers (respects Make and Material Group selections)
        const filteredData = rawItems.filter(i => {
            if (selectedMake !== 'ALL' && i.make !== selectedMake) return false;
            if (selectedMatGroup !== 'ALL' && i.group !== selectedMatGroup) return false;
            return true;
        });

        const totalVal = filteredData.reduce((a, b) => a + (b.value || 0), 0);
        const totalQty = filteredData.reduce((a, b) => a + (b.quantity || 0), 0);
        const totalExcessVal = filteredData.reduce((a, b) => a + (b.excessVal || 0), 0);
        const baseline = invGroupMetric === 'value' ? totalVal : totalQty;

        const makeMap = new Map<string, number>();
        const groupMap = new Map<string, number>();

        filteredData.forEach(i => {
            const val = invGroupMetric === 'value' ? (i.value || 0) : (i.quantity || 0);
            makeMap.set(i.make, (makeMap.get(i.make) || 0) + val);
            groupMap.set(i.group, (groupMap.get(i.group) || 0) + val);
        });

        return {
            totalVal,
            totalQty,
            totalExcessVal,
            count: filteredData.length,
            items: filteredData,
            makeMix: Array.from(makeMap.entries())
                .map(([label, value]) => ({
                    label,
                    value,
                    share: baseline > 0 ? (value / baseline) * 100 : 0
                }))
                .sort((a, b) => b.value - a.value),
            groupMix: Array.from(groupMap.entries())
                .map(([label, value]) => ({
                    label,
                    value,
                    share: baseline > 0 ? (value / baseline) * 100 : 0
                }))
                .sort((a, b) => b.value - a.value),
            topStock: [...filteredData]
                .sort((a, b) => b.value - a.value)
                .slice(0, 10)
                .map(i => ({
                    label: i.description,
                    value: i.value,
                    share: totalVal > 0 ? (i.value / totalVal) * 100 : 0
                })),
            topExcess: [...filteredData]
                .sort((a, b) => b.excessVal - a.excessVal)
                .slice(0, 10)
                .map(i => ({
                    label: i.description,
                    value: i.excessVal,
                    share: i.excessPct
                }))
        };
    }, [closingStock, materials, invGroupMetric, selectedMake, selectedMatGroup, pendingSO, pendingPO]);

    const processedInventoryItems = useMemo(() => {
        let items = [...inventoryStats.items];

        if (invSearchTerm) {
            const low = invSearchTerm.toLowerCase();
            items = items.filter(i =>
                String(i.description || '').toLowerCase().includes(low) ||
                String(i.make || '').toLowerCase().includes(low) ||
                String(i.group || '').toLowerCase().includes(low)
            );
        }

        items.sort((a: any, b: any) => {
            const vA = a[invSortKey];
            const vB = b[invSortKey];
            if (typeof vA === 'string') {
                return invSortOrder === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
            }
            return invSortOrder === 'asc' ? vA - vB : vB - vA;
        });

        return items;
    }, [inventoryStats.items, invSearchTerm, invSortKey, invSortOrder]);

    const handleInvSort = (key: string) => {
        if (invSortKey === key) {
            setInvSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setInvSortKey(key);
            setInvSortOrder('desc');
        }
    };

    const soStats = useMemo(() => {
        const totalVal = pendingSO.reduce((a, b) => a + (b.value || 0), 0);
        const totalQty = pendingSO.reduce((a, b) => a + (b.balanceQty || 0), 0);
        const custMap = new Map<string, { due: number, scheduled: number }>();
        const groupMap = new Map<string, number>();
        const itemSet = new Set<string>();
        const soSet = new Set<string>();
        const ageingMap = { '0-30d': 0, '31-60d': 0, '61-90d': 0, '90d+': 0 };

        let dueValue = 0, dueQty = 0, readyDueValue = 0, readyDueQty = 0, shortageDueValue = 0, shortageDueQty = 0;
        let scheduledValue = 0, scheduledQty = 0, readySchValue = 0, readySchQty = 0, shortageSchValue = 0, shortageSchQty = 0;

        const stockMap = new Map<string, number>();
        (closingStock || []).forEach(s => {
            const k = (s.description || '').toLowerCase().trim();
            stockMap.set(k, (stockMap.get(k) || 0) + (s.quantity || 0));
        });

        const tempStock = new Map(stockMap);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Sort by due date for fair stock allocation
        const sortedSO = [...pendingSO].sort((a, b) => parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime());

        const enrichedItems = sortedSO.map(i => {
            const pName = (i.partyName || 'Unknown').trim();
            if (!custMap.has(pName)) custMap.set(pName, { due: 0, scheduled: 0 });

            const iName = (i.itemName || 'Unspecified').trim().toLowerCase();
            itemSet.add(iName);
            if (i.orderNo) soSet.add(i.orderNo);

            const days = i.overDueDays || 0;
            const dueDate = parseDate(i.dueDate);
            const isDue = days > 0 || (dueDate.getTime() > 0 && dueDate <= today);

            const qty = i.balanceQty || 0;
            const available = tempStock.get(iName) || 0;
            const allocated = Math.min(qty, available);
            const shortage = Math.max(0, qty - allocated);
            tempStock.set(iName, available - allocated);

            const itemVal = i.value || 0;
            const itemReadyVal = allocated * (i.rate || 0);
            const itemShortageVal = shortage * (i.rate || 0);

            if (isDue) {
                dueValue += itemVal; dueQty += qty;
                readyDueValue += itemReadyVal; readyDueQty += allocated;
                shortageDueValue += itemShortageVal; shortageDueQty += shortage;
                custMap.get(pName)!.due += itemVal;
            } else {
                scheduledValue += itemVal; scheduledQty += qty;
                readySchValue += itemReadyVal; readySchQty += allocated;
                shortageSchValue += itemShortageVal; shortageSchQty += shortage;
                custMap.get(pName)!.scheduled += itemVal;
            }

            const mat = materials.find(m => (m.description || '').toLowerCase().trim() === iName);
            const group = mat ? (mat.materialGroup || 'Unspecified') : 'Unspecified';
            groupMap.set(group, (groupMap.get(group) || 0) + itemVal);

            if (days <= 30) ageingMap['0-30d'] += itemVal;
            else if (days <= 60) ageingMap['31-60d'] += itemVal;
            else if (days <= 90) ageingMap['61-90d'] += itemVal;
            else ageingMap['90d+'] += itemVal;

            return {
                ...i,
                readyVal: itemReadyVal,
                shortageVal: itemShortageVal,
                readyQty: allocated,
                shortageQty: shortage
            };
        });

        return {
            totalVal, totalQty,
            dueValue, dueQty, readyDueValue, readyDueQty, shortageDueValue, shortageDueQty,
            scheduledValue, scheduledQty, readySchValue, readySchQty, shortageSchValue, shortageSchQty,
            count: pendingSO.length,
            uniqueItemCount: itemSet.size,
            uniqueSOCount: soSet.size,
            custMix: Array.from(custMap.entries()).map(([label, v]) => ({ label, value: v.due, secondaryValue: v.scheduled })).sort((a, b) => (b.value + b.secondaryValue) - (a.value + a.secondaryValue)),
            groupMix: Array.from(groupMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
            ageing: Object.entries(ageingMap).map(([label, value]) => ({ label, value })),
            topItems: enrichedItems.sort((a, b) => b.value - a.value).slice(0, 10),
            enrichedItems
        };
    }, [pendingSO, materials, closingStock]);

    const poStats = useMemo(() => {
        const totalVal = pendingPO.reduce((a, b) => a + (b.value || 0), 0);
        const vendorMap = new Map<string, number>();
        const statusMap = { 'Overdue': 0, 'Due Today': 0, 'Due This Week': 0, 'Future': 0 };
        const groupMap = new Map<string, number>();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + 7);

        (pendingPO || []).forEach(i => {
            const vName = (i.partyName || 'Unknown').trim();
            vendorMap.set(vName, (vendorMap.get(vName) || 0) + (i.value || 0));

            const iName = (i.itemName || 'Unspecified').trim();
            const mat = materials.find(m => (m.description || '').toLowerCase().trim() === iName.toLowerCase());
            const group = mat ? (mat.materialGroup || 'Unspecified') : 'Unspecified';
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
            vendorMix: Array.from(vendorMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
            dueMix: Object.entries(statusMap).map(([label, value]) => ({ label, value })),
            groupMix: Array.from(groupMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
            topItems: [...pendingPO].sort((a, b) => b.value - a.value).slice(0, 10)
        };
    }, [pendingPO, materials]);

    const weeklyStats = useMemo(() => {
        const targetDate = new Date(2026, 0, 1); // Jan 01, 2026
        const prevDate = new Date(2025, 11, 24); // Dec 24, 2025

        // Define Weekly Gap for Current Week "MTD" (25.12.2025 - 31.12.2025)
        const weeklyGapStart = new Date(prevDate);
        weeklyGapStart.setDate(weeklyGapStart.getDate() + 1);
        const weeklyGapEnd = new Date(targetDate);
        weeklyGapEnd.setDate(weeklyGapEnd.getDate() - 1);

        const mtdStartPrev = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1);
        const ytdYear = targetDate.getMonth() >= 3 ? targetDate.getFullYear() : targetDate.getFullYear() - 1;
        const ytdStart = new Date(ytdYear, 3, 1); // April 1st of fiscal year

        const getSalesSum = (start: Date, end: Date, isOnlineOnly: boolean = false) => {
            const startOfDay = new Date(start); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(end); endOfDay.setHours(23, 59, 59, 999);

            return enrichedSales
                .filter(s => s.rawDate >= startOfDay && s.rawDate <= endOfDay)
                .filter(s => !isOnlineOnly || s.custGroup === 'Online')
                .reduce((acc, i) => acc + (i.value || 0), 0);
        };

        const mtdPrev = getSalesSum(mtdStartPrev, prevDate);
        // Calculate Total Month Sales (Dec 01 - Dec 31) for Current Week column
        const mtdCurr = getSalesSum(mtdStartPrev, weeklyGapEnd);
        const ytdPrev = getSalesSum(ytdStart, prevDate);
        const ytdCurr = getSalesSum(ytdStart, targetDate);

        const mtdPrevOnline = getSalesSum(mtdStartPrev, prevDate, true);
        const mtdCurrOnline = getSalesSum(mtdStartPrev, weeklyGapEnd, true);
        const ytdPrevOnline = getSalesSum(ytdStart, prevDate, true);
        const ytdCurrOnline = getSalesSum(ytdStart, targetDate, true);

        // Specific Makes for the report
        const reportMakes = ['LAPP', 'Eaton', 'Hager', 'Mennekes', 'Havells', 'Luker'];

        const getMakeStats = (items: any[]) => {
            const stats: Record<string, { ready: number, shortage: number, total: number }> = {};
            reportMakes.forEach(m => stats[m] = { ready: 0, shortage: 0, total: 0 });
            stats['Others'] = { ready: 0, shortage: 0, total: 0 };

            items.forEach(i => {
                const mat = materials.find(m => (m.description || '').toLowerCase().trim() === (i.itemName || '').toLowerCase().trim());
                const rawMake = mat ? (mat.make || 'Unspecified') : 'Unspecified';
                const mergedMake = getMergedMakeName(rawMake);
                const targetKey = reportMakes.includes(mergedMake) ? mergedMake : 'Others';

                stats[targetKey].ready += (i.readyVal || 0);
                stats[targetKey].shortage += (i.shortageVal || 0);
                stats[targetKey].total += (i.value || 0);
            });
            return stats;
        };

        const dueItems = soStats.enrichedItems.filter(i => {
            const days = i.overDueDays || 0;
            const dd = parseDate(i.dueDate);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            return days > 0 || (dd.getTime() > 0 && dd <= today);
        });

        const schedItems = soStats.enrichedItems.filter(i => {
            const days = i.overDueDays || 0;
            const dd = parseDate(i.dueDate);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            return !(days > 0 || (dd.getTime() > 0 && dd <= today));
        });

        const stockPivotData: { make: string, groups: { group: string, qty: number, value: number }[] }[] = [];
        const stockMakeMap = new Map<string, Map<string, { qty: number, value: number }>>();

        (inventoryStats.items || []).forEach(i => {
            const mke = i.make || 'Unspecified';
            const grp = i.group || 'Unspecified';
            if (!stockMakeMap.has(mke)) stockMakeMap.set(mke, new Map());
            const groupMap = stockMakeMap.get(mke)!;
            if (!groupMap.has(grp)) groupMap.set(grp, { qty: 0, value: 0 });
            const stats = groupMap.get(grp)!;
            stats.qty += (i.quantity || 0);
            stats.value += (i.value || 0);
        });

        stockMakeMap.forEach((groups, make) => {
            const groupList: { group: string, qty: number, value: number }[] = [];
            groups.forEach((stats, group) => {
                groupList.push({ group, ...stats });
            });
            stockPivotData.push({ make, groups: groupList.sort((a, b) => b.value - a.value) });
        });

        return {
            sales: {
                mtdPrev, mtdCurr, mtdDiff: mtdCurr - mtdPrev,
                ytdPrev, ytdCurr, ytdDiff: ytdCurr - ytdPrev,
                mtdPrevOnline, mtdCurrOnline, mtdDiffOnline: mtdCurrOnline - mtdPrevOnline,
                ytdPrevOnline, ytdCurrOnline, ytdDiffOnline: ytdCurrOnline - ytdPrevOnline
            },
            due: getMakeStats(dueItems),
            sched: getMakeStats(schedItems),
            total: getMakeStats(soStats.enrichedItems),
            stock: stockPivotData.sort((a, b) => b.groups.reduce((acc, g) => acc + g.value, 0) - a.groups.reduce((acc, g) => acc + g.value, 0)),
            targetDate,
            prevDate
        };
    }, [enrichedSales, soStats, materials, inventoryStats]);

    const lineChartData = useMemo(() => {
        if (!selectedFY) return { labels: [], series: [] };
        const startYear = parseInt(selectedFY.split('-')[0]);

        const getSeries = (targetFY: string, filterFn: (i: any) => boolean) => {
            const dataSet = enrichedSales.filter(i => i.fiscalYear === targetFY && filterFn(i));
            if (timeView === 'FY') {
                const arr = new Array(12).fill(0);
                dataSet.forEach(i => { if (i.fiscalMonthIndex >= 0 && i.fiscalMonthIndex < 12) arr[i.fiscalMonthIndex] += (i.value || 0); });
                return arr;
            } else if (timeView === 'MONTH') {
                const targetYear = (selectedMonth >= 9) ? startYear + 1 : startYear;
                const targetMonth = (selectedMonth + 3) % 12; // 0-index for Date constructor
                const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
                const arr = new Array(daysInMonth).fill(0);
                dataSet.forEach(i => { if (i.fiscalMonthIndex === selectedMonth) { const day = i.rawDate.getDate(); if (day > 0 && day <= daysInMonth) arr[day - 1] += (i.value || 0); } });
                return arr;
            } else {
                const arr = new Array(7).fill(0);
                dataSet.forEach(i => {
                    if (i.weekNumber === selectedWeek) {
                        const day = i.rawDate.getDay(); // 0=Sun, 4=Thu
                        const index = (day >= 4) ? (day - 4) : (day + 3); // Map Thu->0, Fri->1... Wed->6
                        if (index >= 0 && index < 7) arr[index] += (i.value || 0);
                    }
                });
                return arr;
            }
        };

        let labels: string[] = [];
        if (timeView === 'FY') {
            labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
        } else if (timeView === 'MONTH') {
            const targetYear = (selectedMonth >= 9) ? startYear + 1 : startYear;
            const targetMonth = (selectedMonth + 3) % 12;
            const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
            labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
        } else {
            labels = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"];
        }

        const currentSeries = getSeries(selectedFY, i => (timeView === 'FY' || (timeView === 'MONTH' && i.fiscalMonthIndex === selectedMonth) || (timeView === 'WEEK' && i.weekNumber === selectedWeek)));
        const prevFY = `${startYear - 1}-${startYear}`;
        const prevSeries = getSeries(prevFY, i => (timeView === 'FY' || (timeView === 'MONTH' && i.fiscalMonthIndex === selectedMonth) || (timeView === 'WEEK' && i.weekNumber === selectedWeek)));
        const ppyFY = `${startYear - 2}-${startYear - 1}`;
        const ppySeries = getSeries(ppyFY, i => (timeView === 'FY' || (timeView === 'MONTH' && i.fiscalMonthIndex === selectedMonth) || (timeView === 'WEEK' && i.weekNumber === selectedWeek)));

        return {
            labels,
            series: [
                { name: selectedFY, data: currentSeries, color: '#3b82f6', active: true },
                { name: prevFY, data: prevSeries, color: '#a855f7', active: true },
                { name: ppyFY, data: ppySeries, color: '#10B981', active: true },
            ]
        };
    }, [selectedFY, enrichedSales, timeView, selectedMonth, selectedWeek]);

    const chartMax = useMemo(() => Math.max(...lineChartData.series.flatMap(s => s.data), 1000) * 1.1, [lineChartData]);
    const formatAxisValue = (val: number) => { if (isNaN(val)) return '0'; if (val >= 10000000) return (val / 10000000).toFixed(1) + 'Cr'; if (val >= 100000) return (val / 100000).toFixed(1) + 'L'; if (val >= 1000) return (val / 1000).toFixed(0) + 'k'; return Math.round(val).toString(); };

    const handleSaveReport = async () => {
        if (!relatedMomId) {
            alert("No linked MOM found to save report.");
            return;
        }
        try {
            const moms = await momService.getAll();
            const mom = moms.find(m => m.id === relatedMomId);
            if (mom) {
                await momService.save({
                    ...mom,
                    benchmarks: weeklyBenchmarks
                });
                alert("Report saved to MOM successfully!");
            }
        } catch (error) {
            console.error(error);
            alert("Failed to save report.");
        }
    };

    return (
        <div className="h-full w-full flex flex-col bg-gray-50/50 overflow-hidden relative">
            {/* SO Detail Modal */}
            {selectedSoItem && (
                <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-500">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-scale-in">
                        <div className="bg-purple-600 px-6 py-4 flex justify-between items-center text-white">
                            <div className="flex items-center gap-2">
                                <ClipboardList className="w-5 h-5" />
                                <h3 className="font-bold text-lg uppercase tracking-tight">Sales Order Details</h3>
                            </div>
                            <button onClick={() => setSelectedSoItem(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><p className="text-[10px] font-bold text-gray-400 uppercase">Order Number</p><p className="text-sm font-black text-gray-900">{selectedSoItem.orderNo}</p></div>
                                <div><p className="text-[10px] font-bold text-gray-400 uppercase">Order Date</p><p className="text-sm font-bold text-gray-700">{selectedSoItem.date}</p></div>
                            </div>
                            <div className="border-t border-gray-100 pt-4">
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Customer / Party</p>
                                <p className="text-sm font-bold text-gray-900">{selectedSoItem.partyName}</p>
                            </div>
                            <div className="border-t border-gray-100 pt-4">
                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Item Details</p>
                                <p className="text-sm font-bold text-gray-800 leading-tight">{selectedSoItem.itemName}</p>
                                <p className="text-[10px] text-gray-500 font-mono mt-1">Part No: {selectedSoItem.partNo || '-'}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-4">
                                <div><p className="text-[10px] font-bold text-gray-400 uppercase">Pending Qty</p><p className="text-base font-black text-purple-700">{selectedSoItem.balanceQty}</p></div>
                                <div><p className="text-[10px] font-bold text-gray-400 uppercase">Unit Rate</p><p className="text-sm font-bold text-gray-700">Rs. {selectedSoItem.rate.toLocaleString()}</p></div>
                                <div><p className="text-[10px] font-bold text-gray-400 uppercase">Order Value</p><p className="text-base font-black text-emerald-600">{formatLargeValue(selectedSoItem.value)}</p></div>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center border border-gray-100">
                                <div><p className="text-[10px] font-bold text-gray-400 uppercase">Due Date</p><p className="text-sm font-black text-gray-900">{selectedSoItem.dueDate}</p></div>
                                {selectedSoItem.overDueDays > 0 && (
                                    <div className="text-right">
                                        <span className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase ring-4 ring-red-50">{selectedSoItem.overDueDays} Days Overdue</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button onClick={() => setSelectedSoItem(null)} className="px-5 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors uppercase tracking-widest shadow-lg active:scale-95">Close Details</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between flex-shrink-0 shadow-sm z-10">
                <div className="flex bg-gray-200/50 backdrop-blur-sm p-1.5 rounded-xl border border-gray-200 shadow-inner overflow-hidden">
                    {(['sales', 'inventory', 'so', 'po', 'weekly'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveSubTab(tab)}
                            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-500 ease-out transform active:scale-95 ${activeSubTab === tab ? 'bg-white text-indigo-700 shadow-[0_8px_16px_rgba(0,0,0,0.12)] scale-[1.02] translate-y-0' : 'text-gray-500 hover:text-indigo-600 hover:bg-white/40 hover:-translate-y-0.5'}`}
                        >
                            {tab === 'so' ? 'Pending SO' : tab === 'po' ? 'Pending PO' : tab === 'weekly' ? 'Weekly Report' : tab}
                        </button>
                    ))}
                </div>
                {activeSubTab === 'sales' && (
                    <div className="flex flex-wrap items-center gap-3">
                        <select value={selectedMake} onChange={e => setSelectedMake(e.target.value)} title="Make Slicer" className="bg-white border border-blue-300 text-[10px] rounded-md px-2 py-1.5 font-bold text-blue-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 max-w-[100px]">
                            {uniqueMakes.map(m => (
                                <option key={m} value={m}>{m === 'ALL' ? 'ALL MAKES' : m}</option>
                            ))}
                        </select>
                        <select value={selectedMatGroup} onChange={e => setSelectedMatGroup(e.target.value)} title="Material Group Slicer" className="bg-white border border-emerald-300 text-[10px] rounded-md px-2 py-1.5 font-bold text-emerald-700 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 max-w-[120px]">
                            {uniqueMatGroups.map(mg => (
                                <option key={mg} value={mg}>{mg === 'ALL' ? 'ALL GROUPS' : mg}</option>
                            ))}
                        </select>
                        <div className="flex bg-gray-100 p-1 rounded-lg">{(['FY', 'MONTH', 'WEEK'] as const).map(v => (<button key={v} onClick={() => setTimeView(v)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}> {v} </button>))}</div>

                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setGroupingMode('MERGED')}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${groupingMode === 'MERGED' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Use Merged Groups (Giridhar, Office, Online)"
                            >
                                Merged
                            </button>
                            <button
                                onClick={() => setGroupingMode('RAW')}
                                className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${groupingMode === 'RAW' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                title="Use Raw Customer Groups (OEM, End User, etc.)"
                            >
                                Raw
                            </button>
                        </div>
                        <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500">{uniqueFYs.length > 0 ? uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>) : <option value="">No FY Data</option>}</select>

                        {timeView === 'MONTH' && (
                            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500">
                                {["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((m, i) => (
                                    <option key={m} value={i}>{m}</option>
                                ))}
                            </select>
                        )}

                        {timeView === 'WEEK' && (
                            <div className="flex items-center gap-2">
                                <select value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500">
                                    {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                                        <option key={w} value={w}>Week {w}</option>
                                    ))}
                                </select>
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                    {(() => {
                                        if (!selectedFY) return '';
                                        const startYear = parseInt(selectedFY.split('-')[0]);
                                        const fyStart = new Date(startYear, 3, 1);
                                        const day = fyStart.getDay();
                                        const daysToSubtract = (day >= 4) ? (day - 4) : (day + 3);
                                        const refThursday = new Date(fyStart);
                                        refThursday.setDate(fyStart.getDate() - daysToSubtract);
                                        refThursday.setHours(0, 0, 0, 0);
                                        const weekStart = new Date(refThursday);
                                        weekStart.setDate(refThursday.getDate() + (selectedWeek - 1) * 7);
                                        const weekEnd = new Date(weekStart);
                                        weekEnd.setDate(weekStart.getDate() + 6);
                                        const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                                        return `${fmt(weekStart)} - ${fmt(weekEnd)}`;
                                    })()}
                                </span>
                            </div>
                        )}
                    </div>
                )}
                {activeSubTab === 'inventory' && (
                    <div className="flex flex-wrap items-center gap-3">
                        <select value={selectedMake} onChange={e => setSelectedMake(e.target.value)} title="Make Slicer" className="bg-white border border-blue-300 text-[10px] rounded-md px-2 py-1.5 font-bold text-blue-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 max-w-[100px]">
                            {uniqueMakes.map(m => (
                                <option key={m} value={m}>{m === 'ALL' ? 'ALL MAKES' : m}</option>
                            ))}
                        </select>
                        <select value={selectedMatGroup} onChange={e => setSelectedMatGroup(e.target.value)} title="Material Group Slicer" className="bg-white border border-emerald-300 text-[10px] rounded-md px-2 py-1.5 font-bold text-emerald-700 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 max-w-[120px]">
                            {uniqueMatGroups.map(mg => (
                                <option key={mg} value={mg}>{mg === 'ALL' ? 'ALL GROUPS' : mg}</option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">View By:</span>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setInvGroupMetric('value')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${invGroupMetric === 'value' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Value</button>
                                <button onClick={() => setInvGroupMetric('quantity')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${invGroupMetric === 'quantity' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Qty</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex-1 p-2 overflow-y-auto custom-scrollbar bg-gray-50/50">
                <div key={activeSubTab} className="h-full animate-fade-in-up">
                    {activeSubTab === 'sales' ? (
                        <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                {[
                                    { label: 'Current Sales', val: kpis.currVal, prev: kpis.prevVal, yoy: kpis.yoyVal, isCurr: true, text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100', icon: DollarSign },
                                    { label: 'Quantity', val: kpis.currQty, prev: kpis.prevQty, yoy: kpis.yoyQty, isCurr: false, text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: Package },
                                    { label: 'Unique Customers', val: kpis.uniqueCusts, prev: kpis.prevCusts, yoy: kpis.yoyCusts, isCurr: false, text: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100', icon: Users },
                                    { label: 'Avg. Order', val: kpis.avgOrder, prev: kpis.prevAvgOrder, yoy: kpis.yoyAvgOrder, isCurr: true, text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100', icon: Activity }
                                ].map((k, i) => {
                                    const diff = k.val - k.prev;
                                    const pct = k.prev > 0 ? (diff / k.prev) * 100 : 0;

                                    const yoyDiff = k.val - (k.yoy || 0);
                                    const yoyPct = (k.yoy || 0) > 0 ? (yoyDiff / k.yoy!) * 100 : 0;

                                    return (
                                        <div key={i} className={`relative overflow-hidden bg-white border ${k.border} p-4 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group`}>
                                            <div className="flex flex-col h-full justify-between gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className={`p-1.5 ${k.bg} rounded-lg border ${k.border}`}>
                                                            <k.icon className={`w-3.5 h-3.5 ${k.text}`} />
                                                        </div>
                                                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                                                            {k.label}
                                                            <span className="ml-1 text-gray-400 font-normal">({timeView})</span>
                                                        </p>
                                                    </div>
                                                    <h3 className={`text-2xl font-bold ${k.text} tracking-tight tabular-nums`}>
                                                        {k.isCurr ? formatLargeValue(k.val, true) : k.val.toLocaleString()}
                                                    </h3>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 mt-1">
                                                    {/* Sequential Comparison Badge */}
                                                    <div className="flex flex-col gap-1">
                                                        <div className={`flex items-center justify-between px-2 py-1 rounded-lg border shadow-sm transition-all group-hover:shadow duration-300 ${diff >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                            <span className="text-[11px] font-extrabold">{Math.abs(pct).toFixed(0)}%</span>
                                                            {diff >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                        </div>
                                                        <p className="text-[8px] font-bold uppercase text-gray-400 tracking-tighter pl-1">
                                                            {timeView === 'WEEK' ? 'vs Prev Wk' : timeView === 'MONTH' ? 'vs Prev Mo' : 'vs Prev FY'}
                                                        </p>
                                                    </div>

                                                    {/* YoY Comparison Badge */}
                                                    <div className="flex flex-col gap-1">
                                                        <div className={`flex items-center justify-between px-2 py-1 rounded-lg border shadow-sm transition-all group-hover:shadow duration-300 ${yoyDiff >= 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                            <span className="text-[11px] font-extrabold">{Math.abs(yoyPct).toFixed(0)}%</span>
                                                            {yoyDiff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                        </div>
                                                        <p className="text-[8px] font-bold uppercase text-gray-400 tracking-tighter pl-1">
                                                            {timeView === 'FY' ? 'YTD Comp' : 'YoY Comp'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                                {/* Trend Chart (2/3 width) */}
                                <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-72 overflow-hidden transition-all hover:shadow-md">
                                    <h3 className="text-[11px] font-black text-gray-800 mb-3 flex items-center gap-2 uppercase tracking-widest border-b border-gray-50 pb-2">
                                        <TrendingUp className="w-4 h-4 text-blue-600" />
                                        3-Year Sales Trend
                                    </h3>
                                    <div className="flex flex-1 pt-1 overflow-hidden">
                                        <div className="flex flex-col justify-between text-[9px] font-bold text-gray-400 pr-3 pb-8 text-right w-12 border-r border-gray-50">
                                            <span>{formatAxisValue(chartMax)}</span>
                                            <span>{formatAxisValue(chartMax * 0.5)}</span>
                                            <span>0</span>
                                        </div>
                                        <div className="flex-1 pl-3 pb-1 relative min-h-0">
                                            <SalesTrendChart data={lineChartData} maxVal={chartMax} />
                                        </div>
                                    </div>
                                </div>

                                {/* Revenue Mix (1/3 width) */}
                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col h-72 overflow-hidden transition-all hover:shadow-md">
                                    <ModernDonutChartDashboard
                                        data={groupedCustomerData.map(g => ({ label: g.group, value: g.total }))}
                                        title={`Revenue by ${groupingMode === 'RAW' ? 'Customer Group' : 'Merged Group'}`}
                                        isCurrency={true}
                                        centerColorClass="text-blue-700"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm h-[380px] flex flex-col overflow-hidden transition-all hover:shadow-md">
                                    <HorizontalBarChart
                                        data={topTenCustomers}
                                        title="Universal Top 10 Customers"
                                        color="emerald"
                                        compareLabel={timeView === 'WEEK' ? 'PW' : timeView === 'MONTH' ? 'PM' : 'LY (YTD)'}
                                    />
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm h-[380px] flex flex-col overflow-hidden transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between mb-2 border-b border-gray-100 pb-2">
                                        <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                                            Advanced {groupingMode === 'RAW' ? 'Customer Group' : 'Merged Group'} Analytics
                                        </h3>
                                        <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">All Groups</span>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <GroupedCustomerAnalysis
                                            data={groupedCustomerData}
                                            compareLabel={timeView === 'WEEK' ? 'PW' : timeView === 'MONTH' ? 'PM' : 'LY (YTD)'}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeSubTab === 'inventory' ? (
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-4 rounded-xl shadow-[0_8px_20px_-4px_rgba(79,70,229,0.3)] border border-indigo-500/30 transform transition-all duration-300 hover:scale-[1.01]">
                                    <p className="text-[10px] text-indigo-100 font-black uppercase tracking-widest opacity-80">Total Stock Value</p>
                                    <h3 className="text-2xl font-black text-white mt-1 break-all">{formatLargeValue(inventoryStats.totalVal)}</h3>
                                    <div className="mt-2 h-1 w-12 bg-white/30 rounded-full"></div>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-xl shadow-[0_8_20px_-4px_rgba(16,185,129,0.3)] border border-emerald-400/30 transform transition-all duration-300 hover:scale-[1.01]">
                                    <p className="text-[10px] text-emerald-50 font-black uppercase tracking-widest opacity-80">Total Qty</p>
                                    <h3 className="text-2xl font-black text-white mt-1">{inventoryStats.totalQty.toLocaleString()}</h3>
                                    <div className="mt-2 h-1 w-12 bg-white/30 rounded-full"></div>
                                </div>
                                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-4 rounded-xl shadow-[0_8px_20px_-4px_rgba(139,92,246,0.3)] border border-purple-400/30 transform transition-all duration-300 hover:scale-[1.01]">
                                    <p className="text-[10px] text-purple-50 font-black uppercase tracking-widest opacity-80">Total SKUs</p>
                                    <h3 className="text-2xl font-black text-white mt-1">{inventoryStats.count}</h3>
                                    <div className="mt-2 h-1 w-12 bg-white/30 rounded-full"></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col">
                                    <ModernDonutChartDashboard
                                        data={inventoryStats.makeMix}
                                        title={`Inventory by Make (${invGroupMetric === 'value' ? 'Val' : 'Qty'})`}
                                        isCurrency={invGroupMetric === 'value'}
                                        centerColorClass="text-emerald-600"
                                    />
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col">
                                    <ModernDonutChartDashboard
                                        data={inventoryStats.groupMix}
                                        title={`Inventory by Group (${invGroupMetric === 'value' ? 'Val' : 'Qty'})`}
                                        isCurrency={invGroupMetric === 'value'}
                                        centerColorClass="text-blue-600"
                                    />
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col">
                                    <HorizontalBarChart
                                        data={inventoryStats.topStock}
                                        title="Top 10 High Value Stock Items"
                                        color="emerald"
                                        totalForPercentage={inventoryStats.totalVal}
                                    />
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80 flex flex-col">
                                    <HorizontalBarChart
                                        data={inventoryStats.topExcess}
                                        title="Top 10 Excess Stock Items"
                                        color="rose"
                                        totalForPercentage={inventoryStats.totalExcessVal}
                                    />
                                </div>
                            </div>

                            {/* Inventory Table Integration */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                                <div className="p-3 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50/50 gap-3">
                                    <div className="flex items-center gap-4">
                                        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                            <Table className="w-4 h-4 text-emerald-600" />
                                            Detailed Inventory Snapshot
                                        </h4>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase bg-white px-2 py-0.5 rounded border border-gray-100">{processedInventoryItems.length} Records</span>
                                    </div>
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search inventory..."
                                            value={invSearchTerm}
                                            onChange={(e) => setInvSearchTerm(e.target.value)}
                                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-inner"
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto max-h-96 custom-scrollbar">
                                    <table className="w-full text-left border-collapse min-w-[800px]">
                                        <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.05)] border-b border-gray-200">
                                            <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                {[
                                                    { key: 'description', label: 'Description', align: 'left' },
                                                    { key: 'make', label: 'Make', align: 'left' },
                                                    { key: 'group', label: 'Group', align: 'left' },
                                                    { key: 'quantity', label: 'Quantity', align: 'right' },
                                                    { key: 'rate', label: 'Rate', align: 'right' },
                                                    { key: 'value', label: 'Value', align: 'right' }
                                                ].map(col => (
                                                    <th
                                                        key={col.key}
                                                        className={`py-4 px-4 cursor-pointer hover:bg-gray-100/50 transition-colors ${col.align === 'right' ? 'text-right' : ''}`}
                                                        onClick={() => handleInvSort(col.key)}
                                                    >
                                                        <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                                                            {col.label}
                                                            <ArrowUpDown className={`w-3 h-3 ${invSortKey === col.key ? 'text-indigo-600' : 'text-gray-300'}`} />
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-[11px] text-gray-700">
                                            {processedInventoryItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="py-20 text-center text-gray-400 bg-gray-50/10">
                                                        <div className="flex flex-col items-center justify-center gap-3">
                                                            <Package className="w-12 h-12 text-gray-200" />
                                                            <p className="text-sm font-bold uppercase tracking-tight">No matching stock found</p>
                                                            <p className="text-[10px] text-gray-400">Try adjusting your Brand/Group filters or search term</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                processedInventoryItems.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-emerald-50/30 transition-colors group">
                                                        <td className="py-2.5 px-4 font-bold text-gray-900 max-w-xs truncate" title={item.description}>{item.description}</td>
                                                        <td className="py-2.5 px-4">
                                                            <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-gray-100 text-gray-600 border border-gray-200 group-hover:bg-white">{item.make}</span>
                                                        </td>
                                                        <td className="py-2.5 px-4 text-gray-500 font-medium">{item.group}</td>
                                                        <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-600">{item.quantity.toLocaleString()}</td>
                                                        <td className="py-2.5 px-4 text-right font-mono text-gray-400">{item.rate.toFixed(1)}</td>
                                                        <td className="py-2.5 px-4 text-right font-black text-emerald-700">{formatLargeValue(item.value, true)}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : activeSubTab === 'so' ? (
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Total Pending SO */}
                                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-5 rounded-2xl shadow-[0_10px_30px_-5px_rgba(79,70,229,0.4)] border border-white/10 group h-full">
                                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700"></div>
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform duration-500"><DollarSign className="w-16 h-16 text-white" /></div>
                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        <div>
                                            <p className="text-[10px] text-indigo-100/70 font-black uppercase tracking-widest mb-1">Total Pending SO</p>
                                            <h3 className="text-3xl font-black text-white tracking-tighter leading-none">{formatLargeValue(soStats.totalVal)}</h3>
                                            <p className="text-[11px] font-bold text-indigo-100/50 mt-2 flex items-center gap-1.5"><Package className="w-3 h-3" /> Qty: {soStats.totalQty.toLocaleString()}</p>
                                        </div>
                                        <div className="mt-auto pt-5">
                                            <div className="flex justify-between items-center text-[10px] mb-2 font-black">
                                                <span className="text-red-300 uppercase letter tracking-tighter">Due: {formatLargeValue(soStats.dueValue, true)}</span>
                                                <span className="text-blue-300 uppercase tracking-tighter">Sch: {formatLargeValue(soStats.scheduledValue, true)}</span>
                                            </div>
                                            <div className="w-full bg-white/10 backdrop-blur-sm h-2 rounded-full overflow-hidden flex shadow-inner">
                                                <div className="bg-gradient-to-r from-red-400 to-rose-500 h-full shadow-[0_0_12px_rgba(244,63,94,0.6)] transition-all duration-1000" style={{ width: `${(soStats.dueValue / (soStats.totalVal || 1)) * 100}%` }}></div>
                                                <div className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full shadow-[0_0_12px_rgba(59,130,246,0.6)] transition-all duration-1000" style={{ width: `${(soStats.scheduledValue / (soStats.totalVal || 1)) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-red-100/50 relative overflow-hidden group h-full">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-red-50 rounded-full transition-all group-hover:scale-150 duration-500"></div>
                                    <div className="relative z-10">
                                        <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mb-1">Due order</p>
                                        <h3 className="text-2xl font-black text-gray-900 leading-tight">{formatLargeValue(soStats.dueValue)}</h3>
                                    </div>
                                    <div className="relative z-10 grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-50">
                                        <div>
                                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Ready</p>
                                            <p className="text-xs font-black text-gray-800">{formatLargeValue(soStats.readyDueValue, true)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-rose-500 uppercase tracking-tighter">Shortage</p>
                                            <p className="text-xs font-black text-gray-800">{formatLargeValue(soStats.shortageDueValue, true)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-100/50 relative overflow-hidden group h-full">
                                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-50 rounded-full transition-all group-hover:scale-150 duration-500"></div>
                                    <div className="relative z-10">
                                        <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mb-1">Schedule Order</p>
                                        <h3 className="text-2xl font-black text-gray-900 leading-tight">{formatLargeValue(soStats.scheduledValue)}</h3>
                                    </div>
                                    <div className="relative z-10 grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-50">
                                        <div>
                                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Ready</p>
                                            <p className="text-xs font-black text-gray-800">{formatLargeValue(soStats.readySchValue, true)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-rose-500 uppercase tracking-tighter">Shortage</p>
                                            <p className="text-xs font-black text-gray-800">{formatLargeValue(soStats.shortageSchValue, true)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary Card */}
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2 h-full">
                                    <p className="text-[10px] text-teal-600 font-bold uppercase tracking-wider">Order Summary</p>
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div className="flex justify-between items-center bg-teal-50/50 p-2 rounded-lg border border-teal-100/50">
                                            <span className="text-[9px] font-bold text-teal-700 uppercase">Unique Customers</span>
                                            <span className="text-sm font-black text-teal-900">{soStats.custMix.length}</span>
                                        </div>
                                        <div className="bg-gray-50/80 p-2 rounded-lg border border-gray-100">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-bold text-gray-500 uppercase">Unique SO No</span>
                                                <span className="text-xs font-black text-gray-900">{soStats.uniqueSOCount}</span>
                                            </div>
                                        </div>
                                        <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-bold text-indigo-700 uppercase">Unique Items</span>
                                                <span className="text-xs font-black text-indigo-900">{soStats.uniqueItemCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80">
                                    <ModernDonutChartDashboard data={soStats.ageing} title="SO Ageing Analysis" isCurrency={true} centerColorClass="text-blue-600" />
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80">
                                    <ModernDonutChartDashboard data={soStats.groupMix} title="SO by Material Group" isCurrency={true} centerColorClass="text-emerald-600" />
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80">
                                    <ModernDonutChartDashboard data={soStats.custMix} title="Customer Concentration" isCurrency={true} centerColorClass="text-indigo-600" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-96 flex flex-col">
                                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                        <h4 className="text-[11px] font-black text-gray-600 uppercase flex items-center gap-2"><ListOrdered className="w-4 h-4 text-purple-600" /> Top 10 High Value SOs</h4>
                                        <span className="text-[9px] text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100 animate-pulse">Click Value for Details</span>
                                    </div>
                                    <div className="flex-1 overflow-x-auto">
                                        <table className="w-full text-[9px] text-left border-collapse">
                                            <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur-lg text-gray-400 uppercase font-black tracking-widest border-b border-gray-100">
                                                <tr>
                                                    <th className="py-3 px-4">Date</th>
                                                    <th className="py-3 px-4">Customer Name</th>
                                                    <th className="py-3 px-4">SO No</th>
                                                    <th className="py-3 px-4 text-right">Value Analysis</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {soStats.topItems.map((i: any) => (
                                                    <tr key={i.id} className="hover:bg-purple-50 group cursor-default">
                                                        <td className="py-1.5 px-3 text-gray-400 font-medium">{i.date}</td>
                                                        <td className="py-1.5 px-3 font-bold text-gray-800 truncate max-w-[120px]">{i.partyName}</td>
                                                        <td className="py-1.5 px-3 font-mono text-gray-500">{i.orderNo}</td>
                                                        <td className="py-1.5 px-3 text-right">
                                                            <div className="flex flex-col items-end">
                                                                <button
                                                                    onClick={() => setSelectedSoItem(i)}
                                                                    className="font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-transparent hover:border-purple-300 hover:bg-white transition-all shadow-sm flex items-center gap-1"
                                                                >
                                                                    {formatLargeValue(i.value, true)}
                                                                    <ArrowRight className="w-2 h-2 opacity-40 group-hover:opacity-100" />
                                                                </button>
                                                                <div className="flex gap-1.5 text-[7px] font-bold mt-0.5">
                                                                    <span className="text-emerald-600">R:{formatLargeValue(i.readyVal, true)}</span>
                                                                    <span className="text-rose-600">A:{formatLargeValue(i.shortageVal, true)}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-96">
                                    <HorizontalBarChart
                                        data={soStats.custMix}
                                        title="Pending SO by Customer"
                                        color="blue"
                                        isStacked={true}
                                        secondaryLabel="Scheduled"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : activeSubTab === 'po' ? (
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-orange-400 to-rose-500 p-4 rounded-xl shadow-[0_8px_20px_-4px_rgba(249,115,22,0.3)] border border-orange-400/30 transform transition-all duration-300 hover:scale-[1.01]">
                                    <p className="text-[10px] text-orange-50 font-black uppercase tracking-widest opacity-80">Total Pending PO</p>
                                    <h3 className="text-2xl font-black text-white mt-1">{formatLargeValue(poStats.totalVal)}</h3>
                                    <div className="mt-2 h-1 w-12 bg-white/30 rounded-full"></div>
                                </div>
                                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-xl shadow-[0_8px_20px_-4px_rgba(59,130,246,0.3)] border border-blue-400/30 transform transition-all duration-300 hover:scale-[1.01]">
                                    <p className="text-[10px] text-blue-50 font-black uppercase tracking-widest opacity-80">Open POs</p>
                                    <h3 className="text-2xl font-black text-white mt-1">{poStats.count}</h3>
                                    <div className="mt-2 h-1 w-12 bg-white/30 rounded-full"></div>
                                </div>
                                <div className="bg-gradient-to-br from-red-500 to-rose-700 p-4 rounded-xl shadow-[0_8px_20px_-4px_rgba(239,68,68,0.3)] border border-red-400/30 transform transition-all duration-300 hover:scale-[1.01]">
                                    <p className="text-[10px] text-red-50 font-black uppercase tracking-widest opacity-80">Overdue Arrivals</p>
                                    <h3 className="text-2xl font-black text-white mt-1">{pendingPO.filter(i => i.overDueDays > 0).length}</h3>
                                    <div className="mt-2 h-1 w-12 bg-white/30 rounded-full"></div>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-xl shadow-[0_8px_20px_-4px_rgba(16,185,129,0.3)] border border-emerald-400/30 transform transition-all duration-300 hover:scale-[1.01]">
                                    <p className="text-[10px] text-emerald-50 font-black uppercase tracking-widest opacity-80">Active Vendors</p>
                                    <h3 className="text-2xl font-black text-white mt-1">{poStats.vendorMix.length}</h3>
                                    <div className="mt-2 h-1 w-12 bg-white/30 rounded-full"></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80">
                                    <ModernDonutChartDashboard data={poStats.dueMix} title="PO Delivery Schedule" isCurrency={true} centerColorClass="text-emerald-600" />
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80">
                                    <ModernDonutChartDashboard data={poStats.groupMix} title="PO by Material Group" isCurrency={true} centerColorClass="text-blue-600" />
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-80">
                                    <ModernDonutChartDashboard data={poStats.vendorMix} title="Vendor Concentration" isCurrency={true} centerColorClass="text-purple-600" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm min-h-96">
                                    <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-4 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-orange-600" /> Top 10 High Value Open POs</h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[10px] text-left">
                                            <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-md text-gray-500 uppercase font-bold border-b border-gray-100 shadow-sm">
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
                    ) : activeSubTab === 'weekly' ? (
                        <div className="flex flex-col gap-6 p-4 bg-gray-50 min-h-full">
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSaveReport}
                                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-indigo-700 transition-colors shadow-sm"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Save Report to MOM
                                </button>
                            </div>
                            {/* Sales Report Section */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="bg-indigo-600 px-6 py-4 flex items-center gap-3">
                                    <TrendingUp className="w-5 h-5 text-indigo-100" />
                                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">Sales Comparison Analysis</h3>
                                </div>
                                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* MTD Performance */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest border-l-4 border-indigo-500 pl-3">MTD Performance</h4>
                                        <div className="overflow-hidden border border-gray-100 rounded-xl shadow-sm">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-50/80 text-gray-500 uppercase text-[10px] font-bold">
                                                    <tr>
                                                        <th className="px-4 py-3 border-b">Category</th>
                                                        <th className="px-4 py-3 border-b text-right">{weeklyStats.prevDate.toLocaleDateString('en-GB')} (PW)</th>
                                                        <th className="px-4 py-3 border-b text-right">{weeklyStats.targetDate.toLocaleDateString('en-GB')} (CW)</th>
                                                        <th className="px-4 py-3 border-b text-right">Diff</th>
                                                        <th className="px-4 py-3 border-b text-right">% Chg</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {/* Total Sales Row */}
                                                    <tr className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-gray-600">Total Sales</td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-700">{Math.round(weeklyStats.sales.mtdPrev).toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-right font-mono font-black text-indigo-900">{Math.round(weeklyStats.sales.mtdCurr).toLocaleString('en-IN')}</td>
                                                        <td className={`px-4 py-3 text-right font-bold ${weeklyStats.sales.mtdDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {weeklyStats.sales.mtdDiff >= 0 ? '+' : ''}{Math.round(weeklyStats.sales.mtdDiff).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-black ${weeklyStats.sales.mtdDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                            {((weeklyStats.sales.mtdDiff / (weeklyStats.sales.mtdPrev || 1)) * 100).toFixed(0)}%
                                                        </td>
                                                    </tr>
                                                    {/* Online Sales Row */}
                                                    <tr className="bg-emerald-50/20">
                                                        <td className="px-4 py-3 font-bold text-emerald-700">Online Sales</td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">{Math.round(weeklyStats.sales.mtdPrevOnline).toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-right font-mono font-black text-emerald-900">{Math.round(weeklyStats.sales.mtdCurrOnline).toLocaleString('en-IN')}</td>
                                                        <td className={`px-4 py-3 text-right font-bold ${weeklyStats.sales.mtdDiffOnline >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {weeklyStats.sales.mtdDiffOnline >= 0 ? '+' : ''}{Math.round(weeklyStats.sales.mtdDiffOnline).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-black ${weeklyStats.sales.mtdDiffOnline >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                            {((weeklyStats.sales.mtdDiffOnline / (weeklyStats.sales.mtdPrevOnline || 1)) * 100).toFixed(0)}%
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* YTD Performance */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest border-l-4 border-teal-500 pl-3">YTD Cumulative</h4>
                                        <div className="overflow-hidden border border-gray-100 rounded-xl shadow-sm">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-50/80 text-gray-500 uppercase text-[10px] font-bold">
                                                    <tr>
                                                        <th className="px-4 py-3 border-b">Category</th>
                                                        <th className="px-4 py-3 border-b text-right">{weeklyStats.prevDate.toLocaleDateString('en-GB')} (PW)</th>
                                                        <th className="px-4 py-3 border-b text-right">{weeklyStats.targetDate.toLocaleDateString('en-GB')} (CW)</th>
                                                        <th className="px-4 py-3 border-b text-right">Diff</th>
                                                        <th className="px-4 py-3 border-b text-right">% Chg</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {/* Total Sales Row */}
                                                    <tr className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-gray-600">Total Sales</td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-700">{Math.round(weeklyStats.sales.ytdPrev).toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-right font-mono font-black text-teal-900">{Math.round(weeklyStats.sales.ytdCurr).toLocaleString('en-IN')}</td>
                                                        <td className={`px-4 py-3 text-right font-bold ${weeklyStats.sales.ytdDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {weeklyStats.sales.ytdDiff >= 0 ? '+' : ''}{Math.round(weeklyStats.sales.ytdDiff).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-black ${weeklyStats.sales.ytdDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                            {((weeklyStats.sales.ytdDiff / (weeklyStats.sales.ytdPrev || 1)) * 100).toFixed(0)}%
                                                        </td>
                                                    </tr>
                                                    {/* Online Sales Row */}
                                                    <tr className="bg-teal-50/20">
                                                        <td className="px-4 py-3 font-bold text-teal-700">Online Sales</td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold text-teal-600">{Math.round(weeklyStats.sales.ytdPrevOnline).toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-right font-mono font-black text-teal-900">{Math.round(weeklyStats.sales.ytdCurrOnline).toLocaleString('en-IN')}</td>
                                                        <td className={`px-4 py-3 text-right font-bold ${weeklyStats.sales.ytdDiffOnline >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {weeklyStats.sales.ytdDiffOnline >= 0 ? '+' : ''}{Math.round(weeklyStats.sales.ytdDiffOnline).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-black ${weeklyStats.sales.ytdDiffOnline >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                            {((weeklyStats.sales.ytdDiffOnline / (weeklyStats.sales.ytdPrevOnline || 1)) * 100).toFixed(0)}%
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pending Orders Section */}
                            <div className="space-y-6">
                                {[
                                    { title: 'DUE Orders Analysis (by Make)', data: weeklyStats.due, id: 'DUE' },
                                    { title: 'Scheduled Orders Analysis (by Make)', data: weeklyStats.sched, id: 'SCH' },
                                    { title: 'Total Pending Orders Analysis (by Make)', data: weeklyStats.total, id: 'TOT' }
                                ].map((table) => (
                                    <div key={table.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className={`px-6 py-4 flex items-center gap-3 ${table.id === 'DUE' ? 'bg-rose-600' : table.id === 'SCH' ? 'bg-blue-600' : 'bg-gray-800'}`}>
                                            <Package className="w-5 h-5 text-white/70" />
                                            <h3 className="text-lg font-bold text-white uppercase tracking-tight">{table.title}</h3>
                                        </div>
                                        <div className="overflow-x-auto p-4">
                                            <table className="w-full text-xs text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase">
                                                        <th className="p-3 border">Make</th>
                                                        <th className="p-3 border text-center bg-blue-50/50" colSpan={3}>Previous Week (Manual)</th>
                                                        <th className="p-3 border text-center bg-indigo-50/50" colSpan={3}>Current Week (Automated)</th>
                                                        <th className="p-3 border text-center bg-gray-50" colSpan={3}>Difference</th>
                                                    </tr>
                                                    <tr className="bg-gray-50 text-[9px] font-bold text-gray-500 uppercase">
                                                        <th className="p-2 border">Manufacturer</th>
                                                        <th className="p-2 border text-right bg-blue-50/30">Ready</th>
                                                        <th className="p-2 border text-right bg-blue-50/30">Shortage</th>
                                                        <th className="p-2 border text-right bg-blue-50/30">Total</th>
                                                        <th className="p-2 border text-right bg-indigo-50/30">Ready</th>
                                                        <th className="p-2 border text-right bg-indigo-50/30">Shortage</th>
                                                        <th className="p-2 border text-right bg-indigo-50/30">Total</th>
                                                        <th className="p-2 border text-right">Ready</th>
                                                        <th className="p-2 border text-right">Shortage</th>
                                                        <th className="p-2 border text-right">% Chg</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.keys(table.data).map(make => {
                                                        const curr = table.data[make];
                                                        const prevReady = parseFloat(weeklyBenchmarks[`${table.id}_${make}_Ready`] || 0);
                                                        const prevShortage = parseFloat(weeklyBenchmarks[`${table.id}_${make}_Shortage`] || 0);
                                                        const prevTotal = prevReady + prevShortage;
                                                        const diffReady = curr.ready - prevReady;
                                                        const diffShortage = curr.shortage - prevShortage;
                                                        const diffTotal = curr.total - prevTotal;
                                                        const pctChange = prevTotal > 0 ? (diffTotal / prevTotal) * 100 : 0;
                                                        return (
                                                            <tr key={make} className="hover:bg-gray-50 transition-colors">
                                                                <td className="p-2 border font-bold text-gray-700">{make}</td>
                                                                <td className="p-2 border bg-blue-50/10">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-transparent text-right outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 text-[10px]"
                                                                        value={weeklyBenchmarks[`${table.id}_${make}_Ready`] ? Math.round(parseFloat(weeklyBenchmarks[`${table.id}_${make}_Ready`])).toString() : ""}
                                                                        placeholder="0"
                                                                        onChange={(e) => setWeeklyBenchmarks(prev => ({ ...prev, [`${table.id}_${make}_Ready`]: e.target.value }))}
                                                                    />
                                                                </td>
                                                                <td className="p-2 border bg-blue-50/10">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-transparent text-right outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 text-[10px]"
                                                                        value={weeklyBenchmarks[`${table.id}_${make}_Shortage`] ? Math.round(parseFloat(weeklyBenchmarks[`${table.id}_${make}_Shortage`])).toString() : ""}
                                                                        placeholder="0"
                                                                        onChange={(e) => setWeeklyBenchmarks(prev => ({ ...prev, [`${table.id}_${make}_Shortage`]: e.target.value }))}
                                                                    />
                                                                </td>
                                                                <td className="p-2 border bg-blue-50/20 text-right font-bold text-gray-500">{Math.round(prevTotal).toLocaleString("en-IN")}</td>
                                                                <td className="p-2 border text-right font-mono font-bold text-emerald-600 bg-indigo-50/5">{Math.round(curr.ready).toLocaleString("en-IN")}</td>
                                                                <td className="p-2 border text-right font-mono font-bold text-rose-600 bg-indigo-50/5">{Math.round(curr.shortage).toLocaleString("en-IN")}</td>
                                                                <td className="p-2 border text-right font-mono font-black text-indigo-900 bg-indigo-50/10">{Math.round(curr.total).toLocaleString("en-IN")}</td>
                                                                <td className={`p-2 border text-right font-bold ${diffReady >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{diffReady !== 0 ? Math.round(diffReady).toLocaleString("en-IN") : "-"}</td>
                                                                <td className={`p-2 border text-right font-bold ${diffShortage >= 0 ? "text-rose-500" : "text-emerald-500"}`}>{diffShortage !== 0 ? Math.round(diffShortage).toLocaleString("en-IN") : "-"}</td>
                                                                <td className={`p-2 border text-right font-black ${pctChange >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{pctChange !== 0 ? `${pctChange.toFixed(0)}%` : "-"}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr className="bg-gray-100 font-black text-gray-900">
                                                        <td className="p-2 border uppercase text-[9px]">Grand Total</td>
                                                        {(() => {
                                                            const totPrevReady = Object.keys(table.data).reduce((acc, m) => acc + parseFloat(weeklyBenchmarks[`${table.id}_${m}_Ready`] || 0), 0);
                                                            const totPrevShort = Object.keys(table.data).reduce((acc, m) => acc + parseFloat(weeklyBenchmarks[`${table.id}_${m}_Shortage`] || 0), 0);
                                                            const totPrevTotal = totPrevReady + totPrevShort;
                                                            const totCurrReady = Object.keys(table.data).reduce((acc, m) => acc + table.data[m].ready, 0);
                                                            const totCurrShort = Object.keys(table.data).reduce((acc, m) => acc + table.data[m].shortage, 0);
                                                            const totCurrTotal = totCurrReady + totCurrShort;
                                                            const diffR = totCurrReady - totPrevReady;
                                                            const diffS = totCurrShort - totPrevShort;
                                                            const pctT = totPrevTotal > 0 ? ((totCurrTotal - totPrevTotal) / totPrevTotal) * 100 : 0;
                                                            return (
                                                                <>
                                                                    <td className="p-2 border text-right bg-blue-100/30">{Math.round(totPrevReady).toLocaleString('en-IN')}</td>
                                                                    <td className="p-2 border text-right bg-blue-100/30">{Math.round(totPrevShort).toLocaleString('en-IN')}</td>
                                                                    <td className="p-2 border text-right bg-blue-200/40">{Math.round(totPrevTotal).toLocaleString('en-IN')}</td>
                                                                    <td className="p-2 border text-right bg-emerald-100/30">{Math.round(totCurrReady).toLocaleString('en-IN')}</td>
                                                                    <td className="p-2 border text-right bg-emerald-100/30">{Math.round(totCurrShort).toLocaleString('en-IN')}</td>
                                                                    <td className="p-2 border text-right bg-emerald-200/40 text-indigo-900">{Math.round(totCurrTotal).toLocaleString('en-IN')}</td>
                                                                    <td className={`p-2 border text-right ${diffR >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{Math.round(diffR).toLocaleString('en-IN')}</td>
                                                                    <td className={`p-2 border text-right ${diffS >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{Math.round(diffS).toLocaleString('en-IN')}</td>
                                                                    <td className={`p-2 border text-right ${pctT >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>{pctT.toFixed(0)}%</td>
                                                                </>
                                                            );
                                                        })()}
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}

                                {/* Siddhi Stock Report Pivot Section */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="px-6 py-4 bg-emerald-600 flex items-center gap-3">
                                        <Table className="w-5 h-5 text-white/70" />
                                        <h3 className="text-lg font-bold text-white uppercase tracking-tight">Siddhi Stock Report Pivot (Make & Group)</h3>
                                    </div>
                                    <div className="overflow-x-auto p-4">
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase">
                                                    <th className="p-3 border">Make / Group</th>
                                                    <th className="p-3 border text-center bg-blue-50/50" colSpan={2}>Previous Weeks (Manual)</th>
                                                    <th className="p-3 border text-center bg-indigo-50/50" colSpan={2}>Present Weeks (Actual)</th>
                                                    <th className="p-3 border text-center bg-gray-50" colSpan={3}>Difference Analysis</th>
                                                </tr>
                                                <tr className="bg-gray-50 text-[9px] font-bold text-gray-500 uppercase">
                                                    <th className="p-2 border">Hierarchy</th>
                                                    <th className="p-2 border text-right bg-blue-50/30">Qty</th>
                                                    <th className="p-2 border text-right bg-blue-50/30">Value (₹)</th>
                                                    <th className="p-2 border text-right bg-indigo-50/30">Qty</th>
                                                    <th className="p-2 border text-right bg-indigo-50/30">Value (₹)</th>
                                                    <th className="p-2 border text-right">Qty Diff</th>
                                                    <th className="p-2 border text-right">Val Diff</th>
                                                    <th className="p-2 border text-right">% Val Chg</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {weeklyStats.stock.map(makeGroup => {
                                                    const makeTotal = makeGroup.groups.reduce((acc, g) => ({ qty: acc.qty + g.qty, value: acc.value + g.value }), { qty: 0, value: 0 });
                                                    const prevMakeQty = parseFloat(weeklyBenchmarks[`STOCK_${makeGroup.make}_Qty`] || 0);
                                                    const prevMakeVal = parseFloat(weeklyBenchmarks[`STOCK_${makeGroup.make}_Value`] || 0);

                                                    const diffMakeQty = makeTotal.qty - prevMakeQty;
                                                    const diffMakeVal = makeTotal.value - prevMakeVal;
                                                    const pctMakeVal = prevMakeVal > 0 ? (diffMakeVal / prevMakeVal) * 100 : 0;

                                                    return (
                                                        <React.Fragment key={makeGroup.make}>
                                                            <tr className="bg-gray-50/50">
                                                                <td className="p-2 border font-black text-gray-900 uppercase bg-gray-100/50">{makeGroup.make}</td>
                                                                <td className="p-2 border bg-blue-50/5">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-transparent text-right font-bold outline-none border-b border-transparent focus:border-blue-300"
                                                                        value={weeklyBenchmarks[`STOCK_${makeGroup.make}_Qty`] || ''}
                                                                        onChange={(e) => setWeeklyBenchmarks(prev => ({ ...prev, [`STOCK_${makeGroup.make}_Qty`]: e.target.value }))}
                                                                        placeholder="0"
                                                                    />
                                                                </td>
                                                                <td className="p-2 border bg-blue-50/5">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-transparent text-right font-bold outline-none border-b border-transparent focus:border-blue-300"
                                                                        value={weeklyBenchmarks[`STOCK_${makeGroup.make}_Value`] || ''}
                                                                        onChange={(e) => setWeeklyBenchmarks(prev => ({ ...prev, [`STOCK_${makeGroup.make}_Value`]: e.target.value }))}
                                                                        placeholder="0"
                                                                    />
                                                                </td>
                                                                <td className="p-2 border text-right font-black text-indigo-700 bg-indigo-50/5">{Math.round(makeTotal.qty).toLocaleString('en-IN')}</td>
                                                                <td className="p-2 border text-right font-black text-indigo-900 bg-indigo-50/10">{Math.round(makeTotal.value).toLocaleString('en-IN')}</td>
                                                                <td className={`p-2 border text-right font-black ${diffMakeQty >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{Math.round(diffMakeQty).toLocaleString('en-IN')}</td>
                                                                <td className={`p-2 border text-right font-black ${diffMakeVal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{Math.round(diffMakeVal).toLocaleString('en-IN')}</td>
                                                                <td className={`p-2 border text-right font-black ${pctMakeVal >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>{pctMakeVal !== 0 ? `${pctMakeVal.toFixed(0)}%` : '-'}</td>
                                                            </tr>
                                                            {makeGroup.groups.map(grp => {
                                                                const prevGrpQty = parseFloat(weeklyBenchmarks[`STOCK_${makeGroup.make}_${grp.group}_Qty`] || 0);
                                                                const prevGrpVal = parseFloat(weeklyBenchmarks[`STOCK_${makeGroup.make}_${grp.group}_Value`] || 0);
                                                                const diffGrpQty = grp.qty - prevGrpQty;
                                                                const diffGrpVal = grp.value - prevGrpVal;
                                                                const pctGrpVal = prevGrpVal > 0 ? (diffGrpVal / prevGrpVal) * 100 : 0;

                                                                return (
                                                                    <tr key={grp.group} className="text-[10px] text-gray-500 hover:bg-emerald-50/30 transition-colors">
                                                                        <td className="p-2 border pl-6 italic">{grp.group}</td>
                                                                        <td className="p-2 border bg-blue-50/5">
                                                                            <input
                                                                                type="number"
                                                                                className="w-full bg-transparent text-right outline-none text-[9px]"
                                                                                value={weeklyBenchmarks[`STOCK_${makeGroup.make}_${grp.group}_Qty`] ? Math.round(parseFloat(weeklyBenchmarks[`STOCK_${makeGroup.make}_${grp.group}_Qty`])).toString() : ''}
                                                                                onChange={(e) => setWeeklyBenchmarks(prev => ({ ...prev, [`STOCK_${makeGroup.make}_${grp.group}_Qty`]: e.target.value }))}
                                                                                placeholder="0"
                                                                            />
                                                                        </td>
                                                                        <td className="p-2 border bg-blue-50/5">
                                                                            <input
                                                                                type="number"
                                                                                className="w-full bg-transparent text-right outline-none text-[9px]"
                                                                                value={weeklyBenchmarks[`STOCK_${makeGroup.make}_${grp.group}_Value`] ? Math.round(parseFloat(weeklyBenchmarks[`STOCK_${makeGroup.make}_${grp.group}_Value`])).toString() : ''}
                                                                                onChange={(e) => setWeeklyBenchmarks(prev => ({ ...prev, [`STOCK_${makeGroup.make}_${grp.group}_Value`]: e.target.value }))}
                                                                                placeholder="0"
                                                                            />
                                                                        </td>
                                                                        <td className="p-2 border text-right">{Math.round(grp.qty).toLocaleString('en-IN')}</td>
                                                                        <td className="p-2 border text-right font-bold text-gray-700">{Math.round(grp.value).toLocaleString('en-IN')}</td>
                                                                        <td className={`p-2 border text-right ${diffGrpQty >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.round(diffGrpQty).toLocaleString('en-IN')}</td>
                                                                        <td className={`p-2 border text-right ${diffGrpVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.round(diffGrpVal).toLocaleString('en-IN')}</td>
                                                                        <td className={`p-2 border text-right font-medium ${pctGrpVal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{pctGrpVal !== 0 ? `${pctGrpVal.toFixed(0)}%` : '-'}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                                <tr className="bg-emerald-800 text-white font-black text-xs">
                                                    <td className="p-3 border uppercase tracking-widest text-[10px]">Grand Total Stock</td>
                                                    <td className="p-3 border text-right bg-blue-900/10 font-mono">
                                                        {Math.round(weeklyStats.stock.reduce((acc, m) => acc + parseFloat(weeklyBenchmarks[`STOCK_${m.make}_Qty`] || 0), 0)).toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="p-3 border text-right bg-blue-900/10 font-mono">
                                                        {Math.round(weeklyStats.stock.reduce((acc, m) => acc + parseFloat(weeklyBenchmarks[`STOCK_${m.make}_Value`] || 0), 0)).toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="p-3 border text-right font-mono">
                                                        {Math.round(weeklyStats.stock.reduce((acc, m) => acc + m.groups.reduce((a, g) => a + g.qty, 0), 0)).toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="p-3 border text-right bg-emerald-600 font-mono">
                                                        {Math.round(weeklyStats.stock.reduce((acc, m) => acc + m.groups.reduce((a, g) => a + g.value, 0), 0)).toLocaleString('en-IN')}
                                                    </td>
                                                    {(() => {
                                                        const totPrevQty = weeklyStats.stock.reduce((acc, m) => acc + parseFloat(weeklyBenchmarks[`STOCK_${m.make}_Qty`] || 0), 0);
                                                        const totPrevVal = weeklyStats.stock.reduce((acc, m) => acc + parseFloat(weeklyBenchmarks[`STOCK_${m.make}_Value`] || 0), 0);
                                                        const totCurrQty = weeklyStats.stock.reduce((acc, m) => acc + m.groups.reduce((a, g) => a + g.qty, 0), 0);
                                                        const totCurrVal = weeklyStats.stock.reduce((acc, m) => acc + m.groups.reduce((a, g) => a + g.value, 0), 0);
                                                        const diffQty = totCurrQty - totPrevQty;
                                                        const diffVal = totCurrVal - totPrevVal;
                                                        const pctVal = totPrevVal > 0 ? (diffVal / totPrevVal) * 100 : 0;
                                                        return (
                                                            <>
                                                                <td className={`p-3 border text-right font-mono ${diffQty >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{Math.round(diffQty).toLocaleString('en-IN')}</td>
                                                                <td className={`p-3 border text-right font-mono ${diffVal >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{Math.round(diffVal).toLocaleString('en-IN')}</td>
                                                                <td className={`p-3 border text-right font-black ${pctVal >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{pctVal !== 0 ? `${pctVal.toFixed(0)}%` : '-'}</td>
                                                            </>
                                                        );
                                                    })()}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default DashboardView;