
import React, { useRef, useMemo, useState } from 'react';
import { PendingPOItem, Material, ClosingStockItem, PendingSOItem, CustomerMasterItem } from '../types';
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
}

type SortKey = keyof PendingPOItem;

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
  pendingSOItems = []
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
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  const formatDateDisplay = (dateVal: string | Date | number) => { if (!dateVal) return '-'; let date: Date | null = null; if (dateVal instanceof Date) date = dateVal; else if (typeof dateVal === 'string') { const parts = dateVal.split('-'); if (parts.length === 3 && parts[0].length === 4) date = new Date(dateVal); else if (parts.length === 3) date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])); else date = new Date(dateVal); } else if (typeof dateVal === 'number') date = new Date((dateVal - (25567 + 2)) * 86400 * 1000); if (date && !isNaN(date.getTime())) return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date); return String(dateVal); };
  const formatInputDate = (dateVal: string | Date | number) => { if (!dateVal) return ''; let date: Date | null = null; if (dateVal instanceof Date) date = dateVal; else if (typeof dateVal === 'string') date = new Date(dateVal); else if (typeof dateVal === 'number') date = new Date((dateVal - (25567 + 2)) * 86400 * 1000); if (date && !isNaN(date.getTime())) return date.toISOString().split('T')[0]; return ''; };
  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

  const processedDataWithValidation = useMemo(() => {
      const stockMap = new Map<string, number>();
      closingStockItems.forEach(i => stockMap.set(i.description.toLowerCase().trim(), (stockMap.get(i.description.toLowerCase().trim()) || 0) + i.quantity));
      
      return items.map(item => {
          const isCustUnknown = !customerLookup.has(item.partyName.toLowerCase().trim());
          const isMatUnknown = !materialLookup.has(item.itemName.toLowerCase().trim());
          const currentStock = stockMap.get(item.itemName.toLowerCase().trim()) || 0;
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
      let scheduledVal = 0;
      let dueVal = 0;
      const today = new Date();
      items.forEach(i => {
          const val = (Number(i.balanceQty) || 0) * (Number(i.rate) || 0);
          if (i.dueDate && new Date(i.dueDate) < today) dueVal += val;
          else scheduledVal += val;
      });
      return {
          schedule: { due: dueVal, scheduled: scheduledVal },
          excess: { val: 0, count: 0 },
          need: { val: 0, count: 0 },
          expedite: { val: 0, count: 0 }
      };
  }, [items]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws);

      const newItems: Omit<PendingPOItem, 'id' | 'createdAt'>[] = data.map(row => {
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
              if (!val) return new Date().toISOString().split('T')[0];
              const d = new Date(val);
              return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          };
          
          const orderedQty = parseNum(getVal(['ordered qty', 'ordered', 'qty', 'ordered quantity', 'quantity']));
          const balanceQty = parseNum(getVal(['balance qty', 'balance', 'bal', 'pending qty', 'pending quantity']));
          const rate = parseNum(getVal(['rate', 'price', 'unit rate', 'eff. rate']));
          const value = parseNum(getVal(['value', 'amount', 'total value', 'total amount']));
          
          return {
              date: parseDateString(getVal(['po_date', 'po date', 'date', 'vch date', 'vch_date', 'order date'])),
              orderNo: String(getVal(['order no', 'order', 'vch no', 'po no', 'voucher no', 'vch no.']) || ''),
              partyName: String(getVal(['party name', 'vendor', 'supplier', 'name', 'party_name', 'vendor name']) || ''),
              itemName: String(getVal(['item name', 'item', 'description', 'particulars', 'item_name']) || ''),
              materialCode: String(getVal(['material code', 'code', 'material_code']) || ''),
              partNo: String(getVal(['part no', 'partno', 'part_no']) || ''),
              orderedQty,
              balanceQty,
              rate,
              discount: parseNum(getVal(['discount', 'disc'])),
              value: value || (balanceQty * rate),
              dueDate: getVal(['due on', 'due date', 'delivery date', 'due_on']) ? parseDateString(getVal(['due on', 'due date', 'delivery date', 'due_on'])) : '',
              overDueDays: 0
          };
      }).filter(i => i.partyName && i.itemName && (i.orderedQty > 0 || i.balanceQty > 0));

      if (newItems.length > 0) {
        onBulkAdd(newItems);
        alert(`Successfully imported ${newItems.length} Purchase Orders.`);
      } else {
        alert("No valid records found. Ensure headers like 'PO Date', 'Vendor Name', and 'Item Name' exist.");
      }
    } catch (err) {
      console.error("Excel Import Error:", err);
      alert("Error parsing Excel file. Please ensure it is a valid .xlsx or .xls file.");
    }
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
              <div className={`p-2 rounded-lg bg-orange-50 text-orange-600`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">PO Data Integrity Report</h3>
                <p className={`text-[10px] text-gray-500`}>
                    Verify vendors and items against master data.
                </p>
              </div>
          </div>
          <button 
            onClick={() => setShowErrorsOnly(!showErrorsOnly)} 
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${showErrorsOnly ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
          >
            {showErrorsOnly ? "Show All Records" : "Audit Mismatches Only"}
          </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
              <div className="bg-orange-100 p-1.5 rounded text-orange-700"><ShoppingCart className="w-4 h-4"/></div>
              <h2 className="text-sm font-bold text-gray-800">PO Dashboard & Optimization</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-32">
              <ActionCard title="Need to Place PO" value={formatCurrency(optimizationStats.need.val)} count={optimizationStats.need.count} color="red" icon={AlertOctagon} />
              <ActionCard title="Expedite PO" value={formatCurrency(optimizationStats.expedite.val)} count={optimizationStats.expedite.count} color="blue" icon={CheckCircle2} />
              <ActionCard title="Excess PO" value={formatCurrency(optimizationStats.excess.val)} count={optimizationStats.excess.count} color="orange" icon={AlertTriangle} />
              <div className="bg-white p-2 rounded-xl border border-gray-200 flex flex-col items-center">
                  <SimpleDonut title="PO Schedule" data={[{label: 'Scheduled', value: optimizationStats.schedule.scheduled, color: '#3B82F6'}, {label: 'Overdue', value: optimizationStats.schedule.due, color: '#EF4444'}]} />
              </div>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800">Pending Purchase Orders</h2>
            <div className="flex flex-wrap gap-2">
                <button onClick={() => {}} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-medium border border-gray-300 shadow-sm hover:bg-gray-50"><FileDown className="w-3.5 h-3.5" /> Export All</button>
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
                                                <button onClick={handleSaveEdit} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200 shadow-sm"><Save className="w-3.5 h-3.5" /></button>
                                                <button onClick={handleCancelEdit} className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200 shadow-sm"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="py-2 px-3 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                        <td className="py-2 px-3 font-medium">{item.orderNo}</td>
                                        <td className="py-2 px-3 truncate max-w-[150px]" title={item.partyName}>{item.partyName}</td>
                                        <td className="py-2 px-3 font-medium text-gray-900 truncate" title={item.itemName}>{item.itemName}</td>
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
