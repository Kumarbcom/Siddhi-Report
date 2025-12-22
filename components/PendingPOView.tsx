
import React, { useRef, useMemo, useState } from 'react';
import { PendingPOItem, Material, ClosingStockItem, PendingSOItem } from '../types';
import { Trash2, Download, Upload, ShoppingCart, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Package, FileDown, Pencil, Save, X, Calendar, PieChart, BarChart3, AlertOctagon, CheckCircle2, Filter } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface PendingPOViewProps {
  items: PendingPOItem[];
  materials: Material[];
  closingStockItems: ClosingStockItem[];
  onBulkAdd: (items: Omit<PendingPOItem, 'id' | 'createdAt'>[]) => void;
  onUpdate: (item: PendingPOItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  pendingSOItems?: PendingSOItem[]; 
}

type SortKey = keyof PendingPOItem;
type PlanningActionFilter = 'ALL' | 'NEED_PLACE' | 'EXPEDITE' | 'EXCESS' | 'OVERDUE';

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
       </div>
    );
};

const HorizontalBar = ({ data, title, color }: { data: { label: string, value: number }[], title: string, color: string }) => {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex flex-col h-full w-full">
            <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-3 border-b border-gray-100 pb-1">{title}</h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-1">
                <div className="flex flex-col gap-4">
                    {data.map((item, i) => (
                        <div key={i} className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="truncate text-gray-700 font-medium flex-1 min-w-0 pr-3" title={item.label}>{item.label}</span>
                                <span className="font-bold text-gray-900 flex-shrink-0 bg-white pl-1">{Math.round(item.value).toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full bg-${color}-500`} style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ActionCard = ({ title, value, count, color, icon: Icon, active, onClick }: any) => (
    <button 
        onClick={onClick}
        className={`${active ? `bg-${color}-100 border-${color}-400 ring-2 ring-${color}-200` : `bg-${color}-50 border-${color}-100`} p-3 rounded-xl border flex flex-col justify-between h-full transition-all text-left hover:shadow-md shadow-sm`}
    >
        <div className="flex justify-between items-start w-full">
            <p className={`text-[10px] font-bold text-${color}-700 uppercase`}>{title}</p>
            <Icon className={`w-4 h-4 text-${color}-600`} />
        </div>
        <div>
            <h3 className={`text-lg font-black text-${color}-900`}>{value}</h3>
            <p className={`text-[10px] text-${color}-600 font-medium`}>{count} Items</p>
        </div>
    </button>
);

const PendingPOView: React.FC<PendingPOViewProps> = ({ 
  items, 
  materials,
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
  const [actionFilter, setActionFilter] = useState<PlanningActionFilter>('ALL');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PendingPOItem | null>(null);

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
      const val = (editForm.balanceQty || 0) * (editForm.rate || 0);
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

  const calculateOverDue = (dueDateStr: string) => { if (!dueDateStr) return 0; const due = new Date(dueDateStr); const today = new Date(); const diffTime = today.getTime() - due.getTime(); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); return diffDays > 0 ? diffDays : 0; };
  const formatDateDisplay = (dateVal: string | Date | number) => { if (!dateVal) return '-'; let date: Date | null = null; if (dateVal instanceof Date) date = dateVal; else if (typeof dateVal === 'string') { const parts = dateVal.split('-'); if (parts.length === 3) date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])); else date = new Date(dateVal); } else if (typeof dateVal === 'number') date = new Date((dateVal - (25567 + 2)) * 86400 * 1000); if (date && !isNaN(date.getTime())) return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date); return String(dateVal); };
  const formatInputDate = (dateVal: string | Date | number) => { if (!dateVal) return ''; let date: Date | null = null; if (dateVal instanceof Date) date = dateVal; else if (typeof dateVal === 'string') date = new Date(dateVal); if (date && !isNaN(date.getTime())) return date.toISOString().split('T')[0]; return ''; };
  const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

  // Mapping items for Action filtering
  const supplyMap = useMemo(() => {
      const map = new Map<string, { excess: boolean, expedite: boolean, shortage: number }>();
      const stockMap = new Map<string, number>();
      closingStockItems.forEach(i => stockMap.set(i.description.toLowerCase().trim(), (stockMap.get(i.description.toLowerCase().trim()) || 0) + i.quantity));
      const soMap = new Map<string, number>();
      pendingSOItems.forEach(i => soMap.set(i.itemName.toLowerCase().trim(), (soMap.get(i.itemName.toLowerCase().trim()) || 0) + i.balanceQty));

      const allUniqueItems = new Set([...stockMap.keys(), ...soMap.keys(), ...items.map(i => i.itemName.toLowerCase().trim())]);
      allUniqueItems.forEach(key => {
          const s = stockMap.get(key) || 0;
          const so = soMap.get(key) || 0;
          const po = items.filter(i => i.itemName.toLowerCase().trim() === key).reduce((a,b) => a + b.balanceQty, 0);
          const net = s + po - so;
          map.set(key, { 
            excess: net > 0 && po > 0, 
            expedite: s < so && po > 0,
            shortage: net < 0 ? Math.abs(net) : 0
          });
      });
      return map;
  }, [items, closingStockItems, pendingSOItems]);

  const optimizationStats = useMemo(() => {
      let eVal = 0, eCount = 0, nVal = 0, nCount = 0, xVal = 0, xCount = 0, dueVal = 0, schVal = 0;
      const topExcess: any[] = [], topExpedite: any[] = [], topNeed: any[] = [];
      const today = new Date();

      supplyMap.forEach((v, key) => {
          const itemPOs = items.filter(i => i.itemName.toLowerCase().trim() === key);
          const rate = itemPOs[0]?.rate || closingStockItems.find(s => s.description.toLowerCase().trim() === key)?.rate || 0;
          if (v.excess) { xVal += v.shortage === 0 ? itemPOs.reduce((a,b) => a+b.value, 0) : 0; xCount++; topExcess.push({label: key, value: xVal}); }
          if (v.expedite) { eVal += itemPOs.reduce((a,b) => a+b.value, 0); eCount++; topExpedite.push({label: key, value: eVal}); }
          if (v.shortage > 0) { nVal += v.shortage * rate; nCount++; topNeed.push({label: key, value: v.shortage * rate}); }
      });
      items.forEach(i => { if(i.dueDate && new Date(i.dueDate) < today) dueVal += i.value; else schVal += i.value; });

      return { 
          excess: { val: xVal, count: xCount, top: topExcess.sort((a,b) => b.value-a.value).slice(0, 5) },
          need: { val: nVal, count: nCount, top: topNeed.sort((a,b) => b.value-a.value).slice(0, 5) },
          expedite: { val: eVal, count: eCount, top: topExpedite.sort((a,b) => b.value-a.value).slice(0, 5) },
          schedule: { due: dueVal, scheduled: schVal }
      };
  }, [items, supplyMap, closingStockItems]);

  const handleSort = (key: SortKey) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  
  // Missing functions fix
  const handleDownloadTemplate = () => {
    const headers = [{ "Date": "2023-10-01", "Order": "PO-2023-001", "Party's Name": "Acme Supplier", "Name of Item": "Ball Bearing 6205", "Material Code": "MECH-001", "Part No": "6205-2RS", "Ordered": 100, "Balance": 50, "Rate": 55.00, "Discount": 0, "Value": 2750.00, "Due on": "2023-10-15", "OverDue": 5 }];
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
      const wb = read(arrayBuffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = utils.sheet_to_json<any>(ws, { cellDates: true, dateNF: 'yyyy-mm-dd' });
      const newItems: Omit<PendingPOItem, 'id' | 'createdAt'>[] = [];
      const formatExcelDate = (val: any) => {
        if (val instanceof Date) return val.toISOString().split('T')[0];
        if (typeof val === 'number') {
          const d = new Date((val - (25567 + 2)) * 86400 * 1000);
          return d.toISOString().split('T')[0];
        }
        return String(val || '');
      };
      data.forEach((row) => {
        const getVal = (keys: string[]) => {
          for (const k of keys) {
            const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
            if (foundKey) return row[foundKey];
          }
          return '';
        };
        const date = formatExcelDate(getVal(['date', 'dt']));
        const orderNo = String(getVal(['order', 'order no', 'po no']) || '');
        const partyName = String(getVal(['party\'s name', 'party name', 'vendor']) || '');
        const itemName = String(getVal(['name of item', 'item name', 'description']) || '');
        const materialCode = String(getVal(['material code']) || '');
        const partNo = String(getVal(['part no']) || '');
        const ordered = parseFloat(getVal(['ordered', 'ordered qty'])) || 0;
        const balance = parseFloat(getVal(['balance', 'bal qty'])) || 0;
        const rate = parseFloat(getVal(['rate', 'price'])) || 0;
        const discount = parseFloat(getVal(['discount'])) || 0;
        let value = parseFloat(getVal(['value', 'val', 'amount'])) || 0;
        if (value === 0 && balance !== 0 && rate !== 0) value = balance * rate;
        const due = formatExcelDate(getVal(['due on', 'due date', 'due']));
        let overDue = parseFloat(getVal(['overdue', 'over due']));
        if (!overDue && due) overDue = calculateOverDue(due);
        if (!partyName && !orderNo && !itemName) return;
        newItems.push({
          date, orderNo, partyName, itemName, materialCode, partNo,
          orderedQty: ordered, balanceQty: balance, rate, discount, value,
          dueDate: due, overDueDays: overDue
        });
      });
      if (newItems.length > 0) {
        onBulkAdd(newItems);
        alert(`Imported ${newItems.length} records.`);
      } else {
        alert("No valid records found.");
      }
    } catch (err) {
      alert("Failed to parse Excel file.");
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />;
  };

  const processedItems = useMemo(() => { 
      let data = [...items]; 
      const today = new Date();

      if (actionFilter !== 'ALL') {
          if (actionFilter === 'NEED_PLACE') data = data.filter(i => (supplyMap.get(i.itemName.toLowerCase().trim())?.shortage || 0) > 0);
          else if (actionFilter === 'EXPEDITE') data = data.filter(i => supplyMap.get(i.itemName.toLowerCase().trim())?.expedite);
          else if (actionFilter === 'EXCESS') data = data.filter(i => supplyMap.get(i.itemName.toLowerCase().trim())?.excess);
          else if (actionFilter === 'OVERDUE') data = data.filter(i => i.dueDate && new Date(i.dueDate) < today);
      }

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
  }, [items, searchTerm, sortConfig, actionFilter, supplyMap]);

  const handleExport = () => { 
    if (processedItems.length === 0) { alert("No data to export."); return; } 
    const data = processedItems.map(i => ({ 
        "Date": formatDateDisplay(i.date), 
        "Order": i.orderNo, 
        "Vendor": i.partyName, 
        "Item": i.itemName, 
        "Ordered": i.orderedQty, 
        "Balance": i.balanceQty, 
        "Rate": i.rate, 
        "Value": i.value, 
        "Due on": formatDateDisplay(i.dueDate), 
        "OverDue": i.overDueDays,
        "Supply Priority": supplyMap.get(i.itemName.toLowerCase().trim())?.expedite ? 'EXPEDITE' : (supplyMap.get(i.itemName.toLowerCase().trim())?.excess ? 'EXCESS' : 'NORMAL')
    })); 
    const ws = utils.json_to_sheet(data); 
    const wb = utils.book_new(); 
    utils.book_append_sheet(wb, ws, "Pending_PO_Filtered"); 
    writeFile(wb, "Pending_PO_Planning_Report.xlsx"); 
  };

  const totals = useMemo(() => { const uniqueOrders = new Set<string>(); const result = items.reduce((acc, item) => { if (item.orderNo) uniqueOrders.add(item.orderNo); return { value: acc.value + ((item.balanceQty || 0) * (item.rate || 0)), orderedValue: acc.orderedValue + ((item.orderedQty || 0) * (item.rate || 0)), ordered: acc.ordered + (item.orderedQty || 0), balance: acc.balance + (item.balanceQty || 0) }; }, { value: 0, orderedValue: 0, ordered: 0, balance: 0 }); return { ...result, uniqueOrderCount: uniqueOrders.size }; }, [items]);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0">
          <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                  <div className="bg-orange-100 p-1.5 rounded text-orange-700"><ShoppingCart className="w-4 h-4"/></div>
                  <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Supply Planning Dashboard</h2>
              </div>
              <button 
                onClick={() => setActionFilter('ALL')}
                className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${actionFilter === 'ALL' ? 'bg-gray-200 text-gray-700' : 'text-blue-600 hover:bg-blue-50'}`}
              >
                  Reset Filters
              </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-32">
              <ActionCard 
                title="Shortage / Need" 
                value={formatCurrency(optimizationStats.need.val)} 
                count={optimizationStats.need.count} 
                color="red" 
                icon={AlertOctagon} 
                active={actionFilter === 'NEED_PLACE'}
                onClick={() => setActionFilter('NEED_PLACE')}
              />
              <ActionCard 
                title="Expedite Required" 
                value={formatCurrency(optimizationStats.expedite.val)} 
                count={optimizationStats.expedite.count} 
                color="blue" 
                icon={CheckCircle2} 
                active={actionFilter === 'EXPEDITE'}
                onClick={() => setActionFilter('EXPEDITE')}
              />
              <ActionCard 
                title="Excess PO Items" 
                value={formatCurrency(optimizationStats.excess.val)} 
                count={optimizationStats.excess.count} 
                color="orange" 
                icon={AlertTriangle} 
                active={actionFilter === 'EXCESS'}
                onClick={() => setActionFilter('EXCESS')}
              />
              <button 
                onClick={() => setActionFilter('OVERDUE')}
                className={`p-3 rounded-xl border flex flex-col justify-between h-full transition-all text-left hover:shadow-md shadow-sm ${actionFilter === 'OVERDUE' ? 'bg-indigo-100 border-indigo-400' : 'bg-white border-gray-200'}`}
              >
                  <div className="flex justify-between items-start w-full">
                      <p className="text-[10px] font-bold text-indigo-700 uppercase">PO Schedule</p>
                      <Calendar className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                      <h3 className="text-sm font-black text-red-700">Overdue: {formatCurrency(optimizationStats.schedule.due)}</h3>
                      <p className="text-[9px] text-gray-500 font-medium">Click to Filter Overdue</p>
                  </div>
              </button>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex gap-4 items-center">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Filter className="w-4 h-4 text-indigo-500" /> Pending PO List {actionFilter !== 'ALL' && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 rounded-full">Filtered: {actionFilter}</span>}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
                <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm"><FileDown className="w-3.5 h-3.5" /> Export Filtered</button>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs border hover:bg-gray-50 transition-colors"><Download className="w-3.5 h-3.5" /> Template</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <div className="w-px h-6 bg-gray-200 mx-0.5 hidden sm:block"></div>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Clear Data</button>
            </div>
         </div>
         <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div><input type="text" placeholder="Search by Order, Vendor or Item..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto h-full">
            <table className="w-full text-left border-collapse min-w-full">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                    <tr className="border-b border-gray-200 text-[10px] text-gray-500 uppercase">
                        <th className="py-2 px-3 font-semibold cursor-pointer" onClick={() => handleSort('date')}>Date {renderSortIcon('date')}</th>
                        <th className="py-2 px-3 font-semibold cursor-pointer" onClick={() => handleSort('orderNo')}>Order {renderSortIcon('orderNo')}</th>
                        <th className="py-2 px-3 font-semibold cursor-pointer" onClick={() => handleSort('partyName')}>Party's Name {renderSortIcon('partyName')}</th>
                        <th className="py-2 px-3 font-semibold w-56 cursor-pointer" onClick={() => handleSort('itemName')}>Name of Item {renderSortIcon('itemName')}</th>
                        <th className="py-2 px-3 font-semibold text-center bg-gray-100 text-gray-700 border-l border-r border-gray-200">Stock</th>
                        <th className="py-2 px-3 font-semibold text-right">Ordered</th>
                        <th className="py-2 px-3 font-semibold text-right cursor-pointer" onClick={() => handleSort('balanceQty')}>Balance {renderSortIcon('balanceQty')}</th>
                        <th className="py-2 px-3 font-semibold cursor-pointer" onClick={() => handleSort('dueDate')}>Due on {renderSortIcon('dueDate')}</th>
                        <th className="py-2 px-3 font-semibold text-center">Status</th>
                        <th className="py-2 px-3 font-semibold text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {processedItems.length === 0 ? (<tr><td colSpan={10} className="py-8 text-center text-gray-500 text-xs">No matching purchase orders found.</td></tr>) : (
                        processedItems.map(item => {
                            const inMaster = materials.some(m => m.description.toLowerCase().trim() === item.itemName.toLowerCase().trim());
                            const stockItem = closingStockItems.find(s => s.description.toLowerCase().trim() === item.itemName.toLowerCase().trim());
                            const currentStock = stockItem ? stockItem.quantity : 0;
                            const planning = supplyMap.get(item.itemName.toLowerCase().trim());
                            
                            return (
                                <tr key={item.id} className={`hover:bg-orange-50/20 transition-colors text-xs text-gray-700 ${editingId === item.id ? 'bg-orange-50' : ''}`}>
                                    {editingId === item.id ? (
                                        <>
                                            <td className="py-2 px-3"><input type="date" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={formatInputDate(editForm?.date || '')} onChange={e => handleInputChange('date', e.target.value)} /></td>
                                            <td className="py-2 px-3"><input type="text" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.orderNo || ''} onChange={e => handleInputChange('orderNo', e.target.value)} /></td>
                                            <td className="py-2 px-3"><input type="text" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.partyName || ''} onChange={e => handleInputChange('partyName', e.target.value)} /></td>
                                            <td className="py-2 px-3"><input type="text" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={editForm?.itemName || ''} onChange={e => handleInputChange('itemName', e.target.value)} /></td>
                                            <td className="py-2 px-3 text-center">-</td>
                                            <td className="py-2 px-3"><input type="number" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none" value={editForm?.orderedQty || 0} onChange={e => handleInputChange('orderedQty', parseFloat(e.target.value))} /></td>
                                            <td className="py-2 px-3"><input type="number" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none" value={editForm?.balanceQty || 0} onChange={e => handleInputChange('balanceQty', parseFloat(e.target.value))} /></td>
                                            <td className="py-2 px-3"><input type="date" className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" value={formatInputDate(editForm?.dueDate || '')} onChange={e => handleInputChange('dueDate', e.target.value)} /></td>
                                            <td className="py-2 px-3 text-center">-</td>
                                            <td className="py-2 px-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={handleSaveEdit} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"><Save className="w-3.5 h-3.5" /></button>
                                                    <button onClick={handleCancelEdit} className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200"><X className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="py-2 px-3 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                            <td className="py-2 px-3 font-medium whitespace-nowrap">{item.orderNo}</td>
                                            <td className="py-2 px-3 max-w-[120px] truncate">{item.partyName}</td>
                                            <td className="py-2 px-3 max-w-[200px]"><div className="flex flex-col"><span className="font-medium text-gray-900 line-clamp-1" title={item.itemName}>{item.itemName}</span>{!inMaster && <span className="inline-flex items-center gap-0.5 mt-0.5 text-[9px] text-red-600 bg-red-50 px-1 py-px rounded border border-red-100 w-fit whitespace-nowrap"><AlertTriangle className="w-2 h-2" /> Not in Master</span>}</div></td>
                                            <td className="py-2 px-3 text-center border-l border-r border-gray-100 bg-gray-50/40"><span className="inline-flex items-center gap-0.5 text-[9px] text-gray-700 bg-white px-1.5 py-0.5 rounded-full border border-gray-200 shadow-sm font-medium whitespace-nowrap" title="Current Stock"><Package className="w-2.5 h-2.5 text-gray-500" /> {currentStock}</span></td>
                                            <td className="py-2 px-3 text-right text-gray-500">{item.orderedQty}</td>
                                            <td className="py-2 px-3 text-right font-medium text-blue-600 bg-blue-50/30 rounded">{item.balanceQty}</td>
                                            <td className="py-2 px-3 whitespace-nowrap">{formatDateDisplay(item.dueDate)}</td>
                                            <td className="py-2 px-3 text-center">
                                                {planning?.expedite ? (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-700 border border-blue-200">EXPEDITE</span>
                                                ) : planning?.excess ? (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-orange-100 text-orange-700 border border-orange-200">EXCESS</span>
                                                ) : item.overDueDays > 0 ? (
                                                    <span className="inline-flex px-1 py-px rounded text-[9px] font-bold bg-red-100 text-red-700 whitespace-nowrap">{item.overDueDays} D Overdue</span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
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

export default PendingPOView;
