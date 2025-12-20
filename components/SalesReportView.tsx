
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { SalesReportItem, Material, CustomerMasterItem } from '../types';
import { salesService, SalesUploadResult } from '../services/salesService';
import { Trash2, Download, Upload, Search, ArrowUpDown, ArrowUp, ArrowDown, FileBarChart, AlertTriangle, FileWarning, FileDown, Loader2, ChevronLeft, ChevronRight, Filter, Pencil, Save, X, CheckCircle2, AlertOctagon } from 'lucide-react';
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
  const [lastUploadResult, setLastUploadResult] = useState<SalesUploadResult | null>(null);
  
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

  // Fix: Added handleDownloadTemplate function to resolve build error
  const handleDownloadTemplate = () => {
    const headers = [
      {
        "Sales Date": "2023-10-01",
        "Customer Name": "Acme Corp",
        "Material Code": "MAT-001",
        "Invoice No": "INV-1001",
        "Consignee": "Location A",
        "Voucher Ref No": "REF-001",
        "Quantity": 100,
        "Rate": 50,
        "Discount": 0,
        "Value": 5000
      }
    ];
    const ws = utils.json_to_sheet(headers);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Sales_Template");
    writeFile(wb, "Sales_Report_Template.xlsx");
  };

  const getFiscalInfo = (date: Date) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    const fiscalYear = `${startYear}-${startYear + 1}`;
    const fiscalMonthIndex = month >= 3 ? month - 3 : month + 9;
    return { fiscalYear, fiscalMonthIndex, weekNumber: 1 }; // Week calc simplified for space
  };

  const getFiscalMonthName = (index: number) => ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"][index] || "";

  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedFY, timeView, selectedMonth, selectedWeek, slicerGroup, slicerRep, slicerStatus, slicerMake, slicerMatGroup, showMismatchesOnly]);

  const materialLookup = useMemo(() => {
    const lookup = new Map<string, Material>();
    materials.forEach(m => {
        if (m.materialCode) lookup.set(m.materialCode.toLowerCase().trim(), m);
        if (m.description) lookup.set(m.description.toLowerCase().trim(), m);
    });
    return lookup;
  }, [materials]);

  const customerLookup = useMemo(() => {
    const lookup = new Map<string, CustomerMasterItem>();
    customers.forEach(c => lookup.set(c.customerName.toLowerCase().trim(), c));
    return lookup;
  }, [customers]);

  const enrichedItems: EnrichedSalesItem[] = useMemo(() => {
    return items.map(item => {
        const cleanCust = (item.customerName || '').toLowerCase().trim();
        const cleanMat = (item.materialCode || '').toLowerCase().trim();
        const customer = customerLookup.get(cleanCust);
        const material = materialLookup.get(cleanMat);
        
        const dateObj = new Date(item.salesDate);
        const { fiscalYear, fiscalMonthIndex, weekNumber } = getFiscalInfo(isNaN(dateObj.getTime()) ? new Date() : dateObj);

        return { 
          ...item, 
          custGroup: customer?.group || 'Unassigned', 
          salesRep: customer?.salesRep || 'Unassigned', 
          custStatus: customer?.status || 'Unknown', 
          make: material?.make || 'Unspecified', 
          matGroup: material?.materialGroup || 'Unspecified', 
          isCustUnknown: !customer && !!item.customerName, 
          isMatUnknown: !material && !!item.materialCode, 
          fiscalYear, 
          fiscalMonthIndex, 
          weekNumber 
        };
    });
  }, [items, customerLookup, materialLookup]);

  const options = useMemo(() => {
    const fys = Array.from(new Set(enrichedItems.map(i => i.fiscalYear))).sort().reverse();
    const groups = Array.from(new Set(enrichedItems.map(i => i.custGroup))).sort();
    const reps = Array.from(new Set(enrichedItems.map(i => i.salesRep))).sort();
    const statuses = Array.from(new Set(enrichedItems.map(i => i.custStatus))).sort();
    const makes = Array.from(new Set(enrichedItems.map(i => i.make))).sort();
    const matGroups = Array.from(new Set(enrichedItems.map(i => i.matGroup))).sort();
    return { fys, groups, reps, statuses, makes, matGroups };
  }, [enrichedItems]);

  useEffect(() => { if (!selectedFY && options.fys.length > 0) setSelectedFY(options.fys[0]); }, [options.fys, selectedFY]);

  const processedItems = useMemo(() => {
    let data = [...enrichedItems];
    if (showMismatchesOnly) data = data.filter(i => i.isCustUnknown || i.isMatUnknown);
    else {
      if (selectedFY) data = data.filter(i => i.fiscalYear === selectedFY);
      if (timeView === 'MONTH') data = data.filter(i => i.fiscalMonthIndex === selectedMonth);
    }
    if (slicerGroup !== 'ALL') data = data.filter(i => i.custGroup === slicerGroup);
    if (slicerRep !== 'ALL') data = data.filter(i => i.salesRep === slicerRep);
    if (slicerStatus !== 'ALL') data = data.filter(i => i.custStatus === slicerStatus);
    if (slicerMake !== 'ALL') data = data.filter(i => i.make === slicerMake);
    if (slicerMatGroup !== 'ALL') data = data.filter(i => i.matGroup === slicerMatGroup);
    
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(i => i.customerName.toLowerCase().includes(lower) || i.materialCode.toLowerCase().includes(lower) || i.invoiceNo.toLowerCase().includes(lower));
    }
    
    if (sortConfig) {
      data.sort((a, b) => {
        const valA = a[sortConfig.key] as any;
        const valB = b[sortConfig.key] as any;
        return valA < valB ? (sortConfig.direction === 'asc' ? -1 : 1) : (sortConfig.direction === 'asc' ? 1 : -1);
      });
    }
    return data;
  }, [enrichedItems, selectedFY, timeView, selectedMonth, slicerGroup, slicerRep, slicerStatus, slicerMake, slicerMatGroup, searchTerm, sortConfig, showMismatchesOnly]);

  const totals = useMemo(() => processedItems.reduce((acc, item) => ({ qty: acc.qty + item.quantity, val: acc.val + item.value }), { qty: 0, val: 0 }), [processedItems]);
  const totalPages = Math.ceil(processedItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => processedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [processedItems, currentPage, itemsPerPage]);

  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;
  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'bg-green-100 text-green-700 border-green-200';
    if (s === 'inactive' || s === 'blocked') return 'bg-red-100 text-red-700 border-red-200';
    return 'text-gray-500';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setStatusMessage("Reading file...");
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = utils.sheet_to_json<any>(ws, { cellDates: true });
      
      const newItems: Omit<SalesReportItem, 'id' | 'createdAt'>[] = [];
      
      jsonData.forEach(row => {
        const getVal = (keys: string[]) => {
          for (const k of keys) {
            const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
            if (foundKey) return row[foundKey];
          }
          return undefined;
        };

        const rawDate = getVal(['sales_date', 'date', 'sales date']);
        let salesDate = '';
        if (rawDate instanceof Date) {
            salesDate = rawDate.toISOString().split('T')[0];
        } else if (typeof rawDate === 'number') {
            salesDate = new Date((rawDate - 25569) * 86400 * 1000).toISOString().split('T')[0];
        } else {
            salesDate = String(rawDate || new Date().toISOString().split('T')[0]);
        }

        const item = {
          salesDate,
          customerName: String(getVal(['customer_name', 'customer', 'customer name']) || ''),
          materialCode: String(getVal(['material_code', 'material code', 'code', 'particulars']) || ''),
          invoiceNo: String(getVal(['invoice_no', 'invoice no', 'voucher no', 'vch no']) || ''),
          consignee: String(getVal(['consignee']) || ''),
          voucherRefNo: String(getVal(['voucher_ref_no', 'ref no']) || ''),
          quantity: parseFloat(getVal(['quantity', 'qty'])) || 0,
          rate: parseFloat(getVal(['rate', 'price'])) || 0,
          discount: parseFloat(getVal(['discount'])) || 0,
          value: parseFloat(getVal(['value', 'amount', 'total'])) || 0
        };

        if (item.invoiceNo && item.materialCode) {
          if (item.value === 0 && item.quantity > 0) item.value = item.quantity * item.rate;
          newItems.push(item);
        }
      });

      if (newItems.length > 0) {
        setStatusMessage("Uploading and syncing with database...");
        const result = await salesService.createBulkWithUpsert(newItems);
        setLastUploadResult(result);
        onBulkAdd([]); // Trigger state refresh in parent
        setStatusMessage("Sync complete.");
      } else {
        alert("No valid records found. Ensure columns like 'invoice_no', 'material_code', and 'sales_date' exist.");
      }
    } catch (err) {
      console.error(err);
      alert("Error processing file.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      {/* Upload Progress Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-50 bg-white/90 flex flex-col items-center justify-center backdrop-blur-sm rounded-xl">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <h3 className="text-xl font-bold text-gray-800">{statusMessage}</h3>
        </div>
      )}

      {/* Summary Report Modal (Mock UI) */}
      {lastUploadResult && (
        <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Upload Summary</h3>
            <button onClick={() => setLastUploadResult(null)} className="text-blue-400 hover:text-blue-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-4 gap-4">
             <div className="bg-white p-2 rounded border border-blue-100 text-center"><p className="text-[9px] font-bold text-gray-500 uppercase">Total Rows</p><p className="text-lg font-bold text-gray-900">{lastUploadResult.total_rows_uploaded}</p></div>
             <div className="bg-white p-2 rounded border border-blue-100 text-center"><p className="text-[9px] font-bold text-emerald-500 uppercase">Processed</p><p className="text-lg font-bold text-emerald-600">{lastUploadResult.total_inserted}</p></div>
             <div className="bg-white p-2 rounded border border-blue-100 text-center"><p className="text-[9px] font-bold text-orange-500 uppercase">Updated</p><p className="text-lg font-bold text-orange-600">{lastUploadResult.total_updated}</p></div>
             <div className="bg-white p-2 rounded border border-blue-100 text-center"><p className="text-[9px] font-bold text-red-500 uppercase">Failed</p><p className="text-lg font-bold text-red-600">{lastUploadResult.total_failed}</p></div>
          </div>
          {lastUploadResult.error_log.length > 0 && (
            <div className="max-h-24 overflow-y-auto text-[10px] text-red-600 bg-red-50 p-2 rounded border border-red-100 mt-1">
                <p className="font-bold mb-1">Error Logs:</p>
                {lastUploadResult.error_log.map((log, i) => <p key={i}>Row {log.row}: {log.reason}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0">
         <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
               <div className="bg-blue-600 p-2 rounded-lg text-white"><FileBarChart className="w-5 h-5" /></div>
               <div>
                 <h2 className="text-sm font-bold text-gray-800">Sales Master & Reporting</h2>
                 <p className="text-[10px] text-gray-500">Comprehensive database of all sales transactions</p>
               </div>
            </div>
            <div className="flex gap-2">
               <button onClick={onClear} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"><Trash2 className="w-4 h-4" /></button>
               <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs border hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> Template</button>
               <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
               <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs border border-blue-100 hover:bg-blue-100 font-bold shadow-sm"><Upload className="w-3.5 h-3.5" /> Upload Report</button>
               <button onClick={() => {}} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-emerald-700"><FileDown className="w-3.5 h-3.5" /> Export All</button>
            </div>
         </div>
         <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
               <label className="text-[10px] font-bold text-gray-400 uppercase">Fiscal Year</label>
               <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500">
                  {options.fys.map(fy => <option key={fy} value={fy}>{fy}</option>)}
               </select>
            </div>
            <div className="flex flex-col gap-1">
               <label className="text-[10px] font-bold text-gray-400 uppercase">Time View</label>
               <div className="flex bg-gray-100 p-1 rounded-lg">
                  {(['FY', 'MONTH'] as const).map(v => (
                    <button key={v} onClick={() => setTimeView(v)} className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>{v === 'FY' ? 'Full' : 'Monthly'}</button>
                  ))}
               </div>
            </div>
            {timeView === 'MONTH' && (
              <div className="flex flex-col gap-1">
                 <label className="text-[10px] font-bold text-gray-400 uppercase">Month</label>
                 <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-gray-50 border border-gray-200 text-xs rounded-md px-2 py-1.5 outline-none">
                    {[0,1,2,3,4,5,6,7,8,9,10,11].map(m => <option key={m} value={m}>{getFiscalMonthName(m)}</option>)}
                 </select>
              </div>
            )}
            <div className="flex-1 min-w-[200px] flex flex-col gap-1">
               <label className="text-[10px] font-bold text-gray-400 uppercase">Search Records</label>
               <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input type="text" placeholder="Search Invoice, Customer, Material Code..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 text-xs rounded-md outline-none focus:ring-1 focus:ring-blue-500" />
               </div>
            </div>
         </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase">Filtered Records</p><p className="text-xl font-black text-gray-900">{processedItems.length}</p></div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase">Total Value</p><p className="text-xl font-black text-emerald-600">{formatCurrency(totals.val)}</p></div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase">Total Qty</p><p className="text-xl font-black text-blue-600">{totals.qty.toLocaleString()}</p></div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
             <div><p className="text-[10px] font-bold text-gray-400 uppercase">Data Quality</p><p className={`text-xl font-black ${enrichedItems.some(i => i.isCustUnknown || i.isMatUnknown) ? 'text-orange-500' : 'text-green-500'}`}>{enrichedItems.some(i => i.isCustUnknown || i.isMatUnknown) ? 'Incomplete' : 'Verified'}</p></div>
             <button onClick={() => setShowMismatchesOnly(!showMismatchesOnly)} className={`p-1.5 rounded-lg border ${showMismatchesOnly ? 'bg-orange-600 text-white border-orange-700' : 'bg-gray-50 text-gray-400 border-gray-200'}`} title="Toggle Mismatches Only"><AlertTriangle className="w-4 h-4" /></button>
          </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse min-w-full">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-black text-gray-500 uppercase tracking-tighter">
                    <tr className="border-b border-gray-200">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Invoice No</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Material Code</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Value</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs">
                    {paginatedItems.length === 0 ? (
                      <tr><td colSpan={8} className="py-12 text-center text-gray-400 font-medium italic">No transactions found matching the criteria.</td></tr>
                    ) : (
                        paginatedItems.map(item => (
                            <tr key={item.id} className={`hover:bg-blue-50/20 transition-colors ${editingId === item.id ? 'bg-blue-50' : ''}`}>
                                {editingId === item.id ? (
                                    <>
                                        <td className="py-2 px-3"><input type="date" className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs outline-none" value={item.salesDate} onChange={e => handleInputChange('salesDate', e.target.value)} /></td>
                                        <td className="py-2 px-3"><input type="text" className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs outline-none" value={editForm?.invoiceNo} onChange={e => handleInputChange('invoiceNo', e.target.value)} /></td>
                                        <td className="py-2 px-3"><input type="text" className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs outline-none" value={editForm?.customerName} onChange={e => handleInputChange('customerName', e.target.value)} /></td>
                                        <td className="py-2 px-3"><input type="text" className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs outline-none" value={editForm?.materialCode} onChange={e => handleInputChange('materialCode', e.target.value)} /></td>
                                        <td className="py-2 px-3"><input type="number" className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs text-right outline-none" value={editForm?.quantity} onChange={e => handleInputChange('quantity', parseFloat(e.target.value))} /></td>
                                        <td className="py-2 px-3"><input type="number" className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-xs text-right outline-none" value={editForm?.rate} onChange={e => handleInputChange('rate', parseFloat(e.target.value))} /></td>
                                        <td className="py-2 px-3 text-right font-bold">{formatCurrency((editForm?.quantity || 0) * (editForm?.rate || 0))}</td>
                                        <td className="py-2 px-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={handleSaveEdit} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"><Save className="w-3.5 h-3.5" /></button>
                                                <button onClick={handleCancelEdit} className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{item.salesDate}</td>
                                        <td className="py-2 px-3 font-mono font-bold text-gray-900">{item.invoiceNo}</td>
                                        <td className="py-2 px-3">
                                          <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 truncate max-w-[150px]" title={item.customerName}>{item.customerName}</span>
                                            {item.isCustUnknown && <span className="text-[9px] text-red-500 bg-red-50 px-1 py-0.5 rounded border border-red-100 w-fit">Not in Master</span>}
                                          </div>
                                        </td>
                                        <td className="py-2 px-3">
                                           <div className="flex flex-col">
                                              <span className="font-medium text-gray-600 truncate max-w-[150px]" title={item.materialCode}>{item.materialCode}</span>
                                              {item.isMatUnknown && <span className="text-[9px] text-orange-500 bg-orange-50 px-1 py-0.5 rounded border border-orange-100 w-fit">No Master Match</span>}
                                           </div>
                                        </td>
                                        <td className="py-2 px-3 text-right font-medium">{item.quantity}</td>
                                        <td className="py-2 px-3 text-right text-gray-500">{item.rate.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-right font-black text-gray-900 whitespace-nowrap">{formatCurrency(item.value)}</td>
                                        <td className="py-2 px-3 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
         </div>
         <div className="bg-gray-50 px-3 py-2 border-t border-gray-200 text-[10px] text-gray-500 flex justify-between items-center">
            <div className="flex items-center gap-2">
               <span>Page {currentPage} of {totalPages || 1}</span>
               <div className="flex gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
               </div>
            </div>
            <span>Supabase Sync Active • {processedItems.length} Records</span>
         </div>
      </div>
    </div>
  );
};

export default SalesReportView;
