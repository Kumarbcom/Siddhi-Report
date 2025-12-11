
import React, { useState, useMemo, useEffect } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesRecord, SalesReportItem, CustomerMasterItem } from '../types';
import { TrendingUp, TrendingDown, Package, ClipboardList, ShoppingCart, Calendar, Filter, PieChart as PieIcon, BarChart3, Users, ArrowRight, Activity, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw, UserCircle, Minus, Plus, ChevronDown, ChevronUp, Link2Off, AlertTriangle, Layers, Clock, CheckCircle2, AlertCircle, User, Factory } from 'lucide-react';

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
type Metric = 'quantity' | 'value';

const COLORS = ['#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#6B7280', '#059669', '#2563EB'];

// --- Helper: Lakh Formatter ---
const formatLakhs = (val: number) => {
    if (val === 0) return '0';
    if (Math.abs(val) >= 100000) {
        return `Rs. ${(val / 100000).toFixed(2)} L`;
    }
    return `Rs. ${Math.round(val).toLocaleString('en-IN')}`;
};

const formatLakhsCompact = (val: number) => {
    if (val === 0) return '0';
    if (Math.abs(val) >= 100000) {
        return `${(val / 100000).toFixed(2)} L`;
    }
    return Math.round(val).toLocaleString('en-IN');
};

// --- Local Components for Inventory Tab ---
const InventoryToggle: React.FC<{ value: Metric; onChange: (m: Metric) => void; colorClass: string }> = ({ value, onChange, colorClass }) => (
  <div className="flex bg-gray-100 p-0.5 rounded-md border border-gray-200">
    <button 
      onClick={() => onChange('quantity')} 
      className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-all ${value === 'quantity' ? `bg-white shadow-sm ${colorClass}` : 'text-gray-500 hover:text-gray-700'}`}
    >
      Qty
    </button>
    <button 
      onClick={() => onChange('value')} 
      className={`px-2 py-0.5 text-[9px] font-semibold rounded transition-all ${value === 'value' ? `bg-white shadow-sm ${colorClass}` : 'text-gray-500 hover:text-gray-700'}`}
    >
      Value
    </button>
  </div>
);

const InventoryDonutChart: React.FC<{ 
  data: { label: string; value: number; color: string; displayValue: string }[], 
  metric: Metric,
  total: number,
  centerLabelOverride?: string
}> = ({ data, metric, total, centerLabelOverride }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  let cumulativePercent = 0;

  if (total === 0) return <div className="flex items-center justify-center h-32 text-gray-400 text-[10px]">No Data</div>;

  const slices = data.map(slice => {
    const percent = slice.value / total;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { ...slice, percent, startPercent };
  });

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  const centerLabel = hoveredIndex !== null ? data[hoveredIndex].label : (centerLabelOverride || `Total ${metric === 'value' ? 'Val' : 'Qty'}`);
  
  const centerValue = hoveredIndex !== null 
    ? data[hoveredIndex].displayValue 
    : (metric === 'value' 
        ? formatLakhs(total)
        : Math.round(total).toLocaleString('en-IN'));
        
  const centerSubtext = hoveredIndex !== null ? `${(data[hoveredIndex].value / total * 100).toFixed(1)}%` : '';

  return (
    <div className="flex flex-col items-center gap-3 h-full">
      <div className="relative w-28 h-28 flex-shrink-0">
        <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full">
          {slices.map((slice, i) => {
            if (slice.percent === 1) {
              return <circle key={i} cx="0" cy="0" r="0.8" fill="transparent" stroke={slice.color} strokeWidth="0.3" pathLength="100" 
                onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} />;
            }
            const [startX, startY] = getCoordinatesForPercent(slice.startPercent);
            const [endX, endY] = getCoordinatesForPercent(slice.startPercent + slice.percent);
            const largeArcFlag = slice.percent > 0.5 ? 1 : 0;
            const pathData = [
              `M ${startX} ${startY}`,
              `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
              `L ${endX * 0.6} ${endY * 0.6}`,
              `A 0.6 0.6 0 ${largeArcFlag} 0 ${startX * 0.6} ${startY * 0.6}`,
              'Z'
            ].join(' ');

            return (
              <path
                key={i}
                d={pathData}
                fill={slice.color}
                className={`transition-all duration-200 cursor-pointer ${hoveredIndex === i ? 'opacity-100 scale-105 stroke-2 stroke-white' : 'opacity-90 hover:opacity-100'}`}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <title>{`${slice.label}: ${Math.round(slice.percent * 100)}%`}</title>
              </path>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-1">
          <span className="text-[9px] text-gray-400 uppercase font-medium tracking-wider truncate w-full text-center">
            {centerLabel === 'Unspecified' ? 'Unknown' : centerLabel}
          </span>
          <span className="text-[11px] font-bold text-gray-800 leading-tight text-center">
             {centerValue}
          </span>
          {centerSubtext && <span className="text-[9px] text-gray-500 font-medium">{centerSubtext}</span>}
        </div>
      </div>

      <div className="flex-1 w-full overflow-hidden flex flex-col min-h-0">
         <div className="flex items-center justify-between text-[9px] uppercase font-semibold text-gray-400 pb-1 border-b border-gray-100 mb-1">
            <span>Category</span>
            <div className="flex gap-2">
                <span className="w-8 text-right">%</span>
                <span className="w-20 text-right">{metric === 'value' ? 'Val' : 'Qty'}</span>
            </div>
         </div>
         <div className="overflow-y-auto custom-scrollbar flex-1 space-y-0.5 pr-1">
            {data.map((item, i) => (
              <div 
                key={i} 
                className={`flex items-center justify-between text-[10px] p-0.5 rounded transition-colors cursor-pointer ${hoveredIndex === i ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                  <span className="text-gray-700 font-medium truncate" title={item.label}>{item.label}</span>
                </div>
                <div className="flex gap-2 items-center flex-shrink-0">
                    <span className="w-8 text-right text-gray-500 font-mono text-[9px]">{(item.value / total * 100).toFixed(0)}%</span>
                    <span className="w-20 text-right font-medium text-gray-900 truncate" title={item.displayValue}>{item.displayValue}</span>
                </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};


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
  
  // Inventory Tab State
  const [invMakeMetric, setInvMakeMetric] = useState<Metric>('value');
  const [invGroupMetric, setInvGroupMetric] = useState<Metric>('value');
  const [invTopMetric, setInvTopMetric] = useState<Metric>('value');
  const [invSelectedMake, setInvSelectedMake] = useState<string>('ALL');

  // Pending SO Tab State
  const [soFilterMake, setSoFilterMake] = useState<string>('ALL');
  const [soFilterGroup, setSoFilterGroup] = useState<string>('ALL');

  // Initialize to current fiscal month index (0=Apr, 11=Mar)
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const m = new Date().getMonth();
    return m >= 3 ? m - 3 : m + 9;
  });
  
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // New: Collapsible groups for Pending SO
  const [expandedPendingGroups, setExpandedPendingGroups] = useState<Set<string>>(new Set());

  // Toggle Group Expansion (Sales)
  const toggleGroup = (groupName: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(groupName)) newSet.delete(groupName);
    else newSet.add(groupName);
    setExpandedGroups(newSet);
  };

  // Toggle Pending Group Expansion
  const togglePendingGroup = (groupName: string) => {
    const newSet = new Set(expandedPendingGroups);
    if (newSet.has(groupName)) newSet.delete(groupName);
    else newSet.add(groupName);
    setExpandedPendingGroups(newSet);
  };

  // --- Helper: Robust Date Parsing ---
  const parseDate = (val: any): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (typeof val === 'number') {
        return new Date((val - (25567 + 2)) * 86400 * 1000);
    }
    if (typeof val === 'string') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        const parts = val.split(/[-/.]/);
        if (parts.length === 3) {
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

  // --- 1. Prepare Sales Data ---
  const enrichedSales = useMemo(() => {
      const custMap = new Map<string, CustomerMasterItem>();
      customers.forEach(c => custMap.set(c.customerName.toLowerCase().trim(), c));

      return salesReportItems.map(item => {
          const dateObj = parseDate(item.date);
          const fi = getFiscalInfo(dateObj);
          const cust = custMap.get(item.customerName.toLowerCase().trim());
          
          const primaryGroup = cust?.customerGroup?.trim(); 
          const accountGroup = cust?.group?.trim(); 
          
          return {
              ...item,
              ...fi,
              rawDate: dateObj,
              custGroup: accountGroup, 
              customerMasterGroup: primaryGroup || 'Unspecified', 
              oldGroupField: cust?.group,
              custStatus: cust?.status || 'Unknown',
              salesRep: cust?.salesRep || 'Unassigned',
              derivedGroup: primaryGroup || item.customerName,
              isGrouped: !!(primaryGroup && primaryGroup !== 'Unassigned')
          };
      });
  }, [salesReportItems, customers]);

  // --- 1b. Derive Fiscal Years ---
  const uniqueFYs = useMemo(() => {
      const set = new Set(enrichedSales.map(i => i.fiscalYear));
      return Array.from(set).filter(Boolean).sort().reverse();
  }, [enrichedSales]);

  useEffect(() => {
      if (uniqueFYs.length > 0) {
          if (!selectedFY || !uniqueFYs.includes(selectedFY)) {
              setSelectedFY(uniqueFYs[0]);
          }
      }
  }, [uniqueFYs, selectedFY]);

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
              return getDataForPeriod(selectedFY, selectedMonth, prevW);
          }
      }
  }, [enrichedSales, selectedFY, selectedMonth, selectedWeek, timeView, comparisonMode]);

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

  const lineChartData = useMemo(() => {
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
                  { name: fy1, data: getSeries(fy1), color: '#3b82f6', active: true }, 
                  { name: fy2, data: getSeries(fy2), color: '#a855f7', active: true }, 
                  { name: fy3, data: getSeries(fy3), color: '#9ca3af', active: true } 
              ],
              isMultiYear: true
          };
      } else {
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

  const pieDataGroup = useMemo(() => {
      const map = new Map<string, number>();
      currentData.forEach(i => {
          let key = i.customerMasterGroup || 'Other Groups';
          map.set(key, (map.get(key) || 0) + i.value);
      });
      return Array.from(map.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value);
  }, [currentData]);

  const pieDataStatus = useMemo(() => {
    const map = new Map<string, number>();
    currentData.forEach(i => {
        let key = i.custStatus || 'Unknown';
        map.set(key, (map.get(key) || 0) + i.value);
    });
    return Array.from(map.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
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
      previousData.forEach(i => {
          const key = i.derivedGroup;
          prevMap.set(key, (prevMap.get(key) || 0) + i.value);
      });
      return Array.from(currentMap.entries())
          .map(([label, { value, isGroup }]) => {
              const prevValue = prevMap.get(label) || 0;
              const diff = value - prevValue;
              const pct = prevValue !== 0 ? (diff / prevValue) * 100 : 0;
              return { label, value, prevValue, diff, pct, isGroup };
          })
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
  }, [currentData, previousData]);

  const getGroupBreakdown = (groupName: string) => {
    const breakdownMap = new Map<string, number>();
    currentData
      .filter(i => i.derivedGroup === groupName)
      .forEach(i => {
         breakdownMap.set(i.customerName, (breakdownMap.get(i.customerName) || 0) + i.value);
      });
    return Array.from(breakdownMap.entries())
      .map(([name, val]) => ({ name, value: val }))
      .sort((a, b) => b.value - a.value);
  };

  // --- INVENTORY PREP ---
  const enrichedStock = useMemo(() => {
    return closingStock.map(item => {
        const itemDesc = item.description.toLowerCase().trim();
        const mat = materials.find(m => m.description.toLowerCase().trim() === itemDesc);
        return {
            ...item,
            make: mat ? mat.make : 'Unspecified',
            group: mat ? mat.materialGroup : 'Unspecified',
            isLinked: !!mat
        };
    });
  }, [closingStock, materials]);

  const inventoryUniqueMakes = useMemo(() => {
     const makes = new Set(enrichedStock.map(i => i.make));
     const list = Array.from(makes).sort();
     return ['ALL', ...list];
  }, [enrichedStock]);

  const filteredStock = useMemo(() => {
      if (invSelectedMake === 'ALL') return enrichedStock;
      return enrichedStock.filter(i => i.make === invSelectedMake);
  }, [enrichedStock, invSelectedMake]);

  const inventoryStats = useMemo(() => {
    const data = filteredStock; 
    const totalQty = data.reduce((acc, i) => acc + i.quantity, 0);
    const totalVal = data.reduce((acc, i) => acc + i.value, 0);
    const count = data.length;
    const totalUnmatched = data.filter(i => !i.isLinked).length;

    const makeMap = new Map<string, { qty: number, val: number }>();
    data.forEach(i => {
        const m = makeMap.get(i.make) || { qty: 0, val: 0 };
        m.qty += i.quantity;
        m.val += i.value;
        makeMap.set(i.make, m);
    });

    const formatVal = (val: number, type: Metric) => type === 'value' ? formatLakhs(val) : Math.round(val).toLocaleString('en-IN');

    const byMake = Array.from(makeMap.entries())
        .map(([label, data], i) => ({ 
            label, 
            value: invMakeMetric === 'value' ? data.val : data.qty,
            displayValue: formatVal(invMakeMetric === 'value' ? data.val : data.qty, invMakeMetric),
            color: label === 'Unspecified' ? '#9CA3AF' : COLORS[i % COLORS.length] 
        }))
        .sort((a, b) => b.value - a.value);

    const groupMap = new Map<string, { qty: number, val: number }>();
    data.forEach(i => {
         const g = groupMap.get(i.group) || { qty: 0, val: 0 };
         g.qty += i.quantity;
         g.val += i.value;
         groupMap.set(i.group, g);
    });

    const byGroup = Array.from(groupMap.entries())
        .map(([label, data]) => ({ 
            label, 
            value: invGroupMetric === 'value' ? data.val : data.qty 
        }))
        .sort((a, b) => b.value - a.value)
        .filter(g => g.label !== 'Unspecified');

    const topArticles = [...data]
        .sort((a, b) => {
            const valA = invTopMetric === 'value' ? a.value : a.quantity;
            const valB = invTopMetric === 'value' ? b.value : b.quantity;
            return valB - valA;
        })
        .slice(0, 5)
        .map(i => ({ 
            label: i.description, 
            value: invTopMetric === 'value' ? i.value : i.quantity
        }));

    const currentMakeTotal = byMake.reduce((acc, item) => acc + item.value, 0);

    return { totalQty, totalVal, count, totalUnmatched, byMake, byGroup, topArticles, currentMakeTotal, formatVal };
  }, [filteredStock, invMakeMetric, invGroupMetric, invTopMetric]);

  // --- PENDING SO LOGIC REFACTOR (PROCESS -> FILTER -> AGGREGATE) ---
  
  // 1. Enrich & FIFO Allocation (Global Level)
  const processedSOData = useMemo(() => {
    const today = new Date();
    const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfCurrentMonth.setHours(23, 59, 59, 999);

    const matMap = new Map<string, string>();
    materials.forEach(m => matMap.set(m.description.toLowerCase().trim(), m.make));
    const custMap = new Map<string, string>();
    customers.forEach(c => custMap.set(c.customerName.toLowerCase().trim(), c.customerGroup || 'Unassigned'));

    // Group items for FIFO
    const groupedItems: Record<string, PendingSOItem[]> = {};
    pendingSO.forEach(item => {
        const key = item.itemName.toLowerCase().trim();
        if (!groupedItems[key]) groupedItems[key] = [];
        groupedItems[key].push(item);
    });

    const results = [];

    // Run FIFO
    Object.keys(groupedItems).forEach(key => {
        const groupOrders = groupedItems[key];
        const stockItem = closingStock.find(s => s.description.toLowerCase().trim() === key);
        const totalStock = stockItem ? stockItem.quantity : 0;
        let runningStock = totalStock;

        // Sort by Due Date
        groupOrders.sort((a, b) => {
            const dateA = new Date(a.dueDate || '9999-12-31').getTime();
            const dateB = new Date(b.dueDate || '9999-12-31').getTime();
            return dateA - dateB;
        });

        groupOrders.forEach(order => {
            const dueDate = order.dueDate ? new Date(order.dueDate) : new Date('9999-12-31');
            const isFuture = dueDate > endOfCurrentMonth;
            
            // Calc Overdue
            const diffTime = today.getTime() - dueDate.getTime();
            const isOverdue = diffTime > 0;

            let allocated = 0;
            let shortage = order.balanceQty;

            if (!isFuture) {
                const required = order.balanceQty;
                allocated = Math.min(runningStock, required);
                shortage = required - allocated;
                runningStock = Math.max(0, runningStock - allocated);
            }

            const val = (order.balanceQty || 0) * (order.rate || 0);
            const allocatedVal = allocated * (order.rate || 0);
            const shortageVal = shortage * (order.rate || 0);

            results.push({
                ...order,
                make: matMap.get(key) || 'Unspecified',
                customerGroup: custMap.get(order.partyName.toLowerCase().trim()) || 'Unassigned',
                isFuture,
                isOverdue,
                allocated,
                shortage,
                val,
                allocatedVal,
                shortageVal
            });
        });
    });
    return results;
  }, [pendingSO, materials, customers, closingStock]);

  // 2. Filter Processed Data (Slicers)
  const filteredSOData = useMemo(() => {
      return processedSOData.filter(item => {
          if (soFilterMake !== 'ALL' && item.make !== soFilterMake) return false;
          if (soFilterGroup !== 'ALL' && item.customerGroup !== soFilterGroup) return false;
          return true;
      });
  }, [processedSOData, soFilterMake, soFilterGroup]);

  // 3. Aggregate Stats for Charts & KPIs
  const soStats = useMemo(() => {
      const stats = {
          totalOrdered: { qty: 0, val: 0, count: 0 },
          totalBalance: { qty: 0, val: 0 },
          due: { available: { qty: 0, val: 0 }, shortage: { qty: 0, val: 0 } },
          scheduled: { available: { qty: 0, val: 0 }, shortage: { qty: 0, val: 0 } },
          byGroup: new Map<string, number>(),
          byMake: new Map<string, number>(),
          byStatus: { overdue: 0, due: 0, future: 0 }
      };

      const uniqueOrders = new Set<string>();

      filteredSOData.forEach(item => {
          if (item.orderNo) uniqueOrders.add(item.orderNo);
          
          stats.totalOrdered.qty += item.orderedQty;
          stats.totalOrdered.val += (item.orderedQty * (item.rate || 0));
          
          stats.totalBalance.qty += item.balanceQty;
          stats.totalBalance.val += item.val;

          // Split Logic
          if (item.isFuture) {
              stats.scheduled.available.qty += item.allocated;
              stats.scheduled.available.val += item.allocatedVal;
              stats.scheduled.shortage.qty += item.shortage;
              stats.scheduled.shortage.val += item.shortageVal;
              stats.byStatus.future += item.val;
          } else {
              stats.due.available.qty += item.allocated;
              stats.due.available.val += item.allocatedVal;
              stats.due.shortage.qty += item.shortage;
              stats.due.shortage.val += item.shortageVal;
              
              if (item.isOverdue) stats.byStatus.overdue += item.val;
              else stats.byStatus.due += item.val;
          }

          // Charts Aggregation
          stats.byGroup.set(item.customerGroup, (stats.byGroup.get(item.customerGroup) || 0) + item.val);
          stats.byMake.set(item.make, (stats.byMake.get(item.make) || 0) + item.val);
      });

      stats.totalOrdered.count = uniqueOrders.size;
      return stats;
  }, [filteredSOData]);

  // 4. Aggregate Top 10 Groups Table (Filtered)
  const topPendingGroups = useMemo(() => {
      const groupStats: Record<string, { totalVal: number, due: any, scheduled: any, customers: any }> = {};

      filteredSOData.forEach(item => {
          const g = item.customerGroup;
          const c = item.partyName;

          if (!groupStats[g]) {
              groupStats[g] = { totalVal: 0, due: { qty: 0, val: 0 }, scheduled: { qty: 0, val: 0 }, customers: {} };
          }
          if (!groupStats[g].customers[c]) {
              groupStats[g].customers[c] = { due: { qty: 0, val: 0 }, scheduled: { qty: 0, val: 0 }, totalVal: 0 };
          }

          if (item.isFuture) {
              groupStats[g].scheduled.qty += item.balanceQty;
              groupStats[g].scheduled.val += item.val;
              groupStats[g].customers[c].scheduled.qty += item.balanceQty;
              groupStats[g].customers[c].scheduled.val += item.val;
          } else {
              groupStats[g].due.qty += item.balanceQty;
              groupStats[g].due.val += item.val;
              groupStats[g].customers[c].due.qty += item.balanceQty;
              groupStats[g].customers[c].due.val += item.val;
          }
          groupStats[g].totalVal += item.val;
          groupStats[g].customers[c].totalVal += item.val;
      });

      return Object.entries(groupStats)
          .map(([groupName, s]) => ({
              groupName,
              ...s,
              customers: Object.entries(s.customers)
                  .map(([custName, cs]: any) => ({ custName, ...cs }))
                  .sort((a: any, b: any) => b.totalVal - a.totalVal)
          }))
          .sort((a, b) => b.totalVal - a.totalVal)
          .slice(0, 10);
  }, [filteredSOData]);

  // Slicer Options
  const soSlicerOptions = useMemo(() => {
      const makes = new Set(processedSOData.map(i => i.make));
      const groups = new Set(processedSOData.map(i => i.customerGroup));
      return {
          makes: ['ALL', ...Array.from(makes).sort()],
          groups: ['ALL', ...Array.from(groups).sort()]
      };
  }, [processedSOData]);

  // --- Render Helpers ---
  const formatNumber = (val: number) => Math.round(val).toLocaleString('en-IN');
  const formatCompactNumber = (val: number) => formatLakhsCompact(val); 
  const formatCurrency = (val: number) => formatLakhs(val); 
  
  const formatAxisValue = (val: number) => {
    if (val >= 100000) return (val / 100000).toFixed(1) + 'L';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
    return val.toFixed(0);
  };

  const comparisonLabel = useMemo(() => {
    if (comparisonMode === 'PREV_YEAR') return 'Last Year';
    
    if (timeView === 'FY') return 'Prev FY';
    if (timeView === 'MONTH') {
        const prevM = selectedMonth - 1;
        return prevM < 0 ? 'Mar (Prev FY)' : getFiscalMonthName(prevM);
    }
    if (timeView === 'WEEK') {
        return selectedWeek > 1 ? `Week ${selectedWeek - 1}` : 'Prior Week';
    }
    return 'Prev Period';
  }, [comparisonMode, timeView, selectedMonth, selectedWeek]);

  const chartMax = useMemo(() => {
      const allValues = lineChartData.series.flatMap(s => s.data);
      return Math.max(...allValues, 1000) * 1.1; 
  }, [lineChartData]);

  const SimpleDonut = ({ data, title, color }: { data: {label: string, value: number}[], title: string, color: string }) => {
     if(data.length === 0) return <div className="h-32 flex items-center justify-center text-gray-400 text-xs">No Data</div>;
     const total = data.reduce((a,b) => a+b.value, 0);
     let cumPercent = 0;
     let displayData = data;
     if (data.length > 5) {
         const top5 = data.slice(0, 5);
         const otherVal = data.slice(5).reduce((a,b) => a+b.value, 0);
         displayData = [...top5, { label: 'Others', value: otherVal }];
     }
     return (
        <div className="flex flex-col h-full">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">{title}</h4>
            <div className="flex items-center gap-4 flex-1">
                <div className="w-20 h-20 relative flex-shrink-0">
                   <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                      {displayData.map((slice, i) => {
                          const percent = slice.value / total;
                          const startX = Math.cos(2 * Math.PI * cumPercent);
                          const startY = Math.sin(2 * Math.PI * cumPercent);
                          cumPercent += percent;
                          const endX = Math.cos(2 * Math.PI * cumPercent);
                          const endY = Math.sin(2 * Math.PI * cumPercent);
                          const largeArc = percent > 0.5 ? 1 : 0;
                          const sliceColor = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#9CA3AF'][i % 6];
                          return (
                              <path key={i} d={`M ${startX} ${startY} A 1 1 0 ${largeArc} 1 ${endX} ${endY} L 0 0`} fill={sliceColor} stroke="white" strokeWidth="0.05" />
                          );
                      })}
                      <circle cx="0" cy="0" r="0.6" fill="white" />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <span className={`text-[8px] font-bold text-${color}-600`}>{formatLakhsCompact(total)}</span>
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar h-24 text-[9px]">
                    {displayData.map((d, i) => (
                        <div key={i} className="flex justify-between items-center mb-1">
                             <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#9CA3AF'][i % 6]}}></div>
                                <span className="text-gray-600 truncate" title={d.label}>{d.label}</span>
                             </div>
                             <span className="font-bold text-gray-800 whitespace-nowrap ml-2">{formatLakhs(d.value)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
     );
  };

  const SimpleBarChart = ({ data, title, color }: { data: {label: string, value: number}[], title: string, color: string }) => {
      if(data.length === 0) return <div className="h-32 flex items-center justify-center text-gray-400 text-xs">No Data</div>;
      const sorted = [...data].sort((a,b) => b.value - a.value).slice(0, 6);
      const maxVal = sorted[0].value || 1;
      return (
          <div className="flex flex-col h-full">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">{title}</h4>
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1">
                  {sorted.map((item, i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                          <div className="flex justify-between text-[9px]">
                              <span className="text-gray-700 truncate font-medium">{item.label}</span>
                              <span className="text-gray-900 font-bold">{formatLakhs(item.value)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full bg-${color}-500`} style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

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

          {/* Time & Comparison Controls (Sales Only) */}
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

          {/* NEW: Inventory Filter */}
          {activeSubTab === 'inventory' && (
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  <div className="flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-[10px] text-gray-500 font-bold uppercase hidden md:inline">Filter Make:</span>
                      <select value={invSelectedMake} onChange={e => setInvSelectedMake(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]">
                          {inventoryUniqueMakes.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                  </div>
              </div>
          )}

          {/* NEW: Pending SO Filters */}
          {activeSubTab === 'so' && (
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                  <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-lg border border-gray-200">
                      <Filter className="w-3.5 h-3.5 text-purple-500 ml-1" />
                      <div className="flex flex-col px-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Make</label>
                          <select value={soFilterMake} onChange={e => setSoFilterMake(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-24">
                              {soSlicerOptions.makes.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                      </div>
                      <div className="w-px h-6 bg-gray-300 mx-1"></div>
                      <div className="flex flex-col px-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Cust Group</label>
                          <select value={soFilterGroup} onChange={e => setSoFilterGroup(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-28">
                              {soSlicerOptions.groups.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
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
                            <span className="text-[10px] text-gray-400 font-medium">{comparisonLabel}: {formatLakhsCompact(kpis.prevVal)}</span>
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
                                <h3 className="text-2xl font-extrabold text-gray-900 mt-1">{formatCurrency(kpis.avgOrder)}</h3>
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
                                                    
                                                    {/* Data Points and Labels - ENABLED FOR ALL SERIES, INCLUDING PREVIOUS YEAR */}
                                                    {series.data.map((val, i) => {
                                                        const x = (i / (lineChartData.labels.length - 1)) * 100;
                                                        const y = 100 - (val / chartMax * 100);
                                                        
                                                        // Update: Fixed smaller font size approx 2.2% of viewbox height (~8-10px visual)
                                                        // Update: Fill color matches series color
                                                        
                                                        // Alternate label position to avoid overlap between Current(sIdx=0) and Previous(sIdx>0)
                                                        const labelY = sIdx === 0 ? y - 8 : y + 12;

                                                        return (
                                                            <g key={i}>
                                                                <circle 
                                                                    cx={x}
                                                                    cy={y}
                                                                    r="2" 
                                                                    fill="white"
                                                                    stroke={series.color}
                                                                    strokeWidth="1.5"
                                                                    vectorEffect="non-scaling-stroke"
                                                                    className="hover:scale-125 transition-transform cursor-pointer"
                                                                >
                                                                    <title>{`${lineChartData.labels[i]} (${series.name}): ${formatNumber(val)}`}</title>
                                                                </circle>
                                                                {val > 0 && (
                                                                    <text 
                                                                        x={x} 
                                                                        y={labelY} 
                                                                        textAnchor="middle" 
                                                                        fill={series.color}
                                                                        fontSize="2.2" 
                                                                        fontWeight="bold"
                                                                        style={{ pointerEvents: 'none', textShadow: '0px 0px 2px white' }}
                                                                    >
                                                                        {formatLakhsCompact(val)}
                                                                    </text>
                                                                )}
                                                            </g>
                                                        );
                                                    })}
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

                    {/* Pie Charts (Split View: Group & Status) */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col min-h-[350px]">
                        <div className="flex justify-between items-center mb-2 flex-shrink-0">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><PieIcon className="w-4 h-4 text-purple-600" /> Sales Mix</h3>
                        </div>
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
                            {/* 1. Customer Group Donut - UPDATED to use raw Customer Group field */}
                            <div className="flex-1 min-h-0 border-b border-dashed border-gray-200 pb-2">
                                <SimpleDonut data={pieDataGroup} title="Cust. Master Group" color="blue" />
                            </div>
                            {/* 2. Customer Status Donut */}
                            <div className="flex-1 min-h-0 pt-2">
                                <SimpleDonut data={pieDataStatus} title="By Status" color="green" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Top 10 Pivot (Bar Chart with Expandable Rows) */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-96">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-emerald-600" /> Top 10 Customer Groups (Expandable)
                        </h3>
                        <span className="text-[10px] text-gray-400 italic text-right">
                             Values vs {comparisonLabel}
                        </span>
                    </div>
                    
                    {/* Header */}
                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 pb-2 mb-2 px-2">
                        <span>Group Name</span>
                        <span>Total Sales</span>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                        {topCustomers.map((item, idx) => {
                            const maxVal = topCustomers[0]?.value || 1;
                            const isPositive = item.diff >= 0;
                            const isExpanded = expandedGroups.has(item.label);
                            const breakdown = isExpanded && item.isGroup ? getGroupBreakdown(item.label) : [];
                            
                            return (
                                <div key={idx} className="bg-gray-50/50 rounded-lg border border-gray-100 overflow-hidden">
                                    <div 
                                        className="p-2 flex flex-col cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => item.isGroup && toggleGroup(item.label)}
                                    >
                                        <div className="flex justify-between items-start text-xs mb-1">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <button 
                                                    className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${item.isGroup ? 'hover:bg-gray-200 text-gray-600' : 'opacity-0 cursor-default'}`}
                                                >
                                                    {item.isGroup && (isExpanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />)}
                                                </button>
                                                <span className="w-5 text-[10px] font-bold text-gray-400 bg-white border border-gray-200 rounded text-center flex-shrink-0">{idx + 1}</span>
                                                <span className="font-bold text-gray-800 truncate select-none">{item.label}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="font-bold text-gray-900">{formatLakhs(item.value)}</span>
                                                {item.prevValue > 0 && (
                                                    <div className="flex items-center gap-1 text-[9px] mt-0.5">
                                                        <span className="text-gray-400">vs {formatLakhsCompact(item.prevValue)}</span>
                                                        <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                                            {isPositive ? '+' : ''}{Math.round(item.pct)}%
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Main Bar */}
                                        <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden ml-12 w-[calc(100%-3rem)]">
                                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && item.isGroup && (
                                        <div className="bg-white border-t border-gray-100 p-2 pl-14 animate-in slide-in-from-top-1 duration-200">
                                            <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">Group Breakdown</p>
                                            <div className="space-y-2">
                                                {breakdown.map((cust, cIdx) => (
                                                    <div key={cIdx} className="flex justify-between items-center text-[10px]">
                                                        <span className="text-gray-600 truncate flex-1">{cust.name}</span>
                                                        <span className="font-medium text-gray-800">{formatLakhs(cust.value)}</span>
                                                    </div>
                                                ))}
                                                {breakdown.length === 0 && <span className="text-[10px] text-gray-400 italic">No details available</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        {topCustomers.length === 0 && <div className="text-center text-gray-400 text-xs mt-10">No sales data for selected period.</div>}
                    </div>
                </div>

            </div>
        ) : activeSubTab === 'inventory' ? (
          <div className="flex flex-col gap-4">
             {/* 1. Header Stats */}
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex-shrink-0">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                       <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide mb-0.5">Total Stock Value</p>
                       <p className="text-xl font-bold text-gray-900">{formatCurrency(inventoryStats.totalVal)}</p>
                   </div>
                   <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                       <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-0.5">Total Items</p>
                       <p className="text-xl font-bold text-gray-900">{inventoryStats.count.toLocaleString()}</p>
                   </div>
                   <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                       <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-0.5">Total Quantity</p>
                       <p className="text-xl font-bold text-gray-900">{inventoryStats.totalQty.toLocaleString()}</p>
                   </div>
                   <div className={`rounded-lg p-3 border ${inventoryStats.totalUnmatched > 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
                       <div className="flex items-center gap-1.5 mb-0.5">
                          {inventoryStats.totalUnmatched > 0 ? <Link2Off className="w-3 h-3 text-orange-600" /> : <Package className="w-3 h-3 text-green-600" />}
                          <p className={`text-[10px] font-semibold uppercase tracking-wide ${inventoryStats.totalUnmatched > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                             Not in Master
                          </p>
                       </div>
                       <p className={`text-xl font-bold ${inventoryStats.totalUnmatched > 0 ? 'text-orange-800' : 'text-green-800'}`}>
                           {inventoryStats.totalUnmatched.toLocaleString()}
                       </p>
                   </div>
               </div>
             </div>

             {/* 2. Charts Dashboard */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-shrink-0">
                 {/* Make Distribution (Donut) */}
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col h-[280px]">
                     <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2 flex-shrink-0">
                         <div className="flex items-center gap-1.5">
                             <PieIcon className="w-4 h-4 text-purple-600" />
                             <h3 className="text-xs font-bold text-gray-800">Make Distribution</h3>
                         </div>
                         <InventoryToggle value={invMakeMetric} onChange={setInvMakeMetric} colorClass="text-purple-700" />
                     </div>
                     <div className="flex-1 min-h-0">
                       <InventoryDonutChart data={inventoryStats.byMake} metric={invMakeMetric} total={inventoryStats.currentMakeTotal} />
                     </div>
                 </div>

                 {/* Group Distribution (Bar/List) */}
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col h-[280px]">
                     <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2 flex-shrink-0">
                         <div className="flex items-center gap-1.5">
                             <BarChart3 className="w-4 h-4 text-blue-600" />
                             <h3 className="text-xs font-bold text-gray-800">Stock by Group</h3>
                         </div>
                         <InventoryToggle value={invGroupMetric} onChange={setInvGroupMetric} colorClass="text-blue-700" />
                     </div>
                     <div className="overflow-y-auto custom-scrollbar space-y-2 flex-1 pr-1">
                         {inventoryStats.byGroup.map((group) => {
                             const maxVal = inventoryStats.byGroup[0]?.value || 1;
                             const percent = (group.value / maxVal) * 100;
                             return (
                                 <div key={group.label} className="text-[10px]">
                                     <div className="flex justify-between items-center gap-2 mb-0.5">
                                         <span className="text-gray-700 font-medium text-[10px]">{group.label}</span>
                                         <span className="text-gray-900 font-bold whitespace-nowrap">{inventoryStats.formatVal(group.value, invGroupMetric)}</span>
                                     </div>
                                     <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                                         <div className="bg-blue-500 h-1 rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                     </div>
                                 </div>
                             )
                         })}
                         {inventoryStats.byGroup.length === 0 && <div className="text-center text-gray-400 text-[10px] py-8">No grouped data found</div>}
                     </div>
                 </div>

                 {/* Top 5 Articles */}
                 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col h-[280px]">
                     <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2 flex-shrink-0">
                         <div className="flex items-center gap-1.5">
                             <Layers className="w-4 h-4 text-emerald-600" />
                             <h3 className="text-xs font-bold text-gray-800">Top 5 Articles</h3>
                         </div>
                         <InventoryToggle value={invTopMetric} onChange={setInvTopMetric} colorClass="text-emerald-700" />
                     </div>
                     <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1">
                         {inventoryStats.topArticles.map((item, idx) => (
                             <div key={idx} className="flex items-center gap-2">
                                 <span className={`flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                                     {idx + 1}
                                 </span>
                                 <div className="flex-1 min-w-0">
                                     <p className="text-[10px] font-medium text-gray-800 truncate" title={item.label}>{item.label}</p>
                                     <div className="w-full bg-gray-100 rounded-full h-1 mt-0.5">
                                         <div className={`h-1 rounded-full ${idx === 0 ? 'bg-emerald-500' : 'bg-emerald-300'} transition-all duration-500`} style={{ width: `${(item.value / inventoryStats.topArticles[0].value) * 100}%` }}></div>
                                     </div>
                                 </div>
                                 <div className="text-right">
                                     <p className="text-[10px] font-bold text-gray-900">{inventoryStats.formatVal(item.value, invTopMetric)}</p>
                                 </div>
                             </div>
                         ))}
                         {inventoryStats.topArticles.length === 0 && <p className="text-center text-gray-400 text-[10px] py-4">No data available</p>}
                     </div>
                 </div>
             </div>
          </div>
        ) : activeSubTab === 'so' ? (
          // --- PENDING SO DASHBOARD ---
          <div className="flex flex-col gap-6">
              
              {/* 1. KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">TOTAL ORDERED ({soStats.totalOrdered.count} ORDERS)</p>
                      <div className="flex flex-col">
                          <span className="text-xl font-extrabold text-gray-900">{formatCurrency(soStats.totalOrdered.val)}</span>
                          <span className="text-sm font-bold text-blue-600">Qty: {soStats.totalOrdered.qty.toLocaleString()}</span>
                      </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">TOTAL BALANCE</p>
                      <div className="flex flex-col">
                          <span className="text-xl font-extrabold text-gray-900">{formatCurrency(soStats.totalBalance.val)}</span>
                          <span className="text-sm font-bold text-orange-600">Qty: {soStats.totalBalance.qty.toLocaleString()}</span>
                      </div>
                  </div>
              </div>

              {/* 2. Top Charts Grid (Filtered) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  
                  {/* Chart 1: Customer Group Distribution */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col h-64">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                          <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1"><Users className="w-3.5 h-3.5 text-blue-600" /> Group Wise Pending</h3>
                      </div>
                      <div className="flex-1 min-h-0">
                          <InventoryDonutChart 
                            data={Array.from(soStats.byGroup.entries())
                                .map(([label, value], i) => ({ 
                                    label: label || 'Unassigned', value, color: COLORS[i % COLORS.length], displayValue: formatLakhs(value) 
                                }))
                                .sort((a,b) => b.value - a.value)
                            } 
                            metric="value" 
                            total={soStats.totalBalance.val} 
                            centerLabelOverride="Total Value"
                          />
                      </div>
                  </div>

                  {/* Chart 2: Make Wise Pending (Bar) */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col h-64">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                          <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1"><Factory className="w-3.5 h-3.5 text-purple-600" /> Make Wise Pending</h3>
                      </div>
                      <div className="flex-1 min-h-0">
                          <SimpleBarChart 
                             data={Array.from(soStats.byMake.entries()).map(([label, value]) => ({ label, value }))} 
                             title="" 
                             color="purple" 
                          />
                      </div>
                  </div>

                  {/* Chart 3: Status Distribution */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col h-64">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                          <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-orange-600" /> Schedule Status</h3>
                      </div>
                      <div className="flex-1 min-h-0">
                          <InventoryDonutChart 
                            data={[
                                { label: 'Overdue', value: soStats.byStatus.overdue, color: '#EF4444', displayValue: formatLakhs(soStats.byStatus.overdue) },
                                { label: 'Due This Month', value: soStats.byStatus.due, color: '#F59E0B', displayValue: formatLakhs(soStats.byStatus.due) },
                                { label: 'Scheduled (Future)', value: soStats.byStatus.future, color: '#10B981', displayValue: formatLakhs(soStats.byStatus.future) }
                            ].filter(d => d.value > 0)} 
                            metric="value" 
                            total={soStats.totalBalance.val} 
                            centerLabelOverride="Status"
                          />
                      </div>
                  </div>
              </div>

              {/* 3. Analysis Table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-purple-600" /> Delivery Schedule Analysis (FIFO)
                      </h3>
                  </div>
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase">
                              <th className="py-3 px-4 w-1/3">Category</th>
                              <th className="py-3 px-4 text-center bg-green-50/50 border-l border-r border-green-100 text-green-700">Stock Available</th>
                              <th className="py-3 px-4 text-center bg-red-50/50 text-red-700">Need to Arrange</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                          {/* Row 1: Due for Delivery */}
                          <tr className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-4 px-4">
                                  <div className="flex items-center gap-2">
                                      <div className="bg-red-100 p-1.5 rounded text-red-600"><AlertCircle className="w-4 h-4" /></div>
                                      <div>
                                          <p className="font-bold text-gray-800">Due for Delivery</p>
                                          <p className="text-[10px] text-gray-500">Overdue or Due this Month</p>
                                      </div>
                                  </div>
                              </td>
                              <td className="py-4 px-4 text-center bg-green-50/10 border-l border-r border-gray-100">
                                  <div className="flex flex-col items-center">
                                      <span className="font-bold text-green-700">{formatCurrency(soStats.due.available.val)}</span>
                                      <span className="text-xs font-medium text-green-600">Qty: {soStats.due.available.qty.toLocaleString()}</span>
                                  </div>
                              </td>
                              <td className="py-4 px-4 text-center bg-red-50/10">
                                  <div className="flex flex-col items-center">
                                      <span className="font-bold text-red-700">{formatCurrency(soStats.due.shortage.val)}</span>
                                      <span className="text-xs font-medium text-red-600">Qty: {soStats.due.shortage.qty.toLocaleString()}</span>
                                  </div>
                              </td>
                          </tr>

                          {/* Row 2: Scheduled */}
                          <tr className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-4 px-4">
                                  <div className="flex items-center gap-2">
                                      <div className="bg-blue-100 p-1.5 rounded text-blue-600"><Clock className="w-4 h-4" /></div>
                                      <div>
                                          <p className="font-bold text-gray-800">Scheduled</p>
                                          <p className="text-[10px] text-gray-500">Future Orders (Next Month+)</p>
                                      </div>
                                  </div>
                              </td>
                              <td className="py-4 px-4 text-center bg-green-50/10 border-l border-r border-gray-100">
                                  <div className="flex flex-col items-center">
                                      <span className="font-bold text-green-700">{formatCurrency(soStats.scheduled.available.val)}</span>
                                      <span className="text-xs font-medium text-green-600">Qty: {soStats.scheduled.available.qty.toLocaleString()}</span>
                                  </div>
                              </td>
                              <td className="py-4 px-4 text-center bg-red-50/10">
                                  <div className="flex flex-col items-center">
                                      <span className="font-bold text-red-700">{formatCurrency(soStats.scheduled.shortage.val)}</span>
                                      <span className="text-xs font-medium text-red-600">Qty: {soStats.scheduled.shortage.qty.toLocaleString()}</span>
                                  </div>
                              </td>
                          </tr>
                      </tbody>
                  </table>
              </div>

              {/* 4. Top 10 Customer Groups Table (Collapsible) */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-600" /> Top 10 Customer Groups - Pending Orders
                      </h3>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase">
                                  <th className="py-3 px-4 border-r border-gray-200 w-1/3" rowSpan={2}>Customer Group</th>
                                  <th className="py-2 px-4 text-center border-b border-r border-gray-200 bg-red-50/30 text-red-800" colSpan={2}>Due for Delivery</th>
                                  <th className="py-2 px-4 text-center border-b border-gray-200 bg-blue-50/30 text-blue-800" colSpan={2}>Scheduled</th>
                                  <th className="py-3 px-4 text-right border-l border-gray-200" rowSpan={2}>Total Value</th>
                              </tr>
                              <tr className="bg-gray-50 border-b border-gray-100 text-[9px] font-bold text-gray-500 uppercase">
                                  <th className="py-2 px-4 text-right border-r border-gray-200 bg-red-50/10">Qty</th>
                                  <th className="py-2 px-4 text-right border-r border-gray-200 bg-red-50/10">Amount</th>
                                  <th className="py-2 px-4 text-right border-r border-gray-200 bg-blue-50/10">Qty</th>
                                  <th className="py-2 px-4 text-right bg-blue-50/10">Amount</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-xs">
                              {topPendingGroups.map((group, idx) => {
                                  const isExpanded = expandedPendingGroups.has(group.groupName);
                                  return (
                                      <React.Fragment key={idx}>
                                          {/* Group Row */}
                                          <tr 
                                            className="hover:bg-gray-50 transition-colors cursor-pointer bg-gray-50/30 font-semibold"
                                            onClick={() => togglePendingGroup(group.groupName)}
                                          >
                                              <td className="py-3 px-4 text-gray-900 border-r border-gray-100 flex items-center gap-2">
                                                  <button className="text-gray-500 hover:text-blue-600">
                                                      {isExpanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                                  </button>
                                                  {group.groupName}
                                              </td>
                                              <td className="py-3 px-4 text-right text-gray-600 border-r border-gray-100 bg-red-50/5">
                                                  {group.due.qty.toLocaleString()}
                                              </td>
                                              <td className="py-3 px-4 text-right text-red-700 border-r border-gray-100 bg-red-50/5">
                                                  {formatCurrency(group.due.val)}
                                              </td>
                                              <td className="py-3 px-4 text-right text-gray-600 border-r border-gray-100 bg-blue-50/5">
                                                  {group.scheduled.qty.toLocaleString()}
                                              </td>
                                              <td className="py-3 px-4 text-right text-blue-700 bg-blue-50/5">
                                                  {formatCurrency(group.scheduled.val)}
                                              </td>
                                              <td className="py-3 px-4 text-right text-gray-900 font-bold border-l border-gray-100">
                                                  {formatCurrency(group.totalVal)}
                                              </td>
                                          </tr>

                                          {/* Expanded Customer Details */}
                                          {isExpanded && group.customers.map((cust: any, cIdx: number) => (
                                              <tr key={`${idx}-${cIdx}`} className="bg-white hover:bg-gray-50 transition-colors animate-in slide-in-from-top-1 duration-200">
                                                  <td className="py-2 px-4 pl-10 text-gray-600 border-r border-gray-100 text-[11px] truncate" title={cust.custName}>
                                                      {cust.custName}
                                                  </td>
                                                  <td className="py-2 px-4 text-right text-gray-500 border-r border-gray-100 text-[11px]">
                                                      {cust.due.qty.toLocaleString()}
                                                  </td>
                                                  <td className="py-2 px-4 text-right text-gray-600 border-r border-gray-100 text-[11px]">
                                                      {formatCurrency(cust.due.val)}
                                                  </td>
                                                  <td className="py-2 px-4 text-right text-gray-500 border-r border-gray-100 text-[11px]">
                                                      {cust.scheduled.qty.toLocaleString()}
                                                  </td>
                                                  <td className="py-2 px-4 text-right text-gray-600 text-[11px]">
                                                      {formatCurrency(cust.scheduled.val)}
                                                  </td>
                                                  <td className="py-2 px-4 text-right text-gray-800 font-medium border-l border-gray-100 text-[11px]">
                                                      {formatCurrency(cust.totalVal)}
                                                  </td>
                                              </tr>
                                          ))}
                                      </React.Fragment>
                                  );
                              })}
                              {topPendingGroups.length === 0 && (
                                  <tr>
                                      <td colSpan={6} className="py-8 text-center text-gray-400">No pending orders found.</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
        ) : (
            // Placeholder for PO
            <div className="flex items-center justify-center h-64 text-gray-400 italic">
                {activeSubTab === 'po' && "Pending PO details available in 'Pending PO' tab."}
            </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
