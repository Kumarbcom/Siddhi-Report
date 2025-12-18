
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
    if (editForm) setEditForm({ ...editForm, [field]: value });
  };

  /**
   * STRICT INDIAN DATE PARSE (DD.MM.YYYY)
   * Prevents any timezone conversion or 1-day shifting.
   */
  const strictDateParse = (val: any): string => {
    if (!val) return "";
    let y, m, d;

    if (typeof val === 'string') {
        const parts = val.trim().split(/[./-]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) { // DD.MM.YYYY
                d = parseInt(parts[0]); m = parseInt(parts[1]); y = parseInt(parts[2]);
            } else if (parts[0].length === 4) { // YYYY.MM.DD
                y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]);
            }
        }
    } else if (val instanceof Date) {
        y = val.getFullYear(); m = val.getMonth() + 1; d = val.getDate();
    } else if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        y = date.getUTCFullYear(); m = date.getUTCMonth() + 1; d = date.getUTCDate();
    }

    if (y && m && d) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return String(val);
  };

  const formatDateDisplay = (dateVal: string) => {
    if (!dateVal) return '-';
    const date = new Date(dateVal);
    if (!isNaN(date.getTime())) return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    return dateVal;
  };

  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

  const processedDataWithValidation = useMemo(() => {
    const today = new Date();
    const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
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
            if (isFuture) stockResults.set(order.id, { totalStock, allocated: 0, shortage: order.balanceQty, status: 'future' });
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws);
      const newItems: Omit<PendingSOItem, 'id' | 'createdAt'>[] = data.map(row => {
          const getVal = (keys: string[]) => { for (const k of keys) { const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase()); if (foundKey) return row[foundKey]; } return undefined; };
          const parseNum = (val: any) => { if (val === undefined || val === null) return 0; const cleaned = String(val).replace(/[^0-9.-]/g, ''); return parseFloat(cleaned) || 0; };
          const orderedQty = parseNum(getVal(['ordered', 'ordered qty', 'qty']));
          const balanceQty = parseNum(getVal(['balance', 'balance qty', 'pending qty']));
          const rate = parseNum(getVal(['rate', 'price', 'unit rate']));
          return {
              date: strictDateParse(getVal(['date', 'so_date', 'so date', 'vch date'])),
              orderNo: String(getVal(['order', 'order no', 'vch no', 'so no']) || ''),
              partyName: String(getVal(['party\'s name', 'party name', 'customer', 'name']) || ''),
              itemName: String(getVal(['name of item', 'item name', 'item', 'description']) || ''),
              materialCode: String(getVal(['material code', 'code', 'material_code']) || ''),
              partNo: String(getVal(['part no', 'partno', 'part_no']) || ''),
              orderedQty, balanceQty, rate, discount: parseNum(getVal(['discount', 'disc'])), value: (balanceQty * rate), 
              dueDate: strictDateParse(getVal(['due on', 'due date', 'delivery date'])), 
              overDueDays: parseNum(getVal(['overdue', 'overdue days', 'days']))
          };
      }).filter(i => i.partyName && i.itemName && i.date);
      if (newItems.length > 0) { onBulkAdd(newItems); alert(`Imported ${newItems.length} Sales Orders.`); } else alert("No valid records found.");
    } catch (err) { alert("Error parsing Excel file."); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-green-50 text-green-600`}><UserCheck className="w-5 h-5" /></div>
              <div><h3 className="text-sm font-bold text-gray-800">SO Data Integrity Report</h3><p className={`text-[10px] text-gray-500`}>Verify customer names and items against master data.</p></div>
          </div>
          <button onClick={() => setShowErrorsOnly(!showErrorsOnly)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${showErrorsOnly ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{showErrorsOnly ? "Show All Data" : "Filter Errors Only"}</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-purple-600" /> Pending Sales Orders</h2>
            <div className="flex flex-wrap gap-2">
                <button onClick={() => {}} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 border border-gray-200 shadow-sm"><FileDown className="w-3.5 h-3.5" /> Export All</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors font-bold"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
         </div>
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
                        <th className="py-2 px-3 text-right">Balance</th>
                        <th className="py-2 px-3 text-right">Due On</th>
                        <th className="py-2 px-3 text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs">
                    {filteredItems.length === 0 ? (<tr><td colSpan={7} className="py-8 text-center text-gray-500 font-medium">No matching orders found.</td></tr>) : (
                        filteredItems.map(item => (
                            <tr key={item.id} className={`hover:bg-purple-50/20 transition-colors ${editingId === item.id ? 'bg-purple-50' : ''}`}>
                                <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                <td className="py-2 px-3 font-medium text-gray-800">{item.orderNo}</td>
                                <td className="py-2 px-3 truncate max-w-[150px]" title={item.partyName}>{item.partyName}</td>
                                <td className="py-2 px-3 font-medium line-clamp-1" title={item.itemName}>
                                    {item.isMatUnknown ? <span className="text-red-600 bg-red-50 px-1 py-px rounded font-mono" title="Item not in Master.">{item.itemName}</span> : item.itemName}
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-orange-600">{item.balanceQty}</td>
                                <td className="py-2 px-3 whitespace-nowrap text-gray-600">{formatDateDisplay(item.dueDate)}</td>
                                <td className="py-2 px-3 text-right">
                                    <div className="flex justify-end gap-1">
                                        <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </td>
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
