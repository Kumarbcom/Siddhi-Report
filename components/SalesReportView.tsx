import React, { useRef, useState, useMemo, useEffect } from 'react';
import { SalesReportItem, Material, CustomerMasterItem } from '../types';
import { Trash2, Download, Upload, Search, ArrowUpDown, ArrowUp, ArrowDown, FileBarChart, AlertTriangle, UserX, PackageX, Users, Package, FileWarning, FileDown, Loader2, ChevronLeft, ChevronRight, Filter, Calendar, CalendarRange, Layers, TrendingUp, TrendingDown, Minus, UserCheck } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface SalesReportViewProps {
  items: SalesReportItem[];
  materials: Material[];
  customers: CustomerMasterItem[];
  onBulkAdd: (items: Omit<SalesReportItem, 'id' | 'createdAt'>[]) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

// Extend the base type to include derived fields for sorting/display
type EnrichedSalesItem = SalesReportItem & {
  custGroup: string;
  salesRep: string;
  custStatus: string;
  custType: string;
  make: string;
  matGroup: string;
  isCustUnknown: boolean;
  isMatUnknown: boolean;
  // Date helpers
  fiscalYear: string; 
  fiscalMonthIndex: number; // 0 = April, 11 = March
  weekNumber: number;
};

type SortKey = keyof EnrichedSalesItem;
type TimeViewMode = 'FY' | 'MONTH' | 'WEEK';

const SalesReportView: React.FC<SalesReportViewProps> = ({ 
  items, 
  materials,
  customers,
  onBulkAdd, 
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // --- New Filter States ---
  const [selectedFY, setSelectedFY] = useState<string>('');
  const [timeView, setTimeView] = useState<TimeViewMode>('FY');
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = April
  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Slicers
  const [slicerGroup, setSlicerGroup] = useState<string>('ALL');
  const [slicerRep, setSlicerRep] = useState<string>('ALL');
  const [slicerStatus, setSlicerStatus] = useState<string>('ALL');
  const [slicerMake, setSlicerMake] = useState<string>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Helper: Get Fiscal Year Info
  const getFiscalInfo = (date: Date) => {
    const month = date.getMonth(); // 0 (Jan) - 11 (Dec)
    const year = date.getFullYear();
    
    // Fiscal Year Calculation
    // If Month is Jan(0), Feb(1), Mar(2) -> It belongs to Previous Year's FY cycle
    const startYear = month >= 3 ? year : year - 1;
    const fiscalYear = `${startYear}-${startYear + 1}`;

    // Fiscal Month Index (0 = April, 11 = March)
    // Jan(0) -> 9, Feb(1) -> 10, Mar(2) -> 11, April(3) -> 0
    const fiscalMonthIndex = month >= 3 ? month - 3 : month + 9;

    // ISO Week Number
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);

    return { fiscalYear, fiscalMonthIndex, weekNumber };
  };

  const getFiscalMonthName = (index: number) => {
    const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    return months[index] || "";
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFY, timeView, selectedMonth, selectedWeek, slicerGroup, slicerRep, slicerStatus, slicerMake]);

  // --- Optimization: Pre-compute Lookups ---
  const materialLookup = useMemo(() => {
    const lookup = new Map<string, Material>();
    for (const m of materials) {
        if (m.partNo) lookup.set(m.partNo.toLowerCase().trim(), m);
        if (m.description) lookup.set(m.description.toLowerCase().trim(), m);
    }
    return lookup;
  }, [materials]);

  const customerLookup = useMemo(() => {
    const lookup = new Map<string, CustomerMasterItem>();
    for (const c of customers) {
        lookup.set(c.customerName.toLowerCase().trim(), c);
    }
    return lookup;
  }, [customers]);

  // --- Enrichment Logic ---
  const enrichedItems: EnrichedSalesItem[] = useMemo(() => {
    return items.map(item => {
        const cleanCust = item.customerName.toLowerCase().trim();
        const cleanPart = item.particulars.toLowerCase().trim();

        const customer = customerLookup.get(cleanCust);
        const material = materialLookup.get(cleanPart);
        
        // Parse Date safely
        let dateObj = new Date();
        if (item.date instanceof Date) dateObj = item.date;
        else if (typeof item.date === 'string') dateObj = new Date(item.date);
        else if (typeof item.date === 'number') dateObj = new Date((item.date - (25567 + 2)) * 86400 * 1000);

        const { fiscalYear, fiscalMonthIndex, weekNumber } = getFiscalInfo(dateObj);

        return {
            ...item,
            custGroup: customer?.group || 'Unassigned',
            salesRep: customer?.salesRep || 'Unassigned',
            custStatus: customer?.status || 'Unknown',
            custType: customer?.customerGroup || '',
            make: material?.make || 'Unspecified',
            matGroup: material?.materialGroup || '',
            isCustUnknown: !customer && !!item.customerName,
            isMatUnknown: !material && !!item.particulars,
            fiscalYear,
            fiscalMonthIndex,
            weekNumber
        };
    });
  }, [items, customerLookup, materialLookup]);

  // --- Dynamic Options for Slicers ---
  const options = useMemo(() => {
      const fys = Array.from(new Set(enrichedItems.map(i => i.fiscalYear))).sort().reverse();
      const groups = Array.from(new Set(enrichedItems.map(i => i.custGroup))).sort();
      const reps = Array.from(new Set(enrichedItems.map(i => i.salesRep))).sort();
      const statuses = Array.from(new Set(enrichedItems.map(i => i.custStatus))).sort();
      const makes = Array.from(new Set(enrichedItems.map(i => i.make))).sort();
      
      return { fys, groups, reps, statuses, makes };
  }, [enrichedItems]);

  // Set Default FY if not set
  useEffect(() => {
      if (!selectedFY && options.fys.length > 0) {
          setSelectedFY(options.fys[0]);
      }
  }, [options.fys, selectedFY]);

  // --- Comparative Stats Logic ---
  const comparisonStats = useMemo(() => {
      if (!selectedFY) return null;

      const startYear = parseInt(selectedFY.split('-')[0]);
      const prevFY = `${startYear - 1}-${startYear}`;

      const getMetricsForFY = (fy: string) => {
          const data = enrichedItems.filter(i => {
              // Strict FY filter
              if (i.fiscalYear !== fy) return false;
              // Apply active slicers to comparison as well for apples-to-apples comparison
              if (slicerGroup !== 'ALL' && i.custGroup !== slicerGroup) return false;
              if (slicerRep !== 'ALL' && i.salesRep !== slicerRep) return false;
              if (slicerStatus !== 'ALL' && i.custStatus !== slicerStatus) return false;
              if (slicerMake !== 'ALL' && i.make !== slicerMake) return false;
              return true;
          });

          const totalValue = data.reduce((acc, i) => acc + i.value, 0);
          
          const uniqueCustomerNames = Array.from(new Set(data.map(i => i.customerName)));
          const uniqueCustomersCount = uniqueCustomerNames.length;
          
          let activeCustomersCount = 0;
          uniqueCustomerNames.forEach(name => {
              const cust = customerLookup.get(name.toLowerCase().trim());
              if (cust && cust.status.toLowerCase() === 'active') activeCustomersCount++;
          });

          return { totalValue, uniqueCustomersCount, activeCustomersCount, dataCount: data.length };
      };

      const curr = getMetricsForFY(selectedFY);
      const prev = getMetricsForFY(prevFY);

      return { curr, prev, prevFY };
  }, [enrichedItems, selectedFY, slicerGroup, slicerRep, slicerStatus, slicerMake, customerLookup]);

  // --- Filtering Logic for Table ---
  const processedItems = useMemo(() => {
    let data = [...enrichedItems];

    // 1. Fiscal Year Filter
    if (selectedFY) {
        data = data.filter(i => i.fiscalYear === selectedFY);
    }

    // 2. Time View Filter
    if (timeView === 'MONTH') {
        data = data.filter(i => i.fiscalMonthIndex === selectedMonth);
    } else if (timeView === 'WEEK') {
        data = data.filter(i => i.weekNumber === selectedWeek);
    }

    // 3. Slicers
    if (slicerGroup !== 'ALL') data = data.filter(i => i.custGroup === slicerGroup);
    if (slicerRep !== 'ALL') data = data.filter(i => i.salesRep === slicerRep);
    if (slicerStatus !== 'ALL') data = data.filter(i => i.custStatus === slicerStatus);
    if (slicerMake !== 'ALL') data = data.filter(i => i.make === slicerMake);

    // 4. Search
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        data = data.filter(i => 
            i.customerName.toLowerCase().includes(lower) || 
            i.particulars.toLowerCase().includes(lower) ||
            i.voucherNo.toLowerCase().includes(lower)
        );
    }

    // 5. Sorting
    if (sortConfig) {
        data.sort((a, b) => {
            // @ts-ignore
            const valA = a[sortConfig.key];
            // @ts-ignore
            const valB = b[sortConfig.key];
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return data;
  }, [enrichedItems, selectedFY, timeView, selectedMonth, selectedWeek, slicerGroup, slicerRep, slicerStatus, slicerMake, searchTerm, sortConfig]);

  // --- Pagination Logic ---
  const totalPages = Math.ceil(processedItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return processedItems.slice(start, start + itemsPerPage);
  }, [processedItems, currentPage, itemsPerPage]);

  // --- Handlers & Formatting ---
  const formatDateDisplay = (dateVal: string | Date | number) => {
    if (!dateVal) return '-';
    let date: Date | null = null;
    if (dateVal instanceof Date) date = dateVal;
    else if (typeof dateVal === 'string') date = new Date(dateVal);
    else if (typeof dateVal === 'number') date = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
    
    if (date && !isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    }
    return String(dateVal);
  };

  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;
  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'bg-green-100 text-green-700 border-green-200';
    if (s === 'inactive' || s === 'blocked') return 'bg-red-100 text-red-700 border-red-200';
    return 'text-gray-500';
  };

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />;
  };

  // --- File Handlers (Keep existing logic) ---
  const handleDownloadTemplate = () => { /* ...existing logic... */ 
      const headers = [{ "Date": "2023-10-01", "Customer Name": "ABC Corp", "Particulars": "Item", "Voucher No.": "INV-001", "Quantity": 1, "Value": 1000 }];
      const ws = utils.json_to_sheet(headers);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Template");
      writeFile(wb, "Sales_Report_Template.xlsx");
  };
  
  const handleExportAll = () => { /* ...existing logic... */ 
      if (processedItems.length === 0) { alert("No data"); return; }
      const exportData = processedItems.map(item => ({
        "Date": formatDateDisplay(item.date),
        "Fiscal Year": item.fiscalYear,
        "Customer": item.customerName,
        "Particulars": item.particulars,
        "Value": item.value
      }));
      const ws = utils.json_to_sheet(exportData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Sales_Export");
      writeFile(wb, "Sales_Export.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      setIsProcessing(true);
      setTimeout(async () => {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const wb = read(arrayBuffer);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = utils.sheet_to_json<any>(ws, { cellDates: true, dateNF: 'yyyy-mm-dd' });
            const newItems: any[] = [];
            data.forEach((row: any) => {
                 const getVal = (keys: string[]) => { for (const k of keys) { const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase()); if (foundKey) return row[foundKey]; } return ''; };
                 const customerName = String(getVal(['customer name', 'customer']) || '');
                 const particulars = String(getVal(['particulars', 'item']) || '');
                 const voucherNo = String(getVal(['voucher no']) || '');
                 const value = parseFloat(getVal(['value', 'amount'])) || 0;
                 const quantity = parseFloat(getVal(['quantity', 'qty'])) || 0;
                 const date = getVal(['date', 'dt']); 
                 if(customerName) newItems.push({ date, customerName, particulars, voucherNo, quantity, value, consignee: '', voucherRefNo: '' });
            });
            if(newItems.length > 0) onBulkAdd(newItems);
          } catch(e) { console.error(e); alert("Error parsing file"); }
          finally { setIsProcessing(false); if(fileInputRef.current) fileInputRef.current.value=''; }
      }, 100);
  };

  // --- Helper Component for Trend Badge ---
  const TrendBadge = ({ curr, prev }: { curr: number, prev: number }) => {
     if (prev === 0) return <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">First Year</span>;
     
     const diff = curr - prev;
     const pct = (diff / prev) * 100;
     const isPositive = diff >= 0;
     
     return (
        <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(pct).toFixed(1)}%</span>
            <span className="opacity-75 font-normal">vs {formatCurrency(Math.abs(diff))}</span>
        </div>
     );
  };
  
  const CountTrendBadge = ({ curr, prev }: { curr: number, prev: number }) => {
     if (prev === 0) return <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">New</span>;
     const diff = curr - prev;
     const isPositive = diff >= 0;
     return (
        <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            <span>{Math.abs(diff)}</span>
        </div>
     );
  };

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* 1. Comparative Dashboard (Top Label) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
          
          {/* Card 1: Sales Value */}
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
             <div className="flex justify-between items-start mb-1">
                 <p className="text-[10px] text-gray-500 font-medium uppercase">Sales Value</p>
                 <span className="text-[9px] text-gray-400 font-mono">{selectedFY}</span>
             </div>
             <p className="text-xl font-bold text-indigo-700">{comparisonStats ? formatCurrency(comparisonStats.curr.totalValue) : '-'}</p>
             <div className="mt-2 flex items-center justify-between">
                {comparisonStats && <TrendBadge curr={comparisonStats.curr.totalValue} prev={comparisonStats.prev.totalValue} />}
                <span className="text-[9px] text-gray-400">vs {comparisonStats?.prevFY}</span>
             </div>
          </div>

          {/* Card 2: Unique Customers */}
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
             <div className="flex justify-between items-start mb-1">
                 <p className="text-[10px] text-gray-500 font-medium uppercase">No. of Customers</p>
                 <Users className="w-3.5 h-3.5 text-blue-400" />
             </div>
             <p className="text-xl font-bold text-gray-900">{comparisonStats?.curr.uniqueCustomersCount}</p>
             <div className="mt-2 flex items-center gap-2">
                 {comparisonStats && <CountTrendBadge curr={comparisonStats.curr.uniqueCustomersCount} prev={comparisonStats.prev.uniqueCustomersCount} />}
                 <span className="text-[9px] text-gray-400">vs {comparisonStats?.prev.uniqueCustomersCount} last yr</span>
             </div>
          </div>

          {/* Card 3: Active Status Breakup */}
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
             <div className="flex justify-between items-start mb-1">
                 <p className="text-[10px] text-gray-500 font-medium uppercase">Active Customers</p>
                 <UserCheck className="w-3.5 h-3.5 text-green-500" />
             </div>
             <p className="text-xl font-bold text-gray-900">{comparisonStats?.curr.activeCustomersCount}</p>
             <div className="mt-2 flex items-center gap-2">
                 {comparisonStats && <CountTrendBadge curr={comparisonStats.curr.activeCustomersCount} prev={comparisonStats.prev.activeCustomersCount} />}
                 <span className="text-[9px] text-gray-400">Active count trend</span>
             </div>
          </div>

          {/* Card 4: Current Selection Indicator */}
          <div className="p-3 rounded-xl shadow-sm border bg-gray-50 border-gray-200 flex flex-col justify-center items-center text-center">
              <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5"><Filter className="w-3 h-3" /> View Mode</span>
              <p className="text-sm font-bold text-gray-800 mt-1">{timeView === 'FY' ? 'Full Fiscal Year' : (timeView === 'MONTH' ? `${getFiscalMonthName(selectedMonth)} (Month)` : `Week ${selectedWeek}`)}</p>
              {slicerGroup !== 'ALL' || slicerRep !== 'ALL' ? (
                  <span className="text-[9px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-1 border border-blue-100">Filtered View</span>
              ) : <span className="text-[9px] text-gray-400 mt-1">Global View</span>}
          </div>
      </div>

      {/* 2. CONTROL PANEL (Date & Slicers) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0">
         
         {/* Row 1: Time Controls */}
         <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center border-b border-gray-100 pb-4 w-full">
            
            {/* Fiscal Year Selector */}
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                <span className="text-xs font-bold text-gray-700 px-2">Fiscal Year:</span>
                <select 
                    value={selectedFY} 
                    onChange={(e) => setSelectedFY(e.target.value)}
                    className="bg-white border border-gray-300 text-sm rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                >
                    {options.fys.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                </select>
            </div>

            <div className="w-px h-8 bg-gray-200 hidden lg:block"></div>

            {/* View Mode Toggles */}
            <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setTimeView('FY')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeView === 'FY' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Full Year
                    </button>
                    <button 
                        onClick={() => setTimeView('MONTH')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeView === 'MONTH' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Month
                    </button>
                    <button 
                        onClick={() => setTimeView('WEEK')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeView === 'WEEK' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Week
                    </button>
                </div>

                {/* Specific Period Selector */}
                {timeView === 'MONTH' && (
                    <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="bg-white border border-gray-300 text-xs rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 animate-in fade-in slide-in-from-left-2 duration-200"
                    >
                        {[0,1,2,3,4,5,6,7,8,9,10,11].map(idx => (
                            <option key={idx} value={idx}>{getFiscalMonthName(idx)}</option>
                        ))}
                    </select>
                )}
                {timeView === 'WEEK' && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                        <span className="text-xs text-gray-500">Week:</span>
                        <input 
                            type="number" 
                            min={1} 
                            max={53} 
                            value={selectedWeek} 
                            onChange={(e) => setSelectedWeek(Number(e.target.value))}
                            className="w-16 bg-white border border-gray-300 text-xs rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                )}
            </div>
         </div>

         {/* Row 2: Slicers */}
         <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mr-2">
                <Filter className="w-3.5 h-3.5" /> Slicers:
            </div>
            
            {/* Group Slicer */}
            <div className="flex flex-col gap-0.5">
                <label className="text-[9px] text-gray-400 font-semibold uppercase">Group</label>
                <select 
                    value={slicerGroup} 
                    onChange={(e) => setSlicerGroup(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-32 outline-none focus:ring-1 focus:ring-blue-500 truncate"
                >
                    <option value="ALL">All Groups</option>
                    {options.groups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
            </div>

            {/* Rep Slicer */}
            <div className="flex flex-col gap-0.5">
                <label className="text-[9px] text-gray-400 font-semibold uppercase">Sales Rep</label>
                <select 
                    value={slicerRep} 
                    onChange={(e) => setSlicerRep(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-32 outline-none focus:ring-1 focus:ring-blue-500 truncate"
                >
                    <option value="ALL">All Reps</option>
                    {options.reps.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>

            {/* Status Slicer */}
            <div className="flex flex-col gap-0.5">
                <label className="text-[9px] text-gray-400 font-semibold uppercase">Status</label>
                <select 
                    value={slicerStatus} 
                    onChange={(e) => setSlicerStatus(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-28 outline-none focus:ring-1 focus:ring-blue-500"
                >
                    <option value="ALL">All Status</option>
                    {options.statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {/* Make Slicer */}
            <div className="flex flex-col gap-0.5">
                <label className="text-[9px] text-gray-400 font-semibold uppercase">Make</label>
                <select 
                    value={slicerMake} 
                    onChange={(e) => setSlicerMake(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-32 outline-none focus:ring-1 focus:ring-blue-500 truncate"
                >
                    <option value="ALL">All Makes</option>
                    {options.makes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>

             {/* Reset Filters */}
             {(slicerGroup !== 'ALL' || slicerRep !== 'ALL' || slicerStatus !== 'ALL' || slicerMake !== 'ALL') && (
                 <button 
                    onClick={() => { setSlicerGroup('ALL'); setSlicerRep('ALL'); setSlicerStatus('ALL'); setSlicerMake('ALL'); }}
                    className="mt-4 px-3 py-1 bg-red-50 text-red-600 rounded text-xs font-medium border border-red-100 hover:bg-red-100"
                 >
                     Reset Filters
                 </button>
             )}
         </div>
      </div>

      {/* 3. Action Bar (Search/Export) */}
      <div className="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex-shrink-0">
          <div className="relative w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div>
            <input type="text" placeholder="Search filtered results..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
         </div>
         <div className="flex gap-2">
            <button onClick={handleExportAll} disabled={isProcessing} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium border border-gray-300 hover:bg-gray-50"><FileDown className="w-3.5 h-3.5" /> Export View</button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-100 hover:bg-blue-100"><Upload className="w-3.5 h-3.5" /> Import</button>
            <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /> Clear</button>
         </div>
      </div>

      {/* 4. Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse min-w-full relative">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('date')}>Date {renderSortIcon('date')}</th>
                        <th className="py-2 px-3 text-center">FY</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('customerName')}>Customer {renderSortIcon('customerName')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('custGroup')}>Group {renderSortIcon('custGroup')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('salesRep')}>Rep {renderSortIcon('salesRep')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('custStatus')}>Status {renderSortIcon('custStatus')}</th>
                        
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-orange-50/50 w-56" onClick={() => handleSort('particulars')}>Particulars {renderSortIcon('particulars')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-orange-50/50" onClick={() => handleSort('make')}>Make {renderSortIcon('make')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('voucherNo')}>Voucher {renderSortIcon('voucherNo')}</th>
                        <th className="py-2 px-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('quantity')}>Qty {renderSortIcon('quantity')}</th>
                        <th className="py-2 px-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('value')}>Value {renderSortIcon('value')}</th>
                        <th className="py-2 px-3 text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs text-gray-700">
                    {paginatedItems.length === 0 ? (
                        <tr><td colSpan={12} className="py-8 text-center text-gray-500">
                            No matching records found for the selected period/filters.
                        </td></tr>
                    ) : (
                        paginatedItems.map(item => {
                            return (
                                <tr key={item.id} className="hover:bg-blue-50/20 transition-colors">
                                    <td className="py-2 px-3 whitespace-nowrap text-gray-500">{formatDateDisplay(item.date)}</td>
                                    <td className="py-2 px-3 text-[9px] text-gray-400 whitespace-nowrap text-center">{item.fiscalYear}</td>
                                    
                                    {/* Customer Info */}
                                    <td className="py-2 px-3 max-w-[150px] bg-blue-50/20">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900 truncate" title={item.customerName}>{item.customerName}</span>
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 bg-blue-50/20 text-gray-600 truncate max-w-[100px]" title={item.custGroup}>{item.custGroup || '-'}</td>
                                    <td className="py-2 px-3 bg-blue-50/20 text-gray-600 truncate max-w-[100px]" title={item.salesRep}>{item.salesRep || '-'}</td>
                                    <td className="py-2 px-3 bg-blue-50/20">
                                        {item.custStatus ? (
                                            <span className={`inline-block px-1.5 py-px rounded text-[9px] font-medium border ${getStatusColor(item.custStatus)}`}>
                                                {item.custStatus}
                                            </span>
                                        ) : <span className="text-gray-400">-</span>}
                                    </td>

                                    {/* Material Info */}
                                    <td className="py-2 px-3 max-w-[200px] bg-orange-50/20">
                                        <div className="flex flex-col">
                                            <span className="truncate text-gray-800" title={item.particulars}>{item.particulars}</span>
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 bg-orange-50/20 text-gray-600 truncate max-w-[80px]">{item.make || '-'}</td>

                                    {/* Sales Data */}
                                    <td className="py-2 px-3 text-gray-500 font-mono text-[10px] whitespace-nowrap">{item.voucherNo}</td>
                                    <td className="py-2 px-3 text-right font-medium">{item.quantity}</td>
                                    <td className="py-2 px-3 text-right font-bold text-gray-900 whitespace-nowrap">{formatCurrency(item.value)}</td>
                                    <td className="py-2 px-3 text-right">
                                        <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
         </div>
         
         {/* Pagination Footer */}
         <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center flex-shrink-0">
             <div className="flex items-center gap-2">
                 <span>Rows per page:</span>
                 <select 
                    value={itemsPerPage} 
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="bg-white border border-gray-300 rounded text-xs py-0.5 px-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                 >
                     <option value={50}>50</option>
                     <option value={100}>100</option>
                     <option value={500}>500</option>
                     <option value={1000}>1000</option>
                 </select>
                 <span className="ml-2">
                    Showing {paginatedItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, processedItems.length)} of {processedItems.length}
                 </span>
             </div>
             <div className="flex items-center gap-1">
                 <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                     <ChevronLeft className="w-4 h-4" />
                 </button>
                 <span className="px-2">Page {currentPage} of {Math.max(1, totalPages)}</span>
                 <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                     <ChevronRight className="w-4 h-4" />
                 </button>
             </div>
         </div>
      </div>
    </div>
  );
};

export default SalesReportView;