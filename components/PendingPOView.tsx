
import React, { useRef, useMemo, useState } from 'react';
import { PendingPOItem, Material, ClosingStockItem, PendingSOItem, CustomerMasterItem, SalesReportItem } from '../types';
import { Trash2, Upload, ShoppingCart, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, FileDown, Pencil, Save, X, AlertOctagon, UserCheck } from 'lucide-react';
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
}

type SortKey = keyof PendingPOItem;

const PendingPOView: React.FC<PendingPOViewProps> = ({ 
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
  
  const processedDataWithValidation = useMemo(() => {
      return items.map(item => {
          const isCustUnknown = !customerLookup.has(item.partyName.toLowerCase().trim());
          const isMatUnknown = !materialLookup.has(item.itemName.toLowerCase().trim());
          return { ...item, isCustUnknown, isMatUnknown };
      });
  }, [items, customerLookup, materialLookup]);

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
          return {
              date: strictDateParse(getVal(['date', 'po_date', 'po date', 'vch date'])),
              orderNo: String(getVal(['order', 'order no', 'vch no', 'po no']) || ''),
              partyName: String(getVal(['party\'s name', 'party name', 'vendor', 'supplier']) || ''),
              itemName: String(getVal(['name of item', 'item name', 'item', 'description']) || ''),
              materialCode: String(getVal(['material code', 'code', 'material_code']) || ''),
              partNo: String(getVal(['part no', 'partno', 'part_no']) || ''),
              orderedQty, balanceQty, rate, discount: parseNum(getVal(['discount', 'disc'])), value: (balanceQty * rate), 
              dueDate: strictDateParse(getVal(['due on', 'due date', 'delivery date'])), 
              overDueDays: parseNum(getVal(['overdue', 'overdue days', 'days']))
          };
      }).filter(i => i.partyName && i.itemName && i.date);
      if (newItems.length > 0) { onBulkAdd(newItems); alert(`Imported ${newItems.length} Purchase Orders.`); } else alert("No valid records found.");
    } catch (err) { alert("Error parsing Excel file."); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleHeaderSort = (key: SortKey) => { 
      let direction: 'asc' | 'desc' = 'asc'; 
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; 
      setSortConfig({ key, direction }); 
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-orange-600" /> Pending Purchase Orders</h2>
            <div className="flex flex-wrap gap-2">
                <button onClick={() => {}} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium border border-gray-300 shadow-sm hover:bg-gray-50"><FileDown className="w-3.5 h-3.5" /> Export All</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors font-bold"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm text-[10px] text-gray-500 uppercase tracking-tight">
                    <tr className="border-b border-gray-200">
                        <th className="py-2 px-3 font-bold cursor-pointer" onClick={() => handleHeaderSort('date')}>Date</th>
                        <th className="py-2 px-3 font-bold cursor-pointer" onClick={() => handleHeaderSort('orderNo')}>Order No</th>
                        <th className="py-2 px-3 font-bold cursor-pointer" onClick={() => handleHeaderSort('partyName')}>Vendor Name</th>
                        <th className="py-2 px-3 font-bold w-64 cursor-pointer" onClick={() => handleHeaderSort('itemName')}>Item Name</th>
                        <th className="py-2 px-3 font-bold text-right">Balance</th>
                        <th className="py-2 px-3 font-bold">Due on</th>
                        <th className="py-2 px-3 font-bold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {filteredItems.length === 0 ? (<tr><td colSpan={7} className="py-8 text-center text-gray-500 text-xs">No matching purchase orders found.</td></tr>) : (
                        filteredItems.map(item => (
                            <tr key={item.id} className={`hover:bg-orange-50/20 transition-colors text-xs text-gray-700 ${editingId === item.id ? 'bg-orange-50' : ''}`}>
                                <td className="py-2 px-3 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                <td className="py-2 px-3 font-medium">{item.orderNo}</td>
                                <td className="py-2 px-3 truncate max-w-[150px]" title={item.partyName}>{item.partyName}</td>
                                <td className="py-2 px-3 font-medium text-gray-900 truncate" title={item.itemName}>
                                    {item.isMatUnknown ? <span className="text-red-600 bg-red-50 px-1 py-px rounded font-mono" title="Item not in Master.">{item.itemName}</span> : item.itemName}
                                </td>
                                <td className="py-2 px-3 text-right font-medium text-blue-600">{item.balanceQty}</td>
                                <td className="py-2 px-3 whitespace-nowrap">{formatDateDisplay(item.dueDate)}</td>
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

export default PendingPOView;
