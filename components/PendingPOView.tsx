
import React, { useRef, useMemo, useState } from 'react';
import { PendingPOItem, Material, ClosingStockItem, PendingSOItem, CustomerMasterItem, SalesReportItem } from '../types';
import { Trash2, Download, Upload, ShoppingCart, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Package, FileDown, Pencil, Save, X, Calendar, PieChart, BarChart3, AlertOctagon, CheckCircle2, UserCheck } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface PendingPOViewProps {
  items: PendingPOItem[];
  materials: Material[];
  customers: CustomerMasterItem[];
  closingStockItems: ClosingStockItem[];
  onBulkAdd: (items: Omit<PendingPOItem, 'id' | 'createdAt'>[]) => void;
  onUpdate: (item: PendingPOItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  pendingSOItems?: PendingSOItem[];
  salesReportItems?: SalesReportItem[];
}

type SortKey = keyof PendingPOItem;

const PLANNED_STOCK_GROUPS = new Set([
  "eaton-ace", "eaton-biesse", "eaton-coffee day", "eaton-enrx pvt ltd",
  "eaton-eta technology", "eaton-faively", "eaton-planned stock specific customer",
  "eaton-probat india", "eaton-rinac", "eaton-schenck process",
  "eaton-planned stock general", "hager-incap contracting",
  "lapp-ace group", "lapp-ams group", "lapp-disa india",
  "lapp-engineered customized control", "lapp-kennametal",
  "lapp-planned stock general", "lapp-rinac", "lapp-titan"
]);

const roundToTen = (num: number) => num <= 0 ? 0 : Math.ceil(num / 10) * 10;

const SimpleDonut = ({ data, title }: { data: {label: string, value: number, color: string}[], title: string }) => {
    const total = data.reduce((a,b) => a+b.value, 0);
    let cumPercent = 0;
    return (
       <div className="flex flex-col h-full items-center">
           <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2 w-full text-left">{title}</h4>
           <div className="relative w-24 h-24">
              <svg viewBox="-1 -1 2 2" className="transform -rotate-90 w-full h-full">
                 {data.map((slice, i) => {
                     if (slice.value === 0) return null;
                     const percent = slice.value / (total || 1);
                     const startX = Math.cos(2 * Math.PI * cumPercent);
                     const startY = Math.sin(2 * Math.PI * cumPercent);
                     cumPercent += percent;
                     const endX = Math.cos(2 * Math.PI * cumPercent);
                     const endY = Math.sin(2 * Math.PI * cumPercent);
                     const largeArc = percent > 0.5 ? 1 : 0;
                     if (percent === 1) return <circle key={i} cx="0" cy="0" r="1" fill={slice.color} />;
                     return ( <path key={i} d={`M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArc} 1 ${endX} ${endY} Z`} fill={slice.color} stroke="white" strokeWidth="0.05" /> );
                 })}
                 <circle cx="0" cy="0" r="0.6" fill="white" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[8px] text-gray-400 font-bold">Total Val</span>
                  <span className="text-[10px] font-bold text-gray-800">{(total/1000).toFixed(1)}k</span>
              </div>
           </div>
           <div className="flex flex-col gap-1 mt-2 w-full px-2">
               {data.map((d, i) => (
                   <div key={i} className={`flex justify-between text-[9px]`}>
                       <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></div><span className="text-gray-600">{d.label}</span></div>
                       <span className="font-bold">{d.value.toLocaleString()}</span>
                   </div>
               ))}
           </div>
       </div>
    );
};

const ActionCard = ({ title, value, count, color, icon: Icon }: any) => (
    <div className={`bg-${color}-50 p-3 rounded-xl border border-${color}-100 flex flex-col justify-between h-full`}>
        <div className="flex justify-between items-start">
            <p className={`text-[10px] font-bold text-${color}-700 uppercase`}>{title}</p>
            <Icon className={`w-4 h-4 text-${color}-600`} />
        </div>
        <div>
            <h3 className={`text-xl font-extrabold text-${color}-900`}>{value}</h3>
            <p className={`text-[10px] text-${color}-600 font-medium`}>{count} Items</p>
        </div>
    </div>
);

const PendingPOView: React.FC<PendingPOViewProps> = ({ 
  items, 
  materials,
  customers,
  closingStockItems,
  onBulkAdd, 
  onUpdate,
  onDelete,
  onClear,
  pendingSOItems = [],
  salesReportItems = []
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PendingPOItem | null>(null);

  const materialLookup = useMemo(() => new Set(materials.map(m => m.description.toLowerCase().trim())), [materials]);
  const customerLookup = useMemo(() => new Set(customers.map(c => c.customerName.toLowerCase().trim())), [customers]);

  const handleEditClick = (item: PendingPOItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (editForm) {
      const val = (Number(editForm.balanceQty) || 0) * (Number(editForm.rate) || 0);
      onUpdate({ ...editForm, value: val });
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleInputChange = (field: keyof PendingPOItem, value: any) => {
    if (editForm) setEditForm({ ...editForm, [field]: value });
  };

  const stabilizeDateToString = (dateVal: any): string => {
    if (!dateVal) return "";
    let date: Date | null = null;
    if (dateVal instanceof Date) date = dateVal;
    else if (typeof dateVal === 'number') date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    else {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) date = d;
    }
    
    if (date && !isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(dateVal);
  };

  const formatDateDisplay = (dateVal: string | Date | number) => { 
    if (!dateVal) return '-'; 
    let date: Date | null = null; 
    if (dateVal instanceof Date) date = dateVal; 
    else if (typeof dateVal === 'string') { 
        const parts = dateVal.split('-'); 
        if (parts.length === 3 && parts[0].length === 4) date = new Date(dateVal); 
        else if (parts.length === 3) date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])); 
        else date = new Date(dateVal); 
    } else if (typeof dateVal === 'number') date = new Date((dateVal - 25567) * 86400 * 1000); 
    if (date && !isNaN(date.getTime())) return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date); 
    return String(dateVal); 
  };
  
  const formatInputDate = (dateVal: string | Date | number) => stabilizeDateToString(dateVal);
  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

  const processedDataWithValidation = useMemo(() => {
      const stockMap = new Map<string, number>();
      closingStockItems.forEach(i => stockMap.set(i.description.toLowerCase().trim(), (stockMap.get(i.description.toLowerCase().trim()) || 0) + i.quantity));
      return items.map(item => {
          const itemDesc = item.itemName.toLowerCase().trim();
          const isCustUnknown = !customerLookup.has(item.partyName.toLowerCase().trim());
          const isMatUnknown = !materialLookup.has(itemDesc);
          const currentStock = stockMap.get(itemDesc) || 0;
          return { ...item, isCustUnknown, isMatUnknown, currentStock };
      });
  }, [items, closingStockItems, customerLookup, materialLookup]);

  const filteredItems = useMemo(() => {
    let data = [...processedDataWithValidation];
    if (showErrorsOnly) data = data.filter(i => i.isCustUnknown || i.isMatUnknown);
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        data = data.filter(i => i.orderNo.toLowerCase().includes(lower) || i.partyName.toLowerCase().includes(lower) || i.itemName.toLowerCase().includes(lower));
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
  }, [processedDataWithValidation, searchTerm, sortConfig, showErrorsOnly]);

  const optimizationStats = useMemo(() => {
      const allItemKeys = new Set<string>();
      materials.forEach(m => allItemKeys.add(m.description.toLowerCase().trim()));
      closingStockItems.forEach(s => allItemKeys.add(s.description.toLowerCase().trim()));
      pendingSOItems.forEach(so => allItemKeys.add(so.itemName.toLowerCase().trim()));
      items.forEach(po => allItemKeys.add(po.itemName.toLowerCase().trim()));
      const stockMap = new Map<string, number>();
      closingStockItems.forEach(i => { const key = i.description.toLowerCase().trim(); stockMap.set(key, (stockMap.get(key) || 0) + i.quantity); });
      const soMap = new Map<string, number>();
      pendingSOItems.forEach(i => { const key = i.itemName.toLowerCase().trim(); soMap.set(key, (soMap.get(key) || 0) + i.balanceQty); });
      const poMap = new Map<string, number>();
      items.forEach(i => { const key = i.itemName.toLowerCase().trim(); poMap.set(key, (poMap.get(key) || 0) + i.balanceQty); });
      const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const sales1yMap = new Map<string, number>();
      salesReportItems.forEach(s => {
          const d = new Date(s.date);
          if (d >= oneYearAgo) { const key = s.particulars.toLowerCase().trim(); sales1yMap.set(key, (sales1yMap.get(key) || 0) + s.quantity); }
      });
      let excessVal = 0, excessCount = 0, needVal = 0, needCount = 0, expediteVal = 0, expediteCount = 0, scheduledVal = 0, dueVal = 0;
      const today = new Date();
      allItemKeys.forEach(key => {
          const mat = materials.find(m => m.description.toLowerCase().trim() === key);
          const group = (mat?.materialGroup || '').toLowerCase().trim();
          const stockQty = stockMap.get(key) || 0;
          const soQty = soMap.get(key) || 0;
          const poQty = poMap.get(key) || 0;
          const avg1yQty = (sales1yMap.get(key) || 0) / 12;
          const rate = mat ? (closingStockItems.find(s => s.description.toLowerCase().trim() === key)?.rate || items.find(p => p.itemName.toLowerCase().trim() === key)?.rate || 0) : 0;
          let maxStock = 0;
          if (PLANNED_STOCK_GROUPS.has(group)) maxStock = roundToTen(avg1yQty * 3);
          const netQty = stockQty + poQty - soQty;
          const totalExcess = Math.max(0, netQty - maxStock);
          if (totalExcess > 0 && poQty > 0) { excessVal += Math.min(totalExcess, poQty) * rate; excessCount++; }
          const deficit = maxStock - netQty;
          if (deficit > 0) { needVal += deficit * rate; needCount++; }
          const immediateGap = (soQty + Math.min(maxStock, roundToTen(avg1yQty))) - stockQty;
          if (immediateGap > 0 && poQty > 0) { expediteVal += Math.min(poQty, immediateGap) * rate; expediteCount++; }
      });
      items.forEach(i => {
          const val = (Number(i.balanceQty) || 0) * (Number(i.rate) || 0);
          if (i.dueDate && new Date(i.dueDate).getTime() < today.getTime()) dueVal += val;
          else scheduledVal += val;
      });
      return { schedule: { due: dueVal, scheduled: scheduledVal }, excess: { val: excessVal, count: excessCount }, need: { val: needVal, count: needCount }, expedite: { val: expediteVal, count: expediteCount } };
  }, [items, materials, closingStockItems, pendingSOItems, salesReportItems]);

  const handleDownloadTemplate = () => {
    const headers = [ { "Date": "2024-03-20", "Order": "PO/201", "Party's Name": "Supplier Co", "Name of Item": "Power Cable 4C", "Material Code": "PWR-4C", "Part No": "PN-789", "Ordered": 500, "Balance": 500, "Rate": 120.00, "Discount": 0, "Value": 60000.00, "Due on": "2024-05-10", "OverDue": 0 } ];
    const ws = utils.json_to_sheet(headers);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Pending_PO_Template");
    writeFile(wb, "Pending_PO_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws);
      const newItems: Omit<PendingPOItem, 'id' | 'createdAt'>[] = data.map(row => {
          const getVal = (keys: string[]) => { for (const k of keys) { const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase()); if (foundKey) return row[foundKey]; } return undefined; };
          const parseNum = (val: any) => { if (val === undefined || val === null) return 0; const cleaned = String(val).replace(/[^0-9.-]/g, ''); return parseFloat(cleaned) || 0; };
          const orderedQty = parseNum(getVal(['ordered', 'ordered qty', 'qty']));
          const balanceQty = parseNum(getVal(['balance', 'balance qty', 'pending qty']));
          const rate = parseNum(getVal(['rate', 'price', 'unit rate']));
          const excelValue = parseNum(getVal(['value', 'amount']));
          return {
              date: stabilizeDateToString(getVal(['date', 'po_date', 'po date', 'vch date'])),
              orderNo: String(getVal(['order', 'order no', 'vch no', 'po no']) || ''),
              partyName: String(getVal(['party\'s name', 'party name', 'vendor', 'supplier']) || ''),
              itemName: String(getVal(['name of item', 'item name', 'item', 'description']) || ''),
              materialCode: String(getVal(['material code', 'code', 'material_code']) || ''),
              partNo: String(getVal(['part no', 'partno', 'part_no']) || ''),
              orderedQty, balanceQty, rate, discount: parseNum(getVal(['discount', 'disc'])), value: excelValue || (balanceQty * rate), dueDate: stabilizeDateToString(getVal(['due on', 'due date', 'delivery date'])), overDueDays: parseNum(getVal(['overdue', 'overdue days', 'days']))
          };
      }).filter(i => i.partyName && i.itemName);
      if (newItems.length > 0) { onBulkAdd(newItems); alert(`Imported ${newItems.length} Purchase Orders.`); } else alert("No valid records found.");
    } catch (err) { alert("Error parsing Excel file."); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleHeaderSort = (key: SortKey) => { 
      let direction: 'asc' | 'desc' = 'asc'; 
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; 
      setSortConfig({ key, direction }); 
  };
  const renderSortIcon = (key: SortKey) => { 
      if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />; 
      return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />; 
  };
  
  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-orange-50 text-orange-600`}><AlertTriangle className="w-5 h-5" /></div>
              <div><h3 className="text-sm font-bold text-gray-800">PO Data Integrity Report</h3><p className={`text-[10px] text-gray-500`}>Verify vendors and items against master data.</p></div>
          </div>
          <button onClick={() => setShowErrorsOnly(!showErrorsOnly)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${showErrorsOnly ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{showErrorsOnly ? "Show All Records" : "Audit Mismatches Only"}</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2"><div className="bg-orange-100 p-1.5 rounded text-orange-700"><ShoppingCart className="w-4 h-4"/></div><h2 className="text-sm font-bold text-gray-800">PO Dashboard & Optimization</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-32">
              <ActionCard title="Need to Place PO" value={formatCurrency(optimizationStats.need.val)} count={optimizationStats.need.count} color="red" icon={AlertOctagon} />
              <ActionCard title="Expedite PO" value={formatCurrency(optimizationStats.expedite.val)} count={optimizationStats.expedite.count} color="blue" icon={CheckCircle2} />
              <ActionCard title="Excess PO" value={formatCurrency(optimizationStats.excess.val)} count={optimizationStats.excess.count} color="orange" icon={AlertTriangle} />
              <div className="bg-white p-2 rounded-xl border border-gray-200 flex flex-col items-center"><SimpleDonut title="PO Schedule" data={[{label: 'Scheduled', value: optimizationStats.schedule.scheduled, color: '#3B82F6'}, {label: 'Overdue', value: optimizationStats.schedule.due, color: '#EF4444'}]} /></div>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800">Pending Purchase Orders</h2>
            <div className="flex flex-wrap gap-2">
                <button onClick={() => {}} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium border border-gray-300 shadow-sm hover:bg-gray-50"><FileDown className="w-3.5 h-3.5" /> Export All</button>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm"><Download className="w-3.5 h-3.5" /> Template</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors font-bold"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
         </div>
         <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div><input type="text" placeholder="Search POs..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] text-gray-500 uppercase tracking-tight">
                    <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 font-bold cursor-pointer" onClick={() => handleHeaderSort('date')}>Date {renderSortIcon('date')}</th>
                        <th className="py-2 px-3 font-bold cursor-pointer" onClick={() => handleHeaderSort('orderNo')}>Order No {renderSortIcon('orderNo')}</th>
                        <th className="py-2 px-3 font-bold cursor-pointer" onClick={() => handleHeaderSort('partyName')}>Vendor Name {renderSortIcon('partyName')}</th>
                        <th className="py-2 px-3 font-bold w-64 cursor-pointer" onClick={() => handleHeaderSort('itemName')}>Item Name {renderSortIcon('itemName')}</th>
                        <th className="py-2 px-3 font-bold text-center bg-gray-100 text-gray-700">Stock</th>
                        <th className="py-2 px-3 font-bold text-right">Ordered</th>
                        <th className="py-2 px-3 font-bold text-right">Balance</th>
                        <th className="py-2 px-3 font-bold">Due on</th>
                        <th className="py-2 px-3 font-bold text-center">OD</th>
                        <th className="py-2 px-3 font-bold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {filteredItems.length === 0 ? (<tr><td colSpan={10} className="py-8 text-center text-gray-500 text-xs">No matching purchase orders found.</td></tr>) : (
                        filteredItems.map(item => (
                            <tr key={item.id} className={`hover:bg-orange-50/20 transition-colors text-xs text-gray-700 ${editingId === item.id ? 'bg-orange-50' : ''}`}>
                                {editingId === item.id ? (
                                    <>
                                        <td className="py-2 px-3"><input type="date" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={formatInputDate(editForm?.date || '')} onChange={e => handleInputChange('date', e.target.value)} /></td>
                                        <td className="py-2 px-3"><input type="text" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.orderNo || ''} onChange={e => handleInputChange('orderNo', e.target.value)} /></td>
                                        <td className="py-2 px-3"><input type="text" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.partyName || ''} onChange={e => handleInputChange('partyName', e.target.value)} /></td>
                                        <td className="py-2 px-3"><input type="text" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.itemName || ''} onChange={e => handleInputChange('itemName', e.target.value)} /></td>
                                        <td colSpan={6} className="py-2 px-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={handleSaveEdit} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"><Save className="w-3.5 h-3.5" /></button>
                                                <button onClick={handleCancelEdit} className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="py-2 px-3 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                        <td className="py-2 px-3 font-medium">{item.orderNo}</td>
                                        <td className="py-2 px-3 truncate max-w-[150px]" title={item.partyName}>{item.partyName}</td>
                                        <td className="py-2 px-3 font-medium text-gray-900 truncate" title={item.itemName}>
                                            {item.isMatUnknown ? <span className="text-red-600 bg-red-50 px-1 py-px rounded font-mono" title="Item not in Master. Showing Part No.">{item.partNo || item.itemName}</span> : item.itemName}
                                        </td>
                                        <td className="py-2 px-3 text-center bg-gray-50/40">{item.currentStock}</td>
                                        <td className="py-2 px-3 text-right text-gray-500">{item.orderedQty}</td>
                                        <td className="py-2 px-3 text-right font-medium text-blue-600">{item.balanceQty}</td>
                                        <td className="py-2 px-3 whitespace-nowrap">{formatDateDisplay(item.dueDate)}</td>
                                        <td className="py-2 px-3 text-center">{item.overDueDays > 0 ? <span className="inline-flex px-1 py-px rounded text-[9px] font-bold bg-red-100 text-red-700">{item.overDueDays}D</span> : '-'}</td>
                                        <td className="py-2 px-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
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
      </div>
    </div>
  );
};

export default PendingPOView;
