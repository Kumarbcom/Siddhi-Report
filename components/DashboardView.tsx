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
    if (b === 'unspecified' || b === 'unknown' || b === 'all' || !b) return null;
    let domain = `${b.replace(/[^a-z0-9]/g, '')}.com`;
    // Industry specific domain mapping
    if (b.includes('schneider')) domain = 'se.com';
    if (b.includes('lapp')) domain = 'lapp.com';
    if (b.includes('eaton')) domain = 'eaton.com';
    if (b.includes('hager')) domain = 'hager.com';
    if (b.includes('phoenix')) domain = 'phoenixcontact.com';
    if (b.includes('mitsubishi')) domain = 'mitsubishielectric.com';
    if (b.includes('siemens')) domain = 'siemens.com';
    if (b.includes('honeywell')) domain = 'honeywell.com';
    if (b.includes('abb')) domain = 'abb.com';
    
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
};

const getMergedGroupName = (groupName: string) => {
    const g = String(groupName || 'Unassigned').trim();
    const lowerG = g.toLowerCase();
    if (lowerG.includes('group-1') || lowerG.includes('group-3') || lowerG.includes('peenya') || lowerG.includes('dcv')) return 'Group-1 Giridhar';
    if (lowerG.includes('online')) return 'Online Business';
    return g;
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
    <div className="flex flex-col h-full select-none cursor-crosshair overflow-hidden" ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIndex(null)}>
      <div className="flex-1 relative min-h-0">
         {data.series.map((s: any, sIdx: number) => 
             s.active && s.data.map((val: number, i: number) => {
                 if (val === 0 || isNaN(val)) return null;
                 const x = (i / (data.labels.length - 1)) * 100;
                 const y = 100 - ((val / maxVal) * 100);
                 return (
                     <div key={`${sIdx}-${i}`} className={`absolute text-[8px] font-bold bg-white/80 backdrop-blur-[1px] px-1 rounded shadow-sm border border-gray-100 z-10 pointer-events-none transform -translate-x-1/2 transition-all duration-200 ${hoverIndex === i ? 'scale-125 z-20 border-blue-200 opacity-100' : 'opacity-40'}`} style={{ left: `${x}%`, top: `calc(${y}% - 12px)`, color: s.color }}>
                         {formatLargeValue(val, true)}
                     </div>
                 );
             })
         )}
         <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            {data.series.map((s: any, i: number) => {
               if (!s.active) return null;
               const pts = s.data.map((v: any, idx: any) => `${(idx / (data.labels.length - 1)) * 100},${100 - ((v / maxVal) * 100)}`).join(' L ');
               return <path key={i} d={`M ${pts}`} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />;
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
     let displayData = data.length > 8 ? [...data.slice(0, 8), { label: 'Others', value: data.slice(8).reduce((a,b) => a+(b.value || 0), 0) }] : data;
     const colorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#9CA3AF', '#6366F1', '#EC4899'];
     return (
        <div className="flex flex-col h-full items-center">
            <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-4 w-full text-left border-b border-gray-100 pb-1">{title}</h4>
            <div className="flex flex-col lg:flex-row items-center gap-8 flex-1 min-h-0 w-full">
                <div className="w-64 h-64 relative flex-shrink-0">
                   <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                      {displayData.map((slice, i) => {
                          const percent = slice.value / (total || 1);
                          const startX = Math.cos(2 * Math.PI * cumPercent);
                          const startY = Math.sin(2 * Math.PI * cumPercent);
                          cumPercent += percent;
                          const endX = Math.cos(2 * Math.PI * cumPercent);
                          const endY = Math.sin(2 * Math.PI * cumPercent);
                          return ( <path key={i} d={`M ${startX} ${startY} A 1 1 0 ${percent > 0.5 ? 1 : 0} 1 ${endX} ${endY} L 0 0`} fill={slice.color || colorPalette[i % colorPalette.length]} stroke="white" strokeWidth="0.02" className="hover:opacity-80 transition-opacity" /> );
                      })}
                      <circle cx="0" cy="0" r="0.75" fill="white" />
                   </svg>
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                       <span className={`text-[14px] font-black leading-none ${color === 'blue' ? 'text-blue-700' : 'text-green-700'}`}>{formatLargeValue(total, true)}</span>
                       <span className="text-[8px] text-gray-400 uppercase font-bold mt-1">Total</span>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar w-full max-h-48 lg:max-h-none pr-2">
                    {displayData.map((d, i) => (
                        <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                             <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: d.color || colorPalette[i % colorPalette.length]}}></div>
                                <span className="text-[10px] text-gray-600 font-bold truncate">{d.label}</span>
                             </div>
                             <div className="flex items-center gap-3 ml-4">
                                <span className="text-[10px] font-black text-gray-800 w-10 text-right">{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
     );
};

// Component for rendering horizontal bar charts for top rankings
const HorizontalBarChart = ({ data, title, color }: { data: { label: string, value: number }[], title: string, color: string }) => {
  const maxVal = Math.max(...data.map(d => d.value), 0);
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    green: 'bg-green-500'
  };
  const barColor = colorClasses[color] || 'bg-blue-500';

  return (
    <div className="flex flex-col h-full w-full">
      <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-4 border-b border-gray-100 pb-1">{title}</h4>
      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-xs">No Data</div>
        ) : (
          data.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-700">
                <span className="truncate flex-1 pr-4">{item.label}</span>
                <span>{formatLargeValue(item.value, true)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div 
                  className={`${barColor} h-full rounded-full transition-all duration-500`} 
                  style={{ width: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const KPICard = ({ label, value, growth, timeView }: { label: string, value: string, growth: number, timeView: string }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors">
        <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
            <h3 className="text-xl font-black text-gray-900 mt-1">{value}</h3>
        </div>
        <div className="mt-3 flex items-center gap-2">
            <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${growth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <span>{Math.abs(growth).toFixed(1)}%</span>
            </div>
            <span className="text-[9px] text-gray-400 font-medium italic">vs PY ({timeView})</span>
        </div>
    </div>
);

const DashboardView: React.FC<any> = ({ materials = [], closingStock = [], pendingSO = [], pendingPO = [], salesReportItems = [], customers = [], setActiveTab }) => {
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'inventory' | 'so' | 'po'>('sales');
  const [timeView, setTimeView] = useState<'FY' | 'MONTH'>('FY');
  
  const now = new Date();
  const currentMonthIdx = now.getMonth() >= 3 ? now.getMonth() - 3 : now.getMonth() + 9;
  const currentYearStr = now.getMonth() >= 3 ? `${now.getFullYear()}-${now.getFullYear() + 1}` : `${now.getFullYear() - 1}-${now.getFullYear()}`;
  
  const [selectedFY, setSelectedFY] = useState<string>(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIdx);
  const [invGroupMetric, setInvGroupMetric] = useState<'value' | 'quantity'>('value');
  const [invTableSearch, setInvTableSearch] = useState('');
  const [invTableSort, setInvTableSort] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [selectedInvMake, setSelectedInvMake] = useState<string>('ALL');

  const parseDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000);
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const getFiscalInfo = (date: Date) => {
    const month = date.getMonth(); 
    const year = date.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    const fiscalYear = `${startYear}-${startYear + 1}`;
    const fiscalMonthIndex = month >= 3 ? month - 3 : month + 9;
    return { fiscalYear, fiscalMonthIndex };
  };

  const enrichedSales = useMemo(() => {
      const custMap = new Map<string, CustomerMasterItem>();
      customers.forEach(c => { if(c.customerName) custMap.set(String(c.customerName).toLowerCase().trim(), c); });
      return salesReportItems.map(item => {
          const dateObj = parseDate(item.date);
          const { fiscalYear, fiscalMonthIndex } = getFiscalInfo(dateObj);
          const cust = customerLookup(item.customerName);
          return { ...item, fiscalYear, fiscalMonthIndex, custGroup: getMergedGroupName(cust?.group || 'Unassigned') };
      });

      function customerLookup(name: string) {
          return customers.find(c => String(c.customerName || '').toLowerCase().trim() === String(name || '').toLowerCase().trim());
      }
  }, [salesReportItems, customers]);

  const uniqueFYs = useMemo(() => Array.from(new Set(enrichedSales.map(i => i.fiscalYear))).filter(f => f !== 'N/A').sort().reverse(), [enrichedSales]);
  
  useEffect(() => { 
    if (uniqueFYs.length > 0 && !uniqueFYs.includes(selectedFY)) setSelectedFY(uniqueFYs[0]);
  }, [uniqueFYs]);

  const currentData = useMemo(() => {
      return enrichedSales.filter(i => {
          if (i.fiscalYear !== selectedFY) return false;
          if (timeView === 'MONTH' && i.fiscalMonthIndex !== selectedMonth) return false;
          return true;
      });
  }, [selectedFY, selectedMonth, timeView, enrichedSales]);

  const previousData = useMemo(() => {
      if (!selectedFY) return [];
      const parts = selectedFY.split('-');
      const pyString = `${parseInt(parts[0]) - 1}-${parseInt(parts[1]) - 1}`;
      return enrichedSales.filter(i => {
          if (i.fiscalYear !== pyString) return false;
          if (timeView === 'MONTH' && i.fiscalMonthIndex !== selectedMonth) return false;
          return true;
      });
  }, [selectedFY, timeView, selectedMonth, enrichedSales]);

  const kpis = useMemo(() => {
      const getStats = (data: any[]) => {
          const val = data.reduce((acc, i) => acc + (i.value || 0), 0);
          const qty = data.reduce((acc, i) => acc + (i.quantity || 0), 0);
          const custs = new Set(data.map(i => String(i.customerName || ''))).size;
          return { val, qty, custs };
      };
      const curr = getStats(currentData);
      const prev = getStats(previousData);
      const calcGrowth = (c: number, p: number) => p > 0 ? ((c - p) / p) * 100 : (c > 0 ? 100 : 0);
      return {
          sales: { curr: curr.val, growth: calcGrowth(curr.val, prev.val) },
          qty: { curr: curr.qty, growth: calcGrowth(curr.qty, prev.qty) },
          custs: { curr: curr.custs, growth: calcGrowth(curr.custs, prev.custs) }
      };
  }, [currentData, previousData]);

  const inventoryStats = useMemo(() => {
    let data = closingStock.map(i => { 
        const mat = materials.find(m => String(m.description || '').toLowerCase().trim() === String(i.description || '').toLowerCase().trim()); 
        return { ...i, make: mat ? mat.make : 'Unspecified', group: mat ? mat.materialGroup : 'Unspecified' }; 
    });
    const uniqueMakes = Array.from(new Set(data.map(i => i.make))).sort();
    
    // Detailed Table with Filters and Sorting
    let tableData = [...data];
    if (selectedInvMake !== 'ALL') tableData = tableData.filter(i => i.make === selectedInvMake);
    if (invTableSearch) {
        const lower = invTableSearch.toLowerCase();
        tableData = tableData.filter(i => i.description.toLowerCase().includes(lower) || i.make.toLowerCase().includes(lower) || i.group.toLowerCase().includes(lower));
    }
    if (invTableSort) {
        tableData.sort((a, b) => {
            const valA = (a as any)[invTableSort.key];
            const valB = (b as any)[invTableSort.key];
            if (valA < valB) return invTableSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return invTableSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    const makeMap = new Map<string, number>();
    const groupMap = new Map<string, number>();
    data.forEach(i => {
        const val = invGroupMetric === 'value' ? (i.value || 0) : (i.quantity || 0);
        makeMap.set(i.make, (makeMap.get(i.make) || 0) + val);
        groupMap.set(i.group, (groupMap.get(i.group) || 0) + val);
    });

    return {
        totalVal: data.reduce((a, b) => a + (b.value || 0), 0),
        totalQty: data.reduce((a, b) => a + (b.quantity || 0), 0),
        count: data.length,
        items: tableData,
        uniqueMakes,
        makeMix: Array.from(makeMap.entries()).map(([label, value]) => ({ label, value })),
        groupMix: Array.from(groupMap.entries()).map(([label, value]) => ({ label, value })),
        topStock: data.sort((a,b) => b.value - a.value).slice(0, 10).map(i => ({ label: i.description, value: i.value }))
    };
  }, [closingStock, materials, invGroupMetric, selectedInvMake, invTableSearch, invTableSort]);

  const toggleSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (invTableSort && invTableSort.key === key && invTableSort.direction === 'asc') direction = 'desc';
      setInvTableSort({ key, direction });
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-50/50 overflow-hidden relative">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between flex-shrink-0 shadow-sm z-10">
          <div className="flex bg-gray-100 p-1 rounded-lg">{(['sales', 'inventory', 'so', 'po'] as const).map(tab => (<button key={tab} onClick={() => setActiveSubTab(tab)} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeSubTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{tab === 'so' ? 'Pending SO' : tab === 'po' ? 'Pending PO' : tab}</button>))}</div>
          {activeSubTab === 'sales' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg">{(['FY', 'MONTH'] as const).map(v => (<button key={v} onClick={() => setTimeView(v as any)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}> {v} </button>))}</div>
              {timeView === 'MONTH' && (<select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium">{[0,1,2,3,4,5,6,7,8,9,10,11].map(m => <option key={m} value={m}>Fiscal Month {m+1}</option>)}</select>)}
              <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium">{uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}</select>
            </div>
          )}
          {activeSubTab === 'inventory' && (
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Metric:</span>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setInvGroupMetric('value')} className={`px-2 py-1 rounded text-[10px] font-bold ${invGroupMetric === 'value' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>Value</button>
                    <button onClick={() => setInvGroupMetric('quantity')} className={`px-2 py-1 rounded text-[10px] font-bold ${invGroupMetric === 'quantity' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>Qty</button>
                </div>
            </div>
          )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        {activeSubTab === 'sales' ? (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <KPICard label="Current Sales Value" value={formatLargeValue(kpis.sales.curr)} growth={kpis.sales.growth} timeView={timeView} />
                    <KPICard label="Quantity Sold" value={kpis.qty.curr.toLocaleString()} growth={kpis.qty.growth} timeView={timeView} />
                    <KPICard label="Unique Customers" value={kpis.custs.curr.toString()} growth={kpis.custs.growth} timeView={timeView} />
                    <div className="bg-blue-600 p-4 rounded-xl shadow-lg flex flex-col justify-center text-white">
                        <p className="text-[10px] font-bold uppercase opacity-80">Period Trend</p>
                        <h3 className="text-lg font-black mt-1 flex items-center gap-2">{timeView === 'FY' ? 'Annual Overview' : 'Monthly View'}<TrendingUp className="w-5 h-5"/></h3>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[480px]"><SimpleDonut data={[]} title="Customer Contribution" color="blue" isCurrency={true} /></div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[480px]"><HorizontalBarChart data={[]} title="Top Accounts" color="blue" /></div>
                </div>
            </div>
        ) : activeSubTab === 'inventory' ? (
             <div className="flex flex-col gap-4">
                {/* Manufacturer Slicer */}
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Factory className="w-3 h-3" /> Filter by Manufacturer</h4>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        <button onClick={() => setSelectedInvMake('ALL')} className={`flex flex-col items-center justify-center min-w-[90px] h-[90px] p-2 rounded-xl border-2 shrink-0 transition-all ${selectedInvMake === 'ALL' ? 'bg-blue-50 border-blue-600 shadow-md' : 'bg-white border-gray-100 hover:border-blue-200'}`}><Globe className="w-6 h-6 mb-2 text-blue-600"/><span className="text-[9px] font-black uppercase text-center">All Brands</span></button>
                        {inventoryStats.uniqueMakes.map(make => {
                            const logo = getBrandLogo(make);
                            return (
                                <button key={make} onClick={() => setSelectedInvMake(make)} className={`flex flex-col items-center justify-center min-w-[90px] h-[90px] p-2 rounded-xl border-2 shrink-0 transition-all ${selectedInvMake === make ? 'bg-blue-50 border-blue-600 shadow-md' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                                    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center mb-2 bg-white border border-gray-100 shadow-sm">
                                        {logo ? <img src={logo} alt={make} className="w-8 h-8 object-contain" onError={(e) => (e.target as any).src = ''}/> : <Factory className="w-5 h-5 text-gray-300"/>}
                                    </div>
                                    <span className="text-[9px] font-black uppercase truncate w-full text-center">{make}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[480px]"><SimpleDonut data={inventoryStats.makeMix} title="Inventory Mix by Make" color="green" isCurrency={invGroupMetric === 'value'} /></div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[480px]"><SimpleDonut data={inventoryStats.groupMix} title="Inventory Mix by Group" color="blue" isCurrency={invGroupMetric === 'value'} /></div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[480px]"><HorizontalBarChart data={inventoryStats.topStock} title="Top 10 High Value Items" color="emerald" /></div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center bg-gray-50/50 gap-4">
                        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Table className="w-4 h-4 text-emerald-600" /> Detailed Inventory Snapshot</h4>
                        <div className="relative w-full md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div>
                            <input type="text" placeholder="Search snapshot..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs" value={invTableSearch} onChange={e => setInvTableSearch(e.target.value)} />
                        </div>
                    </div>
                    <div className="overflow-x-auto h-[400px] custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead className="sticky top-0 bg-white shadow-sm text-[10px] font-black uppercase text-gray-500 tracking-wider">
                                <tr className="border-b border-gray-200">
                                    <th className="py-3 px-4 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('description')}>Description {invTableSort?.key === 'description' && (invTableSort.direction === 'asc' ? <ArrowUp className="inline w-3 h-3"/> : <ArrowDown className="inline w-3 h-3"/>)}</th>
                                    <th className="py-3 px-4">Make</th>
                                    <th className="py-3 px-4">Group</th>
                                    <th className="py-3 px-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('quantity')}>Qty {invTableSort?.key === 'quantity' && (invTableSort.direction === 'asc' ? <ArrowUp className="inline w-3 h-3"/> : <ArrowDown className="inline w-3 h-3"/>)}</th>
                                    <th className="py-3 px-4 text-right">Rate</th>
                                    <th className="py-3 px-4 text-right cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('value')}>Value {invTableSort?.key === 'value' && (invTableSort.direction === 'asc' ? <ArrowUp className="inline w-3 h-3"/> : <ArrowDown className="inline w-3 h-3"/>)}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs">
                                {inventoryStats.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                                        <td className="py-2.5 px-4 font-medium text-gray-900">{item.description}</td>
                                        <td className="py-2.5 px-4"><span className="px-2 py-0.5 rounded-full bg-gray-100 font-bold text-[10px]">{item.make}</span></td>
                                        <td className="py-2.5 px-4 text-gray-500">{item.group}</td>
                                        <td className="py-2.5 px-4 text-right font-mono">{item.quantity.toLocaleString()}</td>
                                        <td className="py-2.5 px-4 text-right text-gray-400">{item.rate.toFixed(2)}</td>
                                        <td className="py-2.5 px-4 text-right font-black text-emerald-700">{formatLargeValue(item.value, true)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
             </div>
        ) : null}
      </div>
    </div>
  );
};
export default DashboardView;