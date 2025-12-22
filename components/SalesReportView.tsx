
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { SalesReportItem, Material, CustomerMasterItem } from '../types';
import { Trash2, Download, Upload, Search, ArrowUpDown, ArrowUp, ArrowDown, FileBarChart, AlertTriangle, UserX, PackageX, Users, Package, FileWarning, FileDown, Loader2, ChevronLeft, ChevronRight, Filter, Calendar, CalendarRange, Layers, TrendingUp, TrendingDown, Minus, UserCheck, Target, BarChart2, AlertOctagon, DollarSign, Pencil, Save, X } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface SalesReportViewProps {
  items: SalesReportItem[];
  materials: Material[];
  customers: CustomerMasterItem[];
  onBulkAdd: (items: Omit<SalesReportItem, 'id' | 'createdAt'>[]) => void;
  onUpdate: (item: SalesReportItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

type EnrichedSalesItem = SalesReportItem & {
  custGroup: string;
  salesRep: string;
  custStatus: string;
  custType: string;
  make: string;
  matGroup: string;
  isCustUnknown: boolean;
  isMatUnknown: boolean;
  fiscalYear: string; 
  fiscalMonthIndex: number;
  weekNumber: number;
};

type SortKey = keyof EnrichedSalesItem;
type TimeViewMode = 'FY' | 'MONTH' | 'WEEK';

const SalesReportView: React.FC<SalesReportViewProps> = ({ 
  items, 
  materials,
  customers,
  onBulkAdd, 
  onUpdate,
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  const [selectedFY, setSelectedFY] = useState<string>('');
  const [timeView, setTimeView] = useState<TimeViewMode>('FY');
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [showMismatchesOnly, setShowMismatchesOnly] = useState(false);

  const [slicerGroup, setSlicerGroup] = useState<string>('ALL');
  const [slicerRep, setSlicerRep] = useState<string>('ALL');
  const [slicerStatus, setSlicerStatus] = useState<string>('ALL');
  const [slicerMake, setSlicerMake] = useState<string>('ALL');
  const [slicerMatGroup, setSlicerMatGroup] = useState<string>('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SalesReportItem | null>(null);

  const handleEditClick = (item: SalesReportItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (editForm) {
      onUpdate(editForm);
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleInputChange = (field: keyof SalesReportItem, value: any) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  const getFiscalInfo = (date: Date) => { const month = date.getMonth(); const year = date.getFullYear(); const startYear = month >= 3 ? year : year - 1; const fiscalYear = `${startYear}-${startYear + 1}`; const fiscalMonthIndex = month >= 3 ? month - 3 : month + 9; const fyStart = new Date(startYear, 3, 1); const fyFirstThu = new Date(fyStart); if (fyFirstThu.getDay() <= 4) { fyFirstThu.setDate(fyFirstThu.getDate() + (4 - fyFirstThu.getDay())); } else { fyFirstThu.setDate(fyFirstThu.getDate() + (4 - fyFirstThu.getDay() + 7)); } const checkDate = new Date(date); checkDate.setHours(0,0,0,0); const baseDate = new Date(fyFirstThu); baseDate.setHours(0,0,0,0); const diffTime = checkDate.getTime() - baseDate.getTime(); const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); const weekNumber = diffDays >= 0 ? Math.floor(diffDays / 7) + 2 : 1; return { fiscalYear, fiscalMonthIndex, weekNumber }; };
  const getFiscalMonthName = (index: number) => ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"][index] || "";
  const getWeekRangeString = (fy: string, weekNum: number) => { if (!fy) return ''; const startYear = parseInt(fy.split('-')[0]); const fyStart = new Date(startYear, 3, 1); let firstThu = new Date(fyStart); if (firstThu.getDay() <= 4) firstThu.setDate(firstThu.getDate() + (4 - firstThu.getDay())); else firstThu.setDate(firstThu.getDate() + (4 - firstThu.getDay() + 7)); const weekStartDate = new Date(firstThu); weekStartDate.setDate(weekStartDate.getDate() + (weekNum - 2) * 7); let displayStart = new Date(weekStartDate); if (weekNum === 1) displayStart = new Date(startYear, 3, 1); const displayEnd = new Date(displayStart); if (weekNum === 1) { displayEnd.setTime(firstThu.getTime() - 86400000); } else { displayEnd.setDate(displayStart.getDate() + 6); } const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); return `${fmt(displayStart)} - ${fmt(displayEnd)}`; };

  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedFY, timeView, selectedMonth, selectedWeek, slicerGroup, slicerRep, slicerStatus, slicerMake, slicerMatGroup, showMismatchesOnly]);

  const materialLookup = useMemo(() => { const lookup = new Map<string, Material>(); for (const m of materials) { if (m.partNo) lookup.set(m.partNo.toLowerCase().trim(), m); if (m.description) lookup.set(m.description.toLowerCase().trim(), m); } return lookup; }, [materials]);
  const customerLookup = useMemo(() => { const lookup = new Map<string, CustomerMasterItem>(); for (const c of customers) { lookup.set(c.customerName.toLowerCase().trim(), c); } return lookup; }, [customers]);

  const enrichedItems: EnrichedSalesItem[] = useMemo(() => {
    return items.map(item => {
        const cleanCust = item.customerName.toLowerCase().trim();
        const cleanPart = item.particulars.toLowerCase().trim();
        const customer = customerLookup.get(cleanCust);
        const material = materialLookup.get(cleanPart);
        
        let dateObj = new Date(); 
        const rawDate = item.date as any;
        if (rawDate instanceof Date) {
            dateObj = rawDate;
        } else if (typeof rawDate === 'string') {
            dateObj = new Date(rawDate);
        } else if (typeof rawDate === 'number') {
            dateObj = new Date((rawDate - (25567 + 2)) * 86400 * 1000);
        }

        const { fiscalYear, fiscalMonthIndex, weekNumber } = getFiscalInfo(dateObj);
        return { ...item, custGroup: customer?.group || 'Unassigned', salesRep: customer?.salesRep || 'Unassigned', custStatus: customer?.status || 'Unknown', custType: customer?.customerGroup || '', make: material?.make || 'Unspecified', matGroup: material?.materialGroup || 'Unspecified', isCustUnknown: !customer && !!item.customerName, isMatUnknown: !material && !!item.particulars, fiscalYear, fiscalMonthIndex, weekNumber };
    });
  }, [items, customerLookup, materialLookup]);

  const mismatchStats = useMemo(() => { let recordsWithError = 0; const uniqueCustErrors = new Set<string>(); const uniqueMatErrors = new Set<string>(); enrichedItems.forEach(i => { let hasError = false; if (i.isCustUnknown) { uniqueCustErrors.add(i.customerName); hasError = true; } if (i.isMatUnknown) { uniqueMatErrors.add(i.particulars); hasError = true; } if (hasError) recordsWithError++; }); return { total: recordsWithError, uniqueCust: uniqueCustErrors.size, uniqueMat: uniqueMatErrors.size }; }, [enrichedItems]);
  const options = useMemo(() => { const fys = Array.from(new Set(enrichedItems.map(i => i.fiscalYear))).sort().reverse(); const groups = Array.from(new Set(enrichedItems.map(i => i.custGroup))).sort(); const reps = Array.from(new Set(enrichedItems.map(i => i.salesRep))).sort(); const statuses = Array.from(new Set(enrichedItems.map(i => i.custStatus))).sort(); const makes = Array.from(new Set(enrichedItems.map(i => i.make))).sort(); const matGroups = Array.from(new Set(enrichedItems.map(i => i.matGroup))).sort(); return { fys, groups, reps, statuses, makes, matGroups }; }, [enrichedItems]);
  useEffect(() => { if (!selectedFY && options.fys.length > 0) { setSelectedFY(options.fys[0]); } }, [options.fys, selectedFY]);

  const processedItems = useMemo(() => {
    let data = [...enrichedItems];
    if (showMismatchesOnly) { data = data.filter(i => i.isCustUnknown || i.isMatUnknown); } else { if (selectedFY) data = data.filter(i => i.fiscalYear === selectedFY); if (timeView === 'MONTH') { data = data.filter(i => i.fiscalMonthIndex === selectedMonth); } else if (timeView === 'WEEK') { data = data.filter(i => i.weekNumber === selectedWeek); } }
    if (slicerGroup !== 'ALL') data = data.filter(i => i.custGroup === slicerGroup); if (slicerRep !== 'ALL') data = data.filter(i => i.salesRep === slicerRep); if (slicerStatus !== 'ALL') data = data.filter(i => i.custStatus === slicerStatus); if (slicerMake !== 'ALL') data = data.filter(i => i.make === slicerMake); if (slicerMatGroup !== 'ALL') data = data.filter(i => i.matGroup === slicerMatGroup);
    if (searchTerm) { const lower = searchTerm.toLowerCase(); data = data.filter(i => i.customerName.toLowerCase().includes(lower) || i.particulars.toLowerCase().includes(lower) || i.voucherNo.toLowerCase().includes(lower)); }
    if (sortConfig) { data.sort((a, b) => { const valA = a[sortConfig.key] as any; const valB = b[sortConfig.key] as any; if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }); }
    return data;
  }, [enrichedItems, selectedFY, timeView, selectedMonth, selectedWeek, slicerGroup, slicerRep, slicerStatus, slicerMake, slicerMatGroup, searchTerm, sortConfig, showMismatchesOnly]);

  const totals = useMemo(() => { return processedItems.reduce((acc, item) => ({ qty: acc.qty + item.quantity, val: acc.val + item.value }), { qty: 0, val: 0 }); }, [processedItems]);
  const totalPages = Math.ceil(processedItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => { const start = (currentPage - 1) * itemsPerPage; return processedItems.slice(start, start + itemsPerPage); }, [processedItems, currentPage, itemsPerPage]);

  const formatDateDisplay = (dateVal: string | Date | number) => { if (!dateVal) return '-'; let date: Date | null = null; if (dateVal instanceof Date) date = dateVal; else if (typeof dateVal === 'string') date = new Date(dateVal); else if (typeof dateVal === 'number') date = new Date((dateVal - (25567 + 2)) * 86400 * 1000); if (date && !isNaN(date.getTime())) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date); } return String(dateVal); };
  const formatInputDate = (dateVal: string | Date | number) => { if (!dateVal) return ''; let date: Date | null = null; if (dateVal instanceof Date) date = dateVal; else if (typeof dateVal === 'string') date = new Date(dateVal); else if (typeof dateVal === 'number') date = new Date((dateVal - (25567 + 2)) * 86400 * 1000); if (date && !isNaN(date.getTime())) return date.toISOString().split('T')[0]; return ''; };
  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;
  const getStatusColor = (status: string) => { const s = (status || '').toLowerCase(); if (s === 'active') return 'bg-green-100 text-green-700 border-green-200'; if (s === 'inactive' || s === 'blocked') return 'bg-red-100 text-red-700 border-red-200'; return 'text-gray-500'; };
  const handleSort = (key: SortKey) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  const renderSortIcon = (key: SortKey) => { if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />; return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />; };

  const handleDownloadTemplate = () => { const headers = [{ "Date": "2023-10-01", "Customer Name": "ABC Corp", "Particulars": "Item", "Voucher No.": "INV-001", "Quantity": 1, "Value": 1000 }]; const ws = utils.json_to_sheet(headers); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Template"); writeFile(wb, "Sales_Report_Template.xlsx"); };
  const handleExportAll = () => { if (processedItems.length === 0) { alert("No data"); return; } const exportData = processedItems.map(item => ({ "Date": formatDateDisplay(item.date), "Fiscal Year": item.fiscalYear, "Customer Name": item.customerName, "Customer Group": item.custGroup, "Sales Rep": item.salesRep, "Status": item.custStatus, "Particulars": item.particulars, "Make": item.make, "Material Group": item.matGroup, "Voucher No": item.voucherNo, "Quantity": item.quantity, "Value": item.value })); const ws = utils.json_to_sheet(exportData); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Sales_Export"); writeFile(wb, "Sales_Export.xlsx"); };
  const handleExportMismatches = () => { const missingCusts = new Set<string>(); const missingMats = new Set<string>(); enrichedItems.forEach(item => { if (item.isCustUnknown) missingCusts.add(item.customerName); if (item.isMatUnknown) missingMats.add(item.particulars); }); if (missingCusts.size === 0 && missingMats.size === 0) { alert("No mismatches found."); return; } const wb = utils.book_new(); if (missingCusts.size > 0) { const custData = Array.from(missingCusts).sort().map(name => ({ "Missing Customer Name": name })); const ws = utils.json_to_sheet(custData); utils.book_append_sheet(wb, ws, "Missing_Customers"); } if (missingMats.size > 0) { const matData = Array.from(missingMats).sort().map(name => ({ "Missing Material Description": name })); const ws = utils.json_to_sheet(matData); utils.book_append_sheet(wb, ws, "Missing_Materials"); } writeFile(wb, "Master_Data_Correction_Report.xlsx"); };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if(!file) return; setIsProcessing(true); setUploadProgress(0); setStatusMessage("Reading file..."); setTimeout(async () => { try { const arrayBuffer = await file.arrayBuffer(); const wb = read(arrayBuffer, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; setStatusMessage("Parsing rows..."); const jsonData = utils.sheet_to_json<any>(ws, { cellDates: true, dateNF: 'yyyy-mm-dd' }); const totalRows = jsonData.length; const CHUNK_SIZE = 1000; const allNewItems: any[] = []; let currentIndex = 0; const processChunk = () => { const end = Math.min(currentIndex + CHUNK_SIZE, totalRows); for (let i = currentIndex; i < end; i++) { const row = jsonData[i]; let customerName = ''; let particulars = ''; let voucherNo = ''; let value = 0; let quantity = 0; let date = null; const keys = Object.keys(row); for (let k = 0; k < keys.length; k++) { const key = keys[k]; const lowerKey = key.toLowerCase(); if (lowerKey.includes('customer') || lowerKey === 'name') customerName = String(row[key]); else if (lowerKey.includes('particular') || lowerKey.includes('item')) particulars = String(row[key]); else if (lowerKey.includes('voucher')) voucherNo = String(row[key]); else if (lowerKey.includes('value') || lowerKey.includes('amount')) value = parseFloat(row[key]); else if (lowerKey.includes('quant') || lowerKey === 'qty') quantity = parseFloat(row[key]); else if (lowerKey.includes('date') || lowerKey === 'dt') date = row[key]; } if (customerName) { allNewItems.push({ date, customerName, particulars, voucherNo, quantity, value: value || 0, consignee: '', voucherRefNo: '' }); } } currentIndex = end; const progress = Math.round((currentIndex / totalRows) * 100); setUploadProgress(progress); setStatusMessage(`Processing... ${progress}%`); if (currentIndex < totalRows) { setTimeout(processChunk, 0); } else { setStatusMessage("Finalizing import..."); setTimeout(() => { if(allNewItems.length > 0) { onBulkAdd(allNewItems); } else { alert("No valid records found in the file."); } setIsProcessing(false); setUploadProgress(null); if(fileInputRef.current) fileInputRef.current.value=''; }, 50); } }; setTimeout(processChunk, 50); } catch(e) { console.error(e); alert("Error parsing file. Please check the format."); setIsProcessing(false); } }, 100);
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      {isProcessing && (<div className="absolute inset-0 z-50 bg-white/90 flex flex-col items-center justify-center backdrop-blur-sm rounded-xl"><Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" /><h3 className="text-xl font-bold text-gray-800">{statusMessage}</h3><p className="text-sm text-gray-500 mb-4">Please wait while we process {uploadProgress !== null ? 'your data' : 'the file'}...</p>{uploadProgress !== null && (<div className="w-64 bg-gray-200 rounded-full h-3"><div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div></div>)}</div>)}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${mismatchStats.total > 0 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>{mismatchStats.total > 0 ? <AlertTriangle className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}</div><div><h3 className="text-sm font-bold text-gray-800">Data Quality Check</h3><p className={`text-xs ${mismatchStats.total > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{mismatchStats.total > 0 ? `${mismatchStats.total} Records need attention (${mismatchStats.uniqueCust} Unique Customers, ${mismatchStats.uniqueMat} Unique Items)` : "All records match Master Data perfectly."}</p></div></div>
          {mismatchStats.total > 0 ? (<div className="flex gap-2"><button onClick={() => setShowMismatchesOnly(!showMismatchesOnly)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${showMismatchesOnly ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{showMismatchesOnly ? "Show All Data" : "Show Errors Only"}</button><button onClick={handleExportMismatches} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600 text-white border border-orange-700 hover:bg-orange-700 shadow-sm flex items-center gap-1.5 animate-pulse"><FileWarning className="w-3.5 h-3.5" /> Download Report</button></div>) : (<span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">100% Quality</span>)}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0">
         <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center border-b border-gray-100 pb-4 w-full">
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200"><span className="text-xs font-bold text-gray-700 px-2">Fiscal Year:</span><select value={selectedFY} onChange={(e) => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-sm rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500">{options.fys.map(fy => <option key={fy} value={fy}>{fy}</option>)}</select></div>
            <div className="w-px h-8 bg-gray-200 hidden lg:block"></div>
            <div className="flex items-center gap-2"><div className="flex bg-gray-100 p-1 rounded-lg"><button onClick={() => setTimeView('FY')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeView === 'FY' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Full Year</button><button onClick={() => setTimeView('MONTH')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeView === 'MONTH' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Month</button><button onClick={() => setTimeView('WEEK')} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeView === 'WEEK' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Week</button></div>{timeView === 'MONTH' && (<select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 animate-in fade-in slide-in-from-left-2 duration-200">{[0,1,2,3,4,5,6,7,8,9,10,11].map(idx => (<option key={idx} value={idx}>{getFiscalMonthName(idx)}</option>))}</select>)}{timeView === 'WEEK' && (<div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200"><span className="text-xs text-gray-500">Week (Thu-Wed):</span><input type="number" min={1} max={53} value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))} className="w-16 bg-white border border-gray-300 text-xs rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500" />{selectedFY && (<span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">{getWeekRangeString(selectedFY, selectedWeek)}</span>)}</div>)}</div>
         </div>
         <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mr-2"><Filter className="w-3.5 h-3.5" /> Slicers:</div>
            <div className="flex flex-col gap-0.5"><label className="text-[10px] text-gray-500 font-bold uppercase">Customer Group</label><select value={slicerGroup} onChange={(e) => setSlicerGroup(e.target.value)} className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-28 outline-none focus:ring-1 focus:ring-blue-500 truncate"><option value="ALL">All Groups</option>{options.groups.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
            <div className="flex flex-col gap-0.5"><label className="text-[10px] text-gray-500 font-bold uppercase">Sales Rep</label><select value={slicerRep} onChange={(e) => setSlicerRep(e.target.value)} className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-28 outline-none focus:ring-1 focus:ring-blue-500 truncate"><option value="ALL">All Reps</option>{options.reps.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            <div className="flex flex-col gap-0.5"><label className="text-[10px] text-gray-500 font-bold uppercase">Customer Status</label><select value={slicerStatus} onChange={(e) => setSlicerStatus(e.target.value)} className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-24 outline-none focus:ring-1 focus:ring-blue-500"><option value="ALL">All Status</option>{options.statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="flex flex-col gap-0.5"><label className="text-[10px] text-gray-500 font-bold uppercase">Make</label><select value={slicerMake} onChange={(e) => setSlicerMake(e.target.value)} className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-28 outline-none focus:ring-1 focus:ring-blue-500 truncate"><option value="ALL">All Makes</option>{options.makes.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
            <div className="flex flex-col gap-0.5"><label className="text-[10px] text-gray-500 font-bold uppercase">Material Group</label><select value={slicerMatGroup} onChange={(e) => setSlicerMatGroup(e.target.value)} className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-28 outline-none focus:ring-1 focus:ring-blue-500 truncate"><option value="ALL">All Mat Groups</option>{options.matGroups.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
             {(slicerGroup !== 'ALL' || slicerRep !== 'ALL' || slicerStatus !== 'ALL' || slicerMake !== 'ALL' || slicerMatGroup !== 'ALL') && (<button onClick={() => { setSlicerGroup('ALL'); setSlicerRep('ALL'); setSlicerStatus('ALL'); setSlicerMake('ALL'); setSlicerMatGroup('ALL'); setShowMismatchesOnly(false); }} className="mt-4 px-3 py-1 bg-red-50 text-red-600 rounded text-xs font-medium border border-red-100 hover:bg-red-100">Reset Filters</button>)}
         </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex-shrink-0 gap-3">
          <div className="flex items-center gap-3 w-full md:w-auto"><h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2 pl-1 whitespace-nowrap"><FileBarChart className="w-4 h-4 text-blue-600" /> Sales Report</h2><div className="h-6 w-px bg-gray-200 hidden md:block"></div><div className="flex items-center gap-4 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200 shadow-sm"><div className="flex flex-col"><span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Records</span><span className="text-xs font-bold text-gray-800">{processedItems.length}</span></div><div className="w-px h-6 bg-gray-300"></div><div className="flex flex-col"><span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Total Qty</span><span className="text-xs font-bold text-blue-600">{totals.qty.toLocaleString()}</span></div><div className="w-px h-6 bg-gray-300"></div><div className="flex flex-col"><span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Total Value</span><span className="text-xs font-bold text-emerald-600">{formatCurrency(totals.val)}</span></div></div></div>
         <div className="flex gap-2 w-full md:w-auto justify-end"><div className="relative w-48 hidden md:block"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div><input type="text" placeholder="Search filtered results..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div><button onClick={handleExportAll} disabled={isProcessing} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium border border-gray-300 hover:bg-gray-50"><FileDown className="w-3.5 h-3.5" /> Export</button><input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} /><button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-100 hover:bg-blue-100"><Upload className="w-3.5 h-3.5" /> Import</button><button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /></button></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse min-w-full relative">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('date')}>Date {renderSortIcon('date')}</th>
                        <th className="py-2 px-3 text-center">FY</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('customerName')}>Customer Name {renderSortIcon('customerName')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('custGroup')}>Customer Group {renderSortIcon('custGroup')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('salesRep')}>Sales Rep {renderSortIcon('salesRep')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-blue-50/50" onClick={() => handleSort('custStatus')}>Status {renderSortIcon('custStatus')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-orange-50/50 w-56" onClick={() => handleSort('particulars')}>Particulars {renderSortIcon('particulars')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-orange-50/50" onClick={() => handleSort('make')}>Make {renderSortIcon('make')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 bg-orange-50/50" onClick={() => handleSort('matGroup')}>Material Group {renderSortIcon('matGroup')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('voucherNo')}>Voucher No {renderSortIcon('voucherNo')}</th>
                        <th className="py-2 px-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('quantity')}>Quantity {renderSortIcon('quantity')}</th>
                        <th className="py-2 px-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('value')}>Value {renderSortIcon('value')}</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs text-gray-700">
                    {paginatedItems.length === 0 ? (<tr><td colSpan={13} className="py-8 text-center text-gray-500">{showMismatchesOnly ? "No data mismatches found! Data quality is perfect." : "No matching records found for the selected period/filters."}</td></tr>) : (
                        paginatedItems.map(item => {
                            return (
                                <tr key={item.id} className={`hover:bg-blue-50/20 transition-colors ${editingId === item.id ? 'bg-blue-50' : ''}`}>
                                    {editingId === item.id ? (
                                        <>
                                            <td className="py-2 px-3"><input type="date" className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={formatInputDate(editForm?.date || '')} onChange={e => handleInputChange('date', e.target.value)} /></td>
                                            <td className="py-2 px-3 text-[9px] text-gray-400 whitespace-nowrap text-center">{item.fiscalYear}</td>
                                            <td className="py-2 px-3"><input type="text" className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.customerName || ''} onChange={e => handleInputChange('customerName', e.target.value)} /></td>
                                            <td className="py-2 px-3 text-gray-600 truncate max-w-[100px]">{item.custGroup || '-'}</td>
                                            <td className="py-2 px-3 text-gray-600 truncate max-w-[100px]">{item.salesRep || '-'}</td>
                                            <td className="py-2 px-3">{item.custStatus || '-'}</td>
                                            <td className="py-2 px-3"><input type="text" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.particulars || ''} onChange={e => handleInputChange('particulars', e.target.value)} /></td>
                                            <td className="py-2 px-3 text-gray-600">{item.make || '-'}</td>
                                            <td className="py-2 px-3 text-gray-600">{item.matGroup || '-'}</td>
                                            <td className="py-2 px-3"><input type="text" className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.voucherNo || ''} onChange={e => handleInputChange('voucherNo', e.target.value)} /></td>
                                            <td className="py-2 px-3 text-right"><input type="number" className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none" value={editForm?.quantity || 0} onChange={e => handleInputChange('quantity', parseFloat(e.target.value))} /></td>
                                            <td className="py-2 px-3 text-right"><input type="number" className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none" value={editForm?.value || 0} onChange={e => handleInputChange('value', parseFloat(e.target.value))} /></td>
                                            <td className="py-2 px-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={handleSaveEdit} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"><Save className="w-3.5 h-3.5" /></button>
                                                    <button onClick={handleCancelEdit} className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="py-2 px-3 whitespace-nowrap text-gray-500">{formatDateDisplay(item.date)}</td>
                                            <td className="py-2 px-3 text-[9px] text-gray-400 whitespace-nowrap text-center">{item.fiscalYear}</td>
                                            <td className="py-2 px-3 max-w-[150px] bg-blue-50/20"><div className="flex flex-col"><span className="font-medium text-gray-900 truncate" title={item.customerName}>{item.customerName}</span>{item.isCustUnknown && <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] text-red-600 bg-red-50 px-1 py-px rounded border border-red-100 w-fit whitespace-nowrap"><AlertTriangle className="w-2 h-2" /> Unknown</span>}</div></td>
                                            <td className="py-2 px-3 bg-blue-50/20 text-gray-600 truncate max-w-[100px]" title={item.custGroup}>{item.custGroup || '-'}</td>
                                            <td className="py-2 px-3 bg-blue-50/20 text-gray-600 truncate max-w-[100px]" title={item.salesRep}>{item.salesRep || '-'}</td>
                                            <td className="py-2 px-3 bg-blue-50/20">{item.custStatus ? <span className={`inline-block px-1.5 py-px rounded text-[9px] font-medium border ${getStatusColor(item.custStatus)}`}>{item.custStatus}</span> : <span className="text-gray-400">-</span>}</td>
                                            <td className="py-2 px-3 max-w-[180px] bg-orange-50/20"><div className="flex flex-col"><span className="truncate text-gray-800" title={item.particulars}>{item.particulars}</span>{item.isMatUnknown && <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] text-red-600 bg-red-50 px-1 py-px rounded border border-red-100 w-fit whitespace-nowrap"><AlertOctagon className="w-2 h-2" /> Check Master</span>}</div></td>
                                            <td className="py-2 px-3 bg-orange-50/20 text-gray-600 truncate max-w-[80px]">{item.make || '-'}</td>
                                            <td className="py-2 px-3 bg-orange-50/20 text-gray-600 truncate max-w-[80px]">{item.matGroup || '-'}</td>
                                            <td className="py-2 px-3 text-gray-500 font-mono text-[10px] whitespace-nowrap">{item.voucherNo}</td>
                                            <td className="py-2 px-3 text-right font-medium">{item.quantity}</td>
                                            <td className="py-2 px-3 text-right font-bold text-gray-900 whitespace-nowrap">{formatCurrency(item.value)}</td>
                                            <td className="py-2 px-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
         </div>
         <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center flex-shrink-0"><div className="flex items-center gap-2"><span>Rows per page:</span><select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-white border border-gray-300 rounded text-xs py-0.5 px-1 focus:outline-none focus:ring-1 focus:ring-blue-500"><option value={50}>50</option><option value={100}>100</option><option value={500}>500</option><option value={1000}>1000</option></select><span className="ml-2">Showing {paginatedItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, processedItems.length)} of {processedItems.length}</span></div><div className="flex items-center gap-1"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button><span className="px-2">Page {currentPage} of {Math.max(1, totalPages)}</span><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button></div></div>
      </div>
    </div>
  );
};

export default SalesReportView;
