
import React, { useState, useMemo, useEffect } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesRecord, SalesReportItem, CustomerMasterItem } from '../types';
import { TrendingUp, TrendingDown, Package, ClipboardList, ShoppingCart, Calendar, Filter, PieChart as PieIcon, BarChart3, Users, ArrowRight, Activity, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';

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
type PieMetric = 'GROUP' | 'STATUS' | 'REP';

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
  
  // --- Dashboard State ---
  const [timeView, setTimeView] = useState<TimeView>('FY');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('PREV_YEAR');
  const [selectedFY, setSelectedFY] = useState<string>('');
  
  // Initialize to current fiscal month index (0=Apr, 11=Mar)
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const m = new Date().getMonth();
    return m >= 3 ? m - 3 : m + 9;
  });
  
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [pieMetric, setPieMetric] = useState<PieMetric>('GROUP');

  // --- Helper: Robust Date Parsing ---
  const parseDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    // Handle Excel Serial Number (approximate)
    if (typeof val === 'number') {
        return new Date((val - (25567 + 2)) * 86400 * 1000);
    }
    // Handle Strings
    if (typeof val === 'string') {
        // Try ISO first
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        
        // Try DD/MM/YYYY or DD-MM-YYYY
        const parts = val.split(/[-/.]/);
        if (parts.length === 3) {
             // Assume DD-MM-YYYY
             return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
    }
    return new Date();
  };

  // --- Helper: Fiscal Year & Week Logic ---
  const getFiscalInfo = (date: Date) => {
    const month = date.getMonth(); 
    const year = date.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    const fiscalYear = `${startYear}-${startYear + 1}`;
    const fiscalMonthIndex = month >= 3 ? month - 3 : month + 9; // 0=Apr, 11=Mar

    // Week Logic (Thu-Wed)
    const fyStart = new Date(startYear, 3, 1);
    let fyFirstThu = new Date(fyStart);
    if (fyFirstThu.getDay() <= 4) fyFirstThu.setDate(fyFirstThu.getDate() + (4 - fyFirstThu.getDay()));
    else fyFirstThu.setDate(fyFirstThu.getDate() + (4 - fyFirstThu.getDay() + 7));
    
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

  // --- 1. Prepare Data ---
  const enrichedSales = useMemo(() => {
      // Create lookup for customer group/status
      const custMap = new Map<string, CustomerMasterItem>();
      customers.forEach(c => custMap.set(c.customerName.toLowerCase().trim(), c));

      return salesReportItems.map(item => {
          const dateObj = parseDate(item.date);
          const fi = getFiscalInfo(dateObj);
          const cust = custMap.get(item.customerName.toLowerCase().trim());
          return {
              ...item,
              ...fi,
              rawDate: dateObj,
              custGroup: cust?.group || 'Unassigned',
              custStatus: cust?.status || 'Unknown',
              salesRep: cust?.salesRep || 'Unassigned',
              derivedGroup: (cust?.group && cust.group !== 'Unassigned') ? cust.group : item.customerName // Logic: If group empty, use name
          };
      });
  }, [salesReportItems, customers]);

  // --- 1b. Derive Fiscal Years ---
  const uniqueFYs = useMemo(() => {
      const set = new Set(enrichedSales.map(i => i.fiscalYear));
      return Array.from(set).filter(Boolean).sort().reverse();
  }, [enrichedSales]);

  // --- 1c. Effect to Update Selected FY on Data Load ---
  useEffect(() => {
      if (uniqueFYs.length > 0) {
          // If no FY selected, or selected FY not in current data, select the latest one
          if (!selectedFY || !uniqueFYs.includes(selectedFY)) {
              setSelectedFY(uniqueFYs[0]);
          }
      }
  }, [uniqueFYs, selectedFY]);

  // --- 2. Filter Logic for Main & Comparison ---
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
          // Prev Period Logic
          if (timeView === 'FY') {
              const prevFY = `${startYear - 1}-${startYear}`;
              return getDataForPeriod(prevFY);
          } else if (timeView === 'MONTH') {
              let prevM = selectedMonth - 1;
              let targetFY = selectedFY;
              if (prevM < 0) { prevM = 11; targetFY = `${startYear - 1}-${startYear}`; }
              return getDataForPeriod(targetFY, prevM);
          } else {
              let prevW = selectedWeek - 1;
              // Simplified: just prev week in same FY for now
              return getDataForPeriod(selectedFY, selectedMonth, prevW);
          }
      }
  }, [enrichedSales, selectedFY, selectedMonth, selectedWeek, timeView, comparisonMode]);

  // --- 3. KPIs ---
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

  // --- 4. Line Chart Data (Advanced: 3 Years or Period Trend) ---
  const lineChartData = useMemo(() => {
      // If View == FY: X-Axis is Months (Apr-Mar). Series: Current FY, Last FY, 2 Years Ago.
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

          return { 
              labels, 
              series: [
                  { name: fy1, data: getSeries(fy1), color: '#3b82f6', active: true }, // Current Blue
                  { name: fy2, data: getSeries(fy2), color: '#a855f7', active: true }, // Last Year Purple
                  { name: fy3, data: getSeries(fy3), color: '#9ca3af', active: true }  // 2 Years Ago Gray
              ],
              isMultiYear: true
          };
      } 
      else {
          // Month or Week View -> Daily Trend Comparison
          const daysInView = timeView === 'MONTH' ? 31 : 7;
          const labels = Array.from({length: daysInView}, (_, i) => (i + 1).toString());
          
          const currSeries = new Array(daysInView).fill(0);
          const prevSeries = new Array(daysInView).fill(0);

          currentData.forEach(i => {
              let idx = 0;
              if (timeView === 'MONTH') idx = i.rawDate.getDate() - 1;
              else idx = i.rawDate.getDay(); 
              if (idx >= 0 && idx < daysInView) currSeries[idx] += i.value;
          });
          
          previousData.forEach(i => {
              let idx = 0;
              if (timeView === 'MONTH') idx = i.rawDate.getDate() - 1;
              else idx = i.rawDate.getDay();
              if (idx >= 0 && idx < daysInView) prevSeries[idx] += i.value;
          });
          
          return { 
              labels, 
              series: [
                  { name: 'Current', data: currSeries, color: '#3b82f6', active: true },
                  { name: comparisonMode === 'PREV_YEAR' ? 'Last Year' : 'Prev Period', data: prevSeries, color: '#cbd5e1', active: true }
              ],
              isMultiYear: false
          };
      }
  }, [currentData, previousData, timeView, selectedFY, enrichedSales, comparisonMode]);

  // --- 5. Pie Chart Data ---
  const pieData = useMemo(() => {
      const map = new Map<string, number>();
      currentData.forEach(i => {
          let key = 'Unknown';
          if (pieMetric === 'GROUP') key = i.custGroup || 'Unassigned';
          else if (pieMetric === 'STATUS') key = i.custStatus || 'Unknown';
          else if (pieMetric === 'REP') key = i.salesRep || 'Unassigned';

          map.set(key, (map.get(key) || 0) + i.value);
      });
      return Array.from(map.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value);
  }, [currentData, pieMetric]);

  // --- 6. Top 10 Customers (Pivot Logic: Group else Name) ---
  const topCustomers = useMemo(() => {
      const map = new Map<string, number>();
      currentData.forEach(i => {
          const key = i.derivedGroup || 'Unknown';
          map.set(key, (map.get(key) || 0) + i.value);
      });
      return Array.from(map.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
  }, [currentData]);

  // --- Render Helpers ---
  const formatNumber = (val: number) => Math.round(val).toLocaleString('en-IN');
  const formatCurrency = (val: number) => `Rs. ${formatNumber(val)}`;
  
  // Format Large Numbers for Axis
  const formatAxisValue = (val: number) => {
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
    return val.toFixed(0);
  };

  // --- Dynamic Comparison Label ---
  const comparisonLabel = useMemo(() => {
    if (comparisonMode === 'PREV_YEAR') return 'Last Year';
    
    if (timeView === 'FY') return 'Prev FY';
    if (timeView === 'MONTH') {
        const prevM = selectedMonth - 1;
        // If prevM is -1, it implies March of the previous year contextually
        return prevM < 0 ? 'Mar (Prev FY)' : getFiscalMonthName(prevM);
    }
    if (timeView === 'WEEK') {
        return selectedWeek > 1 ? `Week ${selectedWeek - 1}` : 'Prior Week';
    }
    return 'Prev Period';
  }, [comparisonMode, timeView, selectedMonth, selectedWeek]);

  // Calculate Chart Max for Y-Axis
  const chartMax = useMemo(() => {
      const allValues = lineChartData.series.flatMap(s => s.data);
      return Math.max(...allValues, 1000) * 1.1; // 10% Headroom
  }, [lineChartData]);

  return (
    <div className="h-full w-full flex flex-col bg-gray-50/50 overflow-hidden">
      
      {/* --- TOP CONTROL BAR --- */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between flex-shrink-0 shadow-sm z-10">
          
          {/* Navigation Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-lg flex-shrink-0">
             {(['sales', 'inventory', 'so', 'po'] as const).map(tab => (
                 <button
                    key={tab}
                    onClick={() => setActiveSubTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeSubTab === tab ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                    {tab === 'so' ? 'Pending SO' : tab === 'po' ? 'Pending PO' : tab}
                 </button>
             ))}
          </div>

          {/* Time & Comparison Controls */}
          {activeSubTab === 'sales' && (
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  
                  {/* View Toggle */}
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                      {(['FY', 'MONTH', 'WEEK'] as const).map(v => (
                          <button key={v} onClick={() => setTimeView(v)} className={`px-3 py-1 rounded-md text-xs font-bold ${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>{v}</button>
                      ))}
                  </div>

                  {/* Dropdowns */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500 font-bold uppercase hidden md:inline">Fiscal Year:</span>
                    <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium outline-none focus:ring-2 focus:ring-blue-500">
                        {uniqueFYs.length > 0 ? (
                            uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)
                        ) : <option value="">No Data</option>}
                    </select>
                  </div>

                  {(timeView === 'MONTH' || timeView === 'WEEK') && (
                      <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium outline-none focus:ring-2 focus:ring-blue-500">
                          {[0,1,2,3,4,5,6,7,8,9,10,11].map(m => <option key={m} value={m}>{getFiscalMonthName(m)}</option>)}
                      </select>
                  )}

                  {timeView === 'WEEK' && (
                      <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-md px-2 py-1">
                          <span className="text-[10px] text-gray-500 font-bold uppercase">Week</span>
                          <input type="number" min={1} max={53} value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} className="w-10 text-xs outline-none font-bold text-center" />
                      </div>
                  )}

                  <div className="w-px h-6 bg-gray-300 mx-1"></div>

                  {/* Comparison Toggle */}
                  <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase hidden md:inline">Compare:</span>
                      <div className="flex bg-gray-100 p-1 rounded-lg">
                          <button onClick={() => setComparisonMode('PREV_YEAR')} className={`px-2 py-1 rounded text-[10px] font-bold ${comparisonMode === 'PREV_YEAR' ? 'bg-white text-purple-600 shadow' : 'text-gray-500'}`}>Last Year</button>
                          <button onClick={() => setComparisonMode('PREV_PERIOD')} className={`px-2 py-1 rounded text-[10px] font-bold ${comparisonMode === 'PREV_PERIOD' ? 'bg-white text-purple-600 shadow' : 'text-gray-500'}`}>Previous</button>
                      </div>
                  </div>
              </div>
          )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        {activeSubTab === 'sales' ? (
            <div className="flex flex-col gap-4">
                
                {/* 1. KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Sales Value */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current Sales</p>
                                <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatCurrency(kpis.currVal)}</h3>
                            </div>
                            <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><DollarSign className="w-5 h-5" /></div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                                <span className={`flex items-center text-xs font-bold ${kpis.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {kpis.diff >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                                    {Math.abs(kpis.pct).toFixed(1)}%
                                </span>
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">{comparisonLabel}: {formatNumber(kpis.prevVal)}</span>
                        </div>
                    </div>

                    {/* Sales Quantity */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sales Quantity</p>
                                <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{kpis.currQty.toLocaleString()}</h3>
                            </div>
                            <div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Package className="w-5 h-5" /></div>
                        </div>
                        <p className="mt-3 text-[10px] text-gray-400">Total units sold in period</p>
                    </div>

                    {/* Active Customers */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Customers</p>
                                <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{kpis.uniqueCusts}</h3>
                            </div>
                            <div className="bg-teal-50 p-2 rounded-lg text-teal-600"><Users className="w-5 h-5" /></div>
                        </div>
                        <p className="mt-3 text-[10px] text-gray-400">Unique billed parties</p>
                    </div>

                    {/* Avg Order Value */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avg Order Value</p>
                                <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatNumber(kpis.avgOrder)}</h3>
                            </div>
                            <div className="bg-purple-50 p-2 rounded-lg text-purple-600"><Activity className="w-5 h-5" /></div>
                        </div>
                        <p className="mt-3 text-[10px] text-gray-400">Revenue per transaction</p>
                    </div>
                </div>

                {/* 2. Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-96">
                    
                    {/* Line Chart (Trend) */}
                    <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-[350px] overflow-hidden">
                        <div className="flex justify-between items-center mb-2 flex-shrink-0">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> Sales Trend Analysis</h3>
                            <div className="flex items-center gap-3 text-[10px] flex-wrap">
                                {lineChartData.series.map((s, i) => (
                                    <span key={i} className="flex items-center gap-1">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: s.color}}></div> 
                                        <span className="text-gray-600 font-medium">{s.name}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex flex-1 min-h-0 pt-4">
                            {/* Y-Axis */}
                            <div className="flex flex-col justify-between text-[10px] text-gray-400 font-medium pr-3 pb-6 h-full text-right w-12 shrink-0 select-none border-r border-gray-100">
                                <span>{formatAxisValue(chartMax)}</span>
                                <span>{formatAxisValue(chartMax * 0.75)}</span>
                                <span>{formatAxisValue(chartMax * 0.5)}</span>
                                <span>{formatAxisValue(chartMax * 0.25)}</span>
                                <span>0</span>
                            </div>

                            {/* Chart Area */}
                            <div className="flex-1 flex flex-col min-w-0 relative pl-2">
                                {/* Graph */}
                                <div className="flex-1 relative">
                                    <svg className="w-full h-full absolute inset-0 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                        {/* Define Gradients */}
                                        <defs>
                                            <linearGradient id="gradient-blue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>

                                        {/* Grid Lines */}
                                        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                                            <line 
                                                key={i} 
                                                x1="0" 
                                                y1={p * 100} 
                                                x2="100" 
                                                y2={p * 100} 
                                                stroke="#f3f4f6" 
                                                strokeWidth="1" 
                                                strokeDasharray={p === 1 ? "" : "2"} // Solid line at bottom (100% or 0 value)
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        ))}

                                        {/* Series Paths */}
                                        {lineChartData.series.map((series, sIdx) => {
                                            // Generate points string for SVG polyline/polygon
                                            // x and y are percentages 0-100 relative to viewBox
                                            const points = series.data.map((val, i) => {
                                                const x = (i / (lineChartData.labels.length - 1)) * 100;
                                                const y = 100 - (val / chartMax * 100);
                                                return `${x},${y}`;
                                            }).join(' ');
                                            
                                            const areaPoints = `${points} 100,100 0,100`;

                                            return (
                                                <g key={sIdx}>
                                                    {sIdx === 0 && (
                                                        <polygon points={areaPoints} fill="url(#gradient-blue)" />
                                                    )}
                                                    <polyline 
                                                        points={points} 
                                                        fill="none" 
                                                        stroke={series.color} 
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        className="transition-all duration-300 ease-out"
                                                        vectorEffect="non-scaling-stroke"
                                                    />
                                                    {/* Hover Dots (only for main series to avoid clutter) */}
                                                    {sIdx === 0 && series.data.map((val, i) => (
                                                        <circle 
                                                            key={i}
                                                            cx={(i / (lineChartData.labels.length - 1)) * 100}
                                                            cy={100 - (val / chartMax * 100)}
                                                            r="2" // Scaled relative to SVG coord, vectorEffect to keep size visual
                                                            fill="white"
                                                            stroke={series.color}
                                                            strokeWidth="1.5"
                                                            vectorEffect="non-scaling-stroke"
                                                            className="hover:scale-125 transition-transform cursor-pointer"
                                                        >
                                                            <title>{`${lineChartData.labels[i]}: ${formatNumber(val)}`}</title>
                                                        </circle>
                                                    ))}
                                                </g>
                                            );
                                        })}
                                    </svg>
                                </div>

                                {/* X-Axis Labels */}
                                <div className="h-6 flex justify-between items-center mt-2 text-[10px] text-gray-400 font-medium select-none">
                                    {lineChartData.labels.map((l, i) => (
                                        <span key={i} className="flex-1 text-center truncate">{l}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pie Chart (Distribution) */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-[350px]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><PieIcon className="w-4 h-4 text-purple-600" /> Sales Distribution</h3>
                            <div className="flex bg-gray-100 p-0.5 rounded">
                                <button onClick={() => setPieMetric('GROUP')} className={`px-2 py-0.5 text-[9px] font-bold rounded ${pieMetric === 'GROUP' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>Group</button>
                                <button onClick={() => setPieMetric('REP')} className={`px-2 py-0.5 text-[9px] font-bold rounded ${pieMetric === 'REP' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>Rep</button>
                                <button onClick={() => setPieMetric('STATUS')} className={`px-2 py-0.5 text-[9px] font-bold rounded ${pieMetric === 'STATUS' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>Status</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {pieData.length === 0 ? <div className="text-center text-gray-400 text-xs mt-10">No data</div> : (
                                <div className="space-y-2">
                                    {pieData.map((item, idx) => {
                                        const total = pieData.reduce((a, b) => a + b.value, 0);
                                        const pct = (item.value / total) * 100;
                                        return (
                                            <div key={idx} className="flex flex-col gap-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="font-medium text-gray-700 truncate w-3/4">{item.label}</span>
                                                    <div className="flex gap-2">
                                                      <span className="font-bold">{formatNumber(item.value)}</span>
                                                      <span className="text-gray-400 text-[10px]">({Math.round(pct)}%)</span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Top 10 Pivot (Bar Chart) */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-80">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-600" /> Top 10 Customer Groups / Accounts</h3>
                        <span className="text-[10px] text-gray-400 italic">By Total Sales Value</span>
                    </div>
                    
                    {/* Header for Pivot */}
                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 pb-2 mb-2">
                        <span>Group / Customer</span>
                        <span>Total Sales</span>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                        {topCustomers.map((item, idx) => {
                            const maxVal = topCustomers[0]?.value || 1;
                            return (
                                <div key={idx} className="group hover:bg-gray-50 p-1 rounded transition-colors">
                                    <div className="flex justify-between items-center text-xs mb-1">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className="w-5 text-[10px] font-bold text-gray-400 bg-gray-100 rounded text-center">{idx + 1}</span>
                                            <span className="font-bold text-gray-700 truncate">{item.label}</span>
                                        </div>
                                        <span className="font-bold text-gray-900">{formatNumber(item.value)}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden ml-7 w-[calc(100%-1.75rem)]">
                                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-500 group-hover:bg-emerald-600" style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                                    </div>
                                </div>
                            )
                        })}
                        {topCustomers.length === 0 && <div className="text-center text-gray-400 text-xs mt-10">No sales data for selected period.</div>}
                    </div>
                </div>

            </div>
        ) : (
            // Placeholder for other tabs
            <div className="flex items-center justify-center h-64 text-gray-400 italic">
                {activeSubTab === 'inventory' && "Inventory Dashboard available in 'Closing Stock' tab details."}
                {activeSubTab === 'so' && "Pending SO details available in 'Pending SO' tab."}
                {activeSubTab === 'po' && "Pending PO details available in 'Pending PO' tab."}
            </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
