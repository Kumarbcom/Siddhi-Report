
import React, { useRef, useMemo, useState } from 'react';
import { PendingSOItem, Material, ClosingStockItem } from '../types';
import { Trash2, Download, Upload, ClipboardList, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Package, Clock, AlertCircle, CheckCircle2, TrendingUp, AlertOctagon, Layers, FileDown, Pencil, Save, X, Filter, CalendarCheck, CalendarDays } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface PendingSOViewProps {
  items: PendingSOItem[];
  materials: Material[];
  closingStockItems: ClosingStockItem[];
  onBulkAdd: (items: Omit<PendingSOItem, 'id' | 'createdAt'>[]) => void;
  onUpdate: (item: PendingSOItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

type SortKey = keyof PendingSOItem;
// Added DUE and SCHEDULED to the filter options
type SupplyStatusFilter = 'ALL' | 'READY' | 'PARTIAL' | 'SHORTAGE' | 'DUE' | 'SCHEDULED';

const PendingSOView: React.FC<PendingSOViewProps> = ({ 
  items, 
  materials,
  closingStockItems,
  onBulkAdd, 
  onUpdate,
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [supplyFilter, setSupplyFilter] = useState<SupplyStatusFilter>('ALL');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PendingSOItem | null>(null);

  const handleEditClick = (item: PendingSOItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = () => {
    if (editForm) {
      const val = (editForm.balanceQty || 0) * (editForm.rate || 0);
      onUpdate({ ...editForm, value: val });
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleInputChange = (field: keyof PendingSOItem, value: any) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  const parseDate = (val: any): Date => {
    if (!val) return new Date(0);
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date((val - (25567 + 2)) * 86400 * 1000);
    if (typeof val === 'string') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        const parts = val.split(/[-/.]/);
        if (parts.length === 3) {
             const d2 = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
             if (!isNaN(d2.getTime())) return d2;
        }
    }
    return new Date(0);
  };

  const calculateOverDue = (dueDateStr: string) => {
    if (!dueDateStr) return 0;
    const due = parseDate(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays > 0 ? diffDays : 0;
  };

  const formatDateDisplay = (dateVal: string | Date | number) => {
    if (!dateVal) return '-';
    let date = parseDate(dateVal);
    if (date && !isNaN(date.getTime()) && date.getTime() > 0) return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    return String(dateVal);
  };

  const formatInputDate = (dateVal: string | Date | number) => {
      if (!dateVal) return '';
      let date = parseDate(dateVal);
      if (date && !isNaN(date.getTime())) return date.toISOString().split('T')[0];
      return '';
  };

  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

  const itemsWithStockLogic = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const groupedItems: Record<string, PendingSOItem[]> = {};
    items.forEach(item => { const key = item.itemName.toLowerCase().trim(); if (!groupedItems[key]) groupedItems[key] = []; groupedItems[key].push(item); });
    
    const stockResults = new Map<string, { totalStock: number; allocated: number; shortage: number; supplyStatus: 'full' | 'partial' | 'none'; deliveryClass: 'due' | 'scheduled' }>();
    
    Object.keys(groupedItems).forEach(key => {
        const groupOrders = groupedItems[key];
        const stockItem = closingStockItems.find(s => s.description.toLowerCase().trim() === key);
        const totalStock = stockItem ? stockItem.quantity : 0;
        
        // FIFO Allocation logic
        groupOrders.sort((a, b) => { 
            const dateA = parseDate(a.dueDate).getTime(); 
            const dateB = parseDate(b.dueDate).getTime(); 
            return (dateA || 9999999999999) - (dateB || 9999999999999); 
        });
        
        let runningStock = totalStock;
        groupOrders.forEach(order => {
            const dueDate = parseDate(order.dueDate);
            const isDue = (dueDate.getTime() > 0 && dueDate <= today) || (order.overDueDays || 0) > 0;
            const deliveryClass = isDue ? 'due' : 'scheduled';

            const needed = order.balanceQty; 
            const canAllocate = Math.min(runningStock, needed); 
            const shortage = needed - canAllocate; 
            runningStock = Math.max(0, runningStock - canAllocate);
            
            let supplyStatus: 'full' | 'partial' | 'none' = 'none'; 
            if (canAllocate === needed) supplyStatus = 'full'; 
            else if (canAllocate > 0) supplyStatus = 'partial';
            
            stockResults.set(order.id, { totalStock, allocated: canAllocate, shortage, supplyStatus, deliveryClass });
        });
    });
    
    return items.map(item => { 
        const logic = stockResults.get(item.id) || { totalStock: 0, allocated: 0, shortage: item.balanceQty, supplyStatus: 'none', deliveryClass: 'scheduled' }; 
        return { ...item, ...logic }; 
    });
  }, [items, closingStockItems]);

  const handleSort = (key: SortKey) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  
  const processedItems = useMemo(() => { 
    let data = [...itemsWithStockLogic]; 
    
    if (supplyFilter !== 'ALL') {
        if (supplyFilter === 'READY') data = data.filter(i => i.supplyStatus === 'full');
        else if (supplyFilter === 'PARTIAL') data = data.filter(i => i.supplyStatus === 'partial');
        else if (supplyFilter === 'SHORTAGE') data = data.filter(i => i.shortage > 0);
        else if (supplyFilter === 'DUE') data = data.filter(i => i.deliveryClass === 'due');
        else if (supplyFilter === 'SCHEDULED') data = data.filter(i => i.deliveryClass === 'scheduled');
    }

    if (searchTerm) { 
        const lower = searchTerm.toLowerCase(); 
        data = data.filter(i => i.orderNo.toLowerCase().includes(lower) || i.partyName.toLowerCase().includes(lower) || i.itemName.toLowerCase().includes(lower) || i.partNo.toLowerCase().includes(lower)); 
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
  }, [itemsWithStockLogic, searchTerm, sortConfig, supplyFilter]);
  
  const totals = useMemo(() => {
      const t = { ordered: 0, orderedValue: 0, balance: 0, value: 0, allocated: 0, toArrange: 0, uniqueInventory: 0, uniqueOrderCount: 0, dueValue: 0, scheduledValue: 0 };
      const uniqueItemsSet = new Set<string>(); const uniqueOrders = new Set<string>();
      
      itemsWithStockLogic.forEach(item => { 
          t.ordered += item.orderedQty || 0; 
          t.orderedValue += (item.orderedQty || 0) * (item.rate || 0); 
          t.balance += item.balanceQty || 0; 
          
          const itemVal = (item.balanceQty || 0) * (item.rate || 0); 
          t.value += itemVal; 
          
          if (item.deliveryClass === 'due') t.dueValue += itemVal;
          else t.scheduledValue += itemVal;

          t.allocated += item.allocated || 0; 
          t.toArrange += item.shortage || 0; 
          
          if (item.orderNo) uniqueOrders.add(item.orderNo); 
          const normName = item.itemName.toLowerCase().trim(); 
          if (!uniqueItemsSet.has(normName)) { 
              uniqueItemsSet.add(normName); 
              const stock = closingStockItems.find(s => s.description.toLowerCase().trim() === normName); 
              t.uniqueInventory += stock ? stock.quantity : 0; 
          } 
      });
      t.uniqueOrderCount = uniqueOrders.size; 
      return t;
  }, [itemsWithStockLogic, closingStockItems]);

  const handleDownloadTemplate = () => { const headers = [{ "Date": "2023-10-01", "Order": "SO-2023-001", "Party's Name": "Acme Corp", "Name of Item": "Ball Bearing 6205", "Material Code": "MECH-001", "Part No": "6205-2RS", "Ordered": 100, "Balance": 50, "Rate": 55.00, "Discount": 0, "Value": 2750.00, "Due on": "2023-10-15", "OverDue": 5 }]; const ws = utils.json_to_sheet(headers); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Pending_SO_Template"); writeFile(wb, "Pending_SO_Template.xlsx"); };
  
  const handleExport = () => { 
    if (processedItems.length === 0) { alert("No data to export."); return; } 
    const data = processedItems.map(i => ({ 
        "Date": formatDateDisplay(i.date), 
        "Order": i.orderNo, 
        "Party's Name": i.partyName, 
        "Name of Item": i.itemName, 
        "Ordered": i.orderedQty, 
        "Balance": i.balanceQty, 
        "Allocated": i.allocated,
        "Shortage": i.shortage,
        "Type": i.deliveryClass.toUpperCase(),
        "Supply Status": i.supplyStatus.toUpperCase(),
        "Rate": i.rate, 
        "Value": i.value, 
        "Due on": formatDateDisplay(i.dueDate), 
        "OverDue": i.overDueDays 
    })); 
    const ws = utils.json_to_sheet(data); 
    const wb = utils.book_new(); 
    utils.book_append_sheet(wb, ws, "Pending_SO_Filtered"); 
    writeFile(wb, "Pending_SO_Report.xlsx"); 
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer(); const wb = read(arrayBuffer); const ws = wb.Sheets[wb.SheetNames[0]]; const data = utils.sheet_to_json<any>(ws, { cellDates: true, dateNF: 'yyyy-mm-dd' }); const newItems: Omit<PendingSOItem, 'id' | 'createdAt'>[] = [];
      const formatExcelDate = (val: any) => { if (val instanceof Date) return val.toISOString().split('T')[0]; if (typeof val === 'number') { const d = new Date((val - (25567 + 2)) * 86400 * 1000); return d.toISOString().split('T')[0]; } return String(val || ''); };
      data.forEach((row) => {
         const getVal = (keys: string[]) => { for (const k of keys) { const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase()); if (foundKey) return row[foundKey]; } return ''; };
         const date = formatExcelDate(getVal(['date', 'dt'])); const orderNo = String(getVal(['order', 'order no', 'so no']) || ''); const partyName = String(getVal(['party\'s name', 'party name']) || ''); const itemName = String(getVal(['name of item', 'item name', 'description']) || ''); const materialCode = String(getVal(['material code']) || ''); const partNo = String(getVal(['part no']) || ''); const ordered = parseFloat(getVal(['ordered', 'ordered qty'])) || 0; const balance = parseFloat(getVal(['balance', 'bal qty'])) || 0; const rate = parseFloat(getVal(['rate', 'price'])) || 0; const discount = parseFloat(getVal(['discount'])) || 0; let value = parseFloat(getVal(['value', 'val', 'amount'])) || 0; if (value === 0 && balance !== 0 && rate !== 0) value = balance * rate; const due = formatExcelDate(getVal(['due on', 'due date', 'due'])); let overDue = parseFloat(getVal(['overdue', 'over due'])); if (!overDue && due) overDue = calculateOverDue(due);
         if (!partyName && !orderNo && !itemName) return;
         newItems.push({ date, orderNo, partyName, itemName, materialCode, partNo, orderedQty: ordered, balanceQty: balance, rate, discount, value, dueDate: due, overDueDays: overDue });
      });
      if (newItems.length > 0) { onBulkAdd(newItems); alert(`Imported ${newItems.length} records.`); } else { alert("No valid records found."); }
    } catch (err) { alert("Failed to parse Excel file."); } if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const renderSortIcon = (key: SortKey) => { if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />; return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-purple-500" /> : <ArrowDown className="w-3 h-3 text-purple-500" />; };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 flex-shrink-0">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
              <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Pending ({totals.uniqueOrderCount} Orders)</p>
              <div className="flex flex-col"><span className="text-sm font-bold text-gray-900">Qty: {totals.balance.toLocaleString()}</span><span className="text-xs font-bold text-gray-800">{formatCurrency(totals.value)}</span></div>
          </div>
          <div className="bg-red-50 p-3 rounded-xl shadow-sm border border-red-100">
              <div className="flex items-center justify-between mb-0.5"><p className="text-[10px] text-red-700 font-bold uppercase">Due Orders</p><CalendarCheck className="w-3.5 h-3.5 text-red-500" /></div>
              <p className="text-sm font-black text-red-800">{formatCurrency(totals.dueValue)}</p>
              <p className="text-[9px] text-red-600 font-medium italic">Require Immediate Action</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl shadow-sm border border-blue-100">
              <div className="flex items-center justify-between mb-0.5"><p className="text-[10px] text-blue-700 font-bold uppercase">Scheduled Orders</p><CalendarDays className="w-3.5 h-3.5 text-blue-500" /></div>
              <p className="text-sm font-black text-blue-800">{formatCurrency(totals.scheduledValue)}</p>
              <p className="text-[9px] text-blue-600 font-medium italic">Future Deliveries</p>
          </div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
              <p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Allocated (FIFO)</p>
              <p className="text-base font-bold text-emerald-600">{totals.allocated.toLocaleString()}</p>
          </div>
          {totals.toArrange > 0 ? (
              <div className="bg-orange-50 p-3 rounded-xl shadow-sm border border-orange-200">
                  <p className="text-[10px] text-orange-700 font-medium uppercase mb-0.5">Shortage To Arrange</p>
                  <p className="text-base font-bold text-orange-700">{totals.toArrange.toLocaleString()}</p>
              </div>
          ) : (
              <div className="bg-green-50 p-3 rounded-xl shadow-sm border border-green-200">
                  <p className="text-[10px] text-green-700 font-medium uppercase mb-0.5">Stock Status</p>
                  <p className="text-xs font-bold text-green-700 flex items-center gap-1 mt-1"><CheckCircle2 className="w-3.5 h-3.5" /> Sufficient</p>
              </div>
          )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-purple-600" /> Sales Order Pipeline</h2>
            <div className="flex flex-wrap gap-2">
                <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"><FileDown className="w-3.5 h-3.5" /> Export Filtered</button>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs border hover:bg-gray-50 transition-colors"><Download className="w-3.5 h-3.5" /> Template</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <div className="w-px h-6 bg-gray-200 mx-0.5 hidden sm:block"></div>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Clear Data</button>
            </div>
         </div>
         
         <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div>
                <input type="text" placeholder="Search orders..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 overflow-x-auto">
                {(['ALL', 'DUE', 'SCHEDULED', 'READY', 'SHORTAGE'] as SupplyStatusFilter[]).map(f => (
                    <button 
                        key={f} 
                        onClick={() => setSupplyFilter(f)} 
                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all whitespace-nowrap ${supplyFilter === f ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto h-full">
            <table className="w-full text-left border-collapse min-w-full">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('date')}>Date {renderSortIcon('date')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('orderNo')}>Order {renderSortIcon('orderNo')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('partyName')}>Party's Name {renderSortIcon('partyName')}</th>
                        <th className="py-2 px-3 cursor-pointer hover:bg-gray-100 w-56" onClick={() => handleSort('itemName')}>Name of Item {renderSortIcon('itemName')}</th>
                        <th className="py-2 px-3 text-right">Bal Qty</th>
                        <th className="py-2 px-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('dueDate')}>Due On {renderSortIcon('dueDate')}</th>
                        <th className="py-2 px-3 text-center">Status</th>
                        <th className="py-2 px-3 text-center bg-gray-50 border-l border-gray-100">Stock</th>
                        <th className="py-2 px-3 text-center bg-gray-50">Alloc</th>
                        <th className="py-2 px-3 text-center bg-gray-50 border-r border-gray-100 text-red-600">Shortage</th>
                        <th className="py-2 px-3 text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs">
                    {processedItems.length === 0 ? (<tr><td colSpan={11} className="py-8 text-center text-gray-500">No matching orders found.</td></tr>) : (
                        processedItems.map(item => {
                            const inMaster = materials.some(m => m.description.toLowerCase().trim() === item.itemName.toLowerCase().trim());
                            return (
                                <tr key={item.id} className={`hover:bg-purple-50/20 transition-colors ${editingId === item.id ? 'bg-purple-50' : ''}`}>
                                    {editingId === item.id ? (
                                        <>
                                            <td className="py-2 px-3"><input type="date" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={formatInputDate(editForm?.date || '')} onChange={e => handleInputChange('date', e.target.value)} /></td>
                                            <td className="py-2 px-3"><input type="text" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.orderNo || ''} onChange={e => handleInputChange('orderNo', e.target.value)} /></td>
                                            <td className="py-2 px-3"><input type="text" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.partyName || ''} onChange={e => handleInputChange('partyName', e.target.value)} /></td>
                                            <td className="py-2 px-3"><input type="text" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.itemName || ''} onChange={e => handleInputChange('itemName', e.target.value)} /></td>
                                            <td className="py-2 px-3"><input type="number" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none" value={editForm?.balanceQty || 0} onChange={e => handleInputChange('balanceQty', parseFloat(e.target.value))} /></td>
                                            <td className="py-2 px-3"><input type="date" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={formatInputDate(editForm?.dueDate || '')} onChange={e => handleInputChange('dueDate', e.target.value)} /></td>
                                            <td colSpan={4} className="py-2 px-3 text-center text-[10px] text-gray-400 italic">Classification dynamic</td>
                                            <td className="py-2 px-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={handleSaveEdit} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"><Save className="w-3.5 h-3.5" /></button>
                                                    <button onClick={handleCancelEdit} className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                            <td className="py-2 px-3 font-medium text-gray-800 whitespace-nowrap">{item.orderNo}</td>
                                            <td className="py-2 px-3 text-gray-700 max-w-[120px] truncate" title={item.partyName}>{item.partyName}</td>
                                            <td className="py-2 px-3 text-gray-800 max-w-[200px]">
                                                <div className="flex flex-col">
                                                    <span className="font-medium line-clamp-1" title={item.itemName}>{item.itemName}</span>
                                                    {!inMaster && <span className="inline-flex items-center gap-0.5 mt-0.5 text-[8px] text-red-600 bg-red-50 px-1 py-px rounded border border-red-100 w-fit whitespace-nowrap font-bold"><AlertTriangle className="w-2 h-2" /> Missing in Master</span>}
                                                </div>
                                            </td>
                                            <td className="py-2 px-3 text-right font-black text-gray-900">{item.balanceQty}</td>
                                            <td className="py-2 px-3 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-gray-600">{formatDateDisplay(item.dueDate)}</span>
                                                    {item.overDueDays > 0 && <span className="text-[8px] font-black text-red-600 uppercase tracking-tighter">{item.overDueDays} days Overdue</span>}
                                                </div>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <span className={`inline-block px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase shadow-sm border ${item.deliveryClass === 'due' ? 'bg-red-600 text-white border-red-700' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                    {item.deliveryClass}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-center border-l border-gray-100 bg-gray-50/40"><span className="text-gray-600 font-medium">{item.totalStock}</span></td>
                                            <td className="py-2 px-3 text-center bg-gray-50/40">
                                                <span className={`inline-flex items-center gap-1 text-[10px] px-1 py-px rounded font-bold whitespace-nowrap ${item.supplyStatus === 'full' ? 'text-emerald-700 bg-emerald-100' : item.supplyStatus === 'partial' ? 'text-orange-700 bg-orange-100' : 'text-gray-400'}`}>
                                                    {item.allocated}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-center border-r border-gray-100 bg-gray-50/40">
                                                {item.shortage > 0 ? <span className="font-bold text-red-600 bg-red-50 px-1 py-px rounded">{item.shortage}</span> : <span className="text-emerald-500">✔</span>}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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
      </div>
    </div>
  );
};

export default PendingSOView;
