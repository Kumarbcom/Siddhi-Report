
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
    if (b.includes('schneider')) domain = 'se.com';
    if (b.includes('lapp')) domain = 'lapp.com';
    if (b.includes('eaton')) domain = 'eaton.com';
    if (b.includes('hager')) domain = 'hager.com';
    if (b.includes('phoenix')) domain = 'phoenixcontact.com';
    if (b.includes('mitsubishi')) domain = 'mitsubishielectric.com';
    if (b.includes('siemens')) domain = 'siemens.com';
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
};

const getMergedGroupName = (groupName: string) => {
    const g = String(groupName || 'Unassigned').trim();
    const lowerG = g.toLowerCase();
    if (lowerG.includes('group-1') || lowerG.includes('group-3') || lowerG.includes('peenya') || lowerG.includes('dcv')) return 'Group-1 Giridhar';
    if (lowerG.includes('online')) return 'Online Business';
    return g;
};

const HorizontalBarChart = ({ data, title, color }: { data: { label: string, value: number }[], title: string, color: string }) => {
  const sorted = [...data].sort((a,b) => b.value - a.value).slice(0, 10);
  const maxVal = Math.max(...sorted.map(d => d.value), 1);
  const colorClasses: Record<string, string> = { blue: 'bg-blue-500', emerald: 'bg-emerald-500', green: 'bg-green-500' };
  const barColor = colorClasses[color] || 'bg-blue-500';

  return (
    <div className="flex flex-col h-full w-full">
      <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-4 border-b border-gray-100 pb-1">{title}</h4>
      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
        {sorted.length === 0 ? <div className="h-full flex items-center justify-center text-gray-400 text-xs">No Data</div> : (
          sorted.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-700">
                <span className="truncate flex-1 pr-4">{item.label}</span>
                <span>{formatLargeValue(item.value, true)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className={`${barColor} h-full rounded-full transition-all duration-700`} style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const SalesTrendChart = ({ data, maxVal }: { data: { labels: string[], series: any[] }, maxVal: number }) => {
  if (isNaN(maxVal) || maxVal <= 0 || data.series.length === 0) return <div className="flex items-center justify-center h-full text-gray-300 text-xs italic">Awaiting updated trend data...</div>;
  
  return (
    <div className="flex flex-col h-full select-none overflow-hidden p-2">
      <div className="flex-1 relative">
         <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            {data.series.map((s: any, i: number) => {
               const pts = s.data.map((v: number, idx: number) => {
                   const x = (idx / (data.labels.length - 1)) * 100;
                   const y = 100 - ((v / maxVal) * 100);
                   return `${x},${y}`;
               }).join(' L ');
               return (
                 <g key={i}>
                    <path d={`M ${pts}`} fill="none" stroke={s.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" className="transition-all duration-1000" />
                    {s.data.map((v: number, idx: number) => {
                        const x = (idx / (data.labels.length - 1)) * 100;
                        const y = 100 - ((v / maxVal) * 100);
                        return <circle key={idx} cx={x} cy={y} r="0.8" fill={s.color} className="cursor-pointer hover:r-1.5 transition-all" />;
                    })}
                 </g>
               );
            })}
         </svg>
      </div>
      <div className="flex justify-between mt-4 px-1">
          {data.labels.map((l, i) => <span key={i} className="text-[8px] font-bold text-gray-400 uppercase">{l}</span>)}
      </div>
    </div>
  );
};

const SimpleDonut = ({ data, title, color, isCurrency = false }: { data: {label: string, value: number, color?: string}[], title: string, color: string, isCurrency?: boolean }) => {
     if(data.length === 0) return <div className="h-32 flex items-center justify-center text-gray-400 text-xs">No Data</div>;
     const total = data.reduce((a,b) => a+(b.value || 0), 0);
     let cumPercent = 0;
     let displayData = data.sort((a,b) => b.value - a.value).length > 8 ? [...data.sort((a,b) => b.value - a.value).slice(0, 8), { label: 'Others', value: data.sort((a,b) => b.value - a.value).slice(8).reduce((a,b) => a+(b.value || 0), 0) }] : data;
     const colorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#9CA3AF', '#6366F1', '#EC4899'];
     return (
        <div className="flex flex-col h-full items-center">
            <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-4 w-full text-left border-b border-gray-100 pb-1">{title}</h4>
            <div className="flex flex-col lg:flex-row items-center gap-8 flex-1 min-h-0 w-full">
                <div className="w-64 h-64 relative flex-shrink-0">
                   <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                      {displayData.map((slice, i) => {
                          const percent = slice.value / (total || 1);
                          if (percent === 0) return null;
                          const startX = Math.cos(2 * Math.PI * cumPercent);
                          const startY = Math.sin(2 * Math.PI * cumPercent);
                          cumPercent += percent;
                          const endX = Math.cos(2 * Math.PI * cumPercent);
                          const endY = Math.sin(2 * Math.PI * cumPercent);
                          return ( <path key={i} d={`M ${startX} ${startY} A 1 1 0 ${percent > 0.5 ? 1 : 0} 1 ${endX} ${endY} L 0 0`} fill={slice.color || colorPalette[i % colorPalette.length]} stroke="white" strokeWidth="0.02" /> );
                      })}
                      <circle cx="0" cy="0" r="0.72" fill="white" />
                   </svg>
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                       <span className={`text-[14px] font-black leading-none ${color === 'blue' ? 'text-blue-700' : 'text-green-700'}`}>{formatLargeValue(total, true)}</span>
                       <span className="text-[8px] text-gray-400 uppercase font-black mt-1">TOTAL {isCurrency ? 'VALUE' : 'QTY'}</span>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar w-full max-h-48 lg:max-h-none pr-2">
                    {displayData.map((d, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors px-1 rounded">
                             <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: d.color || colorPalette[i % colorPalette.length]}}></div>
                                <span className="text-[10px] text-gray-600 font-bold truncate">{d.label}</span>
                             </div>
                             <div className="flex items-center gap-3 ml-4">
                                <span className="text-[9px] font-bold text-gray-400">{isCurrency ? formatLargeValue(d.value, true) : d.value.toLocaleString()}</span>
                                <span className="text-[10px] font-black text-gray-800 w-10 text-right">{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
     );
};

const KPICard = ({ label, value, growth, timeView }: { label: string, value: string, growth: number, timeView: string }) => (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:border-blue-400 transition-all group">
        <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest group-hover:text-blue-600 transition-colors">{label}</p>
            <h3 className="text-2xl font-black text-gray-900 mt-1">{value}</h3>
        </div>
        <div className="mt-4 flex items-center gap-2">
            <div className={`flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-black ${growth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {growth >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                <span>{Math.abs(growth).toFixed(1)}%</span>
            </div>
            <span className="text-[9px] text-gray-400 font-bold italic">vs PY ({timeView})</span>
        </div>
    </div>
);

const DashboardView: React.FC<any> = ({ materials = [], closingStock = [], pendingSO = [], pendingPO = [], salesReportItems = [], customers = [], setActiveTab }) => {
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'inventory' | 'so' | 'po'>('sales');
  const [timeView, setTimeView] = useState<'FY' | 'MONTH' | 'WEEK'>('FY');
  
  const FISCAL_MONTHS = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
  
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
    // New FY Format: 2024-25
    const fiscalYear = `${startYear}-${String(startYear + 1).slice(-2)}`;
    const fiscalMonthIndex = month >= 3 ? month - 3 : month + 9;
    
    // Thursday to Wednesday Week logic
    // Week 1 starts on April 1st
    const fyStart = new Date(startYear, 3, 1);
    let firstThu = new Date(fyStart);
    // Find first Thursday of fiscal year
    while(firstThu.getDay() !== 4) { firstThu.setDate(firstThu.getDate() + 1); }
    
    const diffTime = date.getTime() - firstThu.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
    const weekNumber = diffDays >= 0 ? Math.floor(diffDays / 7) + 2 : 1;
    
    return { fiscalYear, fiscalMonthIndex, weekNumber };
  };

  const now = new Date();
  const currentFiscal = getFiscalInfo(now);

  const [selectedFY, setSelectedFY] = useState<string>(currentFiscal.fiscalYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentFiscal.fiscalMonthIndex);
  const [selectedWeek, setSelectedWeek] = useState<number>(currentFiscal.weekNumber);
  const [invGroupMetric, setInvGroupMetric] = useState<'value' | 'quantity'>('value');
  const [invTableSearch, setInvTableSearch] = useState('');
  const [invTableSort, setInvTableSort] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [selectedInvMake, setSelectedInvMake] = useState<string>('ALL');

  const enrichedSales = useMemo(() => {
      const custMap = new Map<string, CustomerMasterItem>();
      customers.forEach(c => { if(c.customerName) custMap.set(String(c.customerName).toLowerCase().trim(), c); });
      return salesReportItems.map(item => {
          const dateObj = parseDate(item.date);
          const { fiscalYear, fiscalMonthIndex, weekNumber } = getFiscalInfo(dateObj);
          const cust = custMap.get(String(item.customerName || '').toLowerCase().trim());
          return { ...item, fiscalYear, fiscalMonthIndex, weekNumber, custGroup: getMergedGroupName(cust?.group || 'Unassigned') };
      });
  }, [salesReportItems, customers]);

  const uniqueFYs = useMemo(() => {
      const fys = Array.from(new Set(enrichedSales.map(i => i.fiscalYear))).filter(f => f !== 'N/A').sort().reverse();
      // Ensure specific years requested are available if data exists
      return fys;
  }, [enrichedSales]);
  
  useEffect(() => { 
    if (uniqueFYs.length > 0 && !uniqueFYs.includes(selectedFY)) setSelectedFY(uniqueFYs[0]);
  }, [uniqueFYs]);

  const currentData = useMemo(() => {
      return enrichedSales.filter(i => {
          if (i.fiscalYear !== selectedFY) return false;
          if (timeView === 'MONTH' && i.fiscalMonthIndex !== selectedMonth) return false;
          if (timeView === 'WEEK' && i.weekNumber !== selectedWeek) return false;
          return true;
      });
  }, [selectedFY, selectedMonth, selectedWeek, timeView, enrichedSales]);

  const previousData = useMemo(() => {
      if (!selectedFY) return [];
      const parts = selectedFY.split('-');
      const pyYear = parseInt(parts[0]) - 1;
      const pyString = `${pyYear}-${String(pyYear + 1).slice(-2)}`;
      return enrichedSales.filter(i => {
          if (i.fiscalYear !== pyString) return false;
          if (timeView === 'MONTH' && i.fiscalMonthIndex !== selectedMonth) return false;
          if (timeView === 'WEEK' && i.weekNumber !== selectedWeek) return false;
          return true;
      });
  }, [selectedFY, timeView, selectedMonth, selectedWeek, enrichedSales]);

  const kpis = useMemo(() => {
      const getStats = (data: any[]) => ({
          val: data.reduce((acc, i) => acc + (i.value || 0), 0),
          qty: data.reduce((acc, i) => acc + (i.quantity || 0), 0),
          custs: new Set(data.map(i => String(i.customerName || ''))).size
      });
      const curr = getStats(currentData);
      const prev = getStats(previousData);
      const calcGrowth = (c: number, p: number) => p > 0 ? ((c - p) / p) * 100 : (c > 0 ? 100 : 0);
      return {
          sales: { curr: curr.val, growth: calcGrowth(curr.val, prev.val) },
          qty: { curr: curr.qty, growth: calcGrowth(curr.qty, prev.qty) },
          custs: { curr: curr.custs, growth: calcGrowth(curr.custs, prev.custs) }
      };
  }, [currentData, previousData]);

  const salesMixData = useMemo(() => {
      const groupMap = new Map<string, number>();
      currentData.forEach(i => {
          groupMap.set(i.custGroup, (groupMap.get(i.custGroup) || 0) + i.value);
      });
      return Array.from(groupMap.entries()).map(([label, value]) => ({ label, value }));
  }, [currentData]);

  const topAccountsData = useMemo(() => {
      const accountMap = new Map<string, number>();
      currentData.forEach(i => {
          accountMap.set(i.customerName, (accountMap.get(i.customerName) || 0) + i.value);
      });
      return Array.from(accountMap.entries()).map(([label, value]) => ({ label, value }));
  }, [currentData]);

  const inventoryStats = useMemo(() => {
    let data = closingStock.map(i => { 
        const mat = materials.find(m => String(m.description || '').toLowerCase().trim() === String(i.description || '').toLowerCase().trim()); 
        return { ...i, make: mat ? mat.make : 'Unspecified', group: mat ? mat.materialGroup : 'Unspecified' }; 
    });
    const uniqueMakes = Array.from(new Set(data.map(i => i.make))).sort();
    if (selectedInvMake !== 'ALL') data = data.filter(i => i.make === selectedInvMake);
    
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
        items: data,
        uniqueMakes,
        makeMix: Array.from(makeMap.entries()).map(([label, value]) => ({ label, value })),
        groupMix: Array.from(groupMap.entries()).map(([label, value]) => ({ label, value })),
        topStock: data.sort((a,b) => b.value - a.value).slice(0, 10).map(i => ({ label: i.description, value: i.value }))
    };
  }, [closingStock, materials, invGroupMetric, selectedInvMake]);

  const trendData = useMemo(() => {
      const getFYData = (fy: string) => {
          const arr = new Array(12).fill(0);
          enrichedSales.filter(i => i.fiscalYear === fy).forEach(i => {
              if (i.fiscalMonthIndex >= 0 && i.fiscalMonthIndex < 12) arr[i.fiscalMonthIndex] += i.value;
          });
          return arr;
      };
      const series = [];
      if (selectedFY) series.push({ name: selectedFY, color: '#3B82F6', data: getFYData(selectedFY) });
      const parts = selectedFY.split('-');
      const py = `${parseInt(parts[0])-1}-${parseInt(parts[0])}`; // basic fallback for series
      series.push({ name: 'Prev Year', color: '#94A3B8', data: getFYData(py) });
      
      return { labels: FISCAL_MONTHS.map(m => m.slice(0,3)), series };
  }, [selectedFY, enrichedSales]);

  const trendMax = useMemo(() => Math.max(...trendData.series.flatMap(s => s.data), 100000) * 1.15, [trendData]);

  return (
    <div className="h-full w-full flex flex-col bg-gray-50/50 overflow-hidden relative">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between flex-shrink-0 shadow-sm z-10">
          <div className="flex bg-gray-100 p-1 rounded-lg">{(['sales', 'inventory', 'so', 'po'] as const).map(tab => (<button key={tab} onClick={() => setActiveSubTab(tab)} className={`px-4 py-1.5 rounded-md text-xs font-black uppercase transition-all ${activeSubTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{tab === 'so' ? 'Pending SO' : tab === 'po' ? 'Pending PO' : tab}</button>))}</div>
          {activeSubTab === 'sales' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg">{(['FY', 'MONTH', 'WEEK'] as const).map(v => (<button key={v} onClick={() => setTimeView(v as any)} className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}> {v} </button>))}</div>
              {timeView === 'MONTH' && (<select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-3 py-1.5 font-bold">{FISCAL_MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}</select>)}
              {timeView === 'WEEK' && (<input type="number" min={1} max={53} value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} className="w-16 bg-white border border-gray-300 text-xs rounded-md px-3 py-1.5 font-bold" />)}
              <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-3 py-1.5 font-bold">{uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}</select>
            </div>
          )}
          {activeSubTab === 'inventory' && (
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setInvGroupMetric('value')} className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${invGroupMetric === 'value' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>Value</button>
                <button onClick={() => setInvGroupMetric('quantity')} className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${invGroupMetric === 'quantity' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>Qty</button>
            </div>
          )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        {activeSubTab === 'sales' ? (
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <KPICard label="Sales Revenue" value={formatLargeValue(kpis.sales.curr)} growth={kpis.sales.growth} timeView={timeView} />
                    <KPICard label="Quantity Sold" value={kpis.qty.curr.toLocaleString()} growth={kpis.qty.growth} timeView={timeView} />
                    <KPICard label="Unique Customers" value={kpis.custs.curr.toString()} growth={kpis.custs.growth} timeView={timeView} />
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-xl shadow-lg flex flex-col justify-center text-white border border-blue-500/50">
                        <p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Active Period</p>
                        <h3 className="text-xl font-black mt-2 flex items-center gap-2">{timeView === 'FY' ? `FY ${selectedFY}` : timeView === 'MONTH' ? FISCAL_MONTHS[selectedMonth] : `Week ${selectedWeek}`}</h3>
                        <p className="text-[10px] font-bold opacity-60 mt-1 italic">Comparison with Previous Period</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-[420px] flex flex-col">
                        <h3 className="text-xs font-black text-gray-800 uppercase mb-6 flex items-center gap-2 tracking-widest"><TrendingUp className="w-4 h-4 text-blue-600"/> Monthly Trend Performance</h3>
                        <div className="flex-1 min-h-0 relative"><SalesTrendChart data={trendData} maxVal={trendMax} /></div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-[420px]"><SimpleDonut data={salesMixData} title="Sales Mix by Group" color="blue" isCurrency={true} /></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[420px]"><HorizontalBarChart data={topAccountsData} title="Top 10 Accounts by Revenue" color="blue" /></div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[420px] flex items-center justify-center text-gray-300 italic text-xs font-black uppercase tracking-tighter">Strategic Insights Area</div>
                </div>
            </div>
        ) : activeSubTab === 'inventory' ? (
             <div className="flex flex-col gap-6">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><Factory className="w-3.5 h-3.5" /> Manufacturer Hub</h4>
                    <div className="flex gap-4 overflow-x-auto pb-3 custom-scrollbar">
                        <button onClick={() => setSelectedInvMake('ALL')} className={`flex flex-col items-center justify-center min-w-[100px] h-[100px] p-3 rounded-2xl border-2 shrink-0 transition-all ${selectedInvMake === 'ALL' ? 'bg-blue-50 border-blue-600 shadow-lg scale-105' : 'bg-white border-gray-100 hover:border-blue-200'}`}><Globe className="w-8 h-8 mb-2 text-blue-600"/><span className="text-[10px] font-black uppercase tracking-tight">Global View</span></button>
                        {inventoryStats.uniqueMakes.map(make => {
                            const logo = getBrandLogo(make);
                            return (
                                <button key={make} onClick={() => setSelectedInvMake(make)} className={`flex flex-col items-center justify-center min-w-[100px] h-[100px] p-3 rounded-2xl border-2 shrink-0 transition-all ${selectedInvMake === make ? 'bg-blue-50 border-blue-600 shadow-lg scale-105' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                                    <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center mb-2 bg-white border border-gray-100 shadow-sm">
                                        {logo ? <img src={logo} alt={make} className="w-10 h-10 object-contain" onError={(e) => (e.target as any).src = ''}/> : <Factory className="w-6 h-6 text-gray-300"/>}
                                    </div>
                                    <span className="text-[9px] font-black uppercase truncate w-full text-center tracking-tight">{make}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm min-h-[500px]"><SimpleDonut data={inventoryStats.makeMix} title="Inventory Mix by Make" color="green" isCurrency={invGroupMetric === 'value'} /></div>
                    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm min-h-[500px]"><SimpleDonut data={inventoryStats.groupMix} title="Inventory Mix by Group" color="blue" isCurrency={invGroupMetric === 'value'} /></div>
                    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm min-h-[500px]"><HorizontalBarChart data={inventoryStats.topStock} title="Top 10 High Value Stock Items" color="emerald" /></div>
                </div>
             </div>
        ) : null}
      </div>
    </div>
  );
};
export default DashboardView;
