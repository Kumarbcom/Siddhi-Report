
import React, { useRef, useMemo, useState, useDeferredValue } from 'react';
import { PendingPOItem, Material, ClosingStockItem, PendingSOItem, SalesReportItem } from '../types';
import { Trash2, Download, Upload, ShoppingCart, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Package, FileDown, Pencil, Save, X, Calendar, PieChart, BarChart3, AlertOctagon, CheckCircle2, Filter, Plus, Layers, Loader2 } from 'lucide-react';
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
    onAddMaterial?: (data: any) => Promise<void>;
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
    // Excel serial date: days since 1900-01-01 (with 1900 leap year bug, offset is 25568)
    if (typeof val === 'number') return new Date((val - 25568) * 86400 * 1000);
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
    pendingSOItems = [],
    salesReportItems = [],
    onAddMaterial
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
    const [actionFilter, setActionFilter] = useState<PlanningActionFilter>('ALL');
    const [quickAddModal, setQuickAddModal] = useState<{ isOpen: boolean; item: PendingPOItem | null }>({ isOpen: false, item: null });
    const [quickAddForm, setQuickAddForm] = useState<{ description: string; partNo: string; make: string; materialGroup: string; materialCode: string }>({ description: '', partNo: '', make: '', materialGroup: '', materialCode: '' });
    const [isAddingMaster, setIsAddingMaster] = useState(false);

    const handleOpenQuickAdd = (item: PendingPOItem) => {
        setQuickAddModal({ isOpen: true, item });
        setQuickAddForm({
            description: item.itemName || '',
            partNo: item.partNo || '',
            make: '',
            materialGroup: '',
            materialCode: item.materialCode || ''
        });
    };

    const handleQuickAddMaster = async () => {
        if (!onAddMaterial || !quickAddForm.description) return;
        setIsAddingMaster(true);
        try {
            await onAddMaterial(quickAddForm);
            setQuickAddModal({ isOpen: false, item: null });
            alert("Added to Material Master successfully!");
        } catch (e: any) {
            alert("Failed to add material: " + (e.message || "Unknown error"));
        } finally {
            setIsAddingMaster(false);
        }
    };

    const formatDateDisplay = (dateVal: string | Date | number) => {
        if (!dateVal) return '-';
        let date = parseDate(dateVal);
        if (date && !isNaN(date.getTime()) && date.getTime() > 0) return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
        return String(dateVal);
    };
    const formatCurrency = (val: number) => `Rs. ${Math.round(val).toLocaleString('en-IN')}`;

    // --- RECONCILED SUPPLY MAPPING (IDENTICAL TO STRATEGY REPORT) ---
    const supplyMap = useMemo(() => {
        // 1. Create Index Maps for fast lookup
        const stockMap = new Map<string, { qty: number; val: number }>();
        closingStockItems.forEach(i => {
            const key = String(i.description || '').toLowerCase().trim();
            if (!key) return;
            const ex = stockMap.get(key) || { qty: 0, val: 0 };
            stockMap.set(key, { qty: ex.qty + i.quantity, val: ex.val + i.value });
        });

        const soMap = new Map<string, { qty: number; val: number }>();
        pendingSOItems.forEach(i => {
            const key = String(i.itemName || '').toLowerCase().trim();
            if (!key) return;
            const ex = soMap.get(key) || { qty: 0, val: 0 };
            soMap.set(key, { qty: ex.qty + i.balanceQty, val: ex.val + i.value });
        });

        const poMap = new Map<string, { qty: number; val: number }>();
        items.forEach(i => {
            const key = String(i.itemName || '').toLowerCase().trim();
            if (!key) return;
            const ex = poMap.get(key) || { qty: 0, val: 0 };
            poMap.set(key, { qty: ex.qty + i.balanceQty, val: ex.val + i.value });
        });

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const sales1yMap = new Map<string, { qty: number; val: number }>();
        salesReportItems.forEach(i => {
            if (parseDate(i.date) >= oneYearAgo) {
                const key = String(i.particulars || '').toLowerCase().trim();
                if (!key) return;
                const ex = sales1yMap.get(key) || { qty: 0, val: 0 };
                sales1yMap.set(key, { qty: ex.qty + (i.quantity || 0), val: ex.val + (i.value || 0) });
            }
        });

        const resultMap = new Map<string, { excessPO: number, poNeed: number, expedite: number, rate: number }>();

        materials.forEach(mat => {
            const descKey = String(mat.description || '').toLowerCase().trim();
            const partKey = String(mat.partNo || '').toLowerCase().trim();
            const group = String(mat.materialGroup || '').toLowerCase().trim();
            const isPlanned = PLANNED_STOCK_GROUPS.has(group);

            const s = stockMap.get(descKey) || { qty: 0, val: 0 };
            const so = soMap.get(descKey) || { qty: 0, val: 0 };
            const po = poMap.get(descKey) || { qty: 0, val: 0 };

            // Sales Dual Match (Essential for PO Need calculation matching Strategy Report)
            const s1Part = sales1yMap.get(partKey) || { qty: 0, val: 0 };
            const s1Desc = sales1yMap.get(descKey) || { qty: 0, val: 0 };
            let s1TotalQty = 0;
            if (partKey && descKey && partKey !== descKey) {
                s1TotalQty = s1Part.qty + s1Desc.qty;
            } else {
                s1TotalQty = s1Desc.qty > 0 ? s1Desc.qty : s1Part.qty;
            }

            const avg1yQty = s1TotalQty / 12;

            // Accurate Rate Hierarchy
            let avgRate = 0;
            if (s.qty > 0) avgRate = s.val / s.qty;
            else if (po.qty > 0) avgRate = po.val / po.qty;
            else if (so.qty > 0) avgRate = so.val / so.qty;

            let maxStock = 0;
            if (isPlanned) {
                maxStock = roundToTen(avg1yQty * 3);
            }

            const netQty = s.qty + po.qty - so.qty;

            // Actions
            const excessStockThreshold = so.qty + maxStock;
            const excessStockQty = Math.max(0, s.qty - excessStockThreshold);

            // Fix: Excess PO Logic - Calculate Total Excess first
            const totalProjectedExcess = Math.max(0, netQty - maxStock);
            // Excess PO = Total Excess - Excess Stock (Only count the PO portion of the excess)
            const excessPOQty = Math.max(0, totalProjectedExcess - excessStockQty);

            const deficit = maxStock - netQty;
            const poNeedQty = deficit > 0 ? deficit : 0;

            const immediateGap = (so.qty + maxStock) - s.qty;
            const expediteQty = (immediateGap > 0 && po.qty > 0) ? Math.min(po.qty, immediateGap) : 0;

            // Populate Result Map with calculated values if any action is needed
            if (excessPOQty > 0 || poNeedQty > 0 || expediteQty > 0) {
                resultMap.set(descKey, { excessPO: excessPOQty, poNeed: poNeedQty, expedite: expediteQty, rate: avgRate });
            }
        });

        return resultMap;
    }, [items, closingStockItems, pendingSOItems, salesReportItems, materials]);

    const optimizationStats = useMemo(() => {
        let eVal = 0, eCount = 0, nVal = 0, nCount = 0, xVal = 0, xCount = 0, dueVal = 0;
        const today = new Date(); today.setHours(0, 0, 0, 0);

        supplyMap.forEach((v) => {
            if (v.poNeed > 0) { nVal += v.poNeed * v.rate; nCount++; }
            if (v.expedite > 0) { eVal += v.expedite * v.rate; eCount++; }
            if (v.excessPO > 0) { xVal += v.excessPO * v.rate; xCount++; }
        });
        items.forEach(i => { if (i.dueDate && parseDate(i.dueDate) < today) dueVal += i.value; });

        return { excess: { val: xVal, count: xCount }, need: { val: nVal, count: nCount }, expedite: { val: eVal, count: eCount }, overdue: { val: dueVal } };
    }, [items, supplyMap]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        try {
            // Fixed: Moved cellDates and dateNF to read options to avoid Sheet2JSONOpts type errors
            const arrayBuffer = await file.arrayBuffer(); const wb = read(arrayBuffer, { cellDates: true, dateNF: 'yyyy-mm-dd' }); const ws = wb.Sheets[wb.SheetNames[0]]; const data = utils.sheet_to_json<any>(ws); const newItems: Omit<PendingPOItem, 'id' | 'createdAt'>[] = [];
            const formatExcelDate = (val: any) => {
                let d: Date;
                if (val instanceof Date) {
                    // Nudge by 12 hours to handle dates that are at 23:59:50 due to floating point error
                    d = new Date(val.getTime() + (12 * 60 * 60 * 1000));
                } else if (typeof val === 'number') {
                    d = new Date((Math.round(val) - 25568) * 86400 * 1000);
                } else {
                    return String(val || '');
                }

                if (isNaN(d.getTime())) return String(val || '');

                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
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

    const deferredSearchTerm = useDeferredValue(searchTerm);

    // Pre-calculate search text
    const itemsWithSearch = useMemo(() => {
        return items.map(i => ({
            ...i,
            searchText: `${i.orderNo || ''} ${i.partyName || ''} ${i.itemName || ''} ${(i as any).partNo || ''}`.toLowerCase()
        }));
    }, [items]);

    const processedItems = useMemo(() => {
        let data = [...itemsWithSearch];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (actionFilter !== 'ALL') {
            if (actionFilter === 'NEED_PLACE') data = data.filter(i => (supplyMap.get(i.itemName.toLowerCase().trim())?.poNeed || 0) > 0);
            else if (actionFilter === 'EXPEDITE') data = data.filter(i => (supplyMap.get(i.itemName.toLowerCase().trim())?.expedite || 0) > 0);
            else if (actionFilter === 'EXCESS') data = data.filter(i => (supplyMap.get(i.itemName.toLowerCase().trim())?.excessPO || 0) > 0);
            else if (actionFilter === 'OVERDUE') data = data.filter(i => i.dueDate && parseDate(i.dueDate) < today);
        }
        if (deferredSearchTerm) {
            const words = deferredSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
            data = data.filter(i => {
                return words.every(word => i.searchText.includes(word));
            });
        }
        if (sortConfig) { data.sort((a, b) => { const valA = String(a[sortConfig.key] || '').toLowerCase(); const valB = String(b[sortConfig.key] || '').toLowerCase(); if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; return 0; }); }
        return data;
    }, [itemsWithSearch, deferredSearchTerm, sortConfig, actionFilter, supplyMap]);

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0">
                <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                        <div className="bg-orange-100 p-1.5 rounded text-orange-700"><ShoppingCart className="w-4 h-4" /></div>
                        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Strategic Supply Planning</h2>
                    </div>
                    <button onClick={() => setActionFilter('ALL')} className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${actionFilter === 'ALL' ? 'bg-gray-200 text-gray-700' : 'text-blue-600 hover:bg-blue-50'}`}>Reset Strategy Filters</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-32">
                    <ActionCard title="PO Need (Shortage)" value={formatCurrency(optimizationStats.need.val)} count={optimizationStats.need.count} color="red" icon={AlertOctagon} active={actionFilter === 'NEED_PLACE'} onClick={() => setActionFilter('NEED_PLACE')} />
                    <ActionCard title="Expedite List" value={formatCurrency(optimizationStats.expedite.val)} count={optimizationStats.expedite.count} color="blue" icon={CheckCircle2} active={actionFilter === 'EXPEDITE'} onClick={() => setActionFilter('EXPEDITE')} />
                    <ActionCard title="Excess PO Items" value={formatCurrency(optimizationStats.excess.val)} count={optimizationStats.excess.count} color="orange" icon={AlertTriangle} active={actionFilter === 'EXCESS'} onClick={() => setActionFilter('EXCESS')} />
                    <button onClick={() => setActionFilter('OVERDUE')} className={`p-3 rounded-xl border flex flex-col justify-between h-full transition-all text-left hover:shadow-md shadow-sm ${actionFilter === 'OVERDUE' ? 'bg-indigo-100 border-indigo-400' : 'bg-white border-gray-200'}`}>
                        <div className="flex justify-between items-start w-full"><p className="text-[10px] font-bold text-indigo-700 uppercase">PO Overdue</p><Calendar className="w-4 h-4 text-indigo-600" /></div>
                        <div><h3 className="text-sm font-black text-red-700">{formatCurrency(optimizationStats.overdue.val)}</h3><p className="text-[9px] text-gray-500 font-medium">Overdue Arrivals</p></div>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                    <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Filter className="w-4 h-4 text-indigo-500" /> Pending PO List</h2>
                    <div className="flex flex-wrap gap-2">
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors"><Upload className="w-3.5 h-3.5" /> Import POs</button>
                        <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs border border-red-100 hover:bg-red-100 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                </div>
                <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-3.5 w-3.5 text-gray-400" /></div><input type="text" placeholder="Search POs..." className="pl-9 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-auto h-full">
                    <table className="w-full text-left border-collapse min-w-full">
                        <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm border-b border-gray-200 text-[10px] text-gray-500 uppercase">
                            <tr>
                                <th className="py-2 px-3 font-semibold">Date</th>
                                <th className="py-2 px-3 font-semibold">Order</th>
                                <th className="py-2 px-3 font-semibold">Vendor</th>
                                <th className="py-2 px-3 font-semibold w-56">Item</th>
                                <th className="py-2 px-3 font-semibold text-right">Qty</th>
                                <th className="py-2 px-3 font-semibold text-right">Value</th>
                                <th className="py-2 px-3 font-semibold">Due on</th>
                                <th className="py-2 px-3 font-semibold text-center">Status</th>
                                <th className="py-2 px-3 font-semibold text-right">Act</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 text-xs text-gray-700">
                            {processedItems.length === 0 ? (<tr><td colSpan={9} className="py-8 text-center text-gray-500 text-xs">No records found.</td></tr>) : (
                                processedItems.map(item => {
                                    const strat = supplyMap.get(item.itemName.toLowerCase().trim());
                                    return (
                                        <tr key={item.id} className="hover:bg-orange-50/20 transition-colors">
                                            <td className="py-2 px-3 whitespace-nowrap">{formatDateDisplay(item.date)}</td>
                                            <td className="py-2 px-3 font-medium whitespace-nowrap">{item.orderNo}</td>
                                            <td className="py-2 px-3 truncate max-w-[120px]">{item.partyName}</td>
                                            <td className="py-2 px-3 font-medium text-gray-900 max-w-[200px]">
                                                <div className="flex flex-col">
                                                    <span className="truncate block" title={item.itemName}>{item.itemName}</span>
                                                    {!materials.some(m => m.description.toLowerCase().trim() === item.itemName.toLowerCase().trim()) && (
                                                        <span className="inline-flex items-center gap-0.5 mt-0.5 text-[8px] text-red-600 bg-red-50 px-1 py-px rounded border border-red-100 w-fit whitespace-nowrap font-bold">
                                                            <AlertTriangle className="w-2 h-2" /> Missing Master
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-2 px-3 text-right font-medium text-blue-600">{item.balanceQty}</td>
                                            <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatCurrency(item.value)}</td>
                                            <td className="py-2 px-3 whitespace-nowrap">{formatDateDisplay(item.dueDate)}</td>
                                            <td className="py-2 px-3 text-center">
                                                {strat?.expedite ? <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-700">EXPEDITE</span> : (strat?.excessPO ? <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-orange-100 text-orange-700">EXCESS</span> : <span className="text-gray-300">-</span>)}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {!materials.some(m => m.description.toLowerCase().trim() === item.itemName.toLowerCase().trim()) && (
                                                        <button
                                                            onClick={() => handleOpenQuickAdd(item)}
                                                            className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors flex items-center gap-1 group relative"
                                                            title="Add to Material Master"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                            <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                                                Add to Master
                                                            </div>
                                                        </button>
                                                    )}
                                                    <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Quick Add Modal */}
            {quickAddModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                                <Layers className="w-5 h-5 text-indigo-600" />
                                Quick Add to Master
                            </h3>
                            <button onClick={() => setQuickAddModal({ isOpen: false, item: null })} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Description</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={quickAddForm.description}
                                    onChange={e => setQuickAddForm(v => ({ ...v, description: e.target.value }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Part No</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={quickAddForm.partNo}
                                        onChange={e => setQuickAddForm(v => ({ ...v, partNo: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Material Code</label>
                                    <input
                                        type="text"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={quickAddForm.materialCode}
                                        onChange={e => setQuickAddForm(v => ({ ...v, materialCode: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Make (Brand)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. LAPP, EATON"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={quickAddForm.make}
                                        onChange={e => setQuickAddForm(v => ({ ...v, make: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Material Group</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. CABLES, SWITCH"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={quickAddForm.materialGroup}
                                        onChange={e => setQuickAddForm(v => ({ ...v, materialGroup: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setQuickAddModal({ isOpen: false, item: null })}
                                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleQuickAddMaster}
                                disabled={isAddingMaster || !quickAddForm.description}
                                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isAddingMaster ? <Layers className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Add to Master
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PendingPOView;
