import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem } from '../types';
import { Download, Search, Filter, ArrowUpDown, FileSpreadsheet, AlertTriangle, PackageOpen } from 'lucide-react';

interface ReportsViewProps {
    materials: Material[];
    closingStock: ClosingStockItem[];
    pendingSO: PendingSOItem[];
    pendingPO: PendingPOItem[];
    salesReportItems: SalesReportItem[];
}

const formatLargeValue = (val: number) => {
    if (isNaN(val) || val === null) return '-';
    if (val === 0) return '0';
    return `Rs. ${Math.round(val).toLocaleString('en-IN')}`;
};

const parseDateString = (dateStr: string): number => {
    if (!dateStr) return Number.MAX_SAFE_INTEGER;
    const parts = dateStr.split(/[-/.]/);
    if (parts.length === 3) {
        if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
        let y = parseInt(parts[2]);
        if (y < 100) y += 2000;
        return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    }
    return new Date(dateStr).getTime();
};

const getLappCategory = (desc: string, make: string): string => {
    if (make !== 'LAPP') return 'Other Make';
    const d = (desc || '').toUpperCase();
    if (d.includes('UNIPLUS')) return 'Uniplus';
    if (d.includes('OLFLEX') || d.includes('ÖLFLEX')) return 'Olflex';
    if (d.includes('UNITRONIC')) return 'UNITRONIC';
    return 'Other LAPP';
};

const getMergedMakeName = (makeName: string) => {
    const m = String(makeName || 'Unspecified').trim();
    const lowerM = m.toLowerCase();
    if (lowerM.includes('lapp')) return 'LAPP';
    if (lowerM.includes('luker')) return 'Luker';
    return m;
};

const roundToTen = (num: number) => {
    if (num <= 0) return 0;
    return Math.ceil(num / 10) * 10;
};

const formatDisplayDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const t = parseDateString(dateStr);
    if (t === Number.MAX_SAFE_INTEGER) return dateStr;
    const d = new Date(t);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

export const ReportsView: React.FC<ReportsViewProps> = ({
    materials, closingStock, pendingSO, pendingPO, salesReportItems
}) => {
    const [activeTab, setActiveTab] = useState<'pendingSO' | 'purchase'>('pendingSO');
    const [soSortBy, setSoSortBy] = useState<'dueDate' | 'lapp' | 'item' | 'po'>('dueDate');
    const [criticalOnly, setCriticalOnly] = useState(false);

    // Build optimized lookup maps
    const { materialMap, stockMap, poMap, soMap, avgSalesMap } = useMemo(() => {
        const matMap = new Map<string, Material>();
        materials.forEach(m => {
            if (m.description) matMap.set(m.description.toLowerCase().trim(), m);
            if (m.partNo) matMap.set(m.partNo.toLowerCase().trim(), m);
        });

        const sMap = new Map<string, number>();
        closingStock.forEach(s => {
            const key = (s.description || '').toLowerCase().trim();
            sMap.set(key, (sMap.get(key) || 0) + s.quantity);
        });

        const pMap = new Map<string, number>();
        pendingPO.forEach(p => {
            const key = (p.itemName || '').toLowerCase().trim();
            pMap.set(key, (pMap.get(key) || 0) + p.balanceQty);
        });

        const oMap = new Map<string, number>();
        pendingSO.forEach(s => {
            const key = (s.itemName || '').toLowerCase().trim();
            oMap.set(key, (oMap.get(key) || 0) + s.balanceQty);
        });

        const aMap = new Map<string, number>();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const oneYearAgoTime = oneYearAgo.getTime();
        
        salesReportItems.forEach(s => {
            const t = parseDateString(s.date);
            if (t >= oneYearAgoTime) {
                const key = (s.particulars || '').toLowerCase().trim();
                aMap.set(key, (aMap.get(key) || 0) + s.quantity);
            }
        });

        return { materialMap: matMap, stockMap: sMap, poMap: pMap, soMap: oMap, avgSalesMap: aMap };
    }, [materials, closingStock, pendingPO, pendingSO, salesReportItems]);

    // Calculate FIFO Allocation for Pending SO
    const allocatedSOData = useMemo(() => {
        const soByItem = new Map<string, PendingSOItem[]>();
        pendingSO.forEach(so => {
            const key = (so.itemName || '').toLowerCase().trim();
            if (!soByItem.has(key)) soByItem.set(key, []);
            soByItem.get(key)!.push(so);
        });

        const result: (PendingSOItem & { allocatedQty: number, totalStock: number, lappCategory: string, overdueDays: number })[] = [];
        const todayT = new Date().setHours(0,0,0,0);

        soByItem.forEach((orders, itemKey) => {
            // Sort by Due Date for FIFO
            orders.sort((a, b) => parseDateString(a.dueDate) - parseDateString(b.dueDate));
            
            let totalStock = stockMap.get(itemKey) || 0;
            let availableStock = totalStock;

            const mat = materialMap.get(itemKey);
            const lappCategory = mat ? getLappCategory(mat.description, mat.make) : 'Unknown';

            orders.forEach(so => {
                const allocated = Math.max(0, Math.min(availableStock, so.balanceQty));
                availableStock -= allocated;
                
                const dueT = parseDateString(so.dueDate);
                let overdueDays = 0;
                if (dueT < todayT && dueT !== Number.MAX_SAFE_INTEGER) {
                    overdueDays = Math.floor((todayT - dueT) / (1000 * 60 * 60 * 24));
                }
                
                result.push({
                    ...so,
                    allocatedQty: allocated,
                    totalStock: totalStock,
                    lappCategory,
                    overdueDays
                });
            });
        });

        // Apply View Sorting
        result.sort((a, b) => {
            if (soSortBy === 'dueDate') {
                const dateCmp = parseDateString(a.dueDate) - parseDateString(b.dueDate);
                if (dateCmp !== 0) return dateCmp;
                return (a.itemName || '').localeCompare(b.itemName || '');
            } else if (soSortBy === 'lapp') {
                const lCmp = (a.lappCategory || '').localeCompare(b.lappCategory || '');
                if (lCmp !== 0) return lCmp;
                return (a.itemName || '').localeCompare(b.itemName || '');
            } else if (soSortBy === 'item') {
                return (a.itemName || '').localeCompare(b.itemName || '');
            } else if (soSortBy === 'po') {
                return (a.orderNo || '').localeCompare(b.orderNo || '');
            }
            return 0;
        });

        return result;
    }, [pendingSO, stockMap, materialMap, soSortBy]);

    // Calculate Purchase Report Data
    const purchaseReportData = useMemo(() => {
        const uniqueItems = new Set<string>();
        pendingSO.forEach(s => uniqueItems.add((s.itemName || '').toLowerCase().trim()));
        pendingPO.forEach(p => uniqueItems.add((p.itemName || '').toLowerCase().trim()));
        
        const result = Array.from(uniqueItems).map(key => {
            if (!key) return null;
            
            const mat = materialMap.get(key);
            const description = mat?.description || key;
            const fastRunner = mat ? ((mat as any).abcIndicator || 'C') : 'C';
            const lappGroup = mat ? getLappCategory(mat.description, mat.make) : 'Unknown';

            const stockQty = stockMap.get(key) || 0;
            const openSO = soMap.get(key) || 0;
            const openPO = poMap.get(key) || 0;

            const avg12mQty = avgSalesMap.get(key) || 0;
            const a1q = avg12mQty / 12;

            let isApplicable = false;
            const mk = mat ? getMergedMakeName(mat.make || '').toUpperCase() : 'UNSPECIFIED';
            const grp = String(mat?.materialGroup || '').trim().toLowerCase();
            
            if (mk === 'LAPP') {
                const excluded = ["lapp-planned stock specific customer", "lapp-non moving stocks", "lapp-against customer po", "lapp infra"];
                isApplicable = !excluded.some(ex => grp.includes(ex.toLowerCase()));
            } else if (mk === 'EATON') {
                const excluded = ["eaton-non moving stock", "eaton-planned stock specific customer"];
                isApplicable = !excluded.some(ex => grp.includes(ex.toLowerCase()));
            }

            let maxStock = 0;
            if (isApplicable && a1q > 0) {
                const min = roundToTen(a1q);
                maxStock = min * 2;
            }

            const expediteQty = Math.max(0, openSO - stockQty); // PO needed to cover SO shortfall immediately
            
            const netQty = stockQty + openPO - openSO;
            const poNeededForMax = Math.max(0, maxStock - netQty); // PO needed to reach Max Stock

            return {
                description,
                fastRunner,
                lappGroup,
                stockQty,
                openSO,
                openPO,
                expediteQty,
                maxStock,
                poNeededForMax
            };
        }).filter(Boolean) as any[];

        if (criticalOnly) {
            return result.filter(r => r.openSO > 0 && r.openPO === 0 && r.stockQty < r.openSO);
        }

        return result.sort((a, b) => b.openSO - a.openSO); // Default sort by highest demand
    }, [pendingSO, pendingPO, materialMap, stockMap, soMap, poMap, avgSalesMap, criticalOnly]);

    const exportToExcel = () => {
        if (activeTab === 'pendingSO') {
            const data = allocatedSOData.map(r => ({
                'Lapp Category': r.lappCategory,
                'SO Date': formatDisplayDate(r.date),
                'SO No': (r.orderNo || '').split('/')[0]?.trim() || '',
                'PO Ref': (r.orderNo || '').split('/').slice(1).join('/')?.trim() || '',
                'Customer Name': r.partyName,
                'Item Description': r.itemName,
                'Order Qty': r.orderedQty,
                'Balance Qty': r.balanceQty,
                'Amount': r.value,
                'Due Date': formatDisplayDate(r.dueDate),
                'Overdue Days': r.overdueDays,
                'Total Stock': r.totalStock,
                'Allocated Qty (FIFO)': r.allocatedQty,
                'Shortfall': Math.max(0, r.balanceQty - r.allocatedQty)
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Pending_SO_Report");
            XLSX.writeFile(wb, "Pending_SO_Report.xlsx");
        } else {
            const data = purchaseReportData.map(r => ({
                'Description': r.description,
                'Fast Runner (ABC)': r.fastRunner,
                'Lapp Category': r.lappGroup,
                'Stock Qty': r.stockQty,
                'Pending SO': r.openSO,
                'Pending PO': r.openPO,
                'PO Need for SO Shortfall': r.expediteQty,
                'Target Max Stock': r.maxStock,
                'PO Need for Max Target': r.poNeededForMax
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Purchase_Report");
            XLSX.writeFile(wb, "Purchase_Report.xlsx");
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-100 rounded-xl">
                        <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Reports & Analytics</h2>
                        <p className="text-sm font-medium text-slate-500">Advanced inventory and fulfillment reports</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('pendingSO')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pendingSO' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Pending SO Report
                        </button>
                        <button
                            onClick={() => setActiveTab('purchase')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'purchase' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Purchase Report
                        </button>
                    </div>
                    <button 
                        onClick={exportToExcel}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm shadow-emerald-200 transition-all flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" /> Export Excel
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-200 z-10 sticky top-[80px]">
                {activeTab === 'pendingSO' ? (
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-slate-500">Sort By:</span>
                        <select 
                            className="bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                            value={soSortBy}
                            onChange={(e) => setSoSortBy(e.target.value as any)}
                        >
                            <option value="dueDate">Due Date &rarr; Item</option>
                            <option value="lapp">Lapp Category &rarr; Item</option>
                            <option value="item">Item Wise</option>
                            <option value="po">Customer PO / SO No</option>
                        </select>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setCriticalOnly(!criticalOnly)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${criticalOnly ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                        >
                            <AlertTriangle className={`w-4 h-4 ${criticalOnly ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`} />
                            Critical Shorts (SO but no PO)
                        </button>
                    </div>
                )}
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto custom-scrollbar p-6">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    {activeTab === 'pendingSO' ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                    <th className="p-3 border-b border-gray-100">SO Date</th>
                                    <th className="p-3 border-b border-gray-100">Category</th>
                                    <th className="p-3 border-b border-gray-100">SO No</th>
                                    <th className="p-3 border-b border-gray-100">PO Ref</th>
                                    <th className="p-3 border-b border-gray-100">Customer Name</th>
                                    <th className="p-3 border-b border-gray-100">Item Description</th>
                                    <th className="p-3 border-b border-gray-100 text-right">Order Qty</th>
                                    <th className="p-3 border-b border-gray-100 text-right">Balance Qty</th>
                                    <th className="p-3 border-b border-gray-100 text-center">Due Date</th>
                                    <th className="p-3 border-b border-gray-100 text-center text-rose-600">Overdue Days</th>
                                    <th className="p-3 border-b border-gray-100 text-right bg-blue-50/50">Total Stock</th>
                                    <th className="p-3 border-b border-gray-100 text-right bg-emerald-50/50">Allocated (FIFO)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allocatedSOData.map((row, i) => (
                                    <tr key={`${row.id}-${i}`} className="hover:bg-slate-50 border-b border-gray-50 transition-colors">
                                        <td className="p-3 text-xs text-slate-600 whitespace-nowrap">{formatDisplayDate(row.date)}</td>
                                        <td className="p-3 text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{row.lappCategory}</td>
                                        <td className="p-3 text-xs font-bold text-slate-700">{(row.orderNo || '').split('/')[0]?.trim() || ''}</td>
                                        <td className="p-3 text-xs font-bold text-slate-500">{(row.orderNo || '').split('/').slice(1).join('/')?.trim() || ''}</td>
                                        <td className="p-3 text-xs text-slate-600 max-w-[150px] truncate" title={row.partyName}>{row.partyName}</td>
                                        <td className="p-3 text-xs font-bold text-slate-800 max-w-[200px] truncate" title={row.itemName}>{row.itemName}</td>
                                        <td className="p-3 text-xs font-medium text-slate-600 text-right">{row.orderedQty.toLocaleString()}</td>
                                        <td className="p-3 text-xs font-black text-indigo-600 text-right">{row.balanceQty.toLocaleString()}</td>
                                        <td className="p-3 text-xs text-slate-600 text-center whitespace-nowrap">{formatDisplayDate(row.dueDate)}</td>
                                        <td className="p-3 text-xs font-black text-center">
                                            {row.overdueDays > 0 ? (
                                                <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{row.overdueDays}</span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-xs font-bold text-blue-600 text-right bg-blue-50/30">{row.totalStock.toLocaleString()}</td>
                                        <td className={`p-3 text-xs font-black text-right bg-emerald-50/30 ${row.allocatedQty > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                            {row.allocatedQty > 0 ? row.allocatedQty.toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {allocatedSOData.length === 0 && (
                                    <tr><td colSpan={10} className="p-8 text-center text-slate-500 font-medium">No pending sales orders found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                    <th className="p-3 border-b border-gray-100">Description</th>
                                    <th className="p-3 border-b border-gray-100 text-center">Fast Runner</th>
                                    <th className="p-3 border-b border-gray-100 text-center">Lapp Category</th>
                                    <th className="p-3 border-b border-gray-100 text-right text-blue-600">Stock Qty</th>
                                    <th className="p-3 border-b border-gray-100 text-right text-amber-600">Pending SO</th>
                                    <th className="p-3 border-b border-gray-100 text-right text-indigo-600">Pending PO</th>
                                    <th className="p-3 border-b border-gray-100 text-right text-rose-600">PO Need (SO Shortfall)</th>
                                    <th className="p-3 border-b border-gray-100 text-right text-gray-500 bg-gray-100/50">Target Max Stock</th>
                                    <th className="p-3 border-b border-gray-100 text-right text-emerald-600 bg-emerald-50/30">PO Need (Max Target)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchaseReportData.map((row, i) => (
                                    <tr key={`${row.description}-${i}`} className="hover:bg-slate-50 border-b border-gray-50 transition-colors">
                                        <td className="p-3 text-xs font-bold text-slate-800 max-w-[250px] truncate" title={row.description}>{row.description}</td>
                                        <td className="p-3 text-xs text-center"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">{row.fastRunner}</span></td>
                                        <td className="p-3 text-[10px] font-bold text-indigo-600 text-center tracking-widest uppercase">{row.lappGroup}</td>
                                        <td className="p-3 text-xs font-black text-blue-600 text-right bg-blue-50/20">{row.stockQty.toLocaleString()}</td>
                                        <td className="p-3 text-xs font-black text-amber-600 text-right bg-amber-50/20">{row.openSO.toLocaleString()}</td>
                                        <td className="p-3 text-xs font-black text-indigo-600 text-right bg-indigo-50/20">{row.openPO.toLocaleString()}</td>
                                        <td className={`p-3 text-xs font-black text-right bg-rose-50/10 ${row.expediteQty > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                                            {row.expediteQty > 0 ? row.expediteQty.toLocaleString() : '-'}
                                        </td>
                                        <td className="p-3 text-xs font-bold text-gray-500 text-right bg-gray-100/30">{row.maxStock.toLocaleString()}</td>
                                        <td className={`p-3 text-xs font-black text-right bg-emerald-50/30 ${row.poNeededForMax > 0 ? 'text-emerald-600' : 'text-emerald-200'}`}>
                                            {row.poNeededForMax > 0 ? row.poNeededForMax.toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {purchaseReportData.length === 0 && (
                                    <tr><td colSpan={10} className="p-8 text-center text-slate-500 font-medium">No purchase data found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
