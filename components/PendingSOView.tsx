import React, { useRef, useMemo, useState } from 'react';
import { PendingSOItem, Material, ClosingStockItem, CustomerMasterItem } from '../types';
import { Trash2, Download, Upload, ClipboardList, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Package, Clock, AlertCircle, CheckCircle2, TrendingUp, AlertOctagon, Layers, FileDown, Pencil, Save, X, UserCheck } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface PendingSOViewProps {
  items: PendingSOItem[];
  materials: Material[];
  customers: CustomerMasterItem[];
  closingStockItems: ClosingStockItem[];
  onBulkAdd: (items: Omit<PendingSOItem, 'id' | 'createdAt'>[]) => void;
  onUpdate: (item: PendingSOItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

type SortKey = keyof PendingSOItem;

const PendingSOView: React.FC<PendingSOViewProps> = ({ 
  items, 
  materials,
  customers,
  closingStockItems,
  onBulkAdd, 
  onUpdate,
  onDelete,
  onClear
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PendingSOItem | null>(null);

  const materialLookup = useMemo(() => new Set(materials.map(m => m.description.toLowerCase().trim())), [materials]);
  const customerLookup = useMemo(() => new Set(customers.map(c => c.customerName.toLowerCase().trim())), [customers]);

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

  const formatDateDisplay = (dateVal: string | Date | number) => {
    if (!dateVal) return '-';
    let date: Date | null = null;
    if (dateVal instanceof Date) date = dateVal;
    else if (typeof dateVal === 'string') {
        const parts = dateVal.split('-');
        if (parts.length === 3) date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        else date = new Date(dateVal);
    } else if (typeof dateVal === 'number') date = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
    if (date && !isNaN(date.getTime())) return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    return String(dateVal);
  };

  const formatInputDate = (dateVal: string | Date | number) => {
      if (!dateVal) return '';
      let date: Date | null = null;
      if (dateVal instanceof Date) date = dateVal;
      else if (typeof dateVal === 'string') date = new Date(dateVal);
      if (date && !isNaN(date.getTime())) return date.toISOString().split('T')[0];
      return '';
  };

  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

  const processedDataWithValidation = useMemo(() => {
    const today = new Date();
    const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfCurrentMonth.setHours(23, 59, 59, 999);
    
    const groupedItems: Record<string, PendingSOItem[]> = {};
    items.forEach(item => { const key = (item.itemName || '').toLowerCase().trim(); if (!groupedItems[key]) groupedItems[key] = []; groupedItems[key].push(item); });
    
    const stockResults = new Map<string, { totalStock: number; allocated: number; shortage: number; status: 'future' | 'full' | 'partial' | 'none' }>();
    Object.keys(groupedItems).forEach(key => {
        const groupOrders = groupedItems[key];
        const stockItem = closingStockItems.find(s => (s.description || '').toLowerCase().trim() === key);
        const totalStock = stockItem ? stockItem.quantity : 0;
        groupOrders.sort((a, b) => { const dateA = new Date(a.dueDate || '9999-12-31').getTime(); const dateB = new Date(b.dueDate || '9999-12-31').getTime(); return dateA - dateB; });
        let runningStock = totalStock;
        groupOrders.forEach(order => {
            const dueDate = order.dueDate ? new Date(order.dueDate) : new Date('9999-12-31');
            const isFuture = dueDate > endOfCurrentMonth;
            if (isFuture) { stockResults.set(order.id, { totalStock, allocated: 0, shortage: order.balanceQty, status: 'future' }); } 
            else {
                const needed = order.balanceQty; const canAllocate = Math.min(runningStock, needed); const shortage = needed - canAllocate; runningStock = Math.max(0, runningStock - canAllocate);
                let status: 'full' | 'partial' | 'none' = 'none'; if (canAllocate === needed) status = 'full'; else if (canAllocate > 0) status = 'partial';
                stockResults.set(order.id, { totalStock, allocated: canAllocate, shortage: shortage, status });
            }
        });
    });

    return items.map(item => {
        const isCustUnknown = !customerLookup.has((item.partyName || '').toLowerCase().trim());
        const isMatUnknown = !materialLookup.has((item.itemName || '').toLowerCase().trim());
        const logic = stockResults.get(item.id) || { totalStock: 0, allocated: 0, shortage: item.balanceQty, status: 'none' };
        return { ...item, ...logic, isCustUnknown, isMatUnknown };
    });
  }, [items, closingStockItems, customerLookup, materialLookup]);

  const mismatchStats = useMemo(() => {
    let recordsWithError = 0;
    const uniqueCustErrors = new Set<string>();
    const uniqueMatErrors = new Set<string>();
    processedDataWithValidation.forEach(i => {
      let hasError = false;
      if (i.isCustUnknown) { uniqueCustErrors.add(i.partyName); hasError = true; }
      if (i.isMatUnknown) { uniqueMatErrors.add(i.itemName); hasError = true; }
      if (hasError) recordsWithError++;
    });
    return { total: recordsWithError, uniqueCust: uniqueCustErrors.size, uniqueMat: uniqueMatErrors.size };
  }, [processedDataWithValidation]);

  const filteredItems = useMemo(() => {
    let data = [...processedDataWithValidation];
    if (showErrorsOnly) data = data.filter(i => i.isCustUnknown || i.isMatUnknown);
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        data = data.filter(i => (i.orderNo || '').toLowerCase().includes(lower) || (i.partyName || '').toLowerCase().includes(lower) || (i.itemName || '').toLowerCase().includes(lower));
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

  const totals = useMemo(() => {
      const t = { ordered: 0, orderedValue: 0, balance: 0, value: 0, allocated: 0, toArrange: 0, uniqueInventory: 0, uniqueOrderCount: 0 };
      const uniqueItemsSet = new Set<string>(); const uniqueOrders = new Set<string>();
      filteredItems.forEach(item => { t.ordered += item.orderedQty || 0; t.orderedValue += (item.orderedQty || 0) * (item.rate || 0); t.balance += item.balanceQty || 0; const itemVal = (item.balanceQty || 0) * (item.rate || 0); t.value += itemVal; t.allocated += item.allocated || 0; t.toArrange += item.shortage || 0; if (item.orderNo) uniqueOrders.add(item.orderNo); const normName = (item.itemName || '').toLowerCase().trim(); if (!uniqueItemsSet.has(normName)) { uniqueItemsSet.add(normName); const stock = closingStockItems.find(s => (s.description || '').toLowerCase().trim() === normName); t.uniqueInventory += stock ? stock.quantity : 0; } });
      t.uniqueOrderCount = uniqueOrders.size; return t;
  }, [filteredItems, closingStockItems]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Quality Header */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${mismatchStats.total > 0 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                {mismatchStats.total > 0 ? <AlertTriangle className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">SO Data Integrity Report</h3>
                <p className={`text-[10px] ${mismatchStats.total > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                  {mismatchStats.total > 0 
                    ? `${mismatchStats.total} orders reference missing Master Data (${mismatchStats.uniqueCust} unknown Customers, ${mismatchStats.uniqueMat} unknown Items)` 
                    : "All SO records match Customer and Material masters perfectly."}
                </p>
              </div>
          </div>
          {mismatchStats.total > 0 && (
              <button 
                onClick={() => setShowErrorsOnly(!showErrorsOnly)} 
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${showErrorsOnly ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >
                {showErrorsOnly ? "Show All Data" : "Filter Errors Only"}
              </button>
          )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 flex-shrink-0">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200"><p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Ordered ({totals.uniqueOrderCount} Orders)</p><div className="flex flex-col"><span className="text-sm font-bold text-blue-600">Qty: {totals.ordered.toLocaleString()}</span><span className="text-xs font-bold text-gray-800">{formatCurrency(totals.orderedValue)}</span></div></div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200"><p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Balance</p><div className="flex flex-col"><span className="text-sm font-bold text-orange-600">Qty: {totals.balance.toLocaleString()}</span><span className="text-xs font-bold text-gray-800">{formatCurrency(totals.value)}</span></div></div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200"><p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Inventory (Ref)</p><p className="text-base font-bold text-gray-600">{totals.uniqueInventory.toLocaleString()}</p></div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200"><p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Allocated (FIFO)</p><p className="text-base font-bold text-emerald-600">{totals.allocated.toLocaleString()}</p></div>
          {totals.toArrange > 0 ? (<div className="bg-red-50 p-3 rounded-xl shadow-sm border border-red-200"><p className="text-[10px] text-red-700 font-medium uppercase mb-0.5">Need To Arrange</p><p className="text-base font-bold text-red-700">{totals.toArrange.toLocaleString()}</p></div>) : (<div className="bg-green-50 p-3 rounded-xl shadow-sm border border-green-200 opacity-50"><p className="text-[10px] text-green-700 font-medium uppercase mb-0.5">Stock Status</p><p className="text-xs font-bold text-green-700 flex items-center gap-1 mt-1"><CheckCircle2 className="w-3.5 h-3.5" /> Sufficient</p></div>)}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-purple-600" /> Pending Sales Orders</h2>
            <div className="flex flex-wrap gap-2">
                <button onClick={() => {}} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 border border-gray-200 shadow-sm"><FileDown className="w-3.5 h-3.5" /> Export All</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
         </div>
         <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div><input type="text" placeholder="Search orders by No, Party, Item or Part No..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1500px]">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 whitespace-nowrap">Date</th>
                        <th className="py-2 px-3 whitespace-nowrap">Order No</th>
                        <th className="py-2 px-3 whitespace-nowrap">Party Name</th>
                        <th className="py-2 px-3 w-64 whitespace-nowrap">Item Name</th>
                        <th className="py-2 px-3 text-right whitespace-nowrap">Ordered</th>
                        <th className="py-2 px-3 text-right whitespace-nowrap">Balance</th>
                        <th className="py-2 px-3 text-right whitespace-nowrap">Due On</th>
                        <th className="py-2 px-3 text-center whitespace-nowrap">OD</th>
                        <th className="py-2 px-3 text-center bg-gray-50 border-l border-gray-100 whitespace-nowrap">Stock</th>
                        <th className="py-2 px-3 text-center bg-gray-50 whitespace-nowrap">Alloc</th>
                        <th className="py-2 px-3 text-center bg-gray-50 border-r border-gray-100 text-red-600 whitespace-nowrap">Arrange</th>
                        <th className="py-2 px-3 text-right whitespace-nowrap">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs">
                    {filteredItems.length === 0 ? (<tr><td colSpan={12} className="py-8 text-center text-gray-500 font-medium">No matching orders found.</td></tr>) : (
                        filteredItems.map(item => (
                            <tr key={item.id} className={`hover:bg-purple-50/20 transition-colors ${editingId === item.id ? 'bg-purple-50' : ''}`}>
                                {editingId === item.id ? (
                                    <>
                                        <td className="py-2 px-3"><input type="date" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={formatInputDate(editForm?.date || '')} onChange={e => handleInputChange('date', e.target.value)} /></td>
                                        <td className="py-2 px-3"><input type="text" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.orderNo || ''} onChange={e => handleInputChange('orderNo', e.target.value)} /></td>
                                        <td className="py-2 px-3"><input type="text" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.partyName || ''} onChange={e => handleInputChange('partyName', e.target.value)} /></td>
                                        <td className="py-2 px-3"><input type="text" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.itemName || ''} onChange={e => handleInputChange('itemName', e.target.value)} /></td>
                                        <td className="py-2 px-3"><input type="number" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-right text-xs focus:outline-none" value={editForm?.orderedQty || 0} onChange={e => handleInputChange('orderedQty', parseFloat(e.target.value))} /></td>
                                        <td className="py-2 px-3"><input type="number" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-right text-xs focus:outline-none" value={editForm?.balanceQty || 0} onChange={e => handleInputChange('balanceQty', parseFloat(e.target.value))} /></td>
                                        <td className="py-2 px-3"><input type="date" className="w-full border border-purple-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={formatInputDate(editForm?.dueDate || '')} onChange={e => handleInputChange('dueDate', e.target.value)} /></td>
                                        <td colSpan={5} className="py-2 px-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={handleSaveEdit} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"><Save className="w-3.5 h-3.5" /></button>
                                                <button onClick={handleCancelEdit} className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                        <td className="py-2 px-3 font-medium text-gray-800 whitespace-nowrap">{item.orderNo}</td>
                                        <td className="py-2 px-3 max-w-[150px]">
                                          <div className="flex flex-col">
                                            <span className="truncate" title={item.partyName}>{item.partyName}</span>
                                            {item.isCustUnknown && <span className="text-[9px] text-red-600 bg-red-50 px-1 py-px rounded border border-red-100 w-fit font-bold mt-0.5 uppercase tracking-tighter">Unknown Cust</span>}
                                          </div>
                                        </td>
                                        <td className="py-2 px-3">
                                          <div className="flex flex-col">
                                            <span className="font-medium line-clamp-1" title={item.itemName}>{item.itemName}</span>
                                            {item.isMatUnknown && <span className="text-[9px] text-red-600 bg-red-50 px-1 py-px rounded border border-red-100 w-fit font-bold mt-0.5 uppercase tracking-tighter">Not in Master</span>}
                                          </div>
                                        </td>
                                        <td className="py-2 px-3 text-right text-gray-600">{item.orderedQty}</td>
                                        <td className="py-2 px-3 text-right font-medium text-orange-600">{item.balanceQty}</td>
                                        <td className="py-2 px-3 whitespace-nowrap text-gray-600">{formatDateDisplay(item.dueDate)}</td>
                                        <td className="py-2 px-3 text-center">{item.overDueDays > 0 ? <span className="inline-flex px-1 py-px rounded text-[9px] font-bold bg-red-100 text-red-700">{item.overDueDays}D</span> : '-'}</td>
                                        <td className="py-2 px-3 text-center border-l border-gray-100 bg-gray-50/40">{item.totalStock}</td>
                                        <td className="py-2 px-3 text-center bg-gray-50/40">{item.status === 'future' ? <span className="text-[9px] text-blue-500">Fut</span> : item.allocated}</td>
                                        <td className="py-2 px-3 text-center border-r border-gray-100 bg-gray-50/40 font-bold text-red-600">{item.shortage || '-'}</td>
                                        <td className="py-2 px-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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

export default PendingSOView;