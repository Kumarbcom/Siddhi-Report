
import React, { useRef, useState, useMemo, useEffect, useDeferredValue } from 'react';
import { SalesReportItem, Material, CustomerMasterItem } from '../types';
import { Trash2, Download, Upload, Search, ArrowUpDown, ArrowUp, ArrowDown, FileBarChart, AlertTriangle, UserX, PackageX, Users, Package, FileWarning, FileDown, Loader2, ChevronLeft, ChevronRight, Filter, Calendar, CalendarRange, Layers, TrendingUp, TrendingDown, Minus, UserCheck, Target, BarChart2, AlertOctagon, DollarSign, Pencil, Save, X, Database, Plus, UserPlus } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface SalesReportViewProps {
    items: SalesReportItem[];
    materials: Material[];
    customers: CustomerMasterItem[];
    onBulkAdd: (items: Omit<SalesReportItem, 'id' | 'createdAt'>[]) => void;
    onUpdate: (item: SalesReportItem) => void;
    onDelete: (id: string) => void;
    onClear: () => void;
    onAddMaterial?: (data: any) => Promise<void>;
    onAddCustomer?: (data: any) => Promise<void>;
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
    onClear,
    onAddMaterial,
    onAddCustomer
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

    // Quick Add States
    const [quickAddMatModal, setQuickAddMatModal] = useState<{ isOpen: boolean; item: EnrichedSalesItem | null }>({ isOpen: false, item: null });
    const [quickAddMatForm, setQuickAddMatForm] = useState<{ description: string; partNo: string; make: string; materialGroup: string; materialCode: string }>({ description: '', partNo: '', make: '', materialGroup: '', materialCode: '' });

    const [quickAddCustModal, setQuickAddCustModal] = useState<{ isOpen: boolean; item: EnrichedSalesItem | null }>({ isOpen: false, item: null });
    const [quickAddCustForm, setQuickAddCustForm] = useState<{ customerName: string; group: string; salesRep: string; status: string; customerGroup: string }>({ customerName: '', group: '', salesRep: '', status: 'Active', customerGroup: '' });

    const [isAdding, setIsAdding] = useState(false);

    const handleOpenQuickAddMat = (item: EnrichedSalesItem) => {
        setQuickAddMatModal({ isOpen: true, item });
        setQuickAddMatForm({ description: item.particulars || '', partNo: '', make: '', materialGroup: '', materialCode: '' });
    };

    const handleOpenQuickAddCust = (item: EnrichedSalesItem) => {
        setQuickAddCustModal({ isOpen: true, item });
        setQuickAddCustForm({ customerName: item.customerName || '', group: '', salesRep: '', status: 'Active', customerGroup: '' });
    };

    const handleQuickAddMaterial = async () => {
        if (!onAddMaterial || !quickAddMatForm.description) return;
        setIsAdding(true);
        try {
            await onAddMaterial(quickAddMatForm);
            setQuickAddMatModal({ isOpen: false, item: null });
            alert("Added to Material Master successfully!");
        } catch (e: any) {
            alert("Failed to add material: " + (e.message || "Unknown error"));
        } finally {
            setIsAdding(false);
        }
    };

    const handleQuickAddCustomer = async () => {
        if (!onAddCustomer || !quickAddCustForm.customerName) return;
        setIsAdding(true);
        try {
            await onAddCustomer(quickAddCustForm);
            setQuickAddCustModal({ isOpen: false, item: null });
            alert("Added to Customer Master successfully!");
        } catch (e: any) {
            alert("Failed to add customer: " + (e.message || "Unknown error"));
        } finally {
            setIsAdding(false);
        }
    };

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

        const fyStart = new Date(startYear, 3, 1);
        const day = fyStart.getDay();
        const daysToSubtract = (day >= 4) ? (day - 4) : (day + 3);
        const refThursday = new Date(fyStart);
        refThursday.setDate(fyStart.getDate() - daysToSubtract);
        refThursday.setHours(0, 0, 0, 0);

        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        const diffTime = targetDate.getTime() - refThursday.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
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
            if (weekNum === 1) displayStart = new Date(fyStart);
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

    const deferredSearchTerm = useDeferredValue(searchTerm);

    // Pre-calculate searching text for performance
    const itemsWithSearch = useMemo(() => {
        return enrichedItems.map(i => ({
            ...i,
            searchText: `${i.customerName || ''} ${i.particulars || ''} ${i.voucherNo || ''}`.toLowerCase()
        }));
    }, [enrichedItems]);

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
        let data = [...itemsWithSearch];
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

        if (deferredSearchTerm) {
            const words = deferredSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
            data = data.filter(i => {
                return words.every(word => i.searchText.includes(word));
            });
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
    }, [itemsWithSearch, selectedFY, timeView, selectedMonth, selectedWeek, slicerGroup, slicerRep, slicerStatus, slicerMake, slicerMatGroup, deferredSearchTerm, sortConfig, showMismatchesOnly]);

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
        else if (typeof dateVal === 'number') date = new Date((dateVal - 25568) * 86400 * 1000);
        if (date && !isNaN(date.getTime())) return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
        return String(dateVal);
    };

    const formatInputDate = (dateVal: any) => {
        if (!dateVal) return '';
        let date: Date | null = null;
        if (dateVal instanceof Date) date = dateVal;
        else if (typeof dateVal === 'string') date = new Date(dateVal);
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
    const handleSort = (key: SortKey) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
    const renderSortIcon = (key: SortKey) => { if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />; return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />; };

    const handleDownloadTemplate = () => { const headers = [{ "Date": "2023-10-01", "Customer Name": "ABC Corp", "Particulars": "Item", "Voucher No.": "INV-001", "Voucher Ref No.": "REF-001", "Quantity": 1, "Value": 1000 }]; const ws = utils.json_to_sheet(headers); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Template"); writeFile(wb, "Sales_Report_Template.xlsx"); };

    const handleExportToExcel = () => {
        const exportData = processedItems.map(item => ({
            'Date': formatDateDisplay(item.date),
            'Voucher No.': item.voucherNo || '',
            'Voucher Ref. No.': item.voucherRefNo || '',
            'Make': item.make || '',
            'Item': item.particulars || '',
            'Qty': item.quantity || 0,
            'Value': item.value || 0,
            'Group': item.matGroup || '',
            'Customer': item.customerName || ''
        }));
        const ws = utils.json_to_sheet(exportData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Sales Report");
        writeFile(wb, `Sales_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsProcessing(true);
        setUploadProgress(0);
        setStatusMessage("Reading file...");
        setTimeout(async () => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const wb = read(arrayBuffer, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                setStatusMessage("Parsing rows...");
                const jsonData = utils.sheet_to_json<any>(ws);
                const totalRows = jsonData.length;
                const CHUNK_SIZE = 1000;
                const allNewItems: any[] = [];
                let currentIndex = 0;

                const formatExcelDate = (val: any) => {
                    let d: Date;
                    if (val instanceof Date) { d = new Date(val.getTime() + (12 * 60 * 60 * 1000)); }
                    else if (typeof val === 'number') { d = new Date((Math.round(val) - 25568) * 86400 * 1000); }
                    else { return String(val || ''); }
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
                        let customerName = '', particulars = '', voucherNo = '', voucherRefNo = '', consignee = '', value = 0, quantity = 0, date = null;
                        Object.keys(row).forEach(key => {
                            const lowerKey = key.toLowerCase().trim().replace(/\./g, ''); // Remove dots for cleaner matching

                            // 1. Check for Reference Number FIRST (to avoid overlap with Voucher No)
                            if (lowerKey.includes('ref')) {
                                voucherRefNo = String(row[key]);
                            }
                            // 2. Check for Consignee
                            else if (lowerKey.includes('consignee')) {
                                consignee = String(row[key]);
                            }
                            // 3. Check for Customer Name
                            else if (lowerKey.includes('customer') || lowerKey === 'name' || lowerKey === 'party') {
                                customerName = String(row[key]);
                            }
                            // 4. Check for Particulars / Items
                            else if (lowerKey.includes('particular') || lowerKey.includes('item') || lowerKey.includes('description')) {
                                particulars = String(row[key]);
                            }
                            // 5. Check for Voucher Number (after Ref check)
                            else if (lowerKey.includes('voucher no') || lowerKey.includes('vch no') || (lowerKey.includes('voucher') && !lowerKey.includes('ref'))) {
                                voucherNo = String(row[key]);
                            }
                            // 6. Metrics and Dates
                            else if (lowerKey.includes('value') || lowerKey.includes('amount')) {
                                value = parseFloat(row[key]);
                            }
                            else if (lowerKey.includes('quant') || lowerKey === 'qty') {
                                quantity = parseFloat(row[key]);
                            }
                            else if (lowerKey.includes('date') || lowerKey === 'dt') {
                                date = formatExcelDate(row[key]);
                            }
                        });
                        if (customerName) allNewItems.push({
                            date,
                            customerName,
                            particulars,
                            voucherNo,
                            quantity: quantity || 0,
                            value: value || 0,
                            consignee: consignee || '',
                            voucherRefNo: voucherRefNo || ''
                        });
                    }
                    currentIndex = end;
                    const progress = Math.round((currentIndex / totalRows) * 100);
                    setUploadProgress(progress);
                    setStatusMessage(`Processing... ${progress}%`);
                    if (currentIndex < totalRows) { setTimeout(processChunk, 0); }
                    else {
                        setStatusMessage("Finalizing...");
                        setTimeout(() => {
                            if (allNewItems.length > 0) onBulkAdd(allNewItems);
                            else alert("No valid records.");
                            setIsProcessing(false);
                            setUploadProgress(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                        }, 50);
                    }
                };
                processChunk();
            } catch (e) { alert("Error parsing file."); setIsProcessing(false); }
        }, 100);
    };

    return (
        <div className="flex flex-col h-full gap-4 relative">
            {isProcessing && (<div className="absolute inset-0 z-50 bg-white/90 flex flex-col items-center justify-center backdrop-blur-sm rounded-xl"><Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" /><h3 className="text-xl font-bold text-gray-800">{statusMessage}</h3>{uploadProgress !== null && (<div className="w-64 bg-gray-200 rounded-full h-3 mt-4"><div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div></div>)}</div>)}

            <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex-shrink-0 gap-4">
                <div className="flex items-center gap-3"><div className={`p-2 rounded-lg ${mismatchStats.total > 0 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>{mismatchStats.total > 0 ? <AlertTriangle className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}</div><div><h3 className="text-sm font-bold text-gray-800">Master Data Quality</h3><p className={`text-xs ${mismatchStats.total > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{mismatchStats.total > 0 ? `${mismatchStats.total} Mismatches found. Need Master Data updates.` : "All records fully verified."}</p></div></div>
                <div className="flex gap-2">
                    <button onClick={() => setShowMismatchesOnly(!showMismatchesOnly)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${showMismatchesOnly ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{showMismatchesOnly ? "Show Valid Records" : "Filter Mismatches"}</button>
                    <button onClick={handleDownloadTemplate} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Template</button>
                    <button onClick={handleExportToExcel} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm flex items-center gap-1.5"><FileDown className="w-3.5 h-3.5" /> Export Excel</button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200"><span className="text-xs font-bold text-gray-700 px-2">FY:</span><select value={selectedFY} onChange={(e) => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-sm rounded-md px-2 py-1 outline-none">{options.fys.map(fy => <option key={fy} value={fy}>{fy}</option>)}</select></div>
                    <div className="flex bg-gray-100 p-1 rounded-lg">{(['FY', 'MONTH', 'WEEK'] as const).map(mode => (<button key={mode} onClick={() => setTimeView(mode)} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${timeView === mode ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{mode}</button>))}</div>
                    {timeView === 'MONTH' && (<select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-3 py-1.5">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(idx => (<option key={idx} value={idx}>{getFiscalMonthName(idx)}</option>))}</select>)}
                    {timeView === 'WEEK' && (<div className="flex items-center gap-2"><span className="text-xs text-gray-500">Week:</span><input type="number" min={1} max={53} value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))} className="w-16 bg-white border border-gray-300 text-xs rounded-md px-2 py-1" /><span className="text-[9px] text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">{getWeekRangeString(selectedFY, selectedWeek)}</span></div>)}
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex flex-col gap-0.5"><label className="text-[9px] font-black text-gray-400 uppercase">Group</label><select value={slicerGroup} onChange={(e) => setSlicerGroup(e.target.value)} className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-32"><option value="ALL">All Groups</option>{options.groups.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                    <div className="flex flex-col gap-0.5"><label className="text-[9px] font-black text-gray-400 uppercase">Make</label><select value={slicerMake} onChange={(e) => setSlicerMake(e.target.value)} className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1 w-32"><option value="ALL">All Makes</option>{options.makes.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div className="flex-1 min-w-[200px] flex items-end">
                        <div className="relative w-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div>
                            <input type="text" placeholder="Search..." className="pl-9 pr-24 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            {deferredSearchTerm !== searchTerm && (
                                <div className="absolute inset-y-0 right-3 flex items-center gap-1.5 text-[10px] text-blue-500 font-bold animate-pulse">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Filtering...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-4 pl-2"><div className="flex flex-col"><span className="text-[10px] text-gray-500 font-bold uppercase">Qty</span><span className="text-sm font-black text-blue-600">{totals.qty.toLocaleString()}</span></div><div className="w-px h-6 bg-gray-200"></div><div className="flex flex-col"><span className="text-[10px] text-gray-500 font-bold uppercase">Total Value</span><span className="text-sm font-black text-emerald-600">{formatCurrency(totals.val)}</span></div></div>
                <div className="flex gap-2"><input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} /><button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100"><Upload className="w-3.5 h-3.5" /> Import</button><button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /></button></div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-auto flex-1 h-full">
                    <table className="w-full text-left border-collapse min-w-full">
                        <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                            <tr className="border-b border-gray-200">
                                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('date')}>Date {renderSortIcon('date')}</th>
                                <th className="py-2 px-3">Voucher No.</th>
                                <th className="py-2 px-3">Voucher Ref. No.</th>
                                <th className="py-2 px-3">Make</th>
                                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('particulars')}>Item {renderSortIcon('particulars')}</th>
                                <th className="py-2 px-3 text-right">Qty</th>
                                <th className="py-2 px-3 text-right">Value</th>
                                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('matGroup')}>Group {renderSortIcon('matGroup')}</th>
                                <th className="py-2 px-3 border-r" onClick={() => handleSort('custGroup')}>Cust Group</th>
                                <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('customerName')}>Customer {renderSortIcon('customerName')}</th>
                                <th className="py-2 px-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-xs text-gray-700">
                            {paginatedItems.map(item => (
                                <tr key={item.id} className="hover:bg-blue-50/10 transition-colors">
                                    <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                    <td className="py-2 px-3 font-mono text-[10px] text-gray-700">{item.voucherNo}</td>
                                    <td className="py-2 px-3 font-mono text-[10px] text-gray-400">{item.voucherRefNo || '-'}</td>
                                    <td className="py-2 px-3 italic text-gray-500">{item.make}</td>
                                    <td className="py-2 px-3">
                                        <div className="flex flex-col">
                                            <span className="truncate max-w-[180px]">{item.particulars}</span>
                                            {item.isMatUnknown && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-[8px] text-red-600 bg-red-50 px-1 rounded font-bold border border-red-100">Unknown Item</span>
                                                    <button onClick={() => handleOpenQuickAddMat(item)} className="p-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200"><Plus className="w-2.5 h-2.5" /></button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium text-blue-700">{item.quantity}</td>
                                    <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatCurrency(item.value)}</td>
                                    <td className="py-2 px-3 italic text-gray-400 font-bold uppercase text-[9px]">{item.matGroup}</td>
                                    <td className="py-2 px-3 font-bold uppercase text-[9px] text-gray-400">{item.custGroup}</td>
                                    <td className="py-2 px-3">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-900 truncate max-w-[150px]">{item.customerName}</span>
                                            {item.isCustUnknown && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-[8px] text-red-600 bg-red-50 px-1 rounded font-bold border border-red-100">Unknown Master</span>
                                                    <button onClick={() => handleOpenQuickAddCust(item)} className="p-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200"><UserPlus className="w-2.5 h-2.5" /></button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 text-[10px] text-gray-500 flex justify-between items-center">
                    <div className="flex items-center gap-4">Rows: {processedItems.length}</div>
                    <div className="flex items-center gap-1"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></button><span>Page {currentPage} of {totalPages}</span><button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></button></div>
                </div>
            </div>

            {/* Quick Add Modals */}
            {quickAddMatModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-4">
                        <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold flex items-center gap-2"><Package className="text-indigo-600" /> Add Material</h3><button onClick={() => setQuickAddMatModal({ isOpen: false, item: null })}><X /></button></div>
                        <div className="space-y-3">
                            <div><label className="text-[10px] font-bold uppercase text-gray-400">Description</label><input type="text" className="w-full border rounded-lg px-3 py-2 text-xs" value={quickAddMatForm.description} onChange={e => setQuickAddMatForm({ ...quickAddMatForm, description: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-[10px] font-bold uppercase text-gray-400">Part No</label><input type="text" className="w-full border rounded-lg px-3 py-2 text-xs" value={quickAddMatForm.partNo} onChange={e => setQuickAddMatForm({ ...quickAddMatForm, partNo: e.target.value })} /></div>
                                <div><label className="text-[10px] font-bold uppercase text-gray-400">Make</label><input type="text" className="w-full border rounded-lg px-3 py-2 text-xs" value={quickAddMatForm.make} onChange={e => setQuickAddMatForm({ ...quickAddMatForm, make: e.target.value })} /></div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3"><button onClick={() => setQuickAddMatModal({ isOpen: false, item: null })} className="text-xs font-bold text-gray-500">Cancel</button><button onClick={handleQuickAddMaterial} disabled={isAdding} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">{isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save</button></div>
                    </div>
                </div>
            )}

            {quickAddCustModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-4">
                        <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold flex items-center gap-2"><Users className="text-indigo-600" /> Add Customer</h3><button onClick={() => setQuickAddCustModal({ isOpen: false, item: null })}><X /></button></div>
                        <div className="space-y-3">
                            <div><label className="text-[10px] font-bold uppercase text-gray-400">Customer Name</label><input type="text" className="w-full border rounded-lg px-3 py-2 text-xs" value={quickAddCustForm.customerName} onChange={e => setQuickAddCustForm({ ...quickAddCustForm, customerName: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-[10px] font-bold uppercase text-gray-400">Sales Rep</label><input type="text" className="w-full border rounded-lg px-3 py-2 text-xs" value={quickAddCustForm.salesRep} onChange={e => setQuickAddCustForm({ ...quickAddCustForm, salesRep: e.target.value })} /></div>
                                <div><label className="text-[10px] font-bold uppercase text-gray-400">Group</label><input type="text" className="w-full border rounded-lg px-3 py-2 text-xs" value={quickAddCustForm.group} onChange={e => setQuickAddCustForm({ ...quickAddCustForm, group: e.target.value })} /></div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3"><button onClick={() => setQuickAddCustModal({ isOpen: false, item: null })} className="text-xs font-bold text-gray-500">Cancel</button><button onClick={handleQuickAddCustomer} disabled={isAdding} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">{isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesReportView;
