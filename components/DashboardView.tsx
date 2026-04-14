import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem, SalesRecord } from '../types';
import { TrendingUp, TrendingDown, Package, ClipboardList, ShoppingCart, Calendar, Filter, PieChart as PieIcon, BarChart3, Users, ArrowRight, Activity, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, UserCircle, Minus, Plus, ChevronDown, ChevronUp, Link2Off, AlertTriangle, Layers, Clock, CheckCircle2, AlertCircle, User, Factory, Tag, ArrowLeft, BarChart4, Hourglass, History, AlertOctagon, ChevronRight, ListOrdered, Table, X, ArrowUp, ArrowDown, Search, ArrowUpDown, FileText, UserPlus, UserMinus, PanelLeftClose, RotateCcw } from 'lucide-react';
import MOMView from './MOMView';
import AttendeeMasterView from './AttendeeMasterView';
import CustomerFYAnalysisView from './CustomerFYAnalysisView';
import { momService } from '../services/momService';
import { utils, writeFile } from 'xlsx';

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

const roundToTen = (num: number) => {
    if (num <= 0) return 0;
    return Math.ceil(num / 10) * 10;
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

const SalesTrendChart = React.memo(({ data, maxVal }: { data: { labels: string[], series: any[] }, maxVal: number }) => {
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
    const barWidth = 100 / (labelCount * (data.series.length + 1));

    return (
        <div className="flex flex-col h-full w-full bg-gradient-to-b from-white/50 to-gray-50/30 rounded-lg p-3">
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mb-3 pb-2 border-b border-gray-200">
                {data.series.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }}></div>
                        <span className="font-bold text-gray-700">{s.name}</span>
                    </div>
                ))}
            </div>

            <div
                className="flex flex-col h-full select-none overflow-visible px-2 relative"
                ref={containerRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
            >
                <div className="flex-1 relative min-h-0 pt-4 pb-2">
                    {/* Value Labels Above Bars */}
                    {data.series.map((s: any, sIdx: number) =>
                        s.active && s.data.map((val: number, i: number) => {
                            if (val === 0 || isNaN(val)) return null;
                            const xPos = ((i + 0.5) / labelCount) * 100 + (sIdx - (data.series.length - 1) / 2) * (100 / (labelCount * data.series.length)) * 0.8;
                            const yPos = 100 - ((val / chartMax) * 100);
                            const isHovered = hoverIndex === i;
                            return (
                                <div
                                    key={`${sIdx}-${i}`}
                                    className={`absolute text-[7px] font-bold bg-white/95 px-1 rounded shadow-sm border border-gray-100 z-10 pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all duration-200 ${isHovered ? 'scale-125 z-20 border-blue-300' : 'opacity-70'}`}
                                    style={{ left: `${xPos}%`, top: `${yPos}%`, color: s.color, opacity: hoverIndex !== null && hoverIndex !== i ? 0.2 : 1 }}
                                >
                                    {formatLargeValue(val, true)}
                                </div>
                            );
                        })
                    )}

                    {/* SVG Bar Chart */}
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Grid Lines */}
                        {[25, 50, 75].map((line, i) => (
                            <line key={i} x1="0" y1={line} x2="100" y2={line} stroke="#e5e7eb" strokeWidth="0.5" vectorEffect="non-scaling-stroke" opacity="0.5" />
                        ))}
                        <line x1="0" y1="100" x2="100" y2="100" stroke="#d1d5db" strokeWidth="1" vectorEffect="non-scaling-stroke" />

                        {/* Bars */}
                        {data.series.map((s: any, sIdx: number) => {
                            if (!s.active) return null;
                            return s.data.map((val: number, i: number) => {
                                const barHeight = (val / chartMax) * 100;
                                const barGroupWidth = 100 / labelCount;
                                const barIndividualWidth = barGroupWidth / (data.series.length + 0.5);
                                const xStart = (i / labelCount) * 100 + (sIdx + 0.25) * barIndividualWidth;
                                const isHovered = hoverIndex === i;

                                return (
                                    <g key={`${sIdx}-${i}`}>
                                        <rect
                                            x={xStart}
                                            y={100 - barHeight}
                                            width={barIndividualWidth * 0.85}
                                            height={barHeight}
                                            fill={s.color}
                                            opacity={isHovered ? 1 : 0.85}
                                            className="transition-all duration-200 cursor-pointer hover:opacity-100"
                                            onMouseEnter={() => setHoverIndex(i)}
                                            onMouseLeave={() => setHoverIndex(null)}
                                            rx="0.5"
                                        />
                                        {/* Bar shadow */}
                                        <rect
                                            x={xStart}
                                            y={100}
                                            width={barIndividualWidth * 0.85}
                                            height="0.5"
                                            fill={s.color}
                                            opacity="0.2"
                                            rx="0.25"
                                        />
                                    </g>
                                );
                            });
                        })}
                    </svg>

                    {/* Tooltip */}
                    {hoverIndex !== null && (
                        <div className="absolute z-30 bg-gray-900/95 backdrop-blur-md text-white text-[9px] p-3 rounded-lg shadow-2xl border border-gray-700 pointer-events-none transition-all duration-100 min-w-[150px]" style={{ left: `${(hoverIndex / (labelCount - 1)) * 100}%`, top: '5%', transform: `translateX(${hoverIndex > labelCount / 2 ? '-110%' : '10%'})` }}>
                            <div className="font-bold border-b border-gray-600 pb-2 mb-2 text-gray-100 text-center uppercase tracking-wider text-[10px]">{data.labels[hoverIndex]}</div>
                            <div className="flex flex-col gap-1.5">
                                {data.series.map((s: any, i: number) => (
                                    <div key={i} className={`flex items-center justify-between gap-3 ${!s.active ? 'opacity-50' : ''}`}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }}></div>
                                            <span className="text-gray-300 font-semibold whitespace-nowrap">{s.name}</span>
                                        </div>
                                        <span className="font-bold text-white text-[10px]">{formatLargeValue(s.data[hoverIndex], true)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* X-Axis Labels */}
                <div className="h-6 relative border-t border-gray-200 pt-1">
                    {data.labels.map((label, i) => {
                        const labelCount = data.labels.length;
                        const skip = labelCount > 15 && i % 3 !== 0 && i !== labelCount - 1;
                        if (skip) return null;
                        const x = ((i + 0.5) / labelCount) * 100;
                        return (
                            <div key={i} className="absolute top-0 flex flex-col items-center transform -translate-x-1/2" style={{ left: `${x}%` }}>
                                <div className="h-1 w-px bg-gray-400 mb-0.5" />
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-tight whitespace-nowrap">{label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

const ModernDonutChartDashboard: React.FC<{
    data: { label: string; value: number; color?: string }[],
    title: string,
    isCurrency?: boolean,
    centerColorClass?: string,
    showDataLabels?: boolean
}> = React.memo(({ data, title, isCurrency, centerColorClass, showDataLabels = true }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    if (data.length === 0) return <div className="h-48 flex items-center justify-center text-gray-400 text-[10px] font-bold uppercase">No records found</div>;

    const total = data.reduce((a, b) => a + (b.value || 0), 0);
    const colorPalette = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8D8EA', '#AA96DA', '#C7CEEA'];
    const labelColorPalette = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8D8EA', '#AA96DA', '#C7CEEA'];

    let cumulativePercent = 0;
    const slices = data.map((slice, i) => {
        const percent = slice.value / (total || 1);
        const startPercent = cumulativePercent;
        cumulativePercent += percent;
        return {
            ...slice,
            percent,
            startPercent,
            color: slice.color || colorPalette[i % colorPalette.length],
            labelColor: labelColorPalette[i % labelColorPalette.length]
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
            <div className="flex gap-4 flex-1 min-h-0">
                <div className="flex flex-col items-center justify-center gap-4 flex-shrink-0">
                    <div className="relative w-40 h-40 group">
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full scale-95 opacity-40"></div>
                        <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full drop-shadow-[0_8px_24px_rgba(0,0,0,0.12)] relative z-10">
                            {slices.map((slice, i) => {
                                if (slice.percent >= 0.999) return <circle key={i} cx="0" cy="0" r="0.85" fill="none" stroke={slice.color} strokeWidth="0.3" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} className="transition-all cursor-pointer hover:opacity-80" />;
                                const [startX, startY] = getCoordinatesForPercent(slice.startPercent);
                                const [endX, endY] = getCoordinatesForPercent(slice.startPercent + slice.percent);
                                const largeArcFlag = slice.percent > 0.5 ? 1 : 0;
                                const midPercent = slice.startPercent + slice.percent / 2;
                                const [labelX, labelY] = getCoordinatesForPercent(midPercent);
                                
                                return (
                                    <g key={i}>
                                        <path
                                            d={`M ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} L ${endX * 0.72} ${endY * 0.72} A 0.72 0.72 0 ${largeArcFlag} 0 ${startX * 0.72} ${startY * 0.72} Z`}
                                            fill={slice.color}
                                            className={`transition-all duration-400 cursor-pointer ${hoveredIndex === i ? 'opacity-100 scale-[1.05] stroke-[0.03] stroke-white shadow-2xl' : 'opacity-90 hover:opacity-100 hover:scale-[1.03]'}`}
                                            onMouseEnter={() => setHoveredIndex(i)}
                                            onMouseLeave={() => setHoveredIndex(null)}
                                        />
                                        {/* Data Labels on Pie Chart - Vibrant Colors */}
                                        {showDataLabels && slice.percent > 0.08 && (
                                            <text
                                                x={labelX * 0.85}
                                                y={labelY * 0.85}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize="0.18"
                                                fontWeight="900"
                                                fill="#000000"
                                                pointerEvents="none"
                                                style={{ 
                                                    textShadow: '0 1px 3px rgba(255,255,255,0.9)',
                                                    paintOrder: 'stroke',
                                                    strokeWidth: '0.02',
                                                    stroke: 'white'
                                                }}
                                            >
                                                {((slice.value / total) * 100).toFixed(0)}%
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center z-20">
                            <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest truncate w-full mb-0.5">{centerLabel}</span>
                            <span className={`text-[12px] font-black leading-tight drop-shadow-sm transition-all duration-300 ${hoveredIndex !== null ? 'scale-110' : ''} ${centerColorClass || 'text-gray-900'}`}>{centerValue}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                    <div className="space-y-1">
                        {slices.map((item, i) => (
                            <div
                                key={i}
                                className={`flex items-center justify-between text-[9px] p-1.5 rounded transition-all cursor-pointer border border-transparent ${hoveredIndex === i ? 'bg-gray-100 border-gray-300' : 'hover:bg-gray-50'}`}
                                onMouseEnter={() => setHoveredIndex(i)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm border border-white/50" style={{ backgroundColor: item.color }}></span>
                                    <span className={`truncate font-bold`} style={{ color: item.labelColor }} title={String(item.label)}>{item.label}</span>
                                </div>
                                <div className="flex gap-2 items-center flex-shrink-0 ml-2">
                                    <span className="text-gray-500 font-bold text-[8px] bg-gray-50 px-1.5 py-0.5 rounded">{total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%</span>
                                    <span className={`font-black text-right min-w-[55px] ${hoveredIndex === i ? 'text-blue-600' : 'text-gray-900'}`}>{isCurrency ? formatLargeValue(item.value, true) : Math.round(item.value).toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
});


const HorizontalBarChart = React.memo(({
    data,
    title,
    color,
    totalForPercentage,
    compareLabel = 'PY',
    isStacked = false,
    secondaryLabel = 'Scheduled'
}: {
    data: { label: string; value: number, secondaryValue?: number, previous?: number, share?: number, latest?: number }[],
    title: string,
    color: string,
    totalForPercentage?: number,
    compareLabel?: string,
    isStacked?: boolean,
    secondaryLabel?: string
}) => {
    const sorted = [...data].sort((a, b) => ((b.value || 0) + (b.secondaryValue || 0)) - ((a.value || 0) + (a.secondaryValue || 0))).slice(0, 10);
    const maxVal = Math.max(sorted[0] ? (sorted[0].value + (sorted[0].secondaryValue || 0)) : 1, 1);
    const barColorClass = (color === 'blue' && isStacked) ? 'bg-rose-600' : color === 'blue' ? 'bg-blue-600' : color === 'emerald' ? 'bg-emerald-600' : color === 'purple' ? 'bg-purple-600' : color === 'rose' ? 'bg-rose-600' : 'bg-orange-600';
    const secondaryColorClass = (color === 'blue' && isStacked) ? 'bg-blue-500' : color === 'blue' ? 'bg-indigo-300' : color === 'emerald' ? 'bg-teal-300' : 'bg-gray-300';

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2 border-b border-gray-100 pb-1 flex justify-between items-center">
                <span>{title}</span>
                <div className="flex gap-3 items-center text-[9px]">
                    {isStacked && (
                        <div className="flex gap-2 items-center">
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-red-500"></div><span className="text-[8px]">Due</span></div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-blue-500"></div><span className="text-[8px]">{secondaryLabel}</span></div>
                        </div>
                    )}
                    {!isStacked && sorted.some(s => s.latest !== undefined) && (
                        <div className="flex items-center gap-1"><div className="w-1.5 h-4 bg-red-500 rounded-full"></div><span className="text-[8px] font-bold">Latest</span></div>
                    )}
                </div>
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
                                        {!isStacked && item.latest !== undefined && item.latest > 0 && (
                                            <div className="text-[8px] font-bold text-red-600">Latest: {formatLargeValue(item.latest, true)}</div>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-end min-w-[60px] bg-white pl-1">
                                        <span className="text-xs md:text-sm font-black text-gray-900 tracking-tight leading-none">{formatLargeValue(total, true)}</span>
                                        {item.previous !== undefined && item.previous > 0 && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tight">LY: {formatLargeValue(item.previous, true)}</span>
                                                <span className={`text-[9px] px-1 py-0.5 rounded-md font-black ${((total - item.previous) / item.previous) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                    {((total - item.previous) / item.previous) >= 0 ? '↑' : '↓'}{Math.abs(((total - item.previous) / item.previous) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden relative flex">
                                    {item.previous !== undefined && (
                                        <div className="absolute inset-0 bg-gray-200/50" style={{ width: `${(item.previous / maxVal) * 100}%` }}></div>
                                    )}
                                    <div className={`h-full ${barColorClass} transition-all duration-700 relative z-10`} style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                                    {item.secondaryValue !== undefined && (
                                        <div className={`h-full ${secondaryColorClass} transition-all duration-700 relative z-10`} style={{ width: `${(item.secondaryValue / maxVal) * 100}%` }}></div>
                                    )}
                                    {item.latest !== undefined && item.latest > 0 && (
                                        <div className="absolute h-full w-1.5 bg-red-500 rounded-full shadow-md" style={{ left: `${(item.latest / maxVal) * 100}%`, transform: 'translateX(-50%)', zIndex: 20 }} title={`Latest: ${formatLargeValue(item.latest, true)}`}></div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});


const HorizontalComparisonChart = React.memo(({
    data,
    title,
    color = 'blue',
    compareLabel = 'LY',
    onToggleDeclining,
    isDecliningOnly
}: {
    data: { label: string; value: number, previous?: number }[],
    title: string,
    color?: string,
    compareLabel?: string,
    onToggleDeclining?: (val: boolean) => void,
    isDecliningOnly?: boolean
}) => {
    const sorted = [...data].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 10);
    const maxVal = Math.max(...sorted.flatMap(d => [d.value, d.previous || 0]), 1);

    const barColorClass = color === 'emerald' ? 'bg-emerald-600' : 'bg-blue-600';
    const prevBarColorClass = 'bg-gray-200';

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 border-b border-gray-100 pb-1 flex justify-between items-center">
                <span className="flex items-center gap-2">
                    <BarChart4 className="w-3.5 h-3.5 text-blue-500" />
                    {title}
                    {onToggleDeclining && (
                        <button 
                            onClick={() => onToggleDeclining(!isDecliningOnly)}
                            className={`ml-2 px-2 py-0.5 rounded-full text-[7px] transition-all font-black uppercase tracking-tighter ${isDecliningOnly ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            {isDecliningOnly ? 'View: Declining' : 'View: Top 10'}
                        </button>
                    )}
                </span>
                <div className="flex gap-3 items-center text-[9px] font-bold text-gray-400">
                    <div className="flex items-center gap-1">
                        <div className={`w-2 h-0.5 ${barColorClass}`}></div>
                        <span>CY</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className={`w-2 h-0.5 ${prevBarColorClass}`}></div>
                        <span>{compareLabel}</span>
                    </div>
                </div>
            </h4>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-5 py-2">
                {sorted.map((item, i) => {
                    const diff = item.previous ? ((item.value - item.previous) / item.previous) * 100 : (item.value > 0 ? 100 : 0);
                    const isPositive = diff >= 0;
                    
                    return (
                        <div key={i} className="group relative">
                            <div className="flex justify-between items-start mb-1.5">
                                <div className="flex items-center gap-2 max-w-[75%] min-w-0">
                                    <span className="text-[11px] font-black text-gray-800 truncate" title={item.label}>
                                        {item.label}
                                    </span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black flex items-center gap-0.5 shadow-sm transition-transform group-hover:scale-110 ${isPositive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                        {isPositive ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
                                        {Math.abs(diff).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-black text-gray-900 tracking-tighter">
                                        {formatLargeValue(item.value, true)}
                                    </span>
                                    {item.previous !== undefined && (
                                        <span className="text-[8px] font-bold text-gray-400 uppercase">
                                            {compareLabel}: {formatLargeValue(item.previous, true)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="relative h-2 w-full bg-gray-50 rounded-full overflow-hidden shadow-inner">
                                {/* Ghost bar for previous year comparison */}
                                {item.previous !== undefined && (
                                    <div 
                                        className="absolute inset-y-0 left-0 bg-gray-200/60 rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${(item.previous / maxVal) * 100}%`, zIndex: 5 }}
                                    ></div>
                                )}
                                {/* Main current year bar */}
                                <div 
                                    className={`absolute inset-y-0 left-0 ${barColorClass} rounded-full z-10 transition-all duration-1000 ease-out shadow-[0_1px_3px_rgba(0,0,0,0.2)] group-hover:brightness-110`}
                                    style={{ width: `${(item.value / maxVal) * 100}%` }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-50"></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});



interface GroupedCustomerAnalysisProps {
    data: { group: string, total: number, totalPrevious: number, customers: { name: string, current: number, previous: number, diff: number }[] }[];
    compareLabel?: string;
    groupingMode: 'RAW' | 'MERGED';
    setGroupingMode: (mode: 'RAW' | 'MERGED') => void;
}

const GroupedCustomerAnalysis: React.FC<GroupedCustomerAnalysisProps> = React.memo(({
    data,
    compareLabel = 'PY',
    groupingMode,
    setGroupingMode
}) => {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'current', direction: 'desc' });

    const toggleGroup = (group: string) => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));

    const expandAll = () => {
        const newExpanded: Record<string, boolean> = {};
        data.forEach(g => newExpanded[g.group] = true);
        setExpandedGroups(newExpanded);
    };
    const collapseAll = () => setExpandedGroups({});

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const grandTotal = useMemo(() => data.reduce((acc, g) => acc + g.total, 0), [data]);

    const processedData = useMemo(() => {
        return data.map(group => {
            const filteredCustomers = group.customers.filter(c =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase())
            );

            const sortedCustomers = [...filteredCustomers].sort((a, b) => {
                let valA = 0;
                let valB = 0;

                switch (sortConfig.key) {
                    case 'name': return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                    case 'current': valA = a.current; valB = b.current; break;
                    case 'previous': valA = a.previous; valB = b.previous; break;
                    case 'diff': valA = a.diff; valB = b.diff; break;
                    case 'growth':
                        valA = a.previous > 0 ? (a.diff / a.previous) : -999;
                        valB = b.previous > 0 ? (b.diff / b.previous) : -999;
                        break;
                    default: return 0;
                }

                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            });

            return { ...group, customers: sortedCustomers };
        }).filter(g => g.customers.length > 0 || (searchTerm && g.group.toLowerCase().includes(searchTerm.toLowerCase())));
    }, [data, searchTerm, sortConfig]);

    useEffect(() => {
        if (searchTerm) {
            const newExpanded: Record<string, boolean> = {};
            processedData.forEach(g => newExpanded[g.group] = true);
            setExpandedGroups(newExpanded);
        }
    }, [searchTerm]);

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-3 border-b border-gray-200 flex flex-col gap-3 bg-gray-50/50">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-gray-700 uppercase flex items-center gap-2 tracking-wide">
                        <Table className="w-3.5 h-3.5 text-blue-600" />
                        Customer Pivot Analysis
                    </h4>
                    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
                        <button onClick={expandAll} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all" title="Expand All"><Plus className="w-3 h-3" /></button>
                        <div className="w-px h-3 bg-gray-200"></div>
                        <button onClick={collapseAll} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all" title="Collapse All"><Minus className="w-3 h-3" /></button>
                    </div>
                </div>
                <div className="relative group">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search customers or groups..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full border-collapse text-left min-w-[300px]">
                    <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm text-[9px] font-black text-gray-500 uppercase tracking-wider border-b border-gray-200">
                        <tr>
                            <th className="py-2.5 px-3 text-left w-[45%] border-r border-gray-100 bg-gray-100/50">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('name')}>
                                            <Layers className="w-3 h-3" />
                                            {groupingMode === 'MERGED' ? 'Group / Customer' : 'Cust Group / Customer'}
                                            <ArrowUpDown className="w-2.5 h-2.5 opacity-50" />
                                        </div>
                                        <div className="flex bg-white rounded-md p-0.5 border border-gray-200 shadow-sm">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setGroupingMode('MERGED'); }}
                                                className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all ${groupingMode === 'MERGED' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                            >G</button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setGroupingMode('RAW'); }}
                                                className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all ${groupingMode === 'RAW' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                            >CG</button>
                                        </div>
                                    </div>
                                </div>
                            </th>
                            <th className="py-2.5 px-2 text-right cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => handleSort('current')}>
                                <div className="flex items-center justify-end gap-1">Current <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" /></div>
                            </th>
                            <th className="py-2.5 px-2 text-right cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => handleSort('previous')}>
                                <div className="flex items-center justify-end gap-1">{compareLabel} <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" /></div>
                            </th>
                            <th className="py-2.5 px-2 text-right hidden sm:table-cell cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => handleSort('diff')}>
                                <div className="flex items-center justify-end gap-1">Diff <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" /></div>
                            </th>
                            <th className="py-2.5 px-2 text-right cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => handleSort('growth')}>
                                <div className="flex items-center justify-end gap-1">Growth <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" /></div>
                            </th>
                            <th className="py-2.5 px-2 text-right bg-yellow-50/50 text-yellow-800">Share %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[10px]">
                        {processedData.map((group) => (
                            <React.Fragment key={group.group}>
                                <tr className="bg-gray-50/50 hover:bg-blue-50/30 transition-colors cursor-pointer group border-b border-white" onClick={() => toggleGroup(group.group)}>
                                    <td className="py-2 px-2 border-l-2 border-transparent group-hover:border-blue-500 transition-colors">
                                        <div className="flex items-center gap-2 font-black text-gray-800 tracking-tight">
                                            {expandedGroups[group.group] ? <ChevronDown className="w-3.5 h-3.5 text-blue-600" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500" />}
                                            {group.group}
                                            <span className="bg-gray-200 text-gray-600 px-1.5 rounded-full text-[8px] font-bold">{group.customers.length}</span>
                                        </div>
                                    </td>
                                    <td className="py-2 px-2 text-right font-black text-gray-900">{formatLargeValue(group.total, true)}</td>
                                    <td className="py-2 px-2 text-right font-medium text-gray-500 ">{formatLargeValue(group.totalPrevious, true)}</td>
                                    <td className="py-2 px-2 text-right font-bold hidden sm:table-cell whitespace-nowrap">
                                        <span className={group.total - group.totalPrevious >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                            {formatLargeValue(group.total - group.totalPrevious, true)}
                                        </span>
                                    </td>
                                    <td className="py-2 px-2 text-right font-bold">
                                        <div className={`flex items-center justify-end gap-1 px-1.5 py-0.5 rounded ${group.total >= group.totalPrevious ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {group.total >= group.totalPrevious ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                            {group.totalPrevious > 0 ? (((group.total - group.totalPrevious) / group.totalPrevious) * 100).toFixed(0) : '100'}%
                                        </div>
                                    </td>
                                    <td className="py-2 px-2 text-right font-black text-yellow-700 bg-yellow-50/30">
                                        {grandTotal > 0 ? ((group.total / grandTotal) * 100).toFixed(1) : 0}%
                                    </td>
                                </tr>
                                {expandedGroups[group.group] && group.customers.map((cust, idx) => (
                                    <tr key={`${group.group}-${idx}`} className="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                        <td className="py-1.5 px-2 pl-9 border-l border-dashed border-gray-200">
                                            <div className="truncate max-w-[140px] text-gray-600 font-medium" title={cust.name}>{cust.name}</div>
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-bold text-gray-700">{formatLargeValue(cust.current, true)}</td>
                                        <td className="py-1.5 px-2 text-right text-gray-400">{formatLargeValue(cust.previous, true)}</td>
                                        <td className="py-1.5 px-2 text-right font-medium hidden sm:table-cell whitespace-nowrap">
                                            <span className={cust.diff >= 0 ? "text-emerald-600" : "text-rose-500"}>
                                                {formatLargeValue(cust.diff, true)}
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-2 text-right">
                                            <div className={`flex items-center justify-end gap-0.5 font-bold ${cust.diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                {cust.diff >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                                {cust.previous > 0 ? ((Math.abs(cust.diff) / cust.previous) * 100).toFixed(0) : '100'}%
                                            </div>
                                        </td>
                                        <td className="py-1.5 px-2 text-right text-gray-400 border-l border-gray-50">
                                            {grandTotal > 0 ? ((cust.current / grandTotal) * 100).toFixed(1) : 0}%
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table >
                {
                    processedData.length === 0 && (
                        <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-2">
                            <Filter className="w-8 h-8 opacity-20" />
                            <span className="text-xs font-bold uppercase opacity-60">No matching data found</span>
                        </div>
                    )
                }
            </div >
            <div className="bg-gray-50 border-t border-gray-200 p-2 text-[9px] text-gray-500 flex justify-between items-center rounded-b-xl">
                <span className="font-bold uppercase tracking-wider">{processedData.length} Groups Active</span>
                <div className="flex gap-4  font-bold">
                    <span className="text-gray-400">PREV: {formatLargeValue(processedData.reduce((acc, g) => acc + g.totalPrevious, 0), true)}</span>
                    <span className="text-blue-700">CURR: {formatLargeValue(processedData.reduce((acc, g) => acc + g.total, 0), true)}</span>
                </div>
            </div>
        </div >
    );
});

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
    isAdmin?: boolean;
}

const DashboardView: React.FC<DashboardViewProps> = React.memo(({
    materials = [],
    closingStock = [],
    pendingSO = [],
    pendingPO = [],
    salesReportItems = [],
    customers = [],
    setActiveTab,
    isAdmin = false
}) => {
    const [invDisplayLimit, setInvDisplayLimit] = useState(100);
    const [activeSubTab, setActiveSubTab] = useState<'sales' | 'inventory' | 'so' | 'po' | 'weekly' | 'stockPlanning' | 'customerAnalysis'>('sales');
    const [decliningOnlyTopTen, setDecliningOnlyTopTen] = useState(false);
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
                    const target = new Date(); // Dynamic target date for benchmarks
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
    const [selectedStockItem, setSelectedStockItem] = useState<string | null>(null);
    const [stockSearchTerm, setStockSearchTerm] = useState('');
    const [stockSlicers, setStockSlicers] = useState({ make: 'ALL', group: 'ALL', strategy: 'ALL', class: 'ALL' });
    const [stockQuickFilter, setStockQuickFilter] = useState<'ALL' | 'SHORTAGE' | 'REFILL'>('ALL');
    const [stockSortConfig, setStockSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'salesCY', direction: 'desc' });





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
        const fiscalYear = `${startYear}-${(startYear + 1).toString().slice(-2)}`;
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
        // Only calculate if needed for active sub-tabs
        if (!['sales', 'weekly', 'customerAnalysis'].includes(activeSubTab)) return [];

        console.time('📊 Dashboard.enrichedSales');
        const custMap = new Map<string, CustomerMasterItem>();
        customers.forEach(c => { if (c.customerName) custMap.set(String(c.customerName).toLowerCase().trim(), c); });

        const matMap = new Map<string, { make: string, group: string }>();
        materials.forEach(m => {
            const info = { make: m.make || 'Unspecified', group: m.materialGroup || 'Unspecified' };
            if (m.partNo) matMap.set(String(m.partNo).toLowerCase().trim(), info);
            if (m.description) matMap.set(String(m.description).toLowerCase().trim(), info);
        });

        const dateCache = new Map<any, { obj: Date, fi: any }>();

        const res = salesReportItems.map(item => {
            let cached = dateCache.get(item.date);
            if (!cached) {
                const dateObj = parseDate(item.date);
                cached = { obj: dateObj, fi: getFiscalInfo(dateObj) };
                dateCache.set(item.date, cached);
            }

            const custKey = String(item.customerName || '').toLowerCase().trim();
            const cust = custMap.get(custKey);
            const mergedGroup = getMergedGroupName(cust?.group || cust?.customerGroup || 'Unassigned');
            const custGroupName = groupingMode === 'RAW' ? (cust?.customerGroup || 'Unassigned') : mergedGroup;

            const matKey = String(item.particulars || '').toLowerCase().trim();
            const matInfo = matMap.get(matKey);

            return {
                ...item,
                ...cached.fi,
                rawDate: cached.obj,
                custGroup: custGroupName,
                custStatus: cust?.status || 'Unknown',
                make: getMergedMakeName(matInfo?.make || 'Unspecified'),
                matGroup: matInfo?.group || 'Unspecified'
            };
        });
        console.timeEnd('📊 Dashboard.enrichedSales');
        return res;
    }, [salesReportItems, customers, materials, groupingMode, activeSubTab]);

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
        const pyString = `${pyStart}-${(parseInt(parts[1]) - 1).toString().padStart(2, '0')}`;

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
        const pyEnd = parseInt(parts[1]) - 1;
        const pyString = `${pyStart}-${pyEnd.toString().padStart(2, '0')}`;

        console.log(`\n=== YoY Debug START ===`);
        console.log(`Current FY: ${selectedFY}`);
        console.log(`Looking for Previous FY: ${pyString}`);
        console.log(`Total enrichedSales records: ${enrichedSales.length}`);

        const availableFYs = Array.from(new Set(enrichedSales.map(i => i.fiscalYear))).sort();
        console.log(`Available FYs in data:`, availableFYs);

        let data = enrichedSales.filter(i => i.fiscalYear === pyString);
        console.log(`Records found for ${pyString}: ${data.length}`);

        if (data.length > 0) {
            console.log(`Sample record:`, data[0]);
            const sampleTotal = data.slice(0, 5).reduce((acc, i) => acc + (i.value || 0), 0);
            console.log(`First 5 records total value: ${sampleTotal}`);
        }

        if (timeView === 'MONTH') {
            data = data.filter(i => i.fiscalMonthIndex === selectedMonth);
            console.log(`After MONTH filter (month ${selectedMonth}): ${data.length} records`);
        } else if (timeView === 'WEEK') {
            data = data.filter(i => i.weekNumber === selectedWeek);
            console.log(`After WEEK filter (week ${selectedWeek}): ${data.length} records`);
        }
        // FY view: Apply YTD Filter (Same period last year) for YTD Comparison (yoyData)
        // This ensures YTD Comparison matches "Current YTD" vs "Previous YTD"
        const today = new Date();
        const cutoffDate = new Date(today);
        cutoffDate.setFullYear(today.getFullYear() - 1);

        data = data.filter(i => i.rawDate <= cutoffDate);
        console.log(`Applied YTD filter for FY view. Cutoff: ${cutoffDate.toDateString()}. Records: ${data.length}`);

        // This compares current year progress against complete previous year


        if (selectedMake !== 'ALL') {
            const before = data.length;
            data = data.filter(i => i.make === selectedMake);
            console.log(`After Make filter (${selectedMake}): ${data.length} records (removed ${before - data.length})`);
        }
        if (selectedMatGroup !== 'ALL') {
            const before = data.length;
            data = data.filter(i => i.matGroup === selectedMatGroup);
            console.log(`After MatGroup filter (${selectedMatGroup}): ${data.length} records (removed ${before - data.length})`);
        }

        const totalVal = data.reduce((acc, i) => acc + (i.value || 0), 0);
        const totalQty = data.reduce((acc, i) => acc + (i.quantity || 0), 0);
        console.log(`FINAL YoY Data: ${data.length} records, Total Value: ${totalVal.toFixed(2)}, Total Qty: ${totalQty}`);
        console.log(`=== YoY Debug END ===\n`);

        return data;
    }, [selectedFY, timeView, selectedMonth, selectedWeek, enrichedSales, selectedMake, selectedMatGroup]);

    const kpis = useMemo(() => {
        // Calculate FULL FY values (not filtered by month/week) for "Current Sales FY"
        const fullFYData = enrichedSales.filter(i => {
            if (i.fiscalYear !== selectedFY) return false;
            if (selectedMake !== 'ALL' && i.make !== selectedMake) return false;
            if (selectedMatGroup !== 'ALL' && i.matGroup !== selectedMatGroup) return false;
            return true;
        });
        const currValFY = fullFYData.reduce((acc, i) => acc + (i.value || 0), 0);

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

        console.log('KPIs Calculation:', {
            currVal, currQty, uniqueCusts, avgOrder,
            prevVal, prevQty, prevCusts, prevAvgOrder,
            yoyVal, yoyQty, yoyCusts, yoyAvgOrder
        });

        return {
            currVal, currValFY, currQty, uniqueCusts, avgOrder,
            prevVal, prevQty, prevCusts, prevAvgOrder,
            yoyVal, yoyQty, yoyCusts, yoyAvgOrder
        };
    }, [currentData, previousDataForComparison, yoyData, enrichedSales, selectedFY, selectedMake, selectedMatGroup]);

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
        const custMap = new Map<string, { current: number, previous: number, latest: number }>();
        
        // Current period data
        currentData.forEach(i => {
            const name = String(i.customerName || 'Unknown');
            if (!custMap.has(name)) custMap.set(name, { current: 0, previous: 0, latest: 0 });
            custMap.get(name)!.current += (i.value || 0);
            custMap.get(name)!.latest = Math.max(custMap.get(name)!.latest, i.value || 0);
        });
        
        // Previous period data for comparison
        const compData = timeView === 'FY' ? yoyData : previousDataForComparison;
        compData.forEach(i => {
            const name = String(i.customerName || 'Unknown');
            if (!custMap.has(name)) custMap.set(name, { current: 0, previous: 0, latest: 0 });
            custMap.get(name)!.previous += (i.value || 0);
        });
        
        let items = Array.from(custMap.entries())
            .map(([label, v]) => ({ label, value: v.current, previous: v.previous, latest: v.latest }));

        if (decliningOnlyTopTen) {
            items = items.filter(i => i.value < (i.previous || 0));
        }

        return items
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [currentData, previousDataForComparison, yoyData, timeView, decliningOnlyTopTen]);

    const normalizeCustomerName = (name: string): string => {
        if (!name) return 'Unknown';
        const trimmed = name.trim();
        const parenIndex = trimmed.indexOf('(');
        if (parenIndex > 0) {
            return trimmed.substring(0, parenIndex).trim();
        }
        return trimmed;
    };



    const stockPlanningData = useMemo(() => {
        if (activeSubTab !== 'stockPlanning') return [];

        const today = new Date();
        const info = getFiscalInfo(today);
        const currentFY = info.fiscalYear;
        const prevFY = `${parseInt(currentFY.split('-')[0]) - 1}-${currentFY.split('-')[0].slice(-2)}`;

        const matMap = new Map<string, any>();
        materials.forEach(m => {
            const desc = (m.description || '').toLowerCase().trim();
            const part = (m.partNo || '').toLowerCase().trim();
            const entry = {
                description: m.description, partNo: m.partNo, make: getMergedMakeName(m.make), group: m.materialGroup,
                stock: 0, soDue: 0, soSched: 0, poDue: 0, poSched: 0, salesCY: 0, salesPY: 0, regSalesCY: 0, regSalesPY: 0,
                monthlySales: new Map<string, number>(), rollingMonths: new Set<string>(), hasProject: false
            };
            if (desc) matMap.set(desc, entry);
            if (part && part !== desc) matMap.set(part, entry);
        });

        closingStock.forEach(i => {
            const k = (i.description || '').toLowerCase().trim();
            const target = matMap.get(k);
            if (target) target.stock += (i.quantity || 0);
        });

        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const processOrder = (items: any[], isSO: boolean) => {
            items.forEach(item => {
                const k = (item.itemName || '').toLowerCase().trim();
                const p = (item.partNo || '').toLowerCase().trim();
                const target = matMap.get(p) || matMap.get(k);
                if (target) {
                    const due = parseDate(item.dueDate);
                    const qty = item.balanceQty || 0;
                    if (due <= monthEnd) { if (isSO) target.soDue += qty; else target.poDue += qty; }
                    else { if (isSO) target.soSched += qty; else target.poSched += qty; }
                }
            });
        };
        processOrder(pendingSO, true);
        processOrder(pendingPO, false);

        const yearAgo = new Date(today); yearAgo.setFullYear(today.getFullYear() - 1);
        enrichedSales.forEach(item => {
            const target = matMap.get((item.particulars || '').toLowerCase().trim());
            if (target) {
                const isProject = (item.particulars || '').toLowerCase().includes('project') || (item.customerName || '').toLowerCase().includes('project');
                const qty = item.quantity || 0;
                if (item.fiscalYear === currentFY) { target.salesCY += qty; if (!isProject) target.regSalesCY += qty; }
                if (item.fiscalYear === prevFY) { target.salesPY += qty; if (!isProject) target.regSalesPY += qty; }
                const mKey = `${item.rawDate.getFullYear()}-${item.rawDate.getMonth() + 1}`;
                target.monthlySales.set(mKey, (target.monthlySales.get(mKey) || 0) + qty);
                if (item.rawDate >= yearAgo) target.rollingMonths.add(mKey);
                if (isProject) target.hasProject = true;
            }
        });

        const uniqueMaterials = Array.from(new Set(matMap.values()));
        return uniqueMaterials.map(m => {
            const activeM = m.monthlySales.size;
            const avgM = activeM > 0 ? m.salesCY / activeM : 0;
            const rollCount = m.rollingMonths.size;
            let mClass = 'NON-MOVING', strategy = 'MADE TO ORDER';
            if (rollCount >= 9) mClass = 'FAST RUNNER'; else if (rollCount >= 3) mClass = 'SLOW RUNNER';
            if (m.salesCY + m.salesPY > 1000) strategy = 'GENERAL STOCK'; else if (m.salesCY + m.salesPY > 0) strategy = 'AGAINST ORDER';
            
            const net = m.stock + m.poDue + m.poSched - (m.soDue + m.soSched);
            let safety = (mClass === 'FAST RUNNER' || strategy === 'GENERAL STOCK') ? Math.ceil(avgM * 1.2) : 0;
            const min = roundToTen(safety);
            const max = roundToTen(safety * 3);

            return {
                ...m, uniqueId: `${m.description}|${m.partNo}`, netQty: net, safetyStock: safety, minStock: min,
                rol: roundToTen(safety * 1.5), maxStock: max, avgMonthly: avgM, classification: mClass, strategy
            };
        });
    }, [materials, closingStock, pendingSO, pendingPO, enrichedSales, activeSubTab]);

    const filteredStockPlanning = useMemo(() => {
        let data = stockPlanningData.filter(d => {
            const matchesMake = stockSlicers.make === 'ALL' || d.make === stockSlicers.make;
            const matchesGroup = stockSlicers.group === 'ALL' || d.group === stockSlicers.group;
            const matchesStrat = stockSlicers.strategy === 'ALL' || d.strategy === stockSlicers.strategy;
            const matchesClass = stockSlicers.class === 'ALL' || d.classification === stockSlicers.class;
            const matchesSearch = !stockSearchTerm || (d.description || '').toLowerCase().includes(stockSearchTerm.toLowerCase()) || (d.partNo || '').toLowerCase().includes(stockSearchTerm.toLowerCase());

            const matchesQuick = stockQuickFilter === 'ALL' ||
                (stockQuickFilter === 'SHORTAGE' && d.netQty < d.minStock) ||
                (stockQuickFilter === 'REFILL' && d.netQty < d.rol);

            return matchesMake && matchesGroup && matchesStrat && matchesClass && matchesSearch && matchesQuick;
        });

        if (stockSortConfig) {
            data.sort((a: any, b: any) => {
                let valA = a[stockSortConfig.key];
                let valB = b[stockSortConfig.key];

                // Special handling for calculated shortage/refill if needed
                if (stockSortConfig.key === 'shortageQty') {
                    valA = a.netQty < a.minStock ? a.minStock - a.netQty : 0;
                    valB = b.netQty < b.minStock ? b.minStock - b.netQty : 0;
                } else if (stockSortConfig.key === 'refillQty') {
                    valA = a.netQty < a.rol ? a.maxStock - a.netQty : 0;
                    valB = b.netQty < b.rol ? b.maxStock - b.netQty : 0;
                } else if (stockSortConfig.key === 'growth') {
                    valA = a.salesPY > 0 ? (a.salesCY - a.salesPY) / a.salesPY : a.salesCY > 0 ? 1 : 0;
                    valB = b.salesPY > 0 ? (b.salesCY - b.salesPY) / b.salesPY : b.salesCY > 0 ? 1 : 0;
                }

                if (valA < valB) return stockSortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return stockSortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            data.sort((a, b) => b.salesCY - a.salesCY);
        }
        return data;
    }, [stockPlanningData, stockSlicers, stockSearchTerm, stockSortConfig, stockQuickFilter]);

    const handleStockSort = (key: string) => {
        setStockSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const handleExportStockPlanning = () => {
        const data = filteredStockPlanning.map((item, idx) => ({
            "S.No": idx + 1,
            "Make": item.make,
            "Material Group": item.group,
            "Description": item.description,
            "Part No": item.partNo,
            "Sales CY": item.salesCY,
            "Sales PY": item.salesPY,
            "Classification": item.classification,
            "Strategy": item.strategy,
            "On Hand Stock": item.stock,
            "SO Due": item.soDue,
            "SO Scheduled": item.soSched,
            "PO Due": item.poDue,
            "PO Scheduled": item.poSched,
            "Net Qty": item.netQty,
            "Shortage": item.netQty < item.minStock ? Math.round(item.minStock - item.netQty) : 0,
            "Refill Qty": item.netQty < item.rol ? Math.round(item.maxStock - item.netQty) : 0,
            "YoY Growth %": item.salesPY > 0 ? Math.round(((item.salesCY - item.salesPY) / item.salesPY) * 100) : item.salesCY > 0 ? 100 : 0,
            "Min Stock": item.minStock,
            "ROL": item.rol,
            "Max Stock": item.maxStock,
            "Avg Monthly Sales": Math.round(item.avgMonthly),
            "Status": item.netQty < item.minStock ? 'SHORTAGE' : item.netQty < item.rol ? 'REFILL' : 'HEALTHY'
        }));

        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Stock_Planning");
        writeFile(wb, `Stock_Planning_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const stockPlanningTotals = useMemo(() => {
        // Calculate totals based on slicers/search but BEFORE the quick filter (Shortage/Refill)
        // This ensures the top KPI cards stay visible and accurate even when you click them.
        const baseData = stockPlanningData.filter(d => {
            const matchesMake = stockSlicers.make === 'ALL' || d.make === stockSlicers.make;
            const matchesGroup = stockSlicers.group === 'ALL' || d.group === stockSlicers.group;
            const matchesStrat = stockSlicers.strategy === 'ALL' || d.strategy === stockSlicers.strategy;
            const matchesClass = stockSlicers.class === 'ALL' || d.classification === stockSlicers.class;
            const matchesSearch = !stockSearchTerm || d.description.toLowerCase().includes(stockSearchTerm.toLowerCase()) || (d.partNo || '').toLowerCase().includes(stockSearchTerm.toLowerCase());
            return matchesMake && matchesGroup && matchesStrat && matchesClass && matchesSearch;
        });

        return baseData.reduce((acc, item) => {
            if (item.netQty < item.minStock) {
                acc.shortageQty += Math.round(item.minStock - item.netQty);
                acc.shortageCount++;
            }
            if (item.netQty < item.rol) {
                acc.refillQty += Math.round(item.maxStock - item.netQty);
                acc.refillCount++;
            }
            return acc;
        }, { shortageQty: 0, shortageCount: 0, refillQty: 0, refillCount: 0 });
    }, [stockPlanningData, stockSlicers, stockSearchTerm]);

    const inventoryStats = useMemo(() => {
        if (!['inventory', 'weekly'].includes(activeSubTab)) return { totalVal: 0, totalQty: 0, totalExcessVal: 0, count: 0, items: [], makeMix: [], groupMix: [], topStock: [], topExcess: [] };

        console.time('📦 Dashboard.inventoryStats');
        const matMap = new Map<string, { make: string, group: string }>();
        materials.forEach(m => {
            const info = { make: m.make || 'Unspecified', group: m.materialGroup || 'Unspecified' };
            if (m.partNo) matMap.set(String(m.partNo).toLowerCase().trim(), info);
            if (m.description) matMap.set(String(m.description).toLowerCase().trim(), info);
        });

        const soMap = new Map<string, number>();
        pendingSO.forEach(s => {
            if (s.itemName) {
                const k = s.itemName.toLowerCase().trim();
                soMap.set(k, (soMap.get(k) || 0) + (s.balanceQty || 0));
            }
        });

        const poMap = new Map<string, number>();
        pendingPO.forEach(p => {
            if (p.itemName) {
                const k = p.itemName.toLowerCase().trim();
                poMap.set(k, (poMap.get(k) || 0) + (p.balanceQty || 0));
            }
        });

        const rawItems = closingStock.map(i => {
            if (!i.description) return null;
            const k = i.description.toLowerCase().trim();
            const matInfo = matMap.get(k);
            const mke = getMergedMakeName(matInfo?.make || 'Unspecified');
            const sQty = soMap.get(k) || 0;
            const pQty = poMap.get(k) || 0;
            const exQty = Math.max(0, (i.quantity || 0) + pQty - sQty);
            return { ...i, make: mke, group: matInfo?.group || 'Unspecified', excessVal: exQty * (i.rate || 0), excessPct: ((i.quantity || 0) + pQty) > 0 ? (exQty / ((i.quantity || 0) + pQty)) * 100 : 0 };
        }).filter(i => i !== null) as any[];

        const filtered = rawItems.filter(i => (selectedMake === 'ALL' || i.make === selectedMake) && (selectedMatGroup === 'ALL' || i.group === selectedMatGroup));
        const totalV = filtered.reduce((a, b) => a + (b.value || 0), 0);
        const totalQ = filtered.reduce((a, b) => a + (b.quantity || 0), 0);
        const totalExV = filtered.reduce((a, b) => a + (b.excessVal || 0), 0);
        const baseline = invGroupMetric === 'value' ? totalV : totalQ;

        const mkeMap = new Map<string, number>();
        const grpMap = new Map<string, number>();
        filtered.forEach(i => {
            const v = invGroupMetric === 'value' ? (i.value || 0) : (i.quantity || 0);
            mkeMap.set(i.make, (mkeMap.get(i.make) || 0) + v);
            grpMap.set(i.group, (grpMap.get(i.group) || 0) + v);
        });

        console.timeEnd('📦 Dashboard.inventoryStats');
        return {
            totalVal: totalV, totalQty: totalQ, totalExcessVal: totalExV, count: filtered.length, items: filtered,
            makeMix: Array.from(mkeMap.entries()).map(([label, value]) => ({ label, value, share: baseline > 0 ? (value / baseline) * 100 : 0 })).sort((a, b) => b.value - a.value),
            groupMix: Array.from(grpMap.entries()).map(([label, value]) => ({ label, value, share: baseline > 0 ? (value / baseline) * 100 : 0 })).sort((a, b) => b.value - a.value),
            topStock: [...filtered].sort((a, b) => b.value - a.value).slice(0, 10).map(i => ({ label: i.description, value: i.value, share: totalV > 0 ? (i.value / totalV) * 100 : 0 })),
            topExcess: [...filtered].sort((a, b) => b.excessVal - a.excessVal).slice(0, 10).map(i => ({ label: i.description, value: i.excessVal, share: i.excessPct }))
        };
    }, [closingStock, materials, invGroupMetric, selectedMake, selectedMatGroup, pendingSO, pendingPO, activeSubTab]);

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
        if (!['so', 'weekly'].includes(activeSubTab)) return { totalVal: 0, totalQty: 0, dueValue: 0, scheduledValue: 0, readyDueValue: 0, shortageDueValue: 0, readySchValue: 0, shortageSchValue: 0, uniqueSOCount: 0, uniqueItemCount: 0, custMix: [], groupMix: [], ageing: [], topItems: [], enrichedItems: [] };
        
        console.time('📑 Dashboard.soStats');
        const stockMap = new Map<string, number>();
        closingStock.forEach(s => {
            const k = (s.description || '').toLowerCase().trim();
            stockMap.set(k, (stockMap.get(k) || 0) + (s.quantity || 0));
        });

        const matMap = new Map<string, string>();
        materials.forEach(m => {
            if (m.description) matMap.set(m.description.toLowerCase().trim(), m.materialGroup || 'Unspecified');
        });

        const today = new Date(); today.setHours(0,0,0,0);
        const sorted = [...pendingSO].sort((a,b) => parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime());
        
        const custMap = new Map<string, { due: number, scheduled: number }>();
        const groupMap = new Map<string, number>();
        const aging = { '0-30d': 0, '31-60d': 0, '61-90d': 0, '90d+': 0 };
        const soSet = new Set<string>();
        const itemSet = new Set<string>();
        let dV = 0, dQ = 0, rdV = 0, sdV = 0, sV = 0, sQ = 0, rsV = 0, ssV = 0;

        const enriched = sorted.map(i => {
            const k = (i.itemName || '').toLowerCase().trim();
            const due = parseDate(i.dueDate);
            const isD = (i.overDueDays || 0) > 0 || (due.getTime() > 0 && due <= today);
            const qty = i.balanceQty || 0;
            const avail = stockMap.get(k) || 0;
            const alloc = Math.min(qty, avail);
            stockMap.set(k, avail - alloc);
            
            const val = i.value || 0;
            const rV = alloc * (i.rate || 0);
            const shV = (qty - alloc) * (i.rate || 0);

            if (isD) { dV += val; dQ += qty; rdV += rV; sdV += shV; }
            else { sV += val; sQ += qty; rsV += rV; ssV += shV; }

            const pName = (i.partyName || 'Unknown').trim();
            const c = custMap.get(pName) || { due: 0, scheduled: 0 };
            if (isD) c.due += val; else c.scheduled += val;
            custMap.set(pName, c);

            const grp = matMap.get(k) || 'Unspecified';
            groupMap.set(grp, (groupMap.get(grp) || 0) + val);
            if (i.orderNo) soSet.add(i.orderNo);
            itemSet.add(k);

            const diff = (today.getTime() - due.getTime()) / (1000 * 3600 * 24);
            if (diff > 90) aging['90d+'] += val;
            else if (diff > 60) aging['61-90d'] += val;
            else if (diff > 30) aging['31-60d'] += val;
            else if (diff > 0) aging['0-30d'] += val;

            return { ...i, readyVal: rV, shortageVal: shV, readyQty: alloc, shortageQty: qty - alloc };
        });

        console.timeEnd('📑 Dashboard.soStats');
        return {
            totalVal: dV + sV, totalQty: dQ + sQ, dueValue: dV, scheduledValue: sV, readyDueValue: rdV, shortageDueValue: sdV, readySchValue: rsV, shortageSchValue: ssV,
            uniqueSOCount: soSet.size, uniqueItemCount: itemSet.size,
            custMix: Array.from(custMap.entries()).map(([label, v]) => ({ label, value: v.due, secondaryValue: v.scheduled })).sort((a,b) => (b.value+b.secondaryValue) - (a.value+a.secondaryValue)),
            groupMix: Array.from(groupMap.entries()).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value),
            ageing: Object.entries(aging).map(([label, value]) => ({ label, value })),
            topItems: enriched.sort((a,b) => b.value - a.value).slice(0, 10),
            enrichedItems: enriched
        };
    }, [pendingSO, materials, closingStock, activeSubTab]);

    const poStats = useMemo(() => {
        if (activeSubTab !== 'po') return { totalVal: 0, count: 0, vendorMix: [], dueMix: [], groupMix: [], topItems: [] };
        console.time('🛒 Dashboard.poStats');
        const matMap = new Map<string, { group: string }>();
        materials.forEach(m => {
            const grp = { group: m.materialGroup || 'Unspecified' };
            if (m.description) matMap.set(m.description.toLowerCase().trim(), grp);
            if (m.partNo) matMap.set(m.partNo.toLowerCase().trim(), grp);
        });

        const vMap = new Map<string, number>();
        const sMap = { 'Overdue': 0, 'Due Today': 0, 'Due This Week': 0, 'Future': 0 };
        const gMap = new Map<string, number>();
        const td = new Date(); td.setHours(0,0,0,0);
        const wEnd = new Date(td); wEnd.setDate(td.getDate() + 7);

        pendingPO.forEach(i => {
            const v = (i.partyName || 'Unknown').trim();
            vMap.set(v, (vMap.get(v) || 0) + (i.value || 0));
            const grp = matMap.get((i.itemName || '').toLowerCase().trim())?.group || 'Unspecified';
            gMap.set(grp, (gMap.get(grp) || 0) + (i.value || 0));
            const due = parseDate(i.dueDate);
            if (due < td) sMap['Overdue'] += (i.value || 0);
            else if (due.getTime() === td.getTime()) sMap['Due Today'] += (i.value || 0);
            else if (due <= wEnd) sMap['Due This Week'] += (i.value || 0);
            else sMap['Future'] += (i.value || 0);
        });

        console.timeEnd('🛒 Dashboard.poStats');
        return {
            totalVal: pendingPO.reduce((a, b) => a + (b.value || 0), 0), count: pendingPO.length,
            vendorMix: Array.from(vMap.entries()).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value),
            dueMix: Object.entries(sMap).map(([label, value]) => ({ label, value })),
            groupMix: Array.from(gMap.entries()).map(([label, value]) => ({ label, value })).sort((a,b) => b.value - a.value),
            topItems: [...pendingPO].sort((a,b) => b.value - a.value).slice(0, 10)
        };
    }, [pendingPO, materials, activeSubTab]);

    const weeklyStats = useMemo(() => {
        const defaultState = {
            sales: { mtdPrev: 0, mtdCurr: 0, mtdDiff: 0, ytdPrev: 0, ytdCurr: 0, ytdDiff: 0, mtdPrevOnline: 0, mtdCurrOnline: 0, mtdDiffOnline: 0, ytdPrevOnline: 0, ytdCurrOnline: 0, ytdDiffOnline: 0 },
            due: {} as Record<string, { ready: number, shortage: number, total: number }>,
            sched: {} as Record<string, { ready: number, shortage: number, total: number }>,
            total: {} as Record<string, { ready: number, shortage: number, total: number }>,
            stock: [] as { make: string, groups: { group: string, qty: number, value: number }[] }[],
            targetDate: new Date(), prevDate: new Date()
        };
        if (activeSubTab !== 'weekly') return defaultState;
        console.time('📅 Dashboard.weeklyStats');
        const today = new Date(); today.setHours(0,0,0,0);
        const cDay = today.getDay();
        const sub = cDay >= 3 ? cDay - 3 : cDay + 4;
        const targetD = new Date(today); targetD.setDate(today.getDate() - sub);
        const prevD = new Date(targetD); prevD.setDate(targetD.getDate() - 7);
        const gapEnd = new Date(targetD); gapEnd.setDate(targetD.getDate() - 1);
        const mtdS = new Date(prevD.getFullYear(), prevD.getMonth(), 1);
        const fyS = new Date(targetD.getMonth() >= 3 ? targetD.getFullYear() : targetD.getFullYear() - 1, 3, 1);

        const getSum = (s: Date, e: Date, online: boolean = false) => {
            const sd = new Date(s); sd.setHours(0,0,0,0);
            const ed = new Date(e); ed.setHours(23,59,59,999);
            return enrichedSales.filter(i => i.rawDate >= sd && i.rawDate <= ed && (!online || i.custGroup === 'Online')).reduce((a, b) => a + (b.value || 0), 0);
        };

        const rMakes = ['LAPP', 'Eaton', 'Hager', 'Mennekes', 'Havells', 'Luker'];
        const mMap = new Map<string, string>();
        materials.forEach(m => {
            const val = getMergedMakeName(m.make);
            if (m.description) mMap.set(m.description.toLowerCase().trim(), val);
        });

        const getMk = (items: any[]) => {
            const s: Record<string, any> = { 'Others': { ready: 0, shortage: 0, total: 0 } };
            rMakes.forEach(m => s[m] = { ready: 0, shortage: 0, total: 0 });
            items.forEach(i => {
                const mk = mMap.get((i.itemName || '').toLowerCase().trim()) || 'Others';
                const k = rMakes.includes(mk) ? mk : 'Others';
                s[k].ready += (i.readyVal || 0); s[k].shortage += (i.shortageVal || 0); s[k].total += (i.value || 0);
            });
            return s;
        };

        const due = soStats.enrichedItems.filter(i => { const d = parseDate(i.dueDate); return (i.overDueDays || 0) > 0 || (d.getTime() > 0 && d <= today); });
        const sch = soStats.enrichedItems.filter(i => { const d = parseDate(i.dueDate); return !((i.overDueDays || 0) > 0 || (d.getTime() > 0 && d <= today)); });
        const stMap = new Map<string, any>();
        inventoryStats.items.forEach(i => {
            if (!stMap.has(i.make)) stMap.set(i.make, new Map());
            const gm = stMap.get(i.make)!;
            const cur = gm.get(i.group) || { qty: 0, value: 0 };
            gm.set(i.group, { qty: cur.qty + i.quantity, value: cur.value + i.value });
        });

        const mtdPrev = getSum(mtdS, prevD);
        const mtdCurr = getSum(mtdS, gapEnd);
        const ytdPrev = getSum(fyS, prevD);
        const ytdCurr = getSum(fyS, targetD);
        const mtdPrevOnline = getSum(mtdS, prevD, true);
        const mtdCurrOnline = getSum(mtdS, gapEnd, true);
        const ytdPrevOnline = getSum(fyS, prevD, true);
        const ytdCurrOnline = getSum(fyS, targetD, true);

        console.timeEnd('📅 Dashboard.weeklyStats');
        return {
            sales: { 
                mtdPrev, mtdCurr, mtdDiff: mtdCurr - mtdPrev,
                ytdPrev, ytdCurr, ytdDiff: ytdCurr - ytdPrev,
                mtdPrevOnline, mtdCurrOnline, mtdDiffOnline: mtdCurrOnline - mtdPrevOnline,
                ytdPrevOnline, ytdCurrOnline, ytdDiffOnline: ytdCurrOnline - ytdPrevOnline
            },
            due: getMk(due), sched: getMk(sch), total: getMk(soStats.enrichedItems),
            stock: Array.from(stMap.entries()).map(([m, g]) => ({ make: m, groups: Array.from(g.entries()).map(([gn, s]: any) => ({ group: gn, ...s })).sort((a,b) => b.value - a.value) })).sort((a,b) => b.groups.reduce((acc, x) => acc + x.value, 0) - a.groups.reduce((acc, y) => acc + y.value, 0)),
            targetDate: targetD, prevDate: prevD
        };
    }, [enrichedSales, soStats, materials, inventoryStats, activeSubTab]);

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
        const prevFY = `${startYear - 1}-${startYear.toString().slice(-2)}`;
        const prevSeries = getSeries(prevFY, i => (timeView === 'FY' || (timeView === 'MONTH' && i.fiscalMonthIndex === selectedMonth) || (timeView === 'WEEK' && i.weekNumber === selectedWeek)));
        const ppyFY = `${startYear - 2}-${(startYear - 1).toString().slice(-2)}`;
        const ppySeries = getSeries(ppyFY, i => (timeView === 'FY' || (timeView === 'MONTH' && i.fiscalMonthIndex === selectedMonth) || (timeView === 'WEEK' && i.weekNumber === selectedWeek)));
        const pppyFY = `${startYear - 3}-${(startYear - 2).toString().slice(-2)}`;
        const pppySeries = getSeries(pppyFY, i => (timeView === 'FY' || (timeView === 'MONTH' && i.fiscalMonthIndex === selectedMonth) || (timeView === 'WEEK' && i.weekNumber === selectedWeek)));

        return {
            labels,
            series: [
                { name: selectedFY, data: currentSeries, color: '#FF3B3B', active: true },
                { name: prevFY, data: prevSeries, color: '#00D1C1', active: true },
                { name: ppyFY, data: ppySeries, color: '#FFD700', active: true },
                { name: pppyFY, data: pppySeries, color: '#3B82F6', active: true },
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
                                <p className="text-[10px] text-gray-500  mt-1">Part No: {selectedSoItem.partNo || '-'}</p>
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

            <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col lg:flex-row gap-4 items-center justify-between flex-shrink-0 shadow-sm z-10 sticky top-0 bg-white/90 backdrop-blur-md">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-2 p-1 rounded-xl w-full xl:flex-1">
                    {(['sales', 'inventory', 'so', 'po', 'weekly', 'customerAnalysis'] as const).map(tab => {
                        const vibrantColors: Record<string, string> = {
                            sales: 'bg-red-100 text-red-700 border-2 border-red-300',
                            inventory: 'bg-cyan-100 text-cyan-700 border-2 border-cyan-300',
                            so: 'bg-amber-100 text-amber-700 border-2 border-amber-300',
                            po: 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300',
                            weekly: 'bg-purple-100 text-purple-700 border-2 border-purple-300',
                            customerAnalysis: 'bg-pink-100 text-pink-700 border-2 border-pink-300'
                        };
                        const activeColors: Record<string, string> = {
                            sales: 'bg-red-600 text-white border-2 border-red-800 shadow-lg',
                            inventory: 'bg-cyan-600 text-white border-2 border-cyan-800 shadow-lg',
                            so: 'bg-amber-600 text-white border-2 border-amber-800 shadow-lg',
                            po: 'bg-emerald-600 text-white border-2 border-emerald-800 shadow-lg',
                            weekly: 'bg-purple-600 text-white border-2 border-purple-800 shadow-lg',
                            customerAnalysis: 'bg-pink-600 text-white border-2 border-pink-800 shadow-lg'
                        };
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveSubTab(tab)}
                                className={`w-full py-2.5 rounded-lg text-[10px] xl:text-xs font-black uppercase tracking-wider transition-all duration-300 transform active:scale-95 flex items-center justify-center ${activeSubTab === tab ? activeColors[tab] + ' scale-[1.03]' : vibrantColors[tab] + ' hover:scale-[1.02]'}`}
                            >
                                {tab === 'so' ? 'Pending SO' : tab === 'po' ? 'Pending PO' : tab === 'weekly' ? 'Weekly Report' : tab === 'customerAnalysis' ? 'Cust Analysis' : tab}
                            </button>
                        );
                    })}
                </div>
                {activeSubTab === 'sales' && (

                    <div className="flex flex-col items-end gap-1.5">
                        {/* Row 1: Filters */}
                        <div className="flex items-center gap-2">
                            <select value={selectedMake} onChange={e => setSelectedMake(e.target.value)} title="Make Slicer" className="bg-white border border-blue-300 text-[10px] rounded-md px-2 py-1 font-bold text-blue-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 h-7">
                                {uniqueMakes.map(m => (<option key={m} value={m}>{m === 'ALL' ? 'ALL MAKES' : m}</option>))}
                            </select>
                            <select value={selectedMatGroup} onChange={e => setSelectedMatGroup(e.target.value)} title="Material Group Slicer" className="bg-white border border-emerald-300 text-[10px] rounded-md px-2 py-1 font-bold text-emerald-700 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 h-7">
                                {uniqueMatGroups.map(mg => (<option key={mg} value={mg}>{mg === 'ALL' ? 'ALL GROUPS' : mg}</option>))}
                            </select>
                            <div className="flex bg-gray-100 p-0.5 rounded-md h-7 items-center">
                                <button onClick={() => setGroupingMode('MERGED')} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${groupingMode === 'MERGED' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Merged</button>
                                <button onClick={() => setGroupingMode('RAW')} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${groupingMode === 'RAW' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Raw</button>
                            </div>
                        </div>

                        {/* Row 2: Time & FY */}
                        <div className="flex items-center gap-2">
                            <div className="flex bg-gray-100 p-0.5 rounded-md h-7 items-center">
                                {(['FY', 'MONTH', 'WEEK'] as const).map(v => (
                                    <button key={v} onClick={() => setTimeView(v)} className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{v}</button>
                                ))}
                            </div>
                            <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-[10px] rounded-md px-2 py-1 font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 h-7">
                                {uniqueFYs.length > 0 ? uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>) : <option value="">No Data</option>}
                            </select>
                        </div>

                        {/* Row 3: Detail Selectors */}
                        {(timeView === 'MONTH' || timeView === 'WEEK') && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                                {timeView === 'MONTH' && (
                                    <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-[10px] rounded-md px-2 py-1 font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 h-7 w-24">
                                        {["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((m, i) => (<option key={m} value={i}>{m}</option>))}
                                    </select>
                                )}
                                {timeView === 'WEEK' && (
                                    <select value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} className="bg-white border border-gray-300 text-[10px] rounded-md px-2 py-1 font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 h-7 w-24">
                                        {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (<option key={w} value={w}>Week {w}</option>))}
                                    </select>
                                )}
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
                                    { label: timeView === 'FY' ? 'YTD Sales' : 'Current Sales', val: kpis.currVal, prev: kpis.prevVal, yoy: kpis.yoyVal, isCurr: true, text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100', icon: DollarSign },
                                    { label: timeView === 'FY' ? 'YTD Quantity' : 'Quantity', val: kpis.currQty, prev: kpis.prevQty, yoy: kpis.yoyQty, isCurr: false, text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: Package },
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
                                                            {timeView === 'WEEK' ? 'vs Prev Week' : timeView === 'MONTH' ? 'vs Prev Month' : 'vs Previous FY'}
                                                        </p>
                                                    </div>

                                                    {/* YoY Comparison Badge */}
                                                    <div className="flex flex-col gap-1">
                                                        <div className={`flex items-center justify-between px-2 py-1 rounded-lg border shadow-sm transition-all group-hover:shadow duration-300 ${yoyDiff >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                            <span className="text-[11px] font-extrabold">{Math.abs(yoyPct).toFixed(0)}%</span>
                                                            {yoyDiff >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                        </div>
                                                        <p className="text-[8px] font-bold uppercase text-gray-400 tracking-tighter pl-1">
                                                            {timeView === 'FY' ? 'vs Same Period LY (YTD)' : 'vs Same Period LY'}
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
                                        4-Year Sales Trend
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
                                    <HorizontalComparisonChart
                                        data={topTenCustomers}
                                        title="Universal Top 10 Customers"
                                        color="emerald"
                                        compareLabel={timeView === 'WEEK' ? 'Prev Week' : timeView === 'MONTH' ? 'Prev Month' : 'LY (YTD)'}
                                        isDecliningOnly={decliningOnlyTopTen}
                                        onToggleDeclining={setDecliningOnlyTopTen}
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
                                    <GroupedCustomerAnalysis
                                        data={groupedCustomerData}
                                        compareLabel={timeView === 'FY' ? 'Same Period LY (YTD)' : (timeView === 'WEEK' ? 'Prev Week' : 'Prev Month')}
                                        groupingMode={groupingMode}
                                        setGroupingMode={setGroupingMode}
                                    />
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">

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
                                    <table className="w-full text-left border-collapse border border-gray-300 min-w-[800px]">
                                        <thead className="sticky top-0 z-20 bg-gray-100 shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
                                            <tr className="text-[9px] font-black text-gray-700 uppercase tracking-widest text-center divide-x divide-gray-300">
                                                <th className="py-2 px-2 border border-gray-300 w-8">#</th>
                                                {[
                                                    { key: 'description', label: 'Item Description', align: 'left' },
                                                    { key: 'make', label: 'Make', align: 'left' },
                                                    { key: 'group', label: 'Material Group', align: 'left' },
                                                    { key: 'quantity', label: 'Stock Qty', align: 'right' },
                                                    { key: 'rate', label: 'Avg Rate', align: 'right' },
                                                    { key: 'value', label: 'Total Value', align: 'right' }
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
                                        <tbody className="divide-y divide-gray-200 text-[10px] text-gray-700">
                                            {processedInventoryItems.length === 0 ? (
                                                <tr><td colSpan={7} className="p-8 text-center text-gray-400">No records found matching filters</td></tr>
                                            ) : (
                                                processedInventoryItems.slice(0, invDisplayLimit).map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-emerald-50/30 even:bg-gray-50/20 transition-colors group">
                                                        <td className="py-1 px-2 border border-gray-200 text-center text-gray-400  text-[9px] select-none">{idx + 1}</td>
                                                        <td className="py-1 px-3 border border-gray-200 font-black text-gray-700 truncate max-w-[300px]" title={item.description}>{item.description}</td>
                                                        <td className="py-1 px-3 border border-gray-200 font-bold text-gray-500 uppercase">{item.make}</td>
                                                        <td className="py-1 px-3 border border-gray-200 font-bold text-blue-600 uppercase tracking-tighter">{item.group}</td>
                                                        <td className="py-1 px-3 border border-gray-200 text-right font-black text-emerald-700">{item.quantity.toLocaleString()}</td>
                                                        <td className="py-1 px-3 border border-gray-200 text-right  text-[9px] text-gray-400">{item.rate.toLocaleString()}</td>
                                                        <td className="py-1 px-3 border border-gray-200 text-right font-black text-gray-900 bg-gray-50/30">{item.value.toLocaleString()}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {processedInventoryItems.length > invDisplayLimit && (
                                    <div className="p-4 flex justify-center bg-gray-50/50 border-t border-gray-100">
                                        <button
                                            onClick={() => setInvDisplayLimit(prev => prev + 200)}
                                            className="px-6 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-sm flex items-center gap-2 group"
                                        >
                                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                                            Load More Inventory ({processedInventoryItems.length - invDisplayLimit} remaining)
                                        </button>
                                    </div>
                                )}
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
                                                        <td className="py-1.5 px-3  text-gray-500">{i.orderNo}</td>
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
                                                        <td className="px-4 py-3 text-right  font-bold text-gray-700">{Math.round(weeklyStats.sales.mtdPrev).toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-right  font-black text-indigo-900">{Math.round(weeklyStats.sales.mtdCurr).toLocaleString('en-IN')}</td>
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
                                                        <td className="px-4 py-3 text-right  font-bold text-emerald-600">{Math.round(weeklyStats.sales.mtdPrevOnline).toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-right  font-black text-emerald-900">{Math.round(weeklyStats.sales.mtdCurrOnline).toLocaleString('en-IN')}</td>
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
                                                        <td className="px-4 py-3 text-right  font-bold text-gray-700">{Math.round(weeklyStats.sales.ytdPrev).toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-right  font-black text-teal-900">{Math.round(weeklyStats.sales.ytdCurr).toLocaleString('en-IN')}</td>
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
                                                        <td className="px-4 py-3 text-right  font-bold text-teal-600">{Math.round(weeklyStats.sales.ytdPrevOnline).toLocaleString('en-IN')}</td>
                                                        <td className="px-4 py-3 text-right  font-black text-teal-900">{Math.round(weeklyStats.sales.ytdCurrOnline).toLocaleString('en-IN')}</td>
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
                                                                        type="text"
                                                                        className="w-full bg-transparent text-right outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 text-[10px]  font-bold text-indigo-700"
                                                                        value={weeklyBenchmarks[`${table.id}_${make}_Ready`] ? Math.round(parseFloat(weeklyBenchmarks[`${table.id}_${make}_Ready`])).toLocaleString('en-IN') : ""}
                                                                        placeholder="0"
                                                                        onChange={(e) => {
                                                                            const val = e.target.value.replace(/,/g, '');
                                                                            if (!isNaN(Number(val))) {
                                                                                setWeeklyBenchmarks(prev => ({ ...prev, [`${table.id}_${make}_Ready`]: val }));
                                                                            }
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td className="p-2 border bg-blue-50/10">
                                                                    <input
                                                                        type="text"
                                                                        className="w-full bg-transparent text-right outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 text-[10px]  font-bold text-indigo-900"
                                                                        value={weeklyBenchmarks[`${table.id}_${make}_Shortage`] ? Math.round(parseFloat(weeklyBenchmarks[`${table.id}_${make}_Shortage`])).toLocaleString('en-IN') : ""}
                                                                        placeholder="0"
                                                                        onChange={(e) => {
                                                                            const val = e.target.value.replace(/,/g, '');
                                                                            if (!isNaN(Number(val))) {
                                                                                setWeeklyBenchmarks(prev => ({ ...prev, [`${table.id}_${make}_Shortage`]: val }));
                                                                            }
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td className="p-2 border bg-blue-50/20 text-right font-bold text-gray-500">{Math.round(prevTotal).toLocaleString("en-IN")}</td>
                                                                <td className="p-2 border text-right  font-bold text-emerald-600 bg-indigo-50/5">{Math.round(curr.ready).toLocaleString("en-IN")}</td>
                                                                <td className="p-2 border text-right  font-bold text-rose-600 bg-indigo-50/5">{Math.round(curr.shortage).toLocaleString("en-IN")}</td>
                                                                <td className="p-2 border text-right  font-black text-indigo-900 bg-indigo-50/10">{Math.round(curr.total).toLocaleString("en-IN")}</td>
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
                                                                        type="text"
                                                                        className="w-full bg-transparent text-right font-black text-indigo-700 outline-none border-b border-transparent focus:border-blue-300"
                                                                        value={weeklyBenchmarks[`STOCK_${makeGroup.make}_Qty`] ? Math.round(parseFloat(weeklyBenchmarks[`STOCK_${makeGroup.make}_Qty`])).toLocaleString('en-IN') : ''}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value.replace(/,/g, '');
                                                                            if (!isNaN(Number(val))) {
                                                                                setWeeklyBenchmarks(prev => ({ ...prev, [`STOCK_${makeGroup.make}_Qty`]: val }));
                                                                            }
                                                                        }}
                                                                        placeholder="0"
                                                                    />
                                                                </td>
                                                                <td className="p-2 border bg-blue-50/5">
                                                                    <input
                                                                        type="text"
                                                                        className="w-full bg-transparent text-right font-black text-indigo-900 outline-none border-b border-transparent focus:border-blue-300"
                                                                        value={weeklyBenchmarks[`STOCK_${makeGroup.make}_Value`] ? Math.round(parseFloat(weeklyBenchmarks[`STOCK_${makeGroup.make}_Value`])).toLocaleString('en-IN') : ''}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value.replace(/,/g, '');
                                                                            if (!isNaN(Number(val))) {
                                                                                setWeeklyBenchmarks(prev => ({ ...prev, [`STOCK_${makeGroup.make}_Value`]: val }));
                                                                            }
                                                                        }}
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
                                                                                type="text"
                                                                                className="w-full bg-transparent text-right outline-none text-xs font-medium text-gray-500 focus:text-gray-900"
                                                                                value={weeklyBenchmarks[`STOCK_${makeGroup.make}_${grp.group}_Qty`] ? Math.round(parseFloat(weeklyBenchmarks[`STOCK_${makeGroup.make}_${grp.group}_Qty`])).toLocaleString('en-IN') : ''}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value.replace(/,/g, '');
                                                                                    if (!isNaN(Number(val))) {
                                                                                        setWeeklyBenchmarks(prev => ({ ...prev, [`STOCK_${makeGroup.make}_${grp.group}_Qty`]: val }));
                                                                                    }
                                                                                }}
                                                                                placeholder="0"
                                                                            />
                                                                        </td>
                                                                        <td className="p-2 border bg-blue-50/5">
                                                                            <input
                                                                                type="text"
                                                                                className="w-full bg-transparent text-right outline-none text-xs font-bold text-gray-700 focus:text-gray-900"
                                                                                value={weeklyBenchmarks[`STOCK_${makeGroup.make}_${grp.group}_Value`] ? Math.round(parseFloat(weeklyBenchmarks[`STOCK_${makeGroup.make}_${grp.group}_Value`])).toLocaleString('en-IN') : ''}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value.replace(/,/g, '');
                                                                                    if (!isNaN(Number(val))) {
                                                                                        setWeeklyBenchmarks(prev => ({ ...prev, [`STOCK_${makeGroup.make}_${grp.group}_Value`]: val }));
                                                                                    }
                                                                                }}
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
                                                    <td className="p-3 border text-right bg-blue-900/10 ">
                                                        {Math.round(weeklyStats.stock.reduce((acc, m) => acc + parseFloat(weeklyBenchmarks[`STOCK_${m.make}_Qty`] || 0), 0)).toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="p-3 border text-right bg-blue-900/10 ">
                                                        {Math.round(weeklyStats.stock.reduce((acc, m) => acc + parseFloat(weeklyBenchmarks[`STOCK_${m.make}_Value`] || 0), 0)).toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="p-3 border text-right ">
                                                        {Math.round(weeklyStats.stock.reduce((acc, m) => acc + m.groups.reduce((a, g) => a + g.qty, 0), 0)).toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="p-3 border text-right bg-emerald-600 ">
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
                                                                <td className={`p-3 border text-right  ${diffQty >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{Math.round(diffQty).toLocaleString('en-IN')}</td>
                                                                <td className={`p-3 border text-right  ${diffVal >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{Math.round(diffVal).toLocaleString('en-IN')}</td>
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
                    ) : activeSubTab === 'stockPlanning' ? (
                        <div className="flex flex-col gap-6 animate-fade-in-up">
                            {filteredStockPlanning.length === 0 && (
                                <div className="bg-amber-50 p-6 rounded-xl border border-amber-200 mb-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-amber-900 mb-1">No Stock Planning Data</h4>
                                            <p className="text-xs text-amber-700">
                                                Materials: {materials.length}, Sales: {salesReportItems.length}, Planning Items: {stockPlanningData.length}
                                            </p>
                                            <p className="text-xs text-amber-600 mt-1">
                                                Check console (F12) for detailed debug information.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {(() => {
                                console.log('Stock Planning Debug - Total items:', stockPlanningData.length);
                                console.log('Stock Planning Debug - Filtered items:', filteredStockPlanning.length);
                                console.log('Stock Planning Debug - Materials:', materials.length);
                                console.log('Stock Planning Debug - Sales items:', salesReportItems.length);
                                if (stockPlanningData.length > 0) {
                                    console.log('Stock Planning Debug - Sample item:', stockPlanningData[0]);
                                }
                                return null;
                            })()}
                            {/* Graphical Summary Dashboard */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Overall Sales Trend (All Filtered Items) */}
                                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4 min-h-[350px]">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Overall Movement & Forecast</h4>
                                            <p className="text-sm font-black text-gray-800 uppercase">Filtered Inventory Trend Analysis</p>
                                        </div>
                                        <Activity className="w-5 h-5 text-rose-500" />
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        {(() => {
                                            try {
                                                const today = new Date();
                                                const currentFYInfo = getFiscalInfo(today);
                                                const [cyStartYear] = currentFYInfo.fiscalYear.split('-').map(Number);
                                                const pyStartYear = cyStartYear - 1;
                                                const fiscalMonthOffsets = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];
                                                const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

                                                const aggregatedPY = new Array(12).fill(0);
                                                const aggregatedCY = new Array(12).fill(0);
                                                const cyIsFuture = new Array(12).fill(false);
                                                let totalProj = 0;

                                                filteredStockPlanning.forEach(item => {
                                                    fiscalMonthOffsets.forEach((mIdx, i) => {
                                                        const pyYear = mIdx >= 3 ? pyStartYear : pyStartYear + 1;
                                                        const cyYear = mIdx >= 3 ? cyStartYear : cyStartYear + 1;

                                                        aggregatedPY[i] += (item.monthlySales?.get?.(`${pyYear}-${mIdx + 1}`) || 0);

                                                        const pointDate = new Date(cyYear, mIdx, 1);
                                                        if (pointDate <= today) {
                                                            aggregatedCY[i] += (item.monthlySales?.get?.(`${cyYear}-${mIdx + 1}`) || 0);
                                                        } else {
                                                            cyIsFuture[i] = true;
                                                        }
                                                    });
                                                    totalProj += item.projection || 0;
                                                });

                                                const cleanedCY = aggregatedCY.map((v, i) => cyIsFuture[i] ? NaN : v);
                                                let lastValidIdx = -1;
                                                for (let j = cleanedCY.length - 1; j >= 0; j--) {
                                                    if (!isNaN(cleanedCY[j])) {
                                                        lastValidIdx = j;
                                                        break;
                                                    }
                                                }

                                                const forecastSeries = new Array(15).fill(NaN);
                                                if (lastValidIdx !== -1) {
                                                    forecastSeries[lastValidIdx] = cleanedCY[lastValidIdx];
                                                    forecastSeries[12] = totalProj;
                                                    forecastSeries[13] = totalProj;
                                                    forecastSeries[14] = totalProj;
                                                }

                                                const maxV = Math.max(
                                                    ...aggregatedPY.filter(v => !isNaN(v)),
                                                    ...cleanedCY.filter(v => !isNaN(v)),
                                                    totalProj,
                                                    1
                                                );

                                                return (
                                                    <SalesTrendChart
                                                        maxVal={isNaN(maxV) ? 1 : maxV}
                                                        data={{
                                                            labels: [...monthNames, '+1M', '+2M', '+3M'],
                                                            series: [
                                                                { name: 'Prev Year', data: [...aggregatedPY, NaN, NaN, NaN], color: '#CBD5E1', active: true },
                                                                { name: 'Curr Year', data: [...cleanedCY, NaN, NaN, NaN], color: '#e11d48', active: true },
                                                                { name: '3M Forecast', data: forecastSeries, color: '#fb7185', active: true, dotted: true }
                                                            ]
                                                        }}
                                                    />
                                                );
                                            } catch (err) {
                                                console.error("Summary Chart Error:", err);
                                                return <div className="h-full flex items-center justify-center text-[10px] text-gray-400 font-bold uppercase">Preparing Graphical Insights...</div>;
                                            }
                                        })()}
                                    </div>
                                </div>

                                {/* Stock Health Mix */}
                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Health Distribution</h4>
                                            <p className="text-sm font-black text-gray-800 uppercase">Stock Adequacy Index</p>
                                        </div>
                                        <PieIcon className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <div className="flex-1 min-h-[220px]">
                                        {(() => {
                                            const shortageCount = filteredStockPlanning.filter(i => i.netQty < i.minStock).length;
                                            const refillCount = filteredStockPlanning.filter(i => i.netQty >= i.minStock && i.netQty < i.rol).length;
                                            const healthyCount = filteredStockPlanning.filter(i => i.netQty >= i.rol).length;
                                            return (
                                                <ModernDonutChartDashboard
                                                    title="STOCK HEALTH"
                                                    centerColorClass="text-indigo-600"
                                                    data={[
                                                        { label: 'CRITICAL', value: shortageCount, color: '#e11d48' },
                                                        { label: 'NEED REFILL', value: refillCount, color: '#f59e0b' },
                                                        { label: 'HEALTHY', value: healthyCount, color: '#10b981' }
                                                    ]}
                                                />
                                            );
                                        })()}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                                            <p className="text-[8px] font-black text-rose-600 uppercase">Procurement Gap</p>
                                            <p className="text-lg font-black text-rose-800 tracking-tight">{formatLargeValue(stockPlanningTotals.shortageQty)}</p>
                                        </div>
                                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                            <p className="text-[8px] font-black text-emerald-600 uppercase">Plan Accuracy</p>
                                            <p className="text-lg font-black text-emerald-800 tracking-tight">
                                                {filteredStockPlanning.length > 0 ? Math.round(((filteredStockPlanning.length - filteredStockPlanning.filter(i => i.netQty < i.minStock).length) / filteredStockPlanning.length) * 100) : 0}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Filters & Actions Panel */}
                            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4">
                                <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-rose-600 p-2.5 rounded-xl text-white shadow-lg shadow-rose-200">
                                            <Search className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-gray-800 uppercase leading-none mb-1">Material Intelligence Filters</h3>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Refine Selection & Search by Part No</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <button
                                            onClick={handleExportStockPlanning}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl shadow-lg shadow-emerald-200 flex flex-col items-center justify-center min-w-[120px] transition-all group"
                                        >
                                            <FileText className="w-4 h-4 mb-1 group-hover:scale-110 transition-transform" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Export Excel</span>
                                        </button>
                                        <button
                                            onClick={() => setStockQuickFilter(prev => prev === 'SHORTAGE' ? 'ALL' : 'SHORTAGE')}
                                            className={`px-5 py-3 rounded-2xl border transition-all flex flex-col items-end min-w-[140px] hover:scale-[1.02] active:scale-[0.98] ${stockQuickFilter === 'SHORTAGE' ? 'bg-red-600 border-red-700 shadow-lg shadow-red-200 ring-2 ring-red-400 ring-offset-2' : 'bg-white border-red-200 shadow-sm'}`}
                                        >
                                            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${stockQuickFilter === 'SHORTAGE' ? 'text-red-100' : 'text-red-500'}`}>Urgent Shortage</span>
                                            <span className={`text-xl font-black leading-none ${stockQuickFilter === 'SHORTAGE' ? 'text-white' : 'text-red-700'}`}>{stockPlanningTotals.shortageQty.toLocaleString()}</span>
                                            <span className={`text-[8px] font-bold mt-1 uppercase ${stockQuickFilter === 'SHORTAGE' ? 'text-red-200' : 'text-red-400'}`}>Across {stockPlanningTotals.shortageCount} Items</span>
                                        </button>
                                        <button
                                            onClick={() => setStockQuickFilter(prev => prev === 'REFILL' ? 'ALL' : 'REFILL')}
                                            className={`px-5 py-3 rounded-2xl border transition-all flex flex-col items-end min-w-[140px] hover:scale-[1.02] active:scale-[0.98] ${stockQuickFilter === 'REFILL' ? 'bg-orange-500 border-orange-600 shadow-lg shadow-orange-200 ring-2 ring-orange-300 ring-offset-2' : 'bg-white border-orange-200 shadow-sm'}`}
                                        >
                                            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${stockQuickFilter === 'REFILL' ? 'text-orange-100' : 'text-orange-400'}`}>Target Refill</span>
                                            <span className={`text-xl font-black leading-none ${stockQuickFilter === 'REFILL' ? 'text-white' : 'text-orange-700'}`}>{stockPlanningTotals.refillQty.toLocaleString()}</span>
                                            <span className={`text-[8px] font-bold mt-1 uppercase ${stockQuickFilter === 'REFILL' ? 'text-orange-200' : 'text-orange-400'}`}>Across {stockPlanningTotals.refillCount} Items</span>
                                        </button>
                                    </div>

                                    <div className="relative w-96">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500" />
                                        <input
                                            type="text"
                                            placeholder="SEARCH BY PART NO OR DESCRIPTION..."
                                            className="w-full pl-10 pr-4 py-3 bg-white border-2 border-rose-100 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all shadow-sm uppercase tracking-wider"
                                            value={stockSearchTerm}
                                            onChange={(e) => setStockSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-4 pt-2 border-t border-gray-50">
                                    {[
                                        { label: 'Make', key: 'make', options: ['ALL', ...Array.from(new Set(stockPlanningData.map(d => d.make))).sort()] },
                                        { label: 'Group', key: 'group', options: ['ALL', ...Array.from(new Set(stockPlanningData.map(d => d.group))).sort()] },
                                        { label: 'Strategy', key: 'strategy', options: ['ALL', 'GENERAL STOCK', 'MADE TO ORDER', 'AGAINST ORDER'] },
                                        { label: 'Classification', key: 'class', options: ['ALL', 'FAST RUNNER', 'SLOW RUNNER', 'NON-MOVING'] }
                                    ].map((s) => (
                                        <div key={s.key} className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{s.label}</label>
                                            <select
                                                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-rose-500"
                                                value={(stockSlicers as any)[s.key]}
                                                onChange={(e) => setStockSlicers(prev => ({ ...prev, [s.key]: e.target.value }))}
                                            >
                                                {s.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Chart Area for Selected Item */}
                            {selectedStockItem && (
                                <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-lg relative animate-fade-in-up">
                                    <div className="absolute top-4 right-4 flex items-center gap-2">
                                        <button
                                            onClick={() => setSelectedStockItem(null)}
                                            className="p-2 text-gray-400 hover:text-rose-600 transition-colors bg-rose-50 rounded-lg flex items-center gap-1.5"
                                            title="Close Side Details"
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Hide Details</span>
                                            <PanelLeftClose className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setSelectedStockItem(null)}
                                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    {(() => {
                                        const item = stockPlanningData.find(d => d.uniqueId === selectedStockItem);
                                        if (!item) return null;

                                        const today = new Date();
                                        const currentFYInfo = getFiscalInfo(today);
                                        const [cyStartYear] = currentFYInfo.fiscalYear.split('-').map(Number);
                                        const pyStartYear = cyStartYear - 1;

                                        // Aligned Fiscal Months (Apr to Mar)
                                        const fiscalMonthOffsets = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];
                                        const monthNames = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

                                        const pyPoints = fiscalMonthOffsets.map(mIdx => {
                                            const year = mIdx >= 3 ? pyStartYear : pyStartYear + 1;
                                            return item.monthlySales.get(`${year}-${mIdx + 1}`) || 0;
                                        });

                                        const cyPoints = fiscalMonthOffsets.map(mIdx => {
                                            const year = mIdx >= 3 ? cyStartYear : cyStartYear + 1;
                                            // Only show CY points up to current month
                                            const pointDate = new Date(year, mIdx, 1);
                                            if (pointDate > today) return NaN;
                                            return item.monthlySales.get(`${year}-${mIdx + 1}`) || 0;
                                        });

                                        // Projection Logic: Start from last CY value and go 3 months forward
                                        const lastCYIdx = cyPoints.findIndex(v => isNaN(v)) - 1;
                                        const startIdx = lastCYIdx >= 0 ? lastCYIdx : 0;

                                        const projectionPoints = new Array(12).fill(NaN);
                                        projectionPoints[startIdx] = cyPoints[startIdx] || 0; // Seamless connection

                                        // Extend projections
                                        const projLabels = ['Forecast +1', 'Forecast +2', 'Forecast +3'];
                                        const projData = [item.projection, item.projection, item.projection];

                                        // Combined labels for chart
                                        const allLabels = [...monthNames, ...projLabels];
                                        const pySeries = [...pyPoints, NaN, NaN, NaN];
                                        const cySeries = [...cyPoints, NaN, NaN, NaN];
                                        const forecastSeries = [...new Array(12).fill(NaN), ...projData];

                                        // Connect projection to last CY point
                                        forecastSeries[startIdx === -1 ? 11 : startIdx] = cyPoints[startIdx === -1 ? 11 : startIdx] || 0;

                                        return (
                                            <div key={item.uniqueId} className="flex flex-col lg:flex-row gap-8">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-6">
                                                        <h4 className="text-xs font-black text-gray-900 uppercase flex items-center gap-2">
                                                            <Activity className="w-4 h-4 text-rose-600" />
                                                            Performance Analysis: <span className="text-rose-600">{item.description}</span>
                                                        </h4>
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                                                <span className="text-[9px] font-bold text-gray-500 uppercase">PY {pyStartYear}-{(pyStartYear + 1).toString().slice(-2)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-2 h-2 rounded-full bg-rose-600"></div>
                                                                <span className="text-[9px] font-bold text-gray-500 uppercase">CY {cyStartYear}-{(cyStartYear + 1).toString().slice(-2)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-2 h-0.5 bg-rose-400 border-t border-dashed border-rose-600"></div>
                                                                <span className="text-[9px] font-bold text-gray-500 uppercase">3M Forecast</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="h-[280px] w-full p-2">
                                                        <SalesTrendChart
                                                            key={item.uniqueId}
                                                            maxVal={(() => {
                                                                const v = Math.max(
                                                                    ...pyPoints.filter(v => !isNaN(v)),
                                                                    ...cyPoints.filter(v => !isNaN(v)),
                                                                    item.projection,
                                                                    1
                                                                );
                                                                return isNaN(v) ? 1 : v;
                                                            })()}
                                                            data={{
                                                                labels: allLabels,
                                                                series: [
                                                                    { name: `FY ${pyStartYear}-${(pyStartYear + 1).toString().slice(-2)} Sales`, data: pySeries, color: '#CBD5E1', active: true },
                                                                    { name: `FY ${cyStartYear}-${(cyStartYear + 1).toString().slice(-2)} Sales`, data: cySeries, color: '#e11d48', active: true },
                                                                    { name: '3-Month Projection', data: forecastSeries, color: '#fb7185', active: true, dotted: true }
                                                                ]
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-100 space-y-4">
                                                    <h5 className="text-[10px] font-black text-rose-800 uppercase tracking-widest border-b border-rose-200 pb-2">Inventory Control Center</h5>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                                                            <p className="text-[8px] font-bold text-gray-400 uppercase">Min Stock</p>
                                                            <p className="text-lg font-black text-gray-900">{item.minStock}</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm">
                                                            <p className="text-[8px] font-bold text-gray-400 uppercase">Max Stock</p>
                                                            <p className="text-lg font-black text-gray-900">{item.maxStock}</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm col-span-2 border-l-4 border-l-rose-600">
                                                            <p className="text-[8px] font-bold text-gray-400 uppercase">Reorder Level (ROL)</p>
                                                            <p className="text-xl font-black text-rose-700">{item.rol}</p>
                                                        </div>
                                                        <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm col-span-2">
                                                            <p className="text-[8px] font-bold text-gray-400 uppercase">Future Projection (Monthly)</p>
                                                            <p className="text-lg font-black text-indigo-700">{item.projection}</p>
                                                        </div>
                                                        <div className="bg-red-50 p-3 rounded-xl border border-red-100 shadow-sm col-span-2">
                                                            <div className="flex justify-between items-center">
                                                                <p className="text-[8px] font-black text-red-600 uppercase">Urgent Shortage</p>
                                                                <AlertTriangle className="w-3 h-3 text-red-500" />
                                                            </div>
                                                            <p className="text-xl font-black text-red-700">{item.netQty < item.minStock ? Math.round(item.minStock - item.netQty) : 0}</p>
                                                        </div>
                                                        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 shadow-sm col-span-2">
                                                            <div className="flex justify-between items-center">
                                                                <p className="text-[8px] font-black text-orange-600 uppercase tracking-tight">Recommended Refill (to Max)</p>
                                                                <RefreshCw className="w-3 h-3 text-orange-500" />
                                                            </div>
                                                            <p className="text-xl font-black text-orange-700">{item.netQty < item.rol ? Math.round(item.maxStock - item.netQty) : 0}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Main Data Grid */}
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse border border-gray-300">
                                        <thead>
                                            <tr className="bg-gray-100 divide-x divide-gray-300 text-[9px] font-black text-gray-700 uppercase tracking-tighter text-center">
                                                <th className="px-2 py-2 border border-gray-300 w-8 bg-gray-100 sticky left-0 z-20">#</th>
                                                <th className="px-3 py-2 border border-gray-300 sticky left-8 z-20 bg-gray-100 min-w-[120px] cursor-pointer hover:bg-gray-200" onClick={() => handleStockSort('make')}>
                                                    <div className="flex items-center justify-center gap-1">Make & Group {stockSortConfig?.key === 'make' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                </th>
                                                <th className="px-3 py-2 border border-gray-300 text-left cursor-pointer hover:bg-gray-200" onClick={() => handleStockSort('description')}>
                                                    <div className="flex flex-col items-start gap-0.5">
                                                        <div className="flex items-center gap-1">Description {stockSortConfig?.key === 'description' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                        <span className="text-[7px] text-gray-400  tracking-widest uppercase">Part Number Index</span>
                                                    </div>
                                                </th>
                                                <th className="px-3 py-2 border border-gray-300 bg-emerald-100/50 cursor-pointer hover:bg-emerald-100" onClick={() => handleStockSort('salesCY')}>
                                                    <div className="flex items-center justify-center gap-1">Qty Sold (CY) {stockSortConfig?.key === 'salesCY' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                </th>
                                                <th className="px-3 py-2 border border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => handleStockSort('salesPY')}>
                                                    <div className="flex items-center justify-center gap-1">Qty Sold (PY) {stockSortConfig?.key === 'salesPY' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                </th>
                                                <th className="px-3 py-2 border border-gray-300 bg-gray-50 cursor-pointer hover:bg-gray-200" onClick={() => handleStockSort('growth')}>
                                                    <div className="flex items-center justify-center gap-1">YoY {stockSortConfig?.key === 'growth' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                </th>
                                                <th className="px-3 py-2 border border-gray-300 bg-blue-100/50 cursor-pointer hover:bg-blue-100" onClick={() => handleStockSort('stock')}>
                                                    <div className="flex items-center justify-center gap-1">Stock {stockSortConfig?.key === 'stock' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                </th>
                                                <th className="px-3 py-2 border border-gray-300 bg-indigo-100/50 cursor-pointer hover:bg-indigo-100" onClick={() => handleStockSort('soDue')}>
                                                    <div className="flex items-center justify-center gap-1">SO (D | S) {stockSortConfig?.key === 'soDue' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                </th>
                                                <th className="px-3 py-2 border border-gray-300 bg-orange-100/50 cursor-pointer hover:bg-orange-100" onClick={() => handleStockSort('poDue')}>
                                                    <div className="flex items-center justify-center gap-1">PO (D | S) {stockSortConfig?.key === 'poDue' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                </th>
                                                <th className="px-3 py-2 border border-gray-300 bg-rose-100/50 cursor-pointer hover:bg-rose-100" onClick={() => handleStockSort('netQty')}>
                                                    <div className="flex items-center justify-center gap-1">Net Qty {stockSortConfig?.key === 'netQty' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                </th>
                                                <th className="px-2 py-2 border border-gray-300 bg-red-100/30 text-red-700 cursor-pointer hover:bg-red-100" onClick={() => handleStockSort('shortageQty')}>
                                                    <div className="flex items-center justify-center gap-1">Shortage Qty {stockSortConfig?.key === 'shortageQty' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                </th>
                                                <th className="px-2 py-2 border border-gray-300 bg-orange-100/30 text-orange-700 cursor-pointer hover:bg-orange-100" onClick={() => handleStockSort('refillQty')}>
                                                    <div className="flex items-center justify-center gap-1">Refill Qty {stockSortConfig?.key === 'refillQty' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                </th>
                                                <th className="px-3 py-2 border border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => handleStockSort('rol')}>
                                                    <div className="flex items-center justify-center gap-1">Target Level {stockSortConfig?.key === 'rol' && (stockSortConfig.direction === 'asc' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />)}</div>
                                                </th>
                                                <th className="px-3 py-2 border border-gray-300">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 text-[10px]">
                                            {filteredStockPlanning.slice(0, 150).map((item, idx) => (
                                                <tr
                                                    key={item.uniqueId || idx}
                                                    onClick={() => setSelectedStockItem(item.uniqueId)}
                                                    className={`hover:bg-rose-50/50 cursor-pointer transition-colors group ${selectedStockItem === item.uniqueId ? 'bg-rose-50' : ''}`}
                                                >
                                                    <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-400  text-[9px] sticky left-0 z-10 bg-white group-hover:bg-rose-50/5">{idx + 1}</td>
                                                    <td className="px-3 py-1.5 border border-gray-200 sticky left-8 z-10 bg-white group-hover:bg-rose-50/5 backdrop-blur-md">
                                                        <span className="font-black text-gray-900 block truncate max-w-[100px]">{item.make}</span>
                                                        <span className="font-bold text-blue-600 text-[8px] uppercase tracking-tighter">{item.group}</span>
                                                    </td>
                                                    <td className="px-3 py-1.5 border border-gray-200">
                                                        <span className="font-black text-gray-700 block max-w-[250px] truncate" title={item.description}>{item.description}</span>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] font-black text-rose-600  tracking-tighter bg-rose-50 px-1 rounded border border-rose-100">{item.partNo || 'NO-PART-NO'}</span>
                                                            <div className="flex gap-1">
                                                                <span className="px-1 py-0.2 rounded bg-gray-100 text-[6.5px] font-black text-gray-500 uppercase">{item.classification}</span>
                                                                <span className="px-1 py-0.2 rounded bg-indigo-50 text-[6.5px] font-black text-indigo-500 uppercase">{item.strategy}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1.5 border border-gray-200 text-right font-black text-emerald-700 bg-emerald-50/10">{item.salesCY.toLocaleString()}</td>
                                                    <td className="px-3 py-1.5 border border-gray-200 text-right font-bold text-gray-400">{item.salesPY.toLocaleString()}</td>
                                                    <td className="px-3 py-1.5 border border-gray-200 text-center">
                                                        {(() => {
                                                            const diff = item.salesCY - item.salesPY;
                                                            const pct = item.salesPY > 0 ? (diff / item.salesPY) * 100 : item.salesCY > 0 ? 100 : 0;
                                                            return (
                                                                <div className={`flex items-center justify-center gap-0.5 font-black text-[9px] ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                    {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                                    <span>{Math.abs(Math.round(pct))}%</span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-3 py-1.5 border border-gray-200 text-right font-black text-blue-700 bg-blue-50/10">{item.stock.toLocaleString()}</td>
                                                    <td className="px-3 py-1.5 border border-gray-200 text-right bg-indigo-50/10">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <span className="font-black text-rose-600">{item.soDue}</span>
                                                            <span className="text-gray-300">|</span>
                                                            <span className="font-bold text-indigo-400">{item.soSched}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1.5 border border-gray-200 text-right bg-orange-50/10">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <span className="font-black text-orange-600">{item.poDue}</span>
                                                            <span className="text-gray-300">|</span>
                                                            <span className="font-bold text-orange-400">{item.poSched}</span>
                                                        </div>
                                                    </td>
                                                    <td className={`px-3 py-1.5 border border-gray-200 text-right font-black text-[11px] ${item.netQty < item.rol ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>
                                                        {item.netQty.toLocaleString()}
                                                    </td>
                                                    <td className="px-3 py-1.5 border border-gray-200 text-right bg-red-50/20 font-black text-red-600">
                                                        {item.netQty < item.minStock ? Math.abs(Math.round(item.minStock - item.netQty)).toLocaleString() : 0}
                                                    </td>
                                                    <td className="px-3 py-1.5 border border-gray-200 text-right bg-orange-50/20 font-black text-orange-600">
                                                        {item.netQty < item.rol ? Math.abs(Math.round(item.maxStock - item.netQty)).toLocaleString() : 0}
                                                    </td>
                                                    <td className="px-3 py-1.5 border border-gray-200 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[8px] font-black text-gray-400 uppercase">ROL: {item.rol}</span>
                                                            <span className="text-[7px] font-bold text-gray-300">MAX: {item.maxStock}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-1.5 border border-gray-200 text-center">
                                                        {item.netQty < item.minStock ? (
                                                            <span className="px-2 py-0.5 rounded bg-red-600 text-white font-black text-[8px] uppercase">Shortage</span>
                                                        ) : item.netQty < item.rol ? (
                                                            <span className="px-2 py-0.5 rounded bg-orange-500 text-white font-black text-[8px] uppercase">Refill</span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-black text-[8px] uppercase">Healthy</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Excel-Style Status Bar at bottom of table */}
                                <div className="bg-rose-700 text-white px-3 py-1 text-[9px] font-black flex justify-between items-center select-none uppercase tracking-widest">
                                    <div className="flex gap-4 items-center">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full bg-white ${filteredStockPlanning.length > 0 ? 'animate-pulse' : 'opacity-50'}`} />
                                            <span>Inventory Analysis Engine: Active</span>
                                        </div>
                                        <span className="text-rose-400 opacity-30">|</span>
                                        <span>Displaying {Math.min(filteredStockPlanning.length, 150)} of {filteredStockPlanning.length} Records</span>
                                        <span className="text-rose-400 opacity-30">|</span>
                                        <span>Filters: {stockSlicers.make !== 'ALL' || stockSlicers.group !== 'ALL' || stockSlicers.strategy !== 'ALL' || stockSlicers.class !== 'ALL' ? 'ACTIVE' : 'NONE'}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="bg-rose-600 px-2 py-0.5 rounded-full">STOCK PLANNING WORKBOOK</span>
                                        <span>Scale: 100%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeSubTab === 'customerAnalysis' ? (
                        <div className="h-full flex flex-col -m-2">
                            <CustomerFYAnalysisView salesReportItems={salesReportItems} customers={customers} />
                        </div>
                    ) : null}
                </div>
            </div>
        </div >
    );
});


export default DashboardView;
