
import React, { useMemo, useState } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem } from '../types';
import { FileDown, Search, ArrowUp, ArrowDown, Filter, AlertTriangle, Minus, ArrowUpDown, Layers, AlignLeft, Eye, EyeOff } from 'lucide-react';
import { utils, writeFile } from 'xlsx';
import { fastSalesService } from '../services/fastSalesService';

interface PivotReportViewProps {
    materials: Material[];
    closingStock: ClosingStockItem[];
    pendingSO: PendingSOItem[];
    pendingPO: PendingPOItem[];
    salesReportItems: SalesReportItem[];
    isAdmin?: boolean;
}

const PLANNED_STOCK_GROUPS = new Set([
    "eaton-ace", "eaton-biesse", "eaton-coffee day", "eaton-enrx pvt ltd",
    "eaton-eta technology", "eaton-faively", "eaton-planned stock specific customer",
    "eaton-probat india", "eaton-rinac", "eaton-schenck process",
    "eaton-planned stock general", "hager-incap contracting", "lapp-ace group",
    "lapp-ams group", "lapp-disa india", "lapp-engineered customized control",
    "lapp-kennametal", "lapp-planned stock general", "lapp-rinac", "lapp-titan"
]);

const roundToTen = (num: number) => {
    if (num <= 0) return 0;
    return Math.ceil(num / 10) * 10;
};

const getMergedMakeName = (makeName: string) => {
    const m = String(makeName || 'Unspecified').trim();
    const lowerM = m.toLowerCase();
    if (lowerM.includes('lapp')) return 'LAPP';
    if (lowerM.includes('luker')) return 'Luker';
    return m;
};

const formatLargeValue = (val: number) => {
    if (val === 0) return '-';
    const absVal = Math.abs(val);
    if (absVal >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
    if (absVal >= 100000) return `${(val / 100000).toFixed(2)} L`;
    return Math.round(val).toLocaleString('en-IN');
};

const parseDate = (val: any): Date => {
    if (!val) return new Date(0);
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date((Math.round(val) - 25568) * 86400 * 1000);
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date(0) : d;
};

type SortPath =
    | 'description' | 'make' | 'materialGroup'
    | 'stock.qty' | 'stock.val'
    | 'so.qty' | 'so.val' | 'so.curQty' | 'so.schQty'
    | 'po.qty' | 'po.val' | 'po.curQty' | 'po.schQty'
    | 'net.qty' | 'net.val'
    | 'avg3m.qty' | 'avg3m.val'
    | 'avg1y.qty' | 'avg1y.val'
    | 'growth.pct'
    | 'levels.min.qty' | 'levels.min.val'
    | 'levels.reorder.qty' | 'levels.reorder.val'
    | 'levels.max.qty' | 'levels.max.val'
    | 'actions.excessStock.qty' | 'actions.excessStock.val'
    | 'actions.excessPO.qty' | 'actions.excessPO.val'
    | 'actions.poNeed.qty' | 'actions.poNeed.val'
    | 'actions.expedite.qty' | 'actions.expedite.val';

const PivotReportView: React.FC<PivotReportViewProps> = ({
    materials, closingStock, pendingSO, pendingPO, salesReportItems, isAdmin = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [slicerMake, setSlicerMake] = useState('ALL');
    const [slicerGroup, setSlicerGroup] = useState('ALL');
    const [filterDescription, setFilterDescription] = useState('');
    const [showExcessStock, setShowExcessStock] = useState(false);
    const [showExcessPO, setShowExcessPO] = useState(false);
    const [showPONeed, setShowPONeed] = useState(false);
    const [showExpedite, setShowExpedite] = useState(false);
    const [showPlanningColumns, setShowPlanningColumns] = useState(true);
    const [displayLimit, setDisplayLimit] = useState(100);
    const [sortConfig, setSortConfig] = useState<{ key: SortPath; direction: 'asc' | 'desc' }>({
        key: 'stock.val',
        direction: 'desc'
    });

    const pivotData = useMemo(() => {
        const salesSummaries = fastSalesService.getSummaries(salesReportItems);
        const stockMap = new Map<string, { qty: number; val: number }>();
        closingStock.forEach(item => {
            if (!item.description) return;
            const key = item.description.toLowerCase().trim();
            const existing = stockMap.get(key) || { qty: 0, val: 0 };
            stockMap.set(key, { qty: existing.qty + (item.quantity || 0), val: existing.val + (item.value || 0) });
        });

        const soMap = new Map<string, any>();
        const poMap = new Map<string, any>();
        const todayT = new Date().setHours(0, 0, 0, 0);

        pendingSO.forEach(item => {
            if (!item.itemName) return;
            const key = item.itemName.toLowerCase().trim();
            const ex = soMap.get(key) || { qty: 0, val: 0, curQty: 0, curVal: 0, schQty: 0, schVal: 0 };
            const v = (item.balanceQty || 0) * (item.rate || 0);
            const due = item.dueDate ? parseDate(item.dueDate).getTime() : 0;
            const isCur = due <= todayT;
            ex.qty += (item.balanceQty || 0); ex.val += v;
            if (isCur) { ex.curQty += (item.balanceQty || 0); ex.curVal += v; }
            else { ex.schQty += (item.balanceQty || 0); ex.schVal += v; }
            soMap.set(key, ex);
        });

        pendingPO.forEach(item => {
            if (!item.itemName) return;
            const key = item.itemName.toLowerCase().trim();
            const ex = poMap.get(key) || { qty: 0, val: 0, curQty: 0, curVal: 0, schQty: 0, schVal: 0 };
            const v = (item.balanceQty || 0) * (item.rate || 0);
            const due = item.dueDate ? parseDate(item.dueDate).getTime() : 0;
            const isCur = due <= todayT;
            ex.qty += (item.balanceQty || 0); ex.val += v;
            if (isCur) { ex.curQty += (item.balanceQty || 0); ex.curVal += v; }
            else { ex.schQty += (item.balanceQty || 0); ex.schVal += v; }
            poMap.set(key, ex);
        });

        const results = materials.map(mat => {
            const dKey = mat.description?.toLowerCase().trim() || '';
            const pKey = mat.partNo?.toLowerCase().trim() || '';
            const stock = stockMap.get(dKey) || { qty: 0, val: 0 };
            const so = soMap.get(dKey) || { qty: 0, val: 0, curQty: 0, curVal: 0, schQty: 0, schVal: 0 };
            const po = poMap.get(dKey) || { qty: 0, val: 0, curQty: 0, curVal: 0, schQty: 0, schVal: 0 };
            const netQty = stock.qty + po.qty - so.qty;
            let rate = stock.qty > 0 ? stock.val / stock.qty : (po.qty > 0 ? po.val / po.qty : (so.qty > 0 ? so.val / so.qty : 0));
            
            const sD = salesSummaries.get(dKey);
            const sP = pKey ? salesSummaries.get(pKey) : null;
            let s3q = (sD?.qty3m || 0) + (sP && sP !== sD ? sP.qty3m : 0);
            let s1q = (sD?.qty1y || 0) + (sP && sP !== sD ? sP.qty1y : 0);
            let s3v = (sD?.val3m || 0) + (sP && sP !== sD ? sP.val3m : 0);
            let s1v = (sD?.val1y || 0) + (sP && sP !== sD ? sP.val1y : 0);

            const a3q = s3q / 3; const a1q = s1q / 12;
            const r1y = s1q > 0 ? s1v / s1q : rate;
            const grp = String(mat.materialGroup || '').trim() || 'Unspecified';
            const isPl = PLANNED_STOCK_GROUPS.has(grp.toLowerCase());
            let strategy = s1q * 12 >= 500 ? 'GENERAL STOCK' : (s1q > 0 ? 'AGAINST ORDER' : 'MADE TO ORDER');
            
            let min = 0, re = 0, max = 0;
            // Calculate levels for ALL items that have sales
            if (a1q > 0) {
                min = roundToTen(a1q); 
                re = roundToTen(a1q * 1.5); 
                max = roundToTen(a1q * 3);
            }

            const exStock = Math.max(0, stock.qty - (so.qty + max));
            const exPO = Math.max(0, (netQty - max) - exStock);
            const poNeed = Math.max(0, max - netQty);
            const expGap = (so.curQty + max) - stock.qty;
            const expQty = (expGap > 0 && po.qty > 0) ? Math.min(po.qty, expGap) : 0;

            return {
                ...mat,
                make: getMergedMakeName(mat.make || '').toUpperCase(),
                materialGroup: grp,
                stock, so, po, net: { qty: netQty, val: netQty * rate },
                avg3m: { qty: a3q, val: a3q * (s3q > 0 ? s3v / s3q : rate) },
                avg1y: { qty: a1q, val: a1q * r1y },
                growth: { pct: a1q > 0 ? ((a3q - a1q) / a1q) * 100 : 0 },
                levels: { min: { qty: min, val: min * r1y }, reorder: { qty: re, val: re * r1y }, max: { qty: max, val: max * r1y } },
                actions: {
                    excessStock: { qty: exStock, val: exStock * rate },
                    excessPO: { qty: exPO, val: exPO * rate },
                    poNeed: { qty: poNeed, val: poNeed * rate },
                    expedite: { qty: expQty, val: expQty * rate }
                }
            };
        });

        return results.filter(i => i.stock.qty > 0 || i.so.qty > 0 || i.po.qty > 0 || i.avg1y.qty > 0 || i.actions.poNeed.qty > 0);
    }, [materials, closingStock, pendingSO, pendingPO, salesReportItems]);

    const slicerOptions = useMemo(() => {
        const makes = new Set<string>(); const groups = new Set<string>();
        pivotData.forEach(i => { if(i.make) makes.add(i.make); if(i.materialGroup) groups.add(i.materialGroup); });
        return { makes: ['ALL', ...Array.from(makes).sort()], groups: ['ALL', ...Array.from(groups).sort()] };
    }, [pivotData]);

    const filteredData = useMemo(() => {
        let d = pivotData;
        if (slicerMake !== 'ALL') d = d.filter(i => i.make === slicerMake);
        if (slicerGroup !== 'ALL') d = d.filter(i => i.materialGroup === slicerGroup);
        if (filterDescription) {
            const l = filterDescription.toLowerCase();
            d = d.filter(i => i.description?.toLowerCase().includes(l));
        }
        if (searchTerm) {
            const l = searchTerm.toLowerCase();
            d = d.filter(i => i.description?.toLowerCase().includes(l) || i.make.toLowerCase().includes(l) || i.materialGroup.toLowerCase().includes(l));
        }
        if (showExcessStock || showExcessPO || showPONeed || showExpedite) {
            d = d.filter(i => (showExcessStock && i.actions.excessStock.qty > 0) || (showExcessPO && i.actions.excessPO.qty > 0) || (showPONeed && i.actions.poNeed.qty > 0) || (showExpedite && i.actions.expedite.qty > 0));
        }
        const keys = sortConfig.key.split('.');
        return [...d].sort((a, b) => {
            let vA: any = a, vB: any = b;
            keys.forEach(k => { vA = vA?.[k]; vB = vB?.[k]; });
            if (typeof vA === 'string' && typeof vB === 'string') return sortConfig.direction === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
            return sortConfig.direction === 'asc' ? (Number(vA) - Number(vB)) : (Number(vB) - Number(vA));
        });
    }, [pivotData, searchTerm, slicerMake, slicerGroup, filterDescription, showExcessStock, showExcessPO, showPONeed, showExpedite, sortConfig]);

    const totals = useMemo(() => {
        const t = { stock: 0, so: 0, po: 0, net: 0, exS: 0, exP: 0, need: 0, exp: 0 };
        filteredData.forEach(r => {
            t.stock += r.stock.val; t.so += r.so.val; t.po += r.po.val; t.net += r.net.val;
            t.exS += r.actions.excessStock.val; t.exP += r.actions.excessPO.val;
            t.need += r.actions.poNeed.val; t.exp += r.actions.expedite.val;
        });
        return t;
    }, [filteredData]);

    const handleHeaderSort = (key: SortPath) => setSortConfig(p => ({ key, direction: p.key === key && p.direction === 'desc' ? 'asc' : 'desc' }));

    return (
        <div className="flex flex-col h-full gap-3">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Filter className="w-5 h-5 text-indigo-600" />
                        <div><h2 className="text-sm font-bold text-gray-800">Pivot Strategy Report</h2><p className="text-[10px] text-gray-500">{filteredData.length} items</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" /><input type="text" placeholder="Search..." className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                        <button onClick={() => {}} className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-100"><FileDown className="w-3.5 h-3.5" /> Export</button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 border-t pt-3">
                    <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border">
                        <select value={slicerMake} onChange={e => setSlicerMake(e.target.value)} className="bg-transparent text-xs font-bold outline-none">{slicerOptions.makes.map(m => <option key={m} value={m}>{m}</option>)}</select>
                        <select value={slicerGroup} onChange={e => setSlicerGroup(e.target.value)} className="bg-transparent text-xs font-bold outline-none">{slicerOptions.groups.map(g => <option key={g} value={g}>{g}</option>)}</select>
                        <input type="text" placeholder="Description..." value={filterDescription} onChange={e => setFilterDescription(e.target.value)} className="bg-transparent text-xs outline-none w-32 border-l pl-2" />
                    </div>
                    <div className="flex gap-1.5">
                        <button onClick={() => setShowExcessStock(!showExcessStock)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showExcessStock ? 'bg-red-50 text-red-700' : 'bg-white text-gray-500'}`}>Excess Stock</button>
                        <button onClick={() => setShowExcessPO(!showExcessPO)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showExcessPO ? 'bg-orange-50 text-orange-700' : 'bg-white text-gray-500'}`}>Excess PO</button>
                        <button onClick={() => setShowPONeed(!showPONeed)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showPONeed ? 'bg-green-50 text-green-700' : 'bg-white text-gray-500'}`}>PO Need</button>
                        <button onClick={() => setShowExpedite(!showExpedite)} className={`px-2 py-1 rounded text-[10px] font-bold border ${showExpedite ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-500'}`}>Expedite</button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex-1 relative">
                <div className="overflow-auto h-full w-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-50 bg-gray-50 text-[9px] font-bold uppercase">
                            <tr className="bg-gray-100 border-b">
                                <th colSpan={3} className="p-1 border-r sticky left-0 bg-gray-100 text-center">Master</th>
                                <th colSpan={2} className="p-1 border-r bg-blue-50/50 text-center">Stock</th>
                                <th colSpan={3} className="p-1 border-r bg-orange-50/50 text-center">SO</th>
                                <th colSpan={3} className="p-1 border-r bg-purple-50/50 text-center">PO</th>
                                <th colSpan={2} className="p-1 border-r bg-gray-200 text-center">Net</th>
                                <th colSpan={3} className="p-1 border-r bg-indigo-50/50 text-center">Planning (Avg/Trend)</th>
                                <th colSpan={3} className="p-1 border-r bg-emerald-50/50 text-center">Levels (Min/Re/Max)</th>
                                <th colSpan={2} className="p-1 border-r text-red-700 text-center">Ex Stock</th>
                                <th colSpan={2} className="p-1 border-r text-red-700 text-center">Ex PO</th>
                                <th colSpan={2} className="p-1 border-r text-green-700 text-center">Need</th>
                                <th colSpan={2} className="p-1 text-blue-700 text-center">Exp</th>
                            </tr>
                            <tr className="border-b cursor-pointer">
                                <th onClick={() => handleHeaderSort('make')} className="p-2 border-r sticky left-0 bg-gray-50">Make</th>
                                <th onClick={() => handleHeaderSort('materialGroup')} className="p-2 border-r sticky left-[6rem] bg-gray-50">Group</th>
                                <th onClick={() => handleHeaderSort('description')} className="p-2 border-r sticky left-[12rem] bg-gray-50 min-w-[200px]">Description</th>
                                <th onClick={() => handleHeaderSort('stock.qty')} className="p-2 text-right">Qty</th>
                                <th onClick={() => handleHeaderSort('stock.val')} className="p-2 text-right border-r">Val</th>
                                <th onClick={() => handleHeaderSort('so.curQty')} className="p-2 text-right text-orange-600">Cur</th>
                                <th onClick={() => handleHeaderSort('so.schQty')} className="p-2 text-right text-orange-600">Sch</th>
                                <th onClick={() => handleHeaderSort('so.qty')} className="p-2 text-right border-r">Tot</th>
                                <th onClick={() => handleHeaderSort('po.curQty')} className="p-2 text-right text-purple-600">Cur</th>
                                <th onClick={() => handleHeaderSort('po.schQty')} className="p-2 text-right text-purple-600">Sch</th>
                                <th onClick={() => handleHeaderSort('po.qty')} className="p-2 text-right border-r">Tot</th>
                                <th onClick={() => handleHeaderSort('net.qty')} className="p-2 text-right bg-gray-100">Qty</th>
                                <th onClick={() => handleHeaderSort('net.val')} className="p-2 text-right border-r bg-gray-100">Val</th>
                                <th onClick={() => handleHeaderSort('avg3m.qty')} className="p-2 text-right text-indigo-700">3M</th>
                                <th onClick={() => handleHeaderSort('avg1y.qty')} className="p-2 text-right text-indigo-700">1Y</th>
                                <th onClick={() => handleHeaderSort('growth.pct')} className="p-2 text-center border-r text-indigo-700">Trend</th>
                                <th onClick={() => handleHeaderSort('levels.min.qty')} className="p-2 text-right text-emerald-700">Min</th>
                                <th onClick={() => handleHeaderSort('levels.reorder.qty')} className="p-2 text-right text-emerald-700">Re</th>
                                <th onClick={() => handleHeaderSort('levels.max.qty')} className="p-2 text-right border-r text-emerald-700">Max</th>
                                <th onClick={() => handleHeaderSort('actions.excessStock.qty')} className="p-2 text-right">Qty</th><th className="p-2 text-right border-r">Val</th>
                                <th onClick={() => handleHeaderSort('actions.excessPO.qty')} className="p-2 text-right">Qty</th><th className="p-2 text-right border-r">Val</th>
                                <th onClick={() => handleHeaderSort('actions.poNeed.qty')} className="p-2 text-right">Qty</th><th className="p-2 text-right border-r">Val</th>
                                <th onClick={() => handleHeaderSort('actions.expedite.qty')} className="p-2 text-right">Qty</th><th className="p-2 text-right">Val</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-[10px]">
                            {filteredData.slice(0, displayLimit).map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                    <td className="p-1 border-r sticky left-0 bg-white">{r.make}</td>
                                    <td className="p-1 border-r sticky left-[6rem] bg-white">{r.materialGroup}</td>
                                    <td className="p-1 border-r sticky left-[12rem] bg-white truncate max-w-[200px] font-medium" title={r.description}>{r.description}</td>
                                    <td className="p-1 text-right">{r.stock.qty || '-'}</td>
                                    <td className="p-1 text-right border-r text-gray-500">{r.stock.val ? Math.round(r.stock.val).toLocaleString() : '-'}</td>
                                    <td className="p-1 text-right text-orange-600">{r.so.curQty || '-'}</td>
                                    <td className="p-1 text-right text-orange-400">{r.so.schQty || '-'}</td>
                                    <td className="p-1 text-right border-r font-bold">{r.so.qty || '-'}</td>
                                    <td className="p-1 text-right text-purple-600">{r.po.curQty || '-'}</td>
                                    <td className="p-1 text-right text-purple-400">{r.po.schQty || '-'}</td>
                                    <td className="p-1 text-right border-r font-bold">{r.po.qty || '-'}</td>
                                    <td className="p-1 text-right bg-gray-50 font-bold">{r.net.qty}</td>
                                    <td className="p-1 text-right border-r bg-gray-50">{Math.round(r.net.val).toLocaleString()}</td>
                                    <td className="p-1 text-right text-indigo-700">{r.avg3m.qty > 0 ? r.avg3m.qty.toFixed(1) : '0'}</td>
                                    <td className="p-1 text-right text-indigo-700">{r.avg1y.qty > 0 ? r.avg1y.qty.toFixed(1) : '0'}</td>
                                    <td className="p-1 text-center border-r text-[8px] font-black">
                                        {r.avg1y.qty > 0 && (
                                            <div className={`flex items-center justify-center gap-0.5 ${r.growth.pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {r.growth.pct >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                                                <span>{Math.abs(Math.round(r.growth.pct))}%</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-1 text-right text-emerald-700 font-bold">{r.levels.min.qty || '0'}</td>
                                    <td className="p-1 text-right text-emerald-700 font-bold">{r.levels.reorder.qty || '0'}</td>
                                    <td className="p-1 text-right border-r text-emerald-700 font-bold">{r.levels.max.qty || '0'}</td>
                                    <td className="p-1 text-right text-red-600 font-bold">{r.actions.excessStock.qty || ''}</td>
                                    <td className="p-1 text-right border-r text-red-300">{r.actions.excessStock.val ? Math.round(r.actions.excessStock.val).toLocaleString() : ''}</td>
                                    <td className="p-1 text-right text-red-600 font-bold">{r.actions.excessPO.qty || ''}</td>
                                    <td className="p-1 text-right border-r text-red-300">{r.actions.excessPO.val ? Math.round(r.actions.excessPO.val).toLocaleString() : ''}</td>
                                    <td className="p-1 text-right text-green-600 font-bold">{r.actions.poNeed.qty || ''}</td>
                                    <td className="p-1 text-right border-r text-green-300">{r.actions.poNeed.val ? Math.round(r.actions.poNeed.val).toLocaleString() : ''}</td>
                                    <td className="p-1 text-right text-blue-600 font-bold">{r.actions.expedite.qty || ''}</td>
                                    <td className="p-1 text-right border-r text-blue-300">{r.actions.expedite.val ? Math.round(r.actions.expedite.val).toLocaleString() : ''}</td>
                                </tr>
                            ))}
                            {filteredData.length > displayLimit && (
                                <tr><td colSpan={27} className="p-4 text-center"><button onClick={() => setDisplayLimit(d => d + 200)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md">Load More ({filteredData.length - displayLimit})</button></td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PivotReportView;
