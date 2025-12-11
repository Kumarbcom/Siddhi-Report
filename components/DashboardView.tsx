
import React, { useState, useMemo } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesRecord, SalesReportItem, CustomerMasterItem } from '../types';
import { TrendingUp, TrendingDown, Package, ClipboardList, ShoppingCart, Calendar, Filter, PieChart as PieIcon, BarChart3, Users, ArrowRight, Activity, DollarSign } from 'lucide-react';

interface DashboardViewProps {
  materials: Material[];
  closingStock: ClosingStockItem[];
  pendingSO: PendingSOItem[];
  pendingPO: PendingPOItem[];
  salesReportItems: SalesReportItem[]; // Using detailed sales report for accurate dates
  customers: CustomerMasterItem[];
  sales1Year: SalesRecord[]; // Kept for legacy prop compatibility if needed
  sales3Months: SalesRecord[]; // Kept for legacy prop compatibility
  setActiveTab: (tab: any) => void;
}

type TimeView = 'FY' | 'MONTH' | 'WEEK';
type ComparisonMode = 'PREV_PERIOD' | 'PREV_YEAR';
type PieMetric = 'GROUP' | 'STATUS';

const DashboardView: React.FC<DashboardViewProps> = ({
  materials,
  closingStock,
  pendingSO,
  pendingPO,
  salesReportItems = [], // Default to empty array if not passed
  customers,
  setActiveTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'inventory' | 'so' | 'po'>('sales');
  
  // --- Dashboard State ---
  const [timeView, setTimeView] = useState<TimeView>('FY');
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('PREV_YEAR');
  const [selectedFY, setSelectedFY] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [pieMetric, setPieMetric] = useState<PieMetric>('GROUP');

  // --- Helper: Fiscal Year & Week Logic ---
  const getFiscalInfo = (date: Date) => {
    const month = date.getMonth(); 
    const year = date.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    const fiscalYear = `${startYear}-${startYear + 1}`;
    const fiscalMonthIndex = month >= 3 ? month - 3 : month + 9; // 0=Apr

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

  const getFiscalMonthName = (idx: number) => ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"][idx];

  // --- 1. Prepare Data ---
  const enrichedSales = useMemo(() => {
      // Create lookup for customer group/status
      const custMap = new Map<string, CustomerMasterItem>();
      customers.forEach(c => custMap.set(c.customerName.toLowerCase().trim(), c));

      return salesReportItems.map(item => {
          const dateObj = new Date(item.date); // Ensure item.date is parseable or Date object
          const fi = getFiscalInfo(dateObj);
          const cust = custMap.get(item.customerName.toLowerCase().trim());
          return {
              ...item,
              ...fi,
              rawDate: dateObj,
              custGroup: cust?.group || 'Unassigned',
              custStatus: cust?.status || 'Unknown',
              derivedGroup: cust?.group && cust.group !== 'Unassigned' ? cust.group : item.customerName // For Top 10 logic
          };
      });
  }, [salesReportItems, customers]);

  // Set Default FY on load
  useMemo(() => {
      if (!selectedFY && enrichedSales.length > 0) {
          const latestFY = enrichedSales.reduce((max, i) => i.fiscalYear > max ? i.fiscalYear : max, '');
          if (latestFY) setSelectedFY(latestFY);
      }
  }, [enrichedSales, selectedFY]);

  const uniqueFYs = useMemo(() => Array.from(new Set(enrichedSales.map(i => i.fiscalYear))).sort().reverse(), [enrichedSales]);

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

      if (comparisonMode === 'PREV_YEAR') {
          const prevFY = `${startYear - 1}-${startYear}`;
          return getDataForPeriod(prevFY, selectedMonth, selectedWeek);
      } else {
          // Prev Period
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

  // --- 4. Line Chart Data ---
  const lineChartData = useMemo(() => {
      // X-Axis Labels & Data Points
      if (timeView === 'FY') {
          // X: Months (Apr-Mar)
          const labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
          const currSeries = new Array(12).fill(0);
          const prevSeries = new Array(12).fill(0);

          currentData.forEach(i => currSeries[i.fiscalMonthIndex] += i.value);
          previousData.forEach(i => prevSeries[i.fiscalMonthIndex] += i.value);

          return { labels, currSeries, prevSeries };
      } 
      else {
          // Month or Week View -> Daily Trend
          // Map days 1..31
          const daysInMonth = 31; // Simplified
          const labels = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString());
          const currSeries = new Array(daysInMonth).fill(0);
          const prevSeries = new Array(daysInMonth).fill(0);

          currentData.forEach(i => {
              const d = i.rawDate.getDate() - 1;
              if (d >= 0 && d < 31) currSeries[d] += i.value;
          });
          previousData.forEach(i => {
              const d = i.rawDate.getDate() - 1;
              if (d >= 0 && d < 31) prevSeries[d] += i.value;
          });
          
          return { labels, currSeries, prevSeries };
      }
  }, [currentData, previousData, timeView]);

  // --- 5. Pie Chart Data ---
  const pieData = useMemo(() => {
      const map = new Map<string, number>();
      currentData.forEach(i => {
          const key = pieMetric === 'GROUP' ? (i.custGroup || 'Unassigned') : (i.custStatus || 'Unknown');
          map.set(key, (map.get(key) || 0) + i.value);
      });
      return Array.from(map.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value);
  }, [currentData, pieMetric]);

  // --- 6. Top 10 Customers (Group Logic) ---
  const topCustomers = useMemo(() => {
      const map = new Map<string, number>();
      currentData.forEach(i => {
          // Requirement: "If customer Group blank then consider Customer Name"
          // We calculated `derivedGroup` in enrichedSales
          const key = i.derivedGroup; 
          map.set(key, (map.get(key) || 0) + i.value);
      });
      return Array.from(map.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
  }, [currentData]);

  // --- Render Helpers ---
  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;
  const formatK = (val: number) => val >= 100000 ? `${(val/100000).toFixed(1)}L` : (val >= 1000 ? `${(val/1000).toFixed(1)}k` : val);

  return (
    <div className="h-full w-full flex flex-col bg-gray-50/50 overflow-hidden">
      
      {/* --- TOP CONTROL BAR --- */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between flex-shrink-0 shadow-sm z-10">
          
          {/* Navigation Tabs (Sales/Inv/SO/PO) */}
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

          {/* Time & Comparison Controls (Only for Sales) */}
          {activeSubTab === 'sales' && (
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  
                  {/* View Toggle */}
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                      {(['FY', 'MONTH', 'WEEK'] as const).map(v => (
                          <button key={v} onClick={() => setTimeView(v)} className={`px-3 py-1 rounded-md text-xs font-bold ${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>{v}</button>
                      ))}
                  </div>

                  {/* Dropdowns */}
                  <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium outline-none focus:ring-2 focus:ring-blue-500">
                      {uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                  </select>

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
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Compare:</span>
                      <div className="flex bg-gray-100 p-1 rounded-lg">
                          <button onClick={() => setComparisonMode('PREV_YEAR')} className={`px-2 py-1 rounded text-[10px] font-bold ${comparisonMode === 'PREV_YEAR' ? 'bg-white text-purple-600 shadow' : 'text-gray-500'}`}>Last Year</button>
                          <button onClick={() => setComparisonMode('PREV_PERIOD')} className={`px-2 py-1 rounded text-[10px] font-bold ${comparisonMode === 'PREV_PERIOD' ? 'bg-white text-purple-600 shadow' : 'text-gray-500'}`}>Prev Period</button>
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
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Sales Value</p>
                                <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatCurrency(kpis.currVal)}</h3>
                            </div>
                            <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><DollarSign className="w-5 h-5" /></div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                            <span className={`flex items-center text-xs font-bold ${kpis.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {kpis.diff >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                                {Math.abs(kpis.pct).toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-gray-400">vs {comparisonMode === 'PREV_YEAR' ? 'Last Year' : 'Prev Period'} ({formatK(kpis.prevVal)})</span>
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
                        <p className="mt-3 text-[10px] text-gray-400">Units Sold in Period</p>
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
                        <p className="mt-3 text-[10px] text-gray-400">Buying in selected period</p>
                    </div>

                    {/* Avg Order Value */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avg Order Value</p>
                                <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatK(kpis.avgOrder)}</h3>
                            </div>
                            <div className="bg-purple-50 p-2 rounded-lg text-purple-600"><Activity className="w-5 h-5" /></div>
                        </div>
                        <p className="mt-3 text-[10px] text-gray-400">Per transaction avg</p>
                    </div>
                </div>

                {/* 2. Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-96">
                    
                    {/* Line Chart (Trend) */}
                    <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600" /> Sales Trend Analysis</h3>
                            <div className="flex items-center gap-4 text-[10px]">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Current</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-300"></div> {comparisonMode === 'PREV_YEAR' ? 'Last Year' : 'Prev Period'}</span>
                            </div>
                        </div>
                        <div className="flex-1 w-full relative">
                            {/* Simple SVG Line Chart Implementation */}
                            <svg className="w-full h-full" viewBox={`0 0 ${lineChartData.labels.length * 10} 100`} preserveAspectRatio="none">
                                {/* Grid Lines */}
                                {[0, 25, 50, 75, 100].map(y => (
                                    <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="#f3f4f6" strokeWidth="0.5" />
                                ))}
                                
                                {/* Data Paths */}
                                {(() => {
                                    const max = Math.max(...lineChartData.currSeries, ...lineChartData.prevSeries, 1) * 1.1;
                                    const step = (lineChartData.labels.length * 10) / (lineChartData.labels.length - 1 || 1);
                                    
                                    const getPoints = (series: number[]) => series.map((v, i) => `${i * step},${100 - (v / max * 100)}`).join(' ');

                                    return (
                                        <>
                                            <polyline points={getPoints(lineChartData.prevSeries)} fill="none" stroke="#d1d5db" strokeWidth="2" strokeDasharray="4" />
                                            <polyline points={getPoints(lineChartData.currSeries)} fill="none" stroke="#3b82f6" strokeWidth="3" />
                                            
                                            {/* Dots for Current */}
                                            {lineChartData.currSeries.map((v, i) => (
                                                <circle key={i} cx={i * step} cy={100 - (v/max*100)} r="2" fill="white" stroke="#3b82f6" strokeWidth="1.5" />
                                            ))}
                                        </>
                                    )
                                })()}
                            </svg>
                            {/* X-Axis Labels */}
                            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-gray-400 mt-1">
                                {lineChartData.labels.map((l, i) => (
                                    <span key={i} style={{width: `${100/lineChartData.labels.length}%`, textAlign: 'center'}}>{l}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Pie Chart (Distribution) */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><PieIcon className="w-4 h-4 text-purple-600" /> Sales Distribution</h3>
                            <div className="flex bg-gray-100 p-0.5 rounded">
                                <button onClick={() => setPieMetric('GROUP')} className={`px-2 py-0.5 text-[9px] font-bold rounded ${pieMetric === 'GROUP' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>Group</button>
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
                                                    <span className="font-medium text-gray-700">{item.label}</span>
                                                    <span className="font-bold">{Math.round(pct)}%</span>
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

                {/* 3. Top 10 Customers (Bar Chart) */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-80">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4"><BarChart3 className="w-4 h-4 text-emerald-600" /> Top 10 Customer Groups / Accounts</h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                        {topCustomers.map((item, idx) => {
                            const maxVal = topCustomers[0]?.value || 1;
                            return (
                                <div key={idx} className="flex items-center gap-3">
                                    <span className="w-4 text-[10px] font-bold text-gray-400">{idx + 1}</span>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-bold text-gray-700 truncate">{item.label}</span>
                                            <span className="font-bold text-gray-900">{formatK(item.value)}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        {topCustomers.length === 0 && <div className="text-center text-gray-400 text-xs mt-10">No sales data for selected period.</div>}
                    </div>
                </div>

            </div>
        ) : (
            // Placeholder for other tabs (Inventory, SO, PO) - Keeping them simple for now as requested changes were for Sales Dashboard
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
