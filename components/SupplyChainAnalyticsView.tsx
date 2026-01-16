
import React, { useState, useMemo, useDeferredValue } from 'react';
import { SalesReportItem, Material, ClosingStockItem, PendingSOItem, PendingPOItem } from '../types';
import {
    Search,
    FileDown,
    Filter,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Layers,
    Table as TableIcon,
    Calendar,
    Factory,
    TrendingUp,
    CheckCircle2,
    Eye,
    EyeOff,
    Settings2
} from 'lucide-react';
import { utils, writeFile } from 'xlsx';

interface AnalyticsProps {
    salesReportItems: SalesReportItem[];
    materials: Material[];
    closingStock: ClosingStockItem[];
    pendingSO: PendingSOItem[];
    pendingPO: PendingPOItem[];
}

const parseDate = (val: any): Date => {
    if (!val) return new Date();
    let d: Date;
    if (val instanceof Date) {
        d = new Date(val);
    } else if (typeof val === 'number') {
        // Handle Excel serial date
        d = new Date((Math.round(val) - 25568) * 86400 * 1000);
    } else if (typeof val === 'string') {
        d = new Date(val);
        if (isNaN(d.getTime())) {
            const parts = val.split(/[-/.]/);
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    const d2 = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    d = !isNaN(d2.getTime()) ? d2 : new Date();
                } else if (parts[2].length === 4) {
                    const d2 = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    d = !isNaN(d2.getTime()) ? d2 : new Date();
                } else {
                    d = new Date();
                }
            } else {
                d = new Date();
            }
        }
    } else {
        d = new Date();
    }
    return d;
};

const getFY = (dateInput: string | number | Date) => {
    const d = parseDate(dateInput);
    if (isNaN(d.getTime())) return 'Unknown';
    const year = d.getFullYear();
    const month = d.getMonth();
    // FY starts in April (month 3)
    if (month >= 3) {
        // April 2025 onwards = FY 2025-26
        return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
        // Jan-Mar 2025 = FY 2024-25
        return `${year - 1}-${year.toString().slice(-2)}`;
    }
};

const SupplyChainAnalyticsView: React.FC<AnalyticsProps> = ({ salesReportItems, materials, closingStock, pendingSO, pendingPO }) => {
    // Slicer States
    const [selectedMake, setSelectedMake] = useState<string>('All');
    const [selectedGroup, setSelectedGroup] = useState<string>('All');
    const [selectedStrategy, setSelectedStrategy] = useState<string>('All');
    const [selectedClass, setSelectedClass] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const deferredSearch = useDeferredValue(searchTerm);
    const [showColumnConfig, setShowColumnConfig] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        makeGroup: true,
        strategyClass: true,
        operational: true,
        activeMonths: true,
        customerCount: true,
        qtySold: true
    });

    const toggleCol = (key: keyof typeof visibleColumns) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Dynamically determine FYs for the report
    const currentFY = getFY(new Date());
    const [cyStartYear] = currentFY.split('-').map(Number);
    const FY_CY = currentFY;
    const FY_PY = `${cyStartYear - 1}-${cyStartYear.toString().slice(-2)}`;

    const analyticsData = useMemo(() => {
        const materialMap = new Map<string, any>();

        // 1. Initialize with Materials
        materials.forEach(m => {
            const partNo = (m.partNo || '').trim().toLowerCase();
            const desc = (m.description || '').trim().toLowerCase();

            const entry = {
                partNo: m.partNo,
                description: m.description,
                group: m.materialGroup,
                make: m.make,
                stock: 0,
                so: 0,
                po: 0,
                sales: [],
                distinctCustomers: new Set(),
                hasProjectOrders: false,
                fyData: {
                    [FY_CY]: { qty: 0, projectQty: 0, customers: new Set(), months: new Set(), monthlyCust: new Map(), totalRawQty: 0 },
                    [FY_PY]: { qty: 0, projectQty: 0, customers: new Set(), months: new Set(), monthlyCust: new Map(), totalRawQty: 0 }
                }
            };

            // Map by description (primary key for sales matching)
            if (desc) materialMap.set(desc, entry);
            // Also map by partNo if different
            if (partNo && partNo !== desc) {
                materialMap.set(partNo, entry);
            }
        });

        // 2. Integrate Stock
        closingStock.forEach(s => {
            const key = (s.description || '').trim().toLowerCase();
            const m = materialMap.get(key);
            if (m) m.stock += (s.quantity || 0);
        });

        // 3. Integrate Pending SO
        pendingSO.forEach(s => {
            const key = (s.itemName || '').trim().toLowerCase();
            const m = materialMap.get(key);
            if (m) m.so += (s.balanceQty || 0);
        });

        // 4. Integrate Pending PO
        pendingPO.forEach(p => {
            const key = (p.itemName || '').trim().toLowerCase();
            const m = materialMap.get(key);
            if (m) m.po += (p.balanceQty || 0);
        });

        // Current date and benchmarks
        const now = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(now.getMonth() - 12);

        // 5. Process Sales
        const materialAnalysisMap = new Map<string, any>();
        // Use a unique set of entries from our map to avoid double-processing (since we mapped by both partNo and desc)
        const uniqueMaterials = Array.from(new Set(materialMap.values()));

        console.log('=== SC ANALYTICS DEBUG ===');
        console.log('Total sales items:', salesReportItems.length);
        console.log('Total materials in map:', materialMap.size);
        console.log('Unique materials:', uniqueMaterials.length);

        // Sample a few sales items to check date parsing and FY
        if (salesReportItems.length > 0) {
            const sample = salesReportItems.slice(0, 3);
            console.log('Sample sales items:');
            sample.forEach(item => {
                const fy = getFY(item.date);
                const key = (item.particulars || '').trim().toLowerCase();
                const matched = materialMap.has(key);
                console.log({
                    date: item.date,
                    fy: fy,
                    particulars: item.particulars,
                    key: key.substring(0, 30),
                    matched: matched,
                    qty: item.quantity
                });
            });
        }

        let matchedCount = 0;
        salesReportItems.forEach(item => {
            const key = (item.particulars || '').trim().toLowerCase();
            const m = materialMap.get(key);
            if (m) {
                matchedCount++;
                const fy = getFY(item.date);
                if (m.fyData[fy]) {
                    m.fyData[fy].totalRawQty += (item.quantity || 0);
                }
                m.sales.push(item);
            }
        });

        console.log('Sales matched to materials:', matchedCount, 'out of', salesReportItems.length);
        console.log('=== END DEBUG ===');

        // Pass 2: Categorize sales into Regular or Project
        uniqueMaterials.forEach(m => {
            m.sales.forEach((item: any) => {
                const fy = getFY(item.date);
                const d = parseDate(item.date);
                const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;

                const isProjectKeyword = (item.particulars || '').toLowerCase().includes('project') || (item.customerName || '').toLowerCase().includes('project');
                const totalFyQty = m.fyData[fy]?.totalRawQty || 0;
                const isVolumeProject = totalFyQty > 0 && (item.quantity || 0) >= (totalFyQty * 0.35);
                const isProjectSale = isProjectKeyword || isVolumeProject;

                m.distinctCustomers.add(item.customerName);
                if (isProjectSale) m.hasProjectOrders = true;

                if (m.fyData[fy]) {
                    if (isProjectSale) {
                        m.fyData[fy].projectQty += (item.quantity || 0);
                    } else {
                        m.fyData[fy].qty += (item.quantity || 0);
                    }
                    m.fyData[fy].customers.add(item.customerName);
                    m.fyData[fy].months.add(monthKey);
                    if (!m.fyData[fy].monthlyCust.has(monthKey)) {
                        m.fyData[fy].monthlyCust.set(monthKey, new Set());
                    }
                    m.fyData[fy].monthlyCust.get(monthKey).add(item.customerName);
                }
            });
        });

        // 6. Final Calculations & Heuristics
        // Calculate total regular quantity for Pareto (Top 30%)
        let totalRegularQty = 0;
        uniqueMaterials.forEach(m => {
            totalRegularQty += (m.fyData[FY_CY].qty + m.fyData[FY_PY].qty);
        });

        const sortedByQty = [...uniqueMaterials]
            .map(m => ({ id: m.description, qty: m.fyData[FY_CY].qty + m.fyData[FY_PY].qty }))
            .sort((a, b) => b.qty - a.qty);

        let cumulativeQty = 0;
        const top30PercentIds = new Set<string>();
        for (const item of sortedByQty) {
            cumulativeQty += item.qty;
            top30PercentIds.add(item.id);
            if (cumulativeQty >= totalRegularQty * 0.3) break;
        }

        return uniqueMaterials.map(m => {
            // Movement Classification (Rolling 12 Months)
            const rollingMonths = new Set();
            m.sales.forEach((s: any) => {
                const sd = parseDate(s.date);
                if (sd >= twelveMonthsAgo) {
                    rollingMonths.add(`${sd.getFullYear()}-${sd.getMonth() + 1}`);
                }
            });

            const activeMonthsRolling = rollingMonths.size;
            const lastSaleDate = m.sales.length > 0 ? new Date(Math.max(...m.sales.map((s: any) => parseDate(s.date).getTime()))) : new Date(0);

            let movementClass = 'NON-MOVING';
            if (lastSaleDate >= twelveMonthsAgo) {
                const isVolumeLeader = top30PercentIds.has(m.description);
                if (activeMonthsRolling >= 9 || (activeMonthsRolling >= 6 && isVolumeLeader)) {
                    movementClass = 'FAST RUNNER';
                } else if (activeMonthsRolling >= 3) {
                    movementClass = 'SLOW RUNNER';
                }
            }

            // Stock Strategy
            const totalCustCount = m.distinctCustomers.size;
            let stockStrategy = 'MADE TO ORDER';
            if (totalCustCount > 10 || (totalCustCount >= 5 && movementClass === 'FAST RUNNER')) {
                stockStrategy = 'GENERAL STOCK';
            } else if (totalCustCount >= 5 || (totalCustCount >= 3 && movementClass === 'FAST RUNNER')) {
                stockStrategy = 'AGAINST ORDER';
            }

            const calculateAvgMonthlyCust = (fyKey: string) => {
                const fy = m.fyData[fyKey];
                if (fy.months.size === 0) return 0;
                let sum = 0;
                fy.monthlyCust.forEach((custSet: Set<string>) => { sum += custSet.size; });
                return sum / fy.months.size;
            };

            return {
                ...m,
                movementClass,
                stockStrategy,
                lastSaleDate,
                netQty: m.stock + m.po - m.so,
                metrics: {
                    [FY_CY]: {
                        activeMonths: m.fyData[FY_CY].months.size,
                        totalCust: m.fyData[FY_CY].customers.size,
                        avgCust: calculateAvgMonthlyCust(FY_CY),
                        totalQty: m.fyData[FY_CY].qty,
                        projectQty: m.fyData[FY_CY].projectQty,
                        avgQty: m.fyData[FY_CY].months.size > 0 ? m.fyData[FY_CY].qty / m.fyData[FY_CY].months.size : 0
                    },
                    [FY_PY]: {
                        activeMonths: m.fyData[FY_PY].months.size,
                        totalCust: m.fyData[FY_PY].customers.size,
                        avgCust: calculateAvgMonthlyCust(FY_PY),
                        totalQty: m.fyData[FY_PY].qty,
                        projectQty: m.fyData[FY_PY].projectQty,
                        avgQty: m.fyData[FY_PY].months.size > 0 ? m.fyData[FY_PY].qty / m.fyData[FY_PY].months.size : 0
                    }
                }
            };
        });
    }, [salesReportItems, materials, closingStock, pendingSO, pendingPO]);

    // Unique values for slicers
    const makes = useMemo(() => ['All', ...Array.from(new Set(analyticsData.map(d => d.make)))].sort(), [analyticsData]);
    const groups = useMemo(() => ['All', ...Array.from(new Set(analyticsData.map(d => d.group)))].sort(), [analyticsData]);
    const strategies = ['All', 'GENERAL STOCK', 'AGAINST ORDER', 'MADE TO ORDER'];
    const classes = ['All', 'FAST RUNNER', 'SLOW RUNNER', 'NON-MOVING'];

    // Filtered Data
    const filteredData = useMemo(() => {
        let data = [...analyticsData];
        if (selectedMake !== 'All') data = data.filter(d => d.make === selectedMake);
        if (selectedGroup !== 'All') data = data.filter(d => d.group === selectedGroup);
        if (selectedStrategy !== 'All') data = data.filter(d => d.stockStrategy === selectedStrategy);
        if (selectedClass !== 'All') data = data.filter(d => d.movementClass === selectedClass);
        if (deferredSearch) {
            const q = deferredSearch.toLowerCase();
            data = data.filter(d => d.description.toLowerCase().includes(q) || d.group.toLowerCase().includes(q) || d.make.toLowerCase().includes(q));
        }

        // Sorting
        if (sortConfig) {
            data.sort((a, b) => {
                let valA: any, valB: any;
                if (sortConfig.key.includes('.')) {
                    const keys = sortConfig.key.split('.');
                    valA = a;
                    valB = b;
                    keys.forEach(k => { valA = valA[k]; valB = valB[k]; });
                } else {
                    valA = (a as any)[sortConfig.key];
                    valB = (b as any)[sortConfig.key];
                }

                if (typeof valA === 'string') {
                    return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                }
                return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            });
        }

        return data;
    }, [analyticsData, selectedMake, selectedGroup, selectedStrategy, selectedClass, deferredSearch, sortConfig]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const renderSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
        return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-green-700" /> : <ArrowDown className="w-3 h-3 text-green-700" />;
    };

    const handleExport = () => {
        const exportData = filteredData.map(d => ({
            "Make": d.make,
            "Group": d.group,
            "Description": d.description,
            "Strategy": d.stockStrategy,
            "Class": d.movementClass,
            "Project Order": d.hasProjectOrders ? "YES" : "NO",
            [`Active Mos (${FY_CY})`]: d.metrics[FY_CY].activeMonths,
            [`Cust Count (${FY_CY})`]: d.metrics[FY_CY].totalCust,
            [`Avg Cust (${FY_CY})`]: d.metrics[FY_CY].avgCust.toFixed(2),
            [`Reg Qty Sold (${FY_CY})`]: d.metrics[FY_CY].totalQty,
            [`Proj Qty Sold (${FY_CY})`]: d.metrics[FY_CY].projectQty,
            [`Avg Qty (${FY_CY})`]: d.metrics[FY_CY].avgQty.toFixed(2)
        }));
        const ws = utils.json_to_sheet(exportData);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "SC Planning");
        writeFile(wb, "Siddhi_SC_Planning_Master.xlsx");
    };

    return (
        <div className="flex flex-col h-full bg-[#f3f4f6]">
            {/* Ribbon / Header */}
            <div className="bg-white border-b border-gray-300 p-3 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-700 p-2 rounded-lg text-white shadow-lg shadow-green-100">
                            <TableIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-gray-800 uppercase tracking-tighter">Supply Chain Master Sheet</h1>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Excel-Style Analytical Planning View</p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search Master Report..."
                            className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded text-xs font-bold focus:ring-1 focus:ring-green-600 outline-none transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <div className="relative">
                            <button
                                onClick={() => setShowColumnConfig(!showColumnConfig)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-md ${showColumnConfig ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-white text-gray-500 border border-gray-200 hover:text-indigo-600'}`}
                            >
                                <Settings2 className="w-3.5 h-3.5" /> Manage View
                            </button>
                            {showColumnConfig && (
                                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[100] p-4 flex flex-col gap-2">
                                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-100 pb-2 flex items-center gap-2">
                                        <Eye className="w-3.5 h-3.5" /> Toggle Sections
                                    </div>
                                    <button onClick={() => toggleCol('makeGroup')} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg text-[10px] font-bold uppercase transition-all">
                                        <span className={visibleColumns.makeGroup ? 'text-gray-900' : 'text-gray-400 line-through'}>Make / Group</span>
                                        {visibleColumns.makeGroup ? <Eye className="w-3 h-3 text-indigo-600" /> : <EyeOff className="w-3 h-3 text-gray-300" />}
                                    </button>
                                    <button onClick={() => toggleCol('strategyClass')} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg text-[10px] font-bold uppercase transition-all">
                                        <span className={visibleColumns.strategyClass ? 'text-gray-900' : 'text-gray-400 line-through'}>Strategy & Class</span>
                                        {visibleColumns.strategyClass ? <Eye className="w-3 h-3 text-indigo-600" /> : <EyeOff className="w-3 h-3 text-gray-300" />}
                                    </button>
                                    <button onClick={() => toggleCol('activeMonths')} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg text-[10px] font-bold uppercase transition-all">
                                        <span className={visibleColumns.activeMonths ? 'text-gray-900' : 'text-gray-400 line-through'}>Active Months</span>
                                        {visibleColumns.activeMonths ? <Eye className="w-3 h-3 text-indigo-600" /> : <EyeOff className="w-3 h-3 text-gray-300" />}
                                    </button>
                                    <button onClick={() => toggleCol('customerCount')} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg text-[10px] font-bold uppercase transition-all">
                                        <span className={visibleColumns.customerCount ? 'text-gray-900' : 'text-gray-400 line-through'}>Customer Count</span>
                                        {visibleColumns.customerCount ? <Eye className="w-3 h-3 text-indigo-600" /> : <EyeOff className="w-3 h-3 text-gray-300" />}
                                    </button>
                                    <button onClick={() => toggleCol('qtySold')} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg text-[10px] font-bold uppercase transition-all">
                                        <span className={visibleColumns.qtySold ? 'text-gray-900' : 'text-gray-400 line-through'}>Quantity Sold</span>
                                        {visibleColumns.qtySold ? <Eye className="w-3 h-3 text-indigo-600" /> : <EyeOff className="w-3 h-3 text-gray-300" />}
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-700 text-white rounded-xl text-[10px] font-black uppercase shadow-md hover:bg-green-800 transition-all"
                        >
                            <FileDown className="w-4 h-4" /> Export Excel
                        </button>
                    </div>
                </div>

                {/* Slicers Area */}
                <div className="flex flex-wrap gap-6 items-end bg-gray-50/50 p-3 rounded-lg border border-gray-200">
                    <Slicer label="Make" selected={selectedMake} options={makes} onSelect={setSelectedMake} />
                    <Slicer label="Material Group" selected={selectedGroup} options={groups} onSelect={setSelectedGroup} />
                    <Slicer label="Stock Strategy" selected={selectedStrategy} options={strategies} onSelect={setSelectedStrategy} />
                    <Slicer label="Classification" selected={selectedClass} options={classes} onSelect={setSelectedClass} />
                </div>
            </div>

            {/* Main Table Grid */}
            <div className="flex-1 overflow-auto bg-white custom-scrollbar">
                <table className="w-full text-left border-collapse table-auto min-w-max border-r border-b border-gray-300">
                    <thead className="sticky top-0 z-20 bg-[#f8f9fa]">
                        <tr className="text-[9px] font-black text-gray-500 uppercase">
                            <th rowSpan={3} className="border border-gray-300 px-3 py-2 bg-gray-100 w-10 text-center">#</th>
                            {visibleColumns.makeGroup && (
                                <>
                                    <th rowSpan={3} className="border border-gray-300 px-3 py-2 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('make')}>
                                        <div className="flex items-center gap-1">Make {renderSortIcon('make')}</div>
                                    </th>
                                    <th rowSpan={3} className="border border-gray-300 px-3 py-2 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('group')}>
                                        <div className="flex items-center gap-1">Group {renderSortIcon('group')}</div>
                                    </th>
                                </>
                            )}
                            <th rowSpan={3} className="border border-gray-300 px-3 py-2 cursor-pointer hover:bg-gray-200 min-w-[300px]" onClick={() => handleSort('description')}>
                                <div className="flex items-center gap-1">Material Description {renderSortIcon('description')}</div>
                            </th>
                            {visibleColumns.strategyClass && (
                                <>
                                    <th rowSpan={3} className="border border-gray-300 px-3 py-2 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('stockStrategy')}>
                                        <div className="flex items-center gap-1">Strategy Group {renderSortIcon('stockStrategy')}</div>
                                    </th>
                                    <th rowSpan={3} className="border border-gray-300 px-3 py-2 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('movementClass')}>
                                        <div className="flex items-center gap-1">Classification {renderSortIcon('movementClass')}</div>
                                    </th>
                                </>
                            )}
                            {visibleColumns.operational && (
                                <>
                                    <th rowSpan={3} className="border border-gray-300 px-3 py-1 bg-rose-50 text-rose-800 text-center cursor-pointer" onClick={() => handleSort('stock')}>Stock</th>
                                    <th rowSpan={3} className="border border-gray-300 px-3 py-1 bg-rose-50 text-rose-800 text-center cursor-pointer" onClick={() => handleSort('so')}>SO</th>
                                    <th rowSpan={3} className="border border-gray-300 px-3 py-1 bg-rose-50 text-rose-800 text-center cursor-pointer" onClick={() => handleSort('po')}>PO</th>
                                    <th rowSpan={3} className="border border-gray-300 px-3 py-1 bg-rose-50 text-rose-800 text-center cursor-pointer" onClick={() => handleSort('netQty')}>Net Qty</th>
                                </>
                            )}
                            {visibleColumns.activeMonths && <th colSpan={2} className="border border-gray-300 px-3 py-1 bg-blue-50 text-center text-blue-800">Active Months</th>}
                            {visibleColumns.customerCount && <th colSpan={4} className="border border-gray-300 px-3 py-1 bg-green-50 text-center text-green-800">Customer Count</th>}
                            {visibleColumns.qtySold && <th colSpan={6} className="border border-gray-300 px-3 py-1 bg-orange-50 text-center text-orange-800">Quantity Sold (Reg vs Proj)</th>}
                        </tr>
                        {/* Hierarchical Header Row 2 */}
                        <tr className="text-[9px] font-bold text-gray-600 uppercase">
                            {visibleColumns.activeMonths && (
                                <>
                                    <th className="border border-gray-300 px-2 py-1 bg-blue-50/50 text-center">{FY_CY}</th>
                                    <th className="border border-gray-300 px-2 py-1 bg-blue-50/50 text-center">{FY_PY}</th>
                                </>
                            )}
                            {visibleColumns.customerCount && (
                                <>
                                    <th colSpan={2} className="border border-gray-300 px-2 py-1 bg-green-50/50 text-center">{FY_CY}</th>
                                    <th colSpan={2} className="border border-gray-300 px-2 py-1 bg-green-50/50 text-center">{FY_PY}</th>
                                </>
                            )}
                            {visibleColumns.qtySold && (
                                <>
                                    <th colSpan={3} className="border border-gray-300 px-2 py-1 bg-orange-50/50 text-center">{FY_CY}</th>
                                    <th colSpan={3} className="border border-gray-300 px-2 py-1 bg-orange-50/50 text-center">{FY_PY}</th>
                                </>
                            )}
                        </tr>
                        {/* Hierarchical Header Row 3 */}
                        <tr className="text-[8px] font-black text-gray-400 uppercase text-center">
                            {visibleColumns.activeMonths && (
                                <>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer" onClick={() => handleSort(`metrics.${FY_CY}.activeMonths`)}>Months {renderSortIcon(`metrics.${FY_CY}.activeMonths`)}</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer" onClick={() => handleSort(`metrics.${FY_PY}.activeMonths`)}>Months {renderSortIcon(`metrics.${FY_PY}.activeMonths`)}</th>
                                </>
                            )}
                            {visibleColumns.customerCount && (
                                <>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-green-50/30" onClick={() => handleSort(`metrics.${FY_CY}.totalCust`)}>Total Count</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-green-50/30" onClick={() => handleSort(`metrics.${FY_CY}.avgCust`)}>Avg / Month</th>

                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-green-50/30" onClick={() => handleSort(`metrics.${FY_PY}.totalCust`)}>Total Count</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-green-50/30" onClick={() => handleSort(`metrics.${FY_PY}.avgCust`)}>Avg / Month</th>
                                </>
                            )}

                            {visibleColumns.qtySold && (
                                <>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-orange-50/30" onClick={() => handleSort(`metrics.${FY_CY}.totalQty`)}>Reg Qty</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-orange-50/30 text-purple-700" onClick={() => handleSort(`metrics.${FY_CY}.projectQty`)}>Proj Qty</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-orange-50/30" onClick={() => handleSort(`metrics.${FY_CY}.avgQty`)}>Avg / Mo</th>

                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-orange-50/30" onClick={() => handleSort(`metrics.${FY_PY}.totalQty`)}>Reg Qty</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-orange-50/30 text-purple-700" onClick={() => handleSort(`metrics.${FY_PY}.projectQty`)}>Proj Qty</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-orange-50/30" onClick={() => handleSort(`metrics.${FY_PY}.avgQty`)}>Avg / Mo</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="text-[10px]">
                        {filteredData.map((item, idx) => (
                            <tr key={idx} className="hover:bg-green-50/30 even:bg-gray-50/20 transition-colors group">
                                <td className="border border-gray-200 px-2 py-1 text-center text-gray-400 font-mono select-none">{idx + 1}</td>
                                {visibleColumns.makeGroup && (
                                    <>
                                        <td className="border border-gray-200 px-3 py-1 font-black text-gray-500 uppercase">{item.make}</td>
                                        <td className="border border-gray-200 px-3 py-1 font-bold text-blue-700 uppercase tracking-tighter">{item.group}</td>
                                    </>
                                )}
                                <td className="border border-gray-200 px-3 py-1 font-black text-gray-900 uppercase truncate max-w-[400px]" title={item.description}>{item.description}</td>
                                {visibleColumns.strategyClass && (
                                    <>
                                        <td className="border border-gray-200 px-3 py-1 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black ${item.stockStrategy === 'GENERAL STOCK' ? 'bg-blue-600 text-white' :
                                                item.stockStrategy === 'AGAINST ORDER' ? 'bg-purple-600 text-white' :
                                                    'bg-gray-400 text-white'
                                                }`}>
                                                {item.stockStrategy}
                                            </span>
                                        </td>
                                        <td className="border border-gray-200 px-3 py-1 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black ${item.movementClass === 'FAST RUNNER' ? 'bg-green-600 text-white' :
                                                item.movementClass === 'SLOW RUNNER' ? 'bg-amber-500 text-white' :
                                                    'bg-gray-300 text-gray-600'
                                                }`}>
                                                {item.movementClass}
                                            </span>
                                        </td>
                                    </>
                                )}

                                {visibleColumns.operational && (
                                    <>
                                        <td className="border border-gray-200 px-3 py-1 text-right font-black text-gray-900">{item.stock || 0}</td>
                                        <td className="border border-gray-200 px-3 py-1 text-right font-black text-rose-600">{item.so || 0}</td>
                                        <td className="border border-gray-200 px-3 py-1 text-right font-black text-blue-600">{item.po || 0}</td>
                                        <td className={`border border-gray-200 px-3 py-1 text-right font-black ${item.netQty < 0 ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>{item.netQty || 0}</td>
                                    </>
                                )}

                                {/* Active Months */}
                                {visibleColumns.activeMonths && (
                                    <>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50/10">{item.metrics[FY_CY].activeMonths}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50/10">{item.metrics[FY_PY].activeMonths}</td>
                                    </>
                                )}

                                {/* Customer Count */}
                                {visibleColumns.customerCount && (
                                    <>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-black text-green-700 bg-green-50/10">{item.metrics[FY_CY].totalCust}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-mono text-gray-500 bg-green-50/10">{item.metrics[FY_CY].avgCust.toFixed(1)}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-black text-green-700 bg-green-50/10">{item.metrics[FY_PY].totalCust}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-mono text-gray-500 bg-green-50/10">{item.metrics[FY_PY].avgCust.toFixed(1)}</td>
                                    </>
                                )}

                                {/* Qty Sold */}
                                {visibleColumns.qtySold && (
                                    <>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-black text-orange-700 bg-orange-50/10">{item.metrics[FY_CY].totalQty}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-black text-purple-700 bg-purple-50/20">{item.metrics[FY_CY].projectQty || 0}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-mono text-gray-500 bg-orange-50/10">{item.metrics[FY_CY].avgQty.toFixed(1)}</td>

                                        <td className="border border-gray-200 px-2 py-1 text-center font-black text-orange-700 bg-orange-50/10">{item.metrics[FY_PY].totalQty}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-black text-purple-700 bg-purple-50/20">{item.metrics[FY_PY].projectQty || 0}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-mono text-gray-500 bg-orange-50/10">{item.metrics[FY_PY].avgQty.toFixed(1)}</td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Excel Status Bar */}
            <div className="bg-green-700 text-white px-3 py-1 text-[9px] font-bold flex justify-between items-center select-none uppercase tracking-widest">
                <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span>MASTER DATA ANALYTICS READY</span>
                    </div>
                    <span className="text-green-500">|</span>
                    <span>VIEW: SUPPLY CHAIN PLANNING</span>
                    <span className="text-green-500">|</span>
                    <span>FILTERS APPLIED: {filteredData.length < analyticsData.length ? 'YES' : 'NO'}</span>
                </div>
                <div>MASTER PLANNING SHEET ▪ 100% SCALE</div>
            </div>
        </div>
    );
};

const Slicer = ({ label, selected, options, onSelect }: any) => (
    <div className="flex flex-col gap-1.5 min-w-[160px]">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-green-700" /> {label}
        </span>
        <select
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm transition-all text-gray-700 cursor-pointer"
        >
            {options.map((opt: string) => (
                <option key={opt} value={opt}>{opt}</option>
            ))}
        </select>
    </div>
);

const Grid = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M3 15h18" />
        <path d="M9 3v18" />
        <path d="M15 3v18" />
    </svg>
);

export default SupplyChainAnalyticsView;
