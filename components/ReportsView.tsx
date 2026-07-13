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

export const ReportsView: React.FC<ReportsViewProps> = ({
    materials, closingStock, pendingSO, pendingPO, salesReportItems
}) => {
    const [activeTab, setActiveTab] = useState<'pendingSO' | 'purchase'>('pendingSO');
    const [soSortBy, setSoSortBy] = useState<'default' | 'item' | 'po'>('default'); // default = Customer -> Due -> Item
    const [criticalOnly, setCriticalOnly] = useState(false);

    // Build optimized lookup maps
    const { materialMap, stockMap, poMap, soMap, avgSalesMap } = useMemo(() => {
        const matMap = new Map<string, Material>();
        materials.forEach(m => {
            if (m.partNo) matMap.set(m.partNo.toLowerCase().trim(), m);
            if (m.materialCode) matMap.set(m.materialCode.toLowerCase().trim(), m);
        });

        const sMap = new Map<string, number>();
        closingStock.forEach(s => {
            const key = (s.description || '').toLowerCase().trim();
            sMap.set(key, (sMap.get(key) || 0) + s.quantity);
        });

        const pMap = new Map<string, number>();
        pendingPO.forEach(p => {
            const key = (p.partNo || '').toLowerCase().trim();
            pMap.set(key, (pMap.get(key) || 0) + p.balanceQty);
        });

        const oMap = new Map<string, number>();
        pendingSO.forEach(s => {
            const key = (s.partNo || '').toLowerCase().trim();
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
        // Group SOs by item to do FIFO allocation
        const soByItem = new Map<string, PendingSOItem[]>();
        pendingSO.forEach(so => {
            const key = (so.partNo || so.itemName || '').toLowerCase().trim();
            if (!soByItem.has(key)) soByItem.set(key, []);
            soByItem.get(key)!.push(so);
        });

        const result: (PendingSOItem & { allocatedQty: number, totalStock: number })[] = [];

        soByItem.forEach((orders, itemKey) => {
            // Sort by Due Date for FIFO
            orders.sort((a, b) => parseDateString(a.dueDate) - parseDateString(b.dueDate));
            
            // Try matching stock via material code or exact description
            let totalStock = stockMap.get(itemKey) || 0;
            if (totalStock === 0) {
                const mat = materialMap.get(itemKey);
                if (mat && mat.description) {
                    totalStock = stockMap.get(mat.description.toLowerCase().trim()) || 0;
                }
            }

            let availableStock = totalStock;

            orders.forEach(so => {
                const allocated = Math.max(0, Math.min(availableStock, so.balanceQty));
                availableStock -= allocated;
                
                result.push({
                    ...so,
                    allocatedQty: allocated,
                    totalStock: totalStock
                });
            });
        });

        // Apply View Sorting
        result.sort((a, b) => {
            if (soSortBy === 'item') {
                return (a.itemName || '').localeCompare(b.itemName || '');
            } else if (soSortBy === 'po') {
                return (a.orderNo || '').localeCompare(b.orderNo || ''); // Assuming orderNo acts as PO
            } else {
                // Default: Customer -> Due Date -> Item
                const partyCmp = (a.partyName || '').localeCompare(b.partyName || '');
                if (partyCmp !== 0) return partyCmp;
                const dateCmp = parseDateString(a.dueDate) - parseDateString(b.dueDate);
                if (dateCmp !== 0) return dateCmp;
                return (a.itemName || '').localeCompare(b.itemName || '');
            }
        });

        return result;
    }, [pendingSO, stockMap, materialMap, soSortBy]);

    // Calculate Purchase Report Data
    const purchaseReportData = useMemo(() => {
        // Gather unique items from SO, PO, and Stock
        const uniqueItems = new Set<string>();
        pendingSO.forEach(s => uniqueItems.add((s.partNo || '').toLowerCase().trim()));
        pendingPO.forEach(p => uniqueItems.add((p.partNo || '').toLowerCase().trim()));
        
        const result = Array.from(uniqueItems).map(key => {
            if (!key) return null;
            
            let description = key;
            let fastRunner = 'C';
            let lappGroup = 'UNKNOWN';
            
            const mat = materialMap.get(key);
            if (mat) {
                description = mat.description || key;
                fastRunner = (mat as any).abcIndicator || 'C'; // assuming it might be in raw data
                lappGroup = mat.materialGroup || 'UNKNOWN';
            }

            const stockQty = stockMap.get(description.toLowerCase().trim()) || stockMap.get(key) || 0;
            const openSO = soMap.get(key) || 0;
            const openPO = poMap.get(key) || 0;

            const avg12mQty = avgSalesMap.get(description.toLowerCase().trim()) || avgSalesMap.get(key) || 0;
            const maxStock = Math.ceil(avg12mQty / 6); // 2 months max stock

            const netQty = stockQty - openSO;
            const calculatedStock = stockQty + openPO - openSO;
            
            const expediteQty = Math.max(0, openSO - stockQty);
            const poNeeded = Math.max(0, maxStock - calculatedStock);

            return {
                partNo: key,
                description,
                fastRunner,
                lappGroup,
                stockQty,
                openSO,
                openPO,
                expediteQty,
                poNeeded
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
                'Date': r.date,
                'Customer PO No / SO No': r.orderNo, // we don't have separate customer po in data
                'Customer Name': r.partyName,
                'Item Description': r.itemName,
                'Part No': r.partNo,
                'Order Qty': r.orderedQty,
                'Balance Qty': r.balanceQty,
                'Amount': r.value,
                'Due Date': r.dueDate,
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
                'Part No': r.partNo?.toUpperCase(),
                'Description': r.description,
                'Fast Runner (ABC)': r.fastRunner,
                'Lapp Group': r.lappGroup,
                'Stock Qty': r.stockQty,
                'Pending SO': r.openSO,
                'Pending PO': r.openPO,
                'Qty to Expedite': r.expediteQty,
                'PO Needed to Place': r.poNeeded
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
                            <option value="default">Customer &rarr; Due Date</option>
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
                                    <th className="p-3 border-b border-gray-100">Date</th>
                                    <th className="p-3 border-b border-gray-100">SO / PO No</th>
                                    <th className="p-3 border-b border-gray-100">Customer Name</th>
                                    <th className="p-3 border-b border-gray-100">Item Description</th>
                                    <th className="p-3 border-b border-gray-100 text-right">Order Qty</th>
                                    <th className="p-3 border-b border-gray-100 text-right">Balance Qty</th>
                                    <th className="p-3 border-b border-gray-100">Due Date</th>
                                    <th className="p-3 border-b border-gray-100 text-right bg-blue-50/50">Total Stock</th>
                                    <th className="p-3 border-b border-gray-100 text-right bg-emerald-50/50">Allocated (FIFO)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allocatedSOData.map((row, i) => (
                                    <tr key={`${row.id}-${i}`} className="hover:bg-slate-50 border-b border-gray-50 transition-colors">
                                        <td className="p-3 text-xs text-slate-600 whitespace-nowrap">{row.date}</td>
                                        <td className="p-3 text-xs font-bold text-slate-700">{row.orderNo}</td>
                                        <td className="p-3 text-xs text-slate-600 max-w-[150px] truncate" title={row.partyName}>{row.partyName}</td>
                                        <td className="p-3 text-xs text-slate-600 max-w-[200px] truncate" title={row.itemName}>{row.itemName}</td>
                                        <td className="p-3 text-xs font-medium text-slate-600 text-right">{row.orderedQty.toLocaleString()}</td>
                                        <td className="p-3 text-xs font-bold text-indigo-600 text-right">{row.balanceQty.toLocaleString()}</td>
                                        <td className="p-3 text-xs text-slate-600 whitespace-nowrap">{row.dueDate}</td>
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
                                    <th className="p-3 border-b border-gray-100">Part No</th>
                                    <th className="p-3 border-b border-gray-100">Description</th>
                                    <th className="p-3 border-b border-gray-100 text-center">Fast Runner</th>
                                    <th className="p-3 border-b border-gray-100 text-center">Lapp Group</th>
                                    <th className="p-3 border-b border-gray-100 text-right text-blue-600">Stock Qty</th>
                                    <th className="p-3 border-b border-gray-100 text-right text-amber-600">Pending SO</th>
                                    <th className="p-3 border-b border-gray-100 text-right text-indigo-600">Pending PO</th>
                                    <th className="p-3 border-b border-gray-100 text-right text-rose-600">Qty to Expedite</th>
                                    <th className="p-3 border-b border-gray-100 text-right text-emerald-600">PO Needed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchaseReportData.map((row, i) => (
                                    <tr key={`${row.partNo}-${i}`} className="hover:bg-slate-50 border-b border-gray-50 transition-colors">
                                        <td className="p-3 text-xs font-bold text-slate-700">{row.partNo?.toUpperCase()}</td>
                                        <td className="p-3 text-xs text-slate-600 max-w-[200px] truncate" title={row.description}>{row.description}</td>
                                        <td className="p-3 text-xs text-center"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">{row.fastRunner}</span></td>
                                        <td className="p-3 text-xs text-slate-500 text-center">{row.lappGroup}</td>
                                        <td className="p-3 text-xs font-black text-blue-600 text-right bg-blue-50/20">{row.stockQty.toLocaleString()}</td>
                                        <td className="p-3 text-xs font-black text-amber-600 text-right bg-amber-50/20">{row.openSO.toLocaleString()}</td>
                                        <td className="p-3 text-xs font-black text-indigo-600 text-right bg-indigo-50/20">{row.openPO.toLocaleString()}</td>
                                        <td className={`p-3 text-xs font-black text-right bg-rose-50/10 ${row.expediteQty > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                                            {row.expediteQty > 0 ? row.expediteQty.toLocaleString() : '-'}
                                        </td>
                                        <td className={`p-3 text-xs font-black text-right bg-emerald-50/10 ${row.poNeeded > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                            {row.poNeeded > 0 ? row.poNeeded.toLocaleString() : '-'}
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
