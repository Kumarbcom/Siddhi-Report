
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem, SalesRecord } from '../types';
import { TrendingUp, TrendingDown, Package, ClipboardList, ShoppingCart, Calendar, Filter, PieChart, BarChart3, BarChart, Users, Activity, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, UserCircle, Minus, Plus, ChevronDown, Link2Off, AlertTriangle, Layers, Clock, CheckCircle2, AlertCircle, Factory, Globe, Search, ArrowUpDown, ArrowUp, ArrowDown, X, ChevronRight, ListOrdered, Table } from 'lucide-react';

/**
 * UTILITY FUNCTIONS - DEFINED FIRST
 */
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
    const b = (brand || '').toLowerCase().trim();
    if (b === 'unspecified' || b === 'unknown' || b === 'all') return null;
    let domain = `${b.replace(/[^a-z0-9]/g, '')}.com`;
    if (b.includes('schneider')) domain = 'se.com';
    if (b.includes('lapp')) domain = 'lapp.com';
    if (b.includes('eaton')) domain = 'eaton.com';
    if (b.includes('hager')) domain = 'hager.com';
    if (b.includes('siemens')) domain = 'siemens.com';
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
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

/**
 * SUB-COMPONENTS
 */
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

  if (!maxVal || maxVal <= 0) return <div className="h-full flex items-center justify-center text-gray-300">No Data</div>;

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIndex(null)} className="flex flex-col h-full relative cursor-crosshair">
      <div className="flex-1 relative min-h-0">
         {data.series.map((s, sIdx) => s.active && s.data.map((val: number, i: number) => {
             if (hoverIndex !== i) return null;
             const x = (i / (data.labels.length - 1)) * 100;
             const y = 100 - ((val / maxVal) * 100);
             return (
               <div key={`${sIdx}-${i}`} className="absolute bg-gray-900 text-white text-[9px] px-1.5 py-0.5 rounded shadow-lg z-50 transform -translate-x-1/2" style={{ left: `${x}%`, top: `${y}%`, marginTop: '-20px' }}>
                 {formatLargeValue(val, true)}
               </div>
             );
         }))}
         <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            {data.series.map((s, i) => {
               if (!s.active) return null;
               const points: [number, number][] = s.data.map((val: any, idx: any) => [(idx / (data.labels.length - 1)) * 100, 100 - ((val / maxVal) * 100)]);
               const pathD = getSmoothPath(points);
               return (
                   <g key={i}>
                       <path d={`${pathD} L 100 100 L 0 100 Z`} fill={s.color} fillOpacity="0.1" />
                       <path d={pathD} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                   </g>
               )
            })}
         </svg>
      </div>
    </div>
  );
};

const SimpleDonut = ({ data, title, color, isCurrency = false }: { data: any[], title: string, color: string, isCurrency?: boolean }) => {
     const total = data.reduce((a,b) => a+(b.value || 0), 0);
     let cumPercent = 0;
     const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
     return (
        <div className="flex flex-col h-full">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">{title}</h4>
            <div className="flex-1 flex flex-col md:flex-row items-center gap-4 min-h-0">
                <svg viewBox="-1 -1 2 2" className="w-32 h-32 transform -rotate-90 flex-shrink-0">
                    {data.slice(0, 5).map((d, i) => {
                        const percent = d.value / (total || 1);
                        const [sx, sy] = [Math.cos(2*Math.PI*cumPercent), Math.sin(2*Math.PI*cumPercent)];
                        cumPercent += percent;
                        const [ex, ey] = [Math.cos(2*Math.PI*cumPercent), Math.sin(2*Math.PI*cumPercent)];
                        return <path key={i} d={`M ${sx} ${sy} A 1 1 0 ${percent > 0.5 ? 1 : 0} 1 ${ex} ${ey} L 0 0`} fill={palette[i%5]} stroke="white" strokeWidth="0.02" />
                    })}
                    <circle cx="0" cy="0" r="0.7" fill="white" />
                </svg>
                <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
                    {data.slice(0, 5).map((d, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                            <span className="truncate w-24 text-gray-600">{d.label}</span>
                            <span className="font-bold">{isCurrency ? formatLargeValue(d.value, true) : d.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
     );
};

const KPICard = ({ label, value, growth }: { label: string, value: string, growth: number }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
        <h3 className="text-xl font-black text-gray-900 mt-1">{value}</h3>
        <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${growth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(growth).toFixed(1)}%
        </div>
    </div>
);

/**
 * MAIN COMPONENT
 */
const DashboardView: React.FC<any> = ({ materials, closingStock, pendingSO, pendingPO, salesReportItems, customers }) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'orders'>('sales');
  const [selectedFY, setSelectedFY] = useState('');

  const parseDateLocal = (v: any) => {
    if (!v) return new Date();
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const getFiscal = (d: Date) => {
    const m = d.getMonth(); const y = d.getFullYear();
    const sy = m >= 3 ? y : y - 1;
    return `${sy}-${sy + 1}`;
  };

  const enrichedSales = useMemo(() => salesReportItems.map(i => ({ ...i, fiscalYear: getFiscal(parseDateLocal(i.date)) })), [salesReportItems]);
  const fyears = useMemo(() => Array.from(new Set(enrichedSales.map(i => i.fiscalYear))).sort().reverse(), [enrichedSales]);

  useEffect(() => { if (fyears.length > 0 && !selectedFY) setSelectedFY(fyears[0]); }, [fyears, selectedFY]);

  const stats = useMemo(() => {
    const cur = enrichedSales.filter(i => i.fiscalYear === selectedFY);
    const total = cur.reduce((a, b) => a + (b.value || 0), 0);
    const qty = cur.reduce((a, b) => a + (b.quantity || 0), 0);
    return { total, qty };
  }, [selectedFY, enrichedSales]);

  const lineData = useMemo(() => {
    const labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    const getS = (fy: string) => {
      const arr = new Array(12).fill(0);
      enrichedSales.filter(i => i.fiscalYear === fy).forEach(i => {
          const m = parseDateLocal(i.date).getMonth();
          const idx = m >= 3 ? m - 3 : m + 9;
          if (idx >= 0 && idx < 12) arr[idx] += (i.value || 0);
      });
      return arr;
    };
    return { labels, series: [{ name: selectedFY, data: getS(selectedFY), color: '#3B82F6', active: true }] };
  }, [selectedFY, enrichedSales]);

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
        <div className="flex bg-white p-2 border-b border-gray-200 justify-between items-center flex-shrink-0">
            <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                {(['sales', 'inventory', 'orders'] as const).map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeTab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>{t}</button>
                ))}
            </div>
            {activeTab === 'sales' && (
                <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="text-xs border rounded p-1">
                    {fyears.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {activeTab === 'sales' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <KPICard label="Annual Sales" value={formatLargeValue(stats.total)} growth={0} />
                        <KPICard label="Units Sold" value={stats.qty.toLocaleString()} growth={0} />
                        <KPICard label="Customers" value={customers.length.toString()} growth={0} />
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-96">
                        <h4 className="text-sm font-bold mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> Revenue Growth Trend</h4>
                        <div className="flex-1 h-64">
                            <SalesTrendChart data={lineData} maxVal={Math.max(...lineData.series[0]?.data, 1000) * 1.2} />
                        </div>
                    </div>
                </>
            )}
            {activeTab === 'inventory' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-80">
                        <SimpleDonut data={[{label: 'In Stock', value: closingStock.length}]} title="Stock Overview" color="green" />
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-80">
                        <SimpleDonut data={[{label: 'Pending PO', value: pendingPO.length}]} title="Procurement Status" color="blue" />
                    </div>
                </div>
            )}
            {activeTab === 'orders' && (
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-purple-600" /> Pipeline Orders</h4>
                    <p className="text-xs text-gray-500 italic">Total Pending SO: {pendingSO.length} lines</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default DashboardView;
