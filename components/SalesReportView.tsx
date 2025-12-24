
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { SalesReportItem, Material, CustomerMasterItem } from '../types';
import { Trash2, Download, Upload, Search, ArrowUpDown, ArrowUp, ArrowDown, FileBarChart, AlertTriangle, UserX, PackageX, Users, Package, FileWarning, FileDown, Loader2, ChevronLeft, ChevronRight, Filter, Calendar, CalendarRange, Layers, TrendingUp, TrendingDown, Minus, UserCheck, Target, BarChart2, AlertOctagon, DollarSign, Pencil, Save, X, Database } from 'lucide-react';
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

const getMergedGroupName = (groupName: string) => {
    const g = String(groupName || 'Unassigned').trim();
    const lowerG = g.toLowerCase();
    if (lowerG.includes('group-1') || lowerG.includes('peenya')) return 'Group-1 Giridhar';
    if (lowerG.includes('group -4 office') || lowerG.includes('group-4') || lowerG.includes('dcv')) return 'Group - Office';
    if (lowerG.includes('online')) return 'Online';
    return g;
};

const SalesReportView: React.FC<SalesReportViewProps> = ({
    items = [],
    materials = [],
    customers = [],
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

    const getFiscalMonthName = (index: number) => ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"][index] || "";

    const getWeekRangeString = (fy: string, weekNum: number) => {
        if (!fy || fy === 'N/A') return '';
        try {
            const startYear = parseInt(fy.split('-')[0]);
            if (isNaN(startYear)) return '';

            const fyStart = new Date(startYear, 3, 1);
            const day = fyStart.getDay();
            const daysToSubtract = (day >= 4) ? (day - 4) : (day + 3);
            const refThursday = new Date(fyStart);
            refThursday.setDate(fyStart.getDate() - daysToSubtract);
            refThursday.setHours(0, 0, 0, 0);

            const weekStart = new Date(refThursday);
            weekStart.setDate(refThursday.getDate() + (weekNum - 1) * 7);

            let displayStart = new Date(weekStart);
            if (weekNum === 1) {
                // For the very first week of the fiscal year, show it starting from April 1st
                displayStart = new Date(fyStart);
            }

            const displayEnd = new Date(weekStart);
            displayEnd.setDate(weekStart.getDate() + 6);

            const fmt = (d: Date) => isNaN(d.getTime()) ? 'Invalid' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            return `${fmt(displayStart)} - ${fmt(displayEnd)}`;
        } catch (e) { return ''; }
    };

    useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedFY, timeView, selectedMonth, selectedWeek, slicerGroup, slicerRep, slicerStatus, slicerMake, slicerMatGroup, showMismatchesOnly]);

    const materialLookup = useMemo(() => {
        const lookup = new Map<string, Material>();
        for (const m of materials) {
            if (m.partNo) lookup.set(String(m.partNo).toLowerCase().trim(), m);
            if (m.description) lookup.set(String(m.description).toLowerCase().trim(), m);
        }
        return lookup;
    }, [materials]);

    const customerLookup = useMemo(() => {
        const lookup = new Map<string, CustomerMasterItem>();
        for (const c of customers) {
            if (c.customerName) lookup.set(String(c.customerName).toLowerCase().trim(), c);
        }
        return lookup;
    }, [customers]);

    const enrichedItems: EnrichedSalesItem[] = useMemo(() => {
        return (items || []).map(item => {
            const cleanCust = String(item.customerName || '').toLowerCase().trim();
            const cleanPart = String(item.particulars || '').toLowerCase().trim();
            const customer = customerLookup.get(cleanCust);
            const material = materialLookup.get(cleanPart);

            let dateObj = new Date();
            const rawDate = item.date as any;
            if (rawDate instanceof Date) { dateObj = rawDate; }
            else if (typeof rawDate === 'string') { dateObj = new Date(rawDate); }
            // Excel serial date: days since 1900-01-01 (with 1900 leap year bug, offset is 25568)
            else if (typeof rawDate === 'number') { dateObj = new Date((rawDate - 25568) * 86400 * 1000); }

            const { fiscalYear, fiscalMonthIndex, weekNumber } = getFiscalInfo(dateObj);
            const mergedGroup = getMergedGroupName(customer?.group || 'Unassigned');
            return {
                ...item,
                custGroup: mergedGroup,
                salesRep: customer?.salesRep || 'Unassigned',
                custStatus: customer?.status || 'Unknown',
                custType: customer?.customerGroup || '',
                make: material?.make || 'Unspecified',
                matGroup: material?.materialGroup || 'Unspecified',
                isCustUnknown: !customer && !!item.customerName,
                isMatUnknown: !material && !!item.particulars,
                fiscalYear, fiscalMonthIndex, weekNumber
            };
        });
    }, [items, customerLookup, materialLookup]);

    const mismatchStats = useMemo(() => {
        let recordsWithError = 0;
        const uniqueCustErrors = new Set<string>();
        const uniqueMatErrors = new Set<string>();
        enrichedItems.forEach(i => {
            let hasError = false;
            if (i.isCustUnknown) { uniqueCustErrors.add(i.customerName); hasError = true; }
            if (i.isMatUnknown) { uniqueMatErrors.add(i.particulars); hasError = true; }
            if (hasError) recordsWithError++;
        });
        return { total: recordsWithError, uniqueCust: uniqueCustErrors.size, uniqueMat: uniqueMatErrors.size };
    }, [enrichedItems]);

    const options = useMemo(() => {
        const fys = Array.from(new Set(enrichedItems.map(i => i.fiscalYear))).filter(f => f !== 'N/A').sort().reverse();
        const groups = Array.from(new Set(enrichedItems.map(i => i.custGroup))).sort();
        const reps = Array.from(new Set(enrichedItems.map(i => i.salesRep))).sort();
        const statuses = Array.from(new Set(enrichedItems.map(i => i.custStatus))).sort();
        const makes = Array.from(new Set(enrichedItems.map(i => i.make))).sort();
        const matGroups = Array.from(new Set(enrichedItems.map(i => i.matGroup))).sort();
        return { fys, groups, reps, statuses, makes, matGroups };
    }, [enrichedItems]);

    useEffect(() => { if (!selectedFY && options.fys.length > 0) { setSelectedFY(options.fys[0]); } }, [options.fys, selectedFY]);

    const processedItems = useMemo(() => {
        let data = [...enrichedItems];
        if (showMismatchesOnly) {
            data = data.filter(i => i.isCustUnknown || i.isMatUnknown);
        } else {
            if (selectedFY) data = data.filter(i => i.fiscalYear === selectedFY);
            if (timeView === 'MONTH') { data = data.filter(i => i.fiscalMonthIndex === selectedMonth); }
            else if (timeView === 'WEEK') { data = data.filter(i => i.weekNumber === selectedWeek); }
        }
        if (slicerGroup !== 'ALL') data = data.filter(i => i.custGroup === slicerGroup);
        if (slicerRep !== 'ALL') data = data.filter(i => i.salesRep === slicerRep);
        if (slicerStatus !== 'ALL') data = data.filter(i => i.custStatus === slicerStatus);
        if (slicerMake !== 'ALL') data = data.filter(i => i.make === slicerMake);
        if (slicerMatGroup !== 'ALL') data = data.filter(i => i.matGroup === slicerMatGroup);

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(i =>
                String(i.customerName || '').toLowerCase().includes(lower) ||
                String(i.particulars || '').toLowerCase().includes(lower) ||
                String(i.voucherNo || '').toLowerCase().includes(lower)
            );
        }
        if (sortConfig) {
            data.sort((a, b) => {
                const valA = a[sortConfig.key] as any;
                const valB = b[sortConfig.key] as any;
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    }, [enrichedItems, selectedFY, timeView, selectedMonth, selectedWeek, slicerGroup, slicerRep, slicerStatus, slicerMake, slicerMatGroup, searchTerm, sortConfig, showMismatchesOnly]);

    const totals = useMemo(() => {
        return processedItems.reduce((acc, item) => ({ qty: acc.qty + (item.quantity || 0), val: acc.val + (item.value || 0) }), { qty: 0, val: 0 });
    }, [processedItems]);

    const totalPages = Math.max(1, Math.ceil(processedItems.length / itemsPerPage));
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return processedItems.slice(start, start + itemsPerPage);
    }, [processedItems, currentPage, itemsPerPage]);

    const formatDateDisplay = (dateVal: any) => {
        if (!dateVal) return '-';
        let date: Date | null = null;
        if (dateVal instanceof Date) date = dateVal;
        else if (typeof dateVal === 'string') date = new Date(dateVal);
        // Excel serial date: days since 1900-01-01 (with 1900 leap year bug, offset is 25568)
        else if (typeof dateVal === 'number') date = new Date((dateVal - 25568) * 86400 * 1000);
        if (date && !isNaN(date.getTime())) return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
        return String(dateVal);
    };

    const formatInputDate = (dateVal: any) => {
        if (!dateVal) return '';
        let date: Date | null = null;
        if (dateVal instanceof Date) date = dateVal;
        else if (typeof dateVal === 'string') date = new Date(dateVal);
        // Excel serial date: days since 1900-01-01 (with 1900 leap year bug, offset is 25568)
        else if (typeof dateVal === 'number') date = new Date((dateVal - 25568) * 86400 * 1000);
        if (date && !isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return '';
    };

    const formatCurrency = (val: number) => `Rs. ${Math.round(val || 0).toLocaleString('en-IN')}`;
    const getStatusColor = (status: string) => { const s = String(status || '').toLowerCase(); if (s === 'active') return 'bg-green-100 text-green-700 border-green-200'; if (s === 'inactive' || s === 'blocked') return 'bg-red-100 text-red-700 border-red-200'; return 'text-gray-500'; };
    const handleSort = (key: SortKey) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
    const renderSortIcon = (key: SortKey) => { if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />; return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />; };

    const handleDownloadTemplate = () => { const headers = [{ "Date": "2023-10-01", "Customer Name": "ABC Corp", "Particulars": "Item", "Voucher No.": "INV-001", "Quantity": 1, "Value": 1000 }]; const ws = utils.json_to_sheet(headers); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Template"); writeFile(wb, "Sales_Report_Template.xlsx"); };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessing(true);
        setUploadProgress(0);
        setStatusMessage("Reading file...");

        setTimeout(async () => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                // Fixed: Moved cellDates and dateNF to read options to avoid Sheet2JSONOpts type errors
                const wb = read(arrayBuffer, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                setStatusMessage("Parsing rows...");
                const jsonData = utils.sheet_to_json<any>(ws);
                const totalRows = jsonData.length;
                const CHUNK_SIZE = 1000;
                const allNewItems: any[] = [];
                let currentIndex = 0;

                // Format Excel dates properly with "Nudge Fix" for 23:59:59 issues
                const formatExcelDate = (val: any) => {
                    let d: Date;
                    if (val instanceof Date) {
                        // Nudge by 12 hours to handle dates that are at 23:59:50 due to floating point error
                        d = new Date(val.getTime() + (12 * 60 * 60 * 1000));
                    } else if (typeof val === 'number') {
                        // Use Math.round to get the nearest whole day
                        d = new Date((Math.round(val) - 25568) * 86400 * 1000);
                    } else {
                        return String(val || '');
                    }

                    if (isNaN(d.getTime())) return String(val || '');

                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                const processChunk = () => {
                    const end = Math.min(currentIndex + CHUNK_SIZE, totalRows);
                    for (let i = currentIndex; i < end; i++) {
                        const row = jsonData[i];
                        let customerName = '';
                        let particulars = '';
                        let voucherNo = '';
                        let value = 0;
                        let quantity = 0;
                        let date = null;
                        const keys = Object.keys(row);
                        for (let k = 0; k < keys.length; k++) {
                            const key = keys[k];
                            const lowerKey = key.toLowerCase();
                            if (lowerKey.includes('customer') || lowerKey === 'name') customerName = String(row[key]);
                            else if (lowerKey.includes('particular') || lowerKey.includes('item')) particulars = String(row[key]);
                            else if (lowerKey.includes('voucher')) voucherNo = String(row[key]);
                            else if (lowerKey.includes('value') || lowerKey.includes('amount')) value = parseFloat(row[key]);
                            else if (lowerKey.includes('quant') || lowerKey === 'qty') quantity = parseFloat(row[key]);
                            else if (lowerKey.includes('date') || lowerKey === 'dt') date = formatExcelDate(row[key]);
                        }
                        if (customerName) {
                            allNewItems.push({ date, customerName, particulars, voucherNo, quantity: quantity || 0, value: value || 0, consignee: '', voucherRefNo: '' });
                        }
                    }
                    currentIndex = end;
                    const progress = Math.round((currentIndex / totalRows) * 100);
                    setUploadProgress(progress);
                    setStatusMessage(`Processing... ${progress}%`);
                    if (currentIndex < totalRows) {
                        setTimeout(processChunk, 0);
                    } else {
                        setStatusMessage("Finalizing import...");
                        setTimeout(() => {
                            if (allNewItems.length > 0) {
                                onBulkAdd(allNewItems);
                            } else {
                                alert("No valid records found.");
                            }
                            setIsProcessing(false);
                            setUploadProgress(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                        }, 50);
                    }
                };
                setTimeout(processChunk, 50);
            } catch (e) {
                alert("Error parsing file.");
                setIsProcessing(false);
            }
        }, 100);
    };

    return (
        <div className="flex flex-col h-full gap-4 relative">
            {isProcessing && (<div className="absolute inset-0 z-50 bg-white/90 flex flex-col items-center justify-center backdrop-blur-sm rounded-xl"><Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" /><h3 className="text-xl font-bold text-gray-800">{statusMessage}</h3>{uploadProgress !== null && (<div className="w-64 bg-gray-200 rounded-full h-3 mt-4"><div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div></div>)}</div>)}

            {/* Quick Stats & Quality Check */}
            <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex-shrink-0 gap-4">
                <div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${mismatchStats.total > 0 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>{mismatchStats.total > 0 ? <AlertTriangle className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}</div><div><h3 className="text-sm font-bold text-gray-800">Master Data Quality</h3><p className={`text-xs ${mismatchStats.total > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{mismatchStats.total > 0 ? `${mismatchStats.total} Mismatches found. Need Master Data updates.` : "All records fully verified."}</p></div></div>
                <div className="flex gap-2">
                    <button onClick={() => setShowMismatchesOnly(!showMismatchesOnly)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${showMismatchesOnly ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{showMismatchesOnly ? "Show Valid Records" : "Filter Mismatches"}</button>
                    <button onClick={handleDownloadTemplate} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Template</button>
                </div>
            </div>

            {/* Main Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200"><span className="text-xs font-bold text-gray-700 px-2">FY:</span><select value={selectedFY} onChange={(e) => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-sm rounded-md px-2 py-1 outline-none">{options.fys.map(fy => <option key={fy} value={fy}>{fy}</option>)}</select></div>
                    <div className="flex bg-gray-100 p-1 rounded-lg">{(['FY', 'MONTH', 'WEEK'] as const).map(mode => (<button key={mode} onClick={() => setTimeView(mode)} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${timeView === mode ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{mode}</button>))}</div>
                    {timeView === 'MONTH' && (<select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-3 py-1.5">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(idx => (<option key={idx} value={idx}>{getFiscalMonthName(idx)}</option>))}</select>)}
                    {timeView === 'WEEK' && (<div className="flex items-center gap-2"><span className="text-xs text-gray-500">Week:</span><input type="number" min={1} max={53} value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))} className="w-16 bg-white border border-gray-300 text-xs rounded-md px-2 py-1" /><span className="text-[9px] text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">{getWeekRangeString(selectedFY, selectedWeek)}</span></div>)}
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex flex-col gap-0.5"><label className="text-[9px] font-black text-gray-400 uppercase">Group</label><select value={slicerGroup} onChange={(e) => setSlicerGroup(e.target.value)} className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-32">{<option value="ALL">All Groups</option>}{options.groups.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                    <div className="flex flex-col gap-0.5"><label className="text-[9px] font-black text-gray-400 uppercase">Make</label><select value={slicerMake} onChange={(e) => setSlicerMake(e.target.value)} className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-32">{<option value="ALL">All Makes</option>}{options.makes.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div className="flex-1 min-w-[200px] flex items-end"><div className="relative w-full"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div><input type="text" placeholder="Search Customer, Item or Voucher..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
                </div>
            </div>

            {/* Header Summary & Actions */}
            <div className="flex items-center justify-between bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-4 pl-2">
                    <div className="flex flex-col"><span className="text-[10px] text-gray-500 font-bold uppercase">Qty</span><span className="text-sm font-black text-blue-600">{totals.qty.toLocaleString()}</span></div>
                    <div className="w-px h-6 bg-gray-200"></div>
                    <div className="flex flex-col"><span className="text-[10px] text-gray-500 font-bold uppercase">Total Value</span><span className="text-sm font-black text-emerald-600">{formatCurrency(totals.val)}</span></div>
                </div>
                <div className="flex gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100"><Upload className="w-3.5 h-3.5" /> Import</button>
                    <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 h-full">
                    <table className="w-full text-left border-collapse min-w-full">
                        <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                            <tr className="border-b border-gray-200">
                                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('date')}>Date {renderSortIcon('date')}</th>
                                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('customerName')}>Customer {renderSortIcon('customerName')}</th>
                                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('custGroup')}>Group {renderSortIcon('custGroup')}</th>
                                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('particulars')}>Item {renderSortIcon('particulars')}</th>
                                <th className="py-2 px-3">Make</th>
                                <th className="py-2 px-3">Voucher</th>
                                <th className="py-2 px-3 text-right">Qty</th>
                                <th className="py-2 px-3 text-right">Value</th>
                                <th className="py-2 px-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-xs">
                            {paginatedItems.length === 0 ? (
                                <tr><td colSpan={8} className="py-20 text-center"><div className="flex flex-col items-center gap-2 opacity-30"><Database className="w-12 h-12" /><p className="text-sm font-bold">No Records Found</p><p className="text-[10px]">Import an Excel file to see sales data here.</p></div></td></tr>
                            ) : (
                                paginatedItems.map(item => (
                                    <tr key={item.id} className={`hover:bg-blue-50/10 transition-colors ${editingId === item.id ? 'bg-blue-50' : ''}`}>
                                        {editingId === item.id ? (
                                            <>
                                                <td className="py-2 px-3"><input type="date" className="w-full border border-blue-300 rounded px-1.5 py-0.5" value={formatInputDate(editForm?.date)} onChange={e => handleInputChange('date', e.target.value)} /></td>
                                                <td className="py-2 px-3"><input type="text" className="w-full border border-blue-300 rounded px-1.5 py-0.5" value={editForm?.customerName} onChange={e => handleInputChange('customerName', e.target.value)} /></td>
                                                <td className="py-2 px-3 text-gray-400 text-[10px] font-bold uppercase">{item.custGroup}</td>
                                                <td className="py-2 px-3"><input type="text" className="w-full border border-blue-300 rounded px-1.5 py-0.5" value={editForm?.particulars} onChange={e => handleInputChange('particulars', e.target.value)} /></td>
                                                <td colSpan={2} className="py-2 px-3 text-gray-400 italic">Editing...</td>
                                                <td className="py-2 px-3 text-right"><input type="number" className="w-16 border border-blue-300 rounded px-1.5 py-0.5 text-right" value={editForm?.quantity} onChange={e => handleInputChange('quantity', parseFloat(e.target.value))} /></td>
                                                <td className="py-2 px-3 text-right"><input type="number" className="w-24 border border-blue-300 rounded px-1.5 py-0.5 text-right" value={editForm?.value} onChange={e => handleInputChange('value', parseFloat(e.target.value))} /></td>
                                                <td className="py-2 px-3 text-right">
                                                    <div className="flex justify-end gap-1"><button onClick={handleSaveEdit} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"><Save className="w-3.5 h-3.5" /></button><button onClick={handleCancelEdit} className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200"><X className="w-3.5 h-3.5" /></button></div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                                <td className="py-2 px-3 max-w-[150px]"><div className="flex flex-col"><span className="font-bold text-gray-900 truncate" title={item.customerName}>{item.customerName}</span>{item.isCustUnknown && <span className="text-[8px] text-red-600 bg-red-50 px-1 rounded w-fit border border-red-100">Unknown Master</span>}</div></td>
                                                <td className="py-2 px-3 text-gray-500 text-[10px] font-bold uppercase truncate max-w-[100px]" title={item.custGroup}>{item.custGroup}</td>
                                                <td className="py-2 px-3 max-w-[180px]"><div className="flex flex-col"><span className="truncate text-gray-800" title={item.particulars}>{item.particulars}</span>{item.isMatUnknown && <span className="text-[8px] text-red-600 bg-red-50 px-1 rounded w-fit border border-red-100">Item Error</span>}</div></td>
                                                <td className="py-2 px-3 text-gray-500 italic truncate max-w-[80px]">{item.make}</td>
                                                <td className="py-2 px-3 text-gray-400 font-mono text-[9px] whitespace-nowrap">{item.voucherNo}</td>
                                                <td className="py-2 px-3 text-right font-medium text-blue-700">{item.quantity}</td>
                                                <td className="py-2 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(item.value)}</td>
                                                <td className="py-2 px-3 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button></div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 text-[10px] text-gray-500 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <span>Rows per page: <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-white border rounded text-[10px]">{[50, 100, 500].map(v => <option key={v} value={v}>{v}</option>)}</select></span>
                        <span>Showing {paginatedItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, processedItems.length)} of {processedItems.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="px-2">Page {currentPage} of {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesReportView;
