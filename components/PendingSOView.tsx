
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
      const val = (Number(editForm.balanceQty) || 0) * (Number(editForm.rate) || 0);
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
        if (parts.length === 3 && parts[0].length === 4) date = new Date(dateVal);
        else if (parts.length === 3) date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
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
      else if (typeof dateVal === 'number') date = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
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
      filteredItems.forEach(item => { t.ordered += Number(item.orderedQty) || 0; t.orderedValue += (Number(item.orderedQty) || 0) * (Number(item.rate) || 0); t.balance += Number(item.balanceQty) || 0; const itemVal = (Number(item.balanceQty) || 0) * (Number(item.rate) || 0); t.value += itemVal; t.allocated += item.allocated || 0; t.toArrange += item.shortage || 0; if (item.orderNo) t.uniqueOrderCount++; });
      return t;
  }, [filteredItems]);

  const handleDownloadTemplate = () => {
    // Exact headers from user image
    const headers = [
      {
        "Date": "2024-03-20",
        "Order": "SO/101",
        "Party's Name": "Acme Corp",
        "Name of Item": "Cable 1.5mm Black",
        "Material Code": "CBL-1.5-BK",
        "Part No": "P-123",
        "Ordered": 100,
        "Balance": 100,
        "Rate": 45.50,
        "Discount": 0,
        "Value": 4550.00,
        "Due on": "2024-04-15",
        "OverDue": 0
      }
    ];
    const ws = utils.json_to_sheet(headers);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Pending_SO_Template");
    writeFile(wb, "Pending_SO_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws);

      const newItems: Omit<PendingSOItem, 'id' | 'createdAt'>[] = data.map(row => {
          const getVal = (keys: string[]) => {
              for (const k of keys) {
                  const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                  if (foundKey) return row[foundKey];
              }
              return undefined;
          };

          const parseNum = (val: any) => {
              if (val === undefined || val === null) return 0;
              const cleaned = String(val).replace(/[^0-9.-]/g, '');
              return parseFloat(cleaned) || 0;
          };

          const parseDateString = (val: any) => {
              if (val instanceof Date) return val.toISOString().split('T')[0];
              if (typeof val === 'number') return new Date((val - (25567 + 2)) * 86400 * 1000).toISOString().split('T')[0];
              if (!val) return "";
              const d = new Date(val);
              return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : "";
          };
          
          const orderedQty = parseNum(getVal(['ordered', 'ordered qty', 'qty']));
          const balanceQty = parseNum(getVal(['balance', 'balance qty', 'pending qty']));
          const rate = parseNum(getVal(['rate', 'price', 'unit rate']));
          const excelValue = parseNum(getVal(['value', 'amount']));
          
          return {
              date: parseDateString(getVal(['date', 'so_date', 'so date', 'vch date'])),
              orderNo: String(getVal(['order', 'order no', 'vch no', 'so no']) || ''),
              partyName: String(getVal(['party\'s name', 'party name', 'customer', 'name']) || ''),
              itemName: String(getVal(['name of item', 'item name', 'item', 'description']) || ''),
              materialCode: String(getVal(['material code', 'code', 'material_code']) || ''),
              partNo: String(getVal(['part no', 'partno', 'part_no']) || ''),
              orderedQty,
              balanceQty,
              rate,
              discount: parseNum(getVal(['discount', 'disc'])),
              value: excelValue || (balanceQty * rate),
              dueDate: parseDateString(getVal(['due on', 'due date', 'delivery date'])),
              overDueDays: parseNum(getVal(['overdue', 'overdue days', 'days']))
          };
      }).filter(i => i.partyName && i.itemName);

      if (newItems.length > 0) {
        onBulkAdd(newItems);
        alert(`Imported ${newItems.length} Sales Orders.`);
      } else {
        alert("No valid records found. Please check header names.");
      }
    } catch (err) {
      console.error("Excel Import Error:", err);
      alert("Error parsing Excel file.");
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Quality Header */}
      <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-green-50 text-green-600`}>
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">SO Data Integrity Report</h3>
                <p className={`text-[10px] text-gray-500`}>
                  Verify customer names and items against master data for reporting.
                </p>
              </div>
          </div>
          <button 
            onClick={() => setShowErrorsOnly(!showErrorsOnly)} 
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${showErrorsOnly ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            {showErrorsOnly ? "Show All Data" : "Filter Errors Only"}
          </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 flex-shrink-0">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200"><p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Ordered</p><div className="flex flex-col"><span className="text-sm font-bold text-blue-600">Qty: {totals.ordered.toLocaleString()}</span><span className="text-xs font-bold text-gray-800">{formatCurrency(totals.orderedValue)}</span></div></div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200"><p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Total Balance</p><div className="flex flex-col"><span className="text-sm font-bold text-orange-600">Qty: {totals.balance.toLocaleString()}</span><span className="text-xs font-bold text-gray-800">{formatCurrency(totals.value)}</span></div></div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200"><p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Orders Count</p><p className="text-base font-bold text-gray-600">{totals.uniqueOrderCount.toLocaleString()}</p></div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200"><p className="text-[10px] text-gray-500 font-medium uppercase mb-0.5">Allocated (FIFO)</p><p className="text-base font-bold text-emerald-600">{totals.allocated.toLocaleString()}</p></div>
          <div className="bg-red-50 p-3 rounded-xl shadow-sm border border-red-200"><p className="text-[10px] text-red-700 font-medium uppercase mb-0.5">Need To Arrange</p><p className="text-base font-bold text-red-700">{totals.toArrange.toLocaleString()}</p></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-purple-600" /> Pending Sales Orders</h2>
            <div className="flex flex-wrap gap-2">
                <button onClick={() => {}} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 border border-gray-200 shadow-sm"><FileDown className="w-3.5 h-3.5" /> Export All</button>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm"><Download className="w-3.5 h-3.5" /> Template</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors font-bold"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
         </div>
         <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div><input type="text" placeholder="Search orders..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 whitespace-nowrap">Date</th>
                        <th className="py-2 px-3 whitespace-nowrap">Order No</th>
                        <th className="py-2 px-3 whitespace-nowrap">Party Name</th>
                        <th className="py-2 px-3 w-64 whitespace-nowrap">Item Name</th>
                        <th className="py-2 px-3 text-right">Ordered</th>
                        <th className="py-2 px-3 text-right">Balance</th>
                        <th className="py-2 px-3 text-right">Due On</th>
                        <th className="py-2 px-3 text-center">OD</th>
                        <th className="py-2 px-3 text-center bg-gray-50 border-l border-gray-100">Stock</th>
                        <th className="py-2 px-3 text-center bg-gray-50">Alloc</th>
                        <th className="py-2 px-3 text-center bg-gray-50 border-r border-gray-100 text-red-600">Arrange</th>
                        <th className="py-2 px-3 text-right">Act</th>
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
                                        <td className="py-2 px-3 font-medium text-gray-800">{item.orderNo}</td>
                                        <td className="py-2 px-3 truncate max-w-[150px]" title={item.partyName}>{item.partyName}</td>
                                        <td className="py-2 px-3 font-medium line-clamp-1" title={item.itemName}>{item.itemName}</td>
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
