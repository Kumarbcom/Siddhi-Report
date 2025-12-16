
import React, { useRef, useMemo, useState } from 'react';
import { PendingPOItem, Material, ClosingStockItem, PendingSOItem } from '../types';
import { Trash2, Download, Upload, ShoppingCart, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Package, FileDown, Pencil, Save, X, Calendar, PieChart, BarChart3, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

interface PendingPOViewProps {
  items: PendingPOItem[];
  materials: Material[];
  closingStockItems: ClosingStockItem[];
  onBulkAdd: (items: Omit<PendingPOItem, 'id' | 'createdAt'>[]) => void;
  onUpdate: (item: PendingPOItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  pendingSOItems?: PendingSOItem[]; // Added for logic
}

type SortKey = keyof PendingPOItem;

// Re-using chart components locally to avoid complex exports/refactors in this specific request scope
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
                     // Handle single slice case
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
                   <div key={i} className="flex justify-between text-[9px]">
                       <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></div><span className="text-gray-600">{d.label}</span></div>
                       <span className="font-bold">{d.value.toLocaleString()}</span>
                   </div>
               ))}
           </div>
       </div>
    );
};

const HorizontalBar = ({ data, title, color }: { data: { label: string, value: number }[], title: string, color: string }) => {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex flex-col h-full w-full">
            <h4 className="text-[11px] font-bold text-gray-600 uppercase mb-3 border-b border-gray-100 pb-1">{title}</h4>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <div className="flex flex-col gap-3">
                    {data.map((item, i) => (
                        <div key={i} className="flex flex-col gap-1">
                            <div className="flex justify-between items-end text-[10px]">
                                <span className="truncate text-gray-700 font-medium max-w-[70%]" title={item.label}>{item.label}</span>
                                <span className="font-bold text-gray-900">{Math.round(item.value).toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full bg-${color}-500`} style={{ width: `${(item.value / maxVal) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
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
  closingStockItems,
  onBulkAdd, 
  onUpdate,
  onDelete,
  onClear,
  pendingSOItems = [] // Use items passed via context/props even if optional in type def
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

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

  // --- Optimization Logic ---
  const optimizationStats = useMemo(() => {
      // 1. Map Stock & SO by Item Name
      const stockMap = new Map<string, number>();
      closingStockItems.forEach(i => stockMap.set(i.description.toLowerCase().trim(), (stockMap.get(i.description.toLowerCase().trim()) || 0) + i.quantity));
      
      const soMap = new Map<string, number>();
      // Use items passed via prop, fallback to localStorage if prop is empty (safety net)
      const soSource = (pendingSOItems && pendingSOItems.length > 0) ? pendingSOItems : (localStorage.getItem('pending_so_db_v1') ? JSON.parse(localStorage.getItem('pending_so_db_v1')!) : []); 
      soSource.forEach((i: any) => soMap.set(i.itemName.toLowerCase().trim(), (soMap.get(i.itemName.toLowerCase().trim()) || 0) + i.balanceQty));

      // 2. Iterate POs
      let scheduledVal = 0;
      let dueVal = 0;
      let excessVal = 0;
      let excessCount = 0;
      let expediteVal = 0;
      let expediteCount = 0;
      
      // Need Place PO is tricky because it depends on items NOT in PO. 
      // But user asked: "Add Stock + PO - SO then show Need place PO". 
      // This implies checking the Net Balance for items involved in POs or generally. 
      // To show "Need Place PO" generally, we'd need to iterate ALL items. 
      // However, usually in a "Pending PO" view, we focus on the POs themselves. 
      // But the prompt specifically asks to calculate shortage.
      // Let's iterate all UNIQUE items found in Stock + SO + PO for a global view? 
      // Or restrict to items currently IN PO? 
      // Let's create a global set of items for correct "Need" calculation.
      const allItems = new Set<string>([...stockMap.keys(), ...soMap.keys(), ...items.map(i => i.itemName.toLowerCase().trim())]);
      
      let totalShortageVal = 0;
      let totalShortageCount = 0;

      const topExcessItems: any[] = [];
      const topExpediteItems: any[] = [];
      const topNeedItems: any[] = [];

      allItems.forEach(itemKey => {
          const stockQty = stockMap.get(itemKey) || 0;
          const soQty = soMap.get(itemKey) || 0;
          // Sum PO for this item
          const itemPOs = items.filter(i => i.itemName.toLowerCase().trim() === itemKey);
          const poQty = itemPOs.reduce((a,b) => a + b.balanceQty, 0);
          // Rate Estimate (from PO or Stock)
          const rate = itemPOs.length > 0 ? itemPOs[0].rate : (closingStockItems.find(s => s.description.toLowerCase().trim() === itemKey)?.rate || 0);

          // Logic: Stock + PO - SO
          const net = stockQty + poQty - soQty;

          // 1. Need Place PO (Shortage) -> If Net < 0
          if (net < 0) {
              const shortageQty = Math.abs(net);
              const val = shortageQty * rate;
              totalShortageVal += val;
              totalShortageCount++;
              if (val > 0) topNeedItems.push({ label: itemKey, value: val });
          }

          // 2. Excess PO -> If (Stock + PO - SO) > 0 AND PO > 0
          // Excess amount is the portion of PO that pushes Net > 0.
          if (net > 0 && poQty > 0) {
              // Excess is min(Net, PO). i.e. if Net is 10 and PO is 5, Excess is 5. If Net is 5 and PO is 10, Excess is 5.
              const excessQty = Math.min(net, poQty);
              const val = excessQty * rate;
              excessVal += val;
              excessCount++;
              if (val > 0) topExcessItems.push({ label: itemKey, value: val });
          }

          // 3. Expedite PO -> If Stock < SO (Immediate Shortage) BUT Stock + PO >= SO (PO covers it)
          // or Stock + PO is still < SO but PO exists (Partial Cover).
          // Basically: There is a PO, and Stock < SO.
          if (stockQty < soQty && poQty > 0) {
              // The amount to expedite is the gap `SO - Stock`, capped by `PO`.
              const gap = soQty - stockQty;
              const expediteQty = Math.min(gap, poQty);
              const val = expediteQty * rate;
              expediteVal += val;
              expediteCount++;
              if (val > 0) topExpediteItems.push({ label: itemKey, value: val });
          }
      });

      // PO Schedule Stats (Only iterate PO Items)
      const today = new Date();
      items.forEach(i => {
          const val = (i.balanceQty || 0) * (i.rate || 0);
          if (i.dueDate && new Date(i.dueDate) < today) dueVal += val;
          else scheduledVal += val;
      });

      return {
          schedule: { due: dueVal, scheduled: scheduledVal },
          excess: { val: excessVal, count: excessCount, top: topExcessItems.sort((a,b) => b.value - a.value).slice(0, 10) },
          need: { val: totalShortageVal, count: totalShortageCount, top: topNeedItems.sort((a,b) => b.value - a.value).slice(0, 10) },
          expedite: { val: expediteVal, count: expediteCount, top: topExpediteItems.sort((a,b) => b.value - a.value).slice(0, 10) },
          topAll: [...topExcessItems, ...topNeedItems, ...topExpediteItems].sort((a,b) => b.value - a.value).slice(0, 10) // Fallback list
      };
  }, [items, closingStockItems, pendingSOItems]);

  const handleDownloadTemplate = () => { const headers = [{ "Date": "2023-10-01", "Order": "PO-2023-901", "Party's Name": "Steel Supplies Co", "Name of Item": "Steel Rod 10mm", "Material Code": "RAW-STL", "Part No": "STL-10MM", "Ordered": 500, "Balance": 100, "Rate": 15.50, "Discount": 2, "Value": 1550.00, "Due on": "2023-10-20", "OverDue": 0 }]; const ws = utils.json_to_sheet(headers); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Pending_PO_Template"); writeFile(wb, "Pending_PO_Template.xlsx"); };
  const handleExport = () => { if (items.length === 0) { alert("No data to export."); return; } const data = items.map(i => ({ "Date": formatDateDisplay(i.date), "Order": i.orderNo, "Party's Name": i.partyName, "Name of Item": i.itemName, "Material Code": i.materialCode, "Part No": i.partNo, "Ordered": i.orderedQty, "Balance": i.balanceQty, "Rate": i.rate, "Discount": i.discount, "Value": i.value, "Due on": formatDateDisplay(i.dueDate), "OverDue": i.overDueDays })); const ws = utils.json_to_sheet(data); const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Pending_PO"); writeFile(wb, "Pending_PO_Export.xlsx"); };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer(); const wb = read(arrayBuffer); const ws = wb.Sheets[wb.SheetNames[0]]; const data = utils.sheet_to_json<any>(ws, { cellDates: true, dateNF: 'yyyy-mm-dd' }); const newItems: Omit<PendingPOItem, 'id' | 'createdAt'>[] = [];
      const formatExcelDate = (val: any) => { if (val instanceof Date) return val.toISOString().split('T')[0]; if (typeof val === 'number') { const d = new Date((val - (25567 + 2)) * 86400 * 1000); return d.toISOString().split('T')[0]; } return String(val || ''); };
      data.forEach((row) => {
         const getVal = (keys: string[]) => { for (const k of keys) { const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase()); if (foundKey) return row[foundKey]; } return ''; };
         const date = formatExcelDate(getVal(['date', 'dt'])); const orderNo = String(getVal(['order', 'order no']) || ''); const partyName = String(getVal(['party\'s name', 'party name', 'party']) || ''); const itemName = String(getVal(['name of item', 'item name', 'item']) || ''); const materialCode = String(getVal(['material code', 'mat code']) || ''); const partNo = String(getVal(['part no']) || ''); const ordered = parseFloat(getVal(['ordered', 'ordered qty'])) || 0; const balance = parseFloat(getVal(['balance', 'bal', 'bal qty'])) || 0; const rate = parseFloat(getVal(['rate', 'price'])) || 0; const discount = parseFloat(getVal(['discount', 'disc'])) || 0; let value = parseFloat(getVal(['value', 'val', 'amount'])) || 0; if (value === 0 && balance !== 0 && rate !== 0) value = balance * rate; const due = formatExcelDate(getVal(['due on', 'due', 'due date'])); let overDue = parseFloat(getVal(['overdue', 'over due', 'od days'])); if (!overDue && due) overDue = calculateOverDue(due);
         if (!partyName && !orderNo && !itemName) return;
         newItems.push({ date, orderNo, partyName, itemName, materialCode, partNo, orderedQty: ordered, balanceQty: balance, rate, discount, value, dueDate: due, overDueDays: overDue });
      });
      if (newItems.length > 0) { onBulkAdd(newItems); alert(`Imported ${newItems.length} records.`); } else { alert("No valid records found."); }
    } catch (err) { alert("Failed to parse Excel file."); } if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSort = (key: SortKey) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  const processedItems = useMemo(() => { let data = [...items]; if (searchTerm) { const lower = searchTerm.toLowerCase(); data = data.filter(i => i.orderNo.toLowerCase().includes(lower) || i.partyName.toLowerCase().includes(lower) || i.itemName.toLowerCase().includes(lower)); } if (sortConfig) { data.sort((a, b) => { if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1; if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }); } return data; }, [items, searchTerm, sortConfig]);
  const renderSortIcon = (key: SortKey) => { if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-400" />; return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-orange-500" /> : <ArrowDown className="w-3 h-3 text-orange-500" />; };
  const totals = useMemo(() => { const uniqueOrders = new Set<string>(); const result = items.reduce((acc, item) => { if (item.orderNo) uniqueOrders.add(item.orderNo); return { value: acc.value + ((item.balanceQty || 0) * (item.rate || 0)), orderedValue: acc.orderedValue + ((item.orderedQty || 0) * (item.rate || 0)), ordered: acc.ordered + (item.orderedQty || 0), balance: acc.balance + (item.balanceQty || 0) }; }, { value: 0, orderedValue: 0, ordered: 0, balance: 0 }); return { ...result, uniqueOrderCount: uniqueOrders.size }; }, [items]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Dashboard Section */}
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
                  <SimpleDonut 
                    title="PO Schedule" 
                    data={[
                        {label: 'Scheduled', value: optimizationStats.schedule.scheduled, color: '#3B82F6'}, 
                        {label: 'Overdue', value: optimizationStats.schedule.due, color: '#EF4444'}
                    ]} 
                  />
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-80 border-t border-gray-100 pt-3">
              <HorizontalBar title="Top 10 Expedite (Value)" data={optimizationStats.expedite.top} color="blue" />
              <HorizontalBar title="Top 10 Need Place (Shortage)" data={optimizationStats.need.top} color="red" />
              <HorizontalBar title="Top 10 Excess PO (Surplus)" data={optimizationStats.excess.top} color="orange" />
          </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex gap-4 items-center">
                <h2 className="text-sm font-semibold text-gray-800">Pending Order List</h2>
                <div className="text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">Total: {totals.uniqueOrderCount} Orders | Val: {formatCurrency(totals.value)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
                <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 border border-gray-200 shadow-sm"><FileDown className="w-3.5 h-3.5" /> Export All</button>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 rounded-lg text-xs border hover:bg-gray-50 transition-colors"><Download className="w-3.5 h-3.5" /> Template</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <div className="w-px h-6 bg-gray-200 mx-0.5 hidden sm:block"></div>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Clear Data</button>
            </div>
         </div>
         <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div><input type="text" placeholder="Search POs..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
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
                        <th className="py-2 px-3 font-semibold text-center">OD</th>
                        <th className="py-2 px-3 font-semibold text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {processedItems.length === 0 ? (<tr><td colSpan={10} className="py-8 text-center text-gray-500 text-xs">No matching purchase orders found.</td></tr>) : (
                        processedItems.map(item => {
                            const inMaster = materials.some(m => m.description.toLowerCase().trim() === item.itemName.toLowerCase().trim());
                            const stockItem = closingStockItems.find(s => s.description.toLowerCase().trim() === item.itemName.toLowerCase().trim());
                            const currentStock = stockItem ? stockItem.quantity : 0;
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
                                            <td className="py-2 px-3 text-center">{item.overDueDays > 0 ? <span className="inline-flex px-1 py-px rounded text-[9px] font-bold bg-red-100 text-red-700 whitespace-nowrap">{item.overDueDays} D</span> : <span className="text-gray-300">-</span>}</td>
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
