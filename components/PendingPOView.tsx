
import React, { useRef, useMemo, useState } from 'react';
import { PendingPOItem, Material, ClosingStockItem, PendingSOItem, SalesReportItem } from '../types';
// Added missing TrendingUp import from lucide-react
import { Trash2, Download, Upload, ShoppingCart, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Package, FileDown, Pencil, Save, X, Calendar, PieChart, BarChart3, AlertOctagon, CheckCircle2, Filter, Info, ClipboardList, Database, Layers, TrendingUp } from 'lucide-react';
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
  salesReportItems?: SalesReportItem[];
}

type SortKey = keyof PendingPOItem;
type PlanningActionFilter = 'ALL' | 'NEED_PLACE' | 'EXPEDITE' | 'EXCESS' | 'OVERDUE';

const PLANNED_STOCK_GROUPS = new Set([
  "eaton-ace", "eaton-biesse", "eaton-coffee day", "eaton-enrx pvt ltd", "eaton-eta technology",
  "eaton-faively", "eaton-planned stock specific customer", "eaton-probat india", "eaton-rinac",
  "eaton-schenck process", "eaton-planned stock general", "hager-incap contracting",
  "lapp-ace group", "lapp-ams group", "lapp-disa india", "lapp-engineered customized control",
  "lapp-kennametal", "lapp-planned stock general", "lapp-rinac", "lapp-titan"
]);

const roundToTen = (num: number) => {
    if (num <= 0) return 0;
    return Math.ceil(num / 10) * 10;
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

const ActionCard = ({ title, value, count, color, icon: Icon, active, onClick }: any) => (
    <button 
        onClick={onClick}
        className={`${active ? `bg-${color}-100 border-${color}-400 ring-2 ring-${color}-200` : `bg-${color}-50 border-${color}-100`} p-3 rounded-xl border flex flex-col justify-between h-full transition-all text-left hover:shadow-md shadow-sm min-h-[100px]`}
    >
        <div className="flex justify-between items-start w-full">
            <p className={`text-[10px] font-bold text-${color}-700 uppercase`}>{title}</p>
            <Icon className={`w-4 h-4 text-${color}-600`} />
        </div>
        <div>
            <h3 className={`text-base font-black text-${color}-900`}>{value}</h3>
            <p className={`text-[9px] text-${color}-600 font-medium`}>{count} Items Impacted</p>
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
  pendingSOItems = [],
  salesReportItems = []
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [actionFilter, setActionFilter] = useState<PlanningActionFilter>('ALL');
  const [selectedStrategyItem, setSelectedStrategyItem] = useState<any>(null);

  const formatDateDisplay = (dateVal: string | Date | number) => { 
      if (!dateVal) return '-'; 
      let date = parseDate(dateVal);
      if (date && !isNaN(date.getTime()) && date.getTime() > 0) return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
      return String(dateVal); 
  };
  const formatCurrency = (val: number) => {
      const absVal = Math.abs(val);
      if (absVal >= 10000000) return `Rs. ${(val / 10000000).toFixed(2)} Cr`;
      if (absVal >= 100000) return `Rs. ${(val / 100000).toFixed(2)} L`;
      return `Rs. ${Math.round(val).toLocaleString('en-IN')}`;
  };

  // --- RECONCILED SUPPLY ANALYSIS (MATCHES STRATEGY REPORT PILLAR-TO-PILLAR) ---
  const calculatedStrategyItems = useMemo(() => {
    const stockMap = new Map<string, { qty: number; val: number }>();
    closingStockItems.forEach(i => {
        const k = String(i.description || '').toLowerCase().trim();
        if (!k) return;
        const ex = stockMap.get(k) || { qty: 0, val: 0 };
        stockMap.set(k, { qty: ex.qty + (i.quantity || 0), val: ex.val + (i.value || 0) });
    });

    const soMap = new Map<string, { qty: number; val: number }>();
    pendingSOItems.forEach(i => {
        const k = String(i.itemName || '').toLowerCase().trim();
        if (!k) return;
        const ex = soMap.get(k) || { qty: 0, val: 0 };
        const val = i.value || (i.balanceQty * i.rate);
        soMap.set(k, { qty: ex.qty + (i.balanceQty || 0), val: ex.val + val });
    });

    const poMap = new Map<string, { qty: number; val: number }>();
    items.forEach(i => {
        const k = String(i.itemName || '').toLowerCase().trim();
        if (!k) return;
        const ex = poMap.get(k) || { qty: 0, val: 0 };
        const val = i.value || (i.balanceQty * i.rate);
        poMap.set(k, { qty: ex.qty + (i.balanceQty || 0), val: ex.val + val });
    });

    const oneYearAgo = new Date(); 
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const sales1yMap = new Map<string, { qty: number; val: number }>();
    salesReportItems.forEach(i => {
        if (parseDate(i.date) >= oneYearAgo) {
            const k = String(i.particulars || '').toLowerCase().trim();
            if (!k) return;
            const ex = sales1yMap.get(k) || { qty: 0, val: 0 };
            sales1yMap.set(k, { qty: ex.qty + (i.quantity || 0), val: ex.val + (i.value || 0) });
        }
    });

    return materials.map(mat => {
        const descKey = String(mat.description || '').toLowerCase().trim();
        const partKey = String(mat.partNo || '').toLowerCase().trim();
        const group = String(mat.materialGroup || '').toLowerCase().trim();
        const isPlanned = PLANNED_STOCK_GROUPS.has(group);
        
        const s = stockMap.get(descKey) || { qty: 0, val: 0 };
        const so = soMap.get(descKey) || { qty: 0, val: 0 };
        const po = poMap.get(descKey) || { qty: 0, val: 0 };
        
        const s1Part = sales1yMap.get(partKey) || { qty: 0, val: 0 };
        const s1Desc = sales1yMap.get(descKey) || { qty: 0, val: 0 };
        
        let s1TotalQty = 0;
        if (partKey && descKey && partKey !== descKey) {
            s1TotalQty = s1Part.qty + s1Desc.qty;
        } else {
            const bestMatch = s1Desc.qty > 0 ? s1Desc : s1Part;
            s1TotalQty = bestMatch.qty;
        }

        const avg1yQty = s1TotalQty / 12;
        
        let avgRate = 0;
        if (s.qty > 0) avgRate = s.val / s.qty;
        else if (po.qty > 0) avgRate = po.val / po.qty;
        else if (so.qty > 0) avgRate = so.val / so.qty;

        let maxStock = 0;
        if (isPlanned) {
            maxStock = roundToTen(avg1yQty * 3);
        }

        const netQty = s.qty + po.qty - so.qty;
        const excessThreshold = so.qty + maxStock;
        const excessStockQty = Math.max(0, s.qty - excessThreshold);
        
        const totalExcess = Math.max(0, netQty - maxStock);
        const excessPOQty = Math.max(0, totalExcess - excessStockQty);
        
        const deficit = maxStock - netQty;
        const poNeedQty = deficit > 0 ? deficit : 0;
        
        const immediateGap = (so.qty + maxStock) - s.qty;
        const expediteQty = (immediateGap > 0 && po.qty > 0) ? Math.min(po.qty, immediateGap) : 0;

        return { 
            descKey, 
            description: mat.description,
            make: mat.make,
            materialGroup: mat.materialGroup,
            stockQty: s.qty,
            soQty: so.qty,
            poQty: po.qty,
            netQty: netQty,
            excessPO: excessPOQty, 
            poNeed: poNeedQty, 
            expedite: expediteQty, 
            rate: avgRate 
        };
    });
  }, [items, closingStockItems, pendingSOItems, salesReportItems, materials]);

  const optimizationStats = useMemo(() => {
      let eVal = 0, eCount = 0, nVal = 0, nCount = 0, xVal = 0, xCount = 0, dueVal = 0;
      const today = new Date(); today.setHours(0,0,0,0);

      calculatedStrategyItems.forEach((v) => {
          if (v.poNeed > 0) { nVal += v.poNeed * v.rate; nCount++; }
          if (v.expedite > 0) { eVal += v.expedite * v.rate; eCount++; }
          if (v.excessPO > 0) { xVal += v.excessPO * v.rate; xCount++; }
      });
      items.forEach(i => { if (i.dueDate && parseDate(i.dueDate) < today) dueVal += (i.value || (i.balanceQty * i.rate)); });

      return { 
        excess: { val: xVal, count: xCount }, 
        need: { val: nVal, count: nCount }, 
        expedite: { val: eVal, count: eCount }, 
        overdue: { val: dueVal } 
      };
  }, [items, calculatedStrategyItems]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer(); const wb = read(arrayBuffer); const ws = wb.Sheets[wb.SheetNames[0]]; const data = utils.sheet_to_json<any>(ws, { cellDates: true, dateNF: 'yyyy-mm-dd' }); const newItems: Omit<PendingPOItem, 'id' | 'createdAt'>[] = [];
      const formatExcelDate = (val: any) => { if (val instanceof Date) return val.toISOString().split('T')[0]; if (typeof val === 'number') { const d = new Date((val - (25567 + 2)) * 86400 * 1000); return d.toISOString().split('T')[0]; } return String(val || ''); };
      data.forEach((row) => {
        const getVal = (keys: string[]) => { for (const k of keys) { const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase()); if (foundKey) return row[foundKey]; } return ''; };
        const date = formatExcelDate(getVal(['date', 'dt'])); const orderNo = String(getVal(['order', 'order no', 'po no']) || ''); const partyName = String(getVal(['party\'s name', 'party name', 'vendor']) || ''); const itemName = String(getVal(['name of item', 'item name', 'description']) || ''); const materialCode = String(getVal(['material code']) || ''); const partNo = String(getVal(['part no']) || ''); const ordered = parseFloat(getVal(['ordered', 'ordered qty'])) || 0; const balance = parseFloat(getVal(['balance', 'bal qty'])) || 0; const rate = parseFloat(getVal(['rate', 'price'])) || 0; let value = parseFloat(getVal(['value', 'val', 'amount'])) || 0; if (value === 0 && balance !== 0 && rate !== 0) value = balance * rate; const due = formatExcelDate(getVal(['due on', 'due date', 'due']));
        if (!partyName && !orderNo && !itemName) return;
        newItems.push({ date, orderNo, partyName, itemName, materialCode, partNo, orderedQty: ordered, balanceQty: balance, rate, discount: 0, value, dueDate: due, overDueDays: 0 });
      });
      if (newItems.length > 0) { onBulkAdd(newItems); alert(`Imported ${newItems.length} records.`); } else alert("No valid records found.");
    } catch (err) { alert("Failed to parse Excel file."); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processedItems = useMemo(() => { 
      let data = [...items]; const today = new Date(); today.setHours(0,0,0,0);
      if (actionFilter !== 'ALL') {
          data = data.filter(item => {
              const itemKey = item.itemName.toLowerCase().trim();
              const strat = calculatedStrategyItems.find(s => s.descKey === itemKey);
              if (actionFilter === 'NEED_PLACE') return (strat?.poNeed || 0) > 0;
              if (actionFilter === 'EXPEDITE') return (strat?.expedite || 0) > 0;
              if (actionFilter === 'EXCESS') return (strat?.excessPO || 0) > 0;
              if (actionFilter === 'OVERDUE') return item.dueDate && parseDate(item.dueDate) < today;
              return true;
          });
      }
      if (searchTerm) { const lower = searchTerm.toLowerCase(); data = data.filter(i => i.orderNo.toLowerCase().includes(lower) || i.partyName.toLowerCase().includes(lower) || i.itemName.toLowerCase().includes(lower)); } 
      if (sortConfig) { data.sort((a, b) => { const valA = a[sortConfig.key] as any; const valB = b[sortConfig.key] as any; if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }); } 
      return data; 
  }, [items, searchTerm, sortConfig, actionFilter, calculatedStrategyItems]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Strategy Detail Modal */}
      {selectedStrategyItem && (
          <div className="absolute inset-0 z-[110] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
                  <div className={`px-8 py-5 flex justify-between items-center text-white ${selectedStrategyItem.expedite > 0 ? 'bg-blue-600' : 'bg-orange-500'}`}>
                      <div className="flex items-center gap-3">
                          <Layers className="w-6 h-6" />
                          <div>
                              <h3 className="font-black text-lg uppercase tracking-widest leading-none">Strategy Breakdown</h3>
                              <p className="text-[10px] font-bold opacity-80 mt-1">Industrial Intelligence Analysis</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedStrategyItem(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex flex-col gap-1">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Article Description</p>
                          <p className="text-base font-black text-gray-900 leading-tight">{selectedStrategyItem.description}</p>
                          <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                              <div><p className="text-[9px] font-bold text-gray-400 uppercase">Manufacturer</p><p className="text-xs font-black text-blue-700">{selectedStrategyItem.make}</p></div>
                              <div className="w-px h-6 bg-gray-200"></div>
                              <div><p className="text-[9px] font-bold text-gray-400 uppercase">Material Group</p><p className="text-xs font-black text-gray-700">{selectedStrategyItem.materialGroup}</p></div>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="flex flex-col gap-1"><p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><Database className="w-3 h-3"/> Stock</p><p className="text-xl font-black text-gray-900">{selectedStrategyItem.stockQty.toLocaleString()}</p></div>
                          <div className="flex flex-col gap-1"><p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><ClipboardList className="w-3 h-3"/> Pending SO</p><p className="text-xl font-black text-orange-600">{selectedStrategyItem.soQty.toLocaleString()}</p></div>
                          <div className="flex flex-col gap-1"><p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><ShoppingCart className="w-3 h-3"/> Pending PO</p><p className="text-xl font-black text-purple-600">{selectedStrategyItem.poQty.toLocaleString()}</p></div>
                          <div className="flex flex-col gap-1"><p className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Net Position</p><p className={`text-xl font-black ${selectedStrategyItem.netQty >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{selectedStrategyItem.netQty.toLocaleString()}</p></div>
                      </div>

                      <div className={`p-6 rounded-2xl border-2 flex items-center justify-between shadow-lg ${selectedStrategyItem.expedite > 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                          <div>
                              <p className={`text-[10px] font-black uppercase tracking-widest ${selectedStrategyItem.expedite > 0 ? 'text-blue-700' : 'text-orange-700'}`}>Recommended Action</p>
                              <h4 className={`text-2xl font-black mt-1 ${selectedStrategyItem.expedite > 0 ? 'text-blue-900' : 'text-orange-900'}`}>
                                  {selectedStrategyItem.expedite > 0 ? `EXPEDITE ${selectedStrategyItem.expedite} QTY` : `EXCESS PO: ${selectedStrategyItem.excessPO} QTY`}
                              </h4>
                          </div>
                          <div className="text-right">
                              <p className="text-[10px] font-bold text-gray-400 uppercase">Valuation @ Market</p>
                              <p className={`text-xl font-black ${selectedStrategyItem.expedite > 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                                  {formatCurrency(selectedStrategyItem.rate * (selectedStrategyItem.expedite > 0 ? selectedStrategyItem.expedite : selectedStrategyItem.excessPO))}
                              </p>
                          </div>
                      </div>
                  </div>
                  <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end">
                      <button onClick={() => setSelectedStrategyItem(null)} className="px-8 py-3 bg-gray-900 text-white text-xs font-black rounded-xl hover:bg-gray-800 transition-all uppercase tracking-widest shadow-xl active:scale-95">Dismiss Analysis</button>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0">
          <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                  <div className="bg-orange-100 p-1.5 rounded text-orange-700"><ShoppingCart className="w-4 h-4"/></div>
                  <h2 className="text-sm font-black text-gray-800 uppercase tracking-tight">Strategic Supply Planning</h2>
              </div>
              <button onClick={() => setActionFilter('ALL')} className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${actionFilter === 'ALL' ? 'bg-gray-100 text-gray-700' : 'text-blue-600 hover:bg-blue-50'}`}>Clear Filters</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 h-auto">
              <ActionCard title="PO Need (Shortage)" value={formatCurrency(optimizationStats.need.val)} count={optimizationStats.need.count} color="red" icon={AlertOctagon} active={actionFilter === 'NEED_PLACE'} onClick={() => setActionFilter('NEED_PLACE')} />
              <ActionCard title="Expedite List" value={formatCurrency(optimizationStats.expedite.val)} count={optimizationStats.expedite.count} color="blue" icon={CheckCircle2} active={actionFilter === 'EXPEDITE'} onClick={() => setActionFilter('EXPEDITE')} />
              <ActionCard title="Excess PO Items" value={formatCurrency(optimizationStats.excess.val)} count={optimizationStats.excess.count} color="orange" icon={AlertTriangle} active={actionFilter === 'EXCESS'} onClick={() => setActionFilter('EXCESS')} />
              <button onClick={() => setActionFilter('OVERDUE')} className={`p-3 rounded-xl border flex flex-col justify-between h-full transition-all text-left hover:shadow-md shadow-sm min-h-[100px] ${actionFilter === 'OVERDUE' ? 'bg-indigo-100 border-indigo-400' : 'bg-white border-gray-200'}`}>
                  <div className="flex justify-between items-start w-full"><p className="text-[10px] font-bold text-indigo-700 uppercase">PO Overdue</p><Calendar className="w-4 h-4 text-indigo-600" /></div>
                  <div><h3 className="text-base font-black text-red-700">{formatCurrency(optimizationStats.overdue.val)}</h3><p className="text-[9px] text-gray-500 font-medium">Pending Arrival Past Due</p></div>
              </button>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
         <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Filter className="w-4 h-4 text-indigo-500" /> Pending Purchase Orders</h2>
            <div className="flex flex-wrap gap-2">
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors shadow-sm"><Upload className="w-3.5 h-3.5" /> Import Excel</button>
                <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
         </div>
         <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div><input type="text" placeholder="Filter by Order, Vendor or Item..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none transition-shadow" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
         <div className="overflow-auto h-full custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-full">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm border-b border-gray-200 text-[10px] text-gray-500 uppercase font-black">
                    <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Order #</th>
                        <th className="py-2.5 px-3">Vendor</th>
                        <th className="py-2.5 px-3 w-56">Item Description</th>
                        <th className="py-2.5 px-3 text-right">Bal Qty</th>
                        <th className="py-2.5 px-3 text-right">Value</th>
                        <th className="py-2.5 px-3">Due On</th>
                        <th className="py-2.5 px-3 text-center">Plan</th>
                        <th className="py-2.5 px-3 text-right">Act</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-[11px] text-gray-700">
                    {processedItems.length === 0 ? (<tr><td colSpan={9} className="py-12 text-center text-gray-400 font-medium italic">No matching procurement records found.</td></tr>) : (
                        processedItems.map(item => {
                            const itemKey = item.itemName.toLowerCase().trim();
                            const strat = calculatedStrategyItems.find(s => s.descKey === itemKey);
                            const inMaster = materials.some(m => m.description.toLowerCase().trim() === itemKey);
                            
                            return (
                                <tr key={item.id} className="hover:bg-orange-50/20 transition-colors">
                                    <td className="py-2 px-3 whitespace-nowrap text-gray-500">{formatDateDisplay(item.date)}</td>
                                    <td className="py-2 px-3 font-bold text-gray-900 whitespace-nowrap">{item.orderNo}</td>
                                    <td className="py-2 px-3 truncate max-w-[120px] text-gray-600 font-medium">{item.partyName}</td>
                                    <td className="py-2 px-3 max-w-[200px]">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 truncate" title={item.itemName}>{item.itemName}</span>
                                            {!inMaster && (
                                                <span className="inline-flex items-center gap-0.5 mt-0.5 text-[8px] text-red-600 bg-red-50 px-1 py-px rounded border border-red-100 w-fit whitespace-nowrap font-black">
                                                    <AlertTriangle className="w-2 h-2" /> Missing in Master
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2 px-3 text-right font-black text-blue-600">{item.balanceQty.toLocaleString()}</td>
                                    <td className="py-2 px-3 text-right font-black text-emerald-700">{formatCurrency(item.value)}</td>
                                    <td className="py-2 px-3 whitespace-nowrap font-medium">{formatDateDisplay(item.dueDate)}</td>
                                    <td className="py-2 px-3 text-center">
                                        {strat?.expedite ? (
                                            <button 
                                                onClick={() => setSelectedStrategyItem(strat)}
                                                className="px-2 py-0.5 rounded-full text-[8px] font-black bg-blue-100 text-blue-700 border border-blue-200 shadow-sm hover:bg-blue-600 hover:text-white transition-all uppercase flex items-center gap-1 mx-auto"
                                            >
                                                Expedite <Info className="w-2 h-2" />
                                            </button>
                                        ) : (strat?.excessPO ? (
                                            <button 
                                                onClick={() => setSelectedStrategyItem(strat)}
                                                className="px-2 py-0.5 rounded-full text-[8px] font-black bg-orange-100 text-orange-700 border border-orange-200 shadow-sm hover:bg-orange-500 hover:text-white transition-all uppercase flex items-center gap-1 mx-auto"
                                            >
                                                Excess <Info className="w-2 h-2" />
                                            </button>
                                        ) : <span className="text-gray-300 font-black">-</span>)}
                                    </td>
                                    <td className="py-2 px-3 text-right">
                                        <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-600 p-1 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </td>
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
