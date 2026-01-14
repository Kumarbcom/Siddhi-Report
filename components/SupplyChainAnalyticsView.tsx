
import React, { useState, useMemo, useDeferredValue } from 'react';
import { SalesReportItem, Material, ClosingStockItem } from '../types';
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
}

const getFY = (dateInput: string | number | Date) => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Unknown';
    const year = d.getFullYear();
    const month = d.getMonth();
    // FY starts in April
    if (month >= 3) {
        return `20${year.toString().slice(-2)}-${(year + 1).toString().slice(-2)}`;
    } else {
        return `20${(year - 1).toString().slice(-2)}-${year.toString().slice(-2)}`;
    }
};

const SupplyChainAnalyticsView: React.FC<AnalyticsProps> = ({ salesReportItems, materials, closingStock }) => {
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
        activeMonths: true,
        customerCount: true,
        qtySold: true
    });

    const toggleCol = (key: keyof typeof visibleColumns) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Hardcode the FYs for the report
    const FY_2526 = "2025-26";
    const FY_2425 = "2024-25";

    const analyticsData = useMemo(() => {
        const materialMap = new Map<string, any>();

        // Map materials for Group and Make lookup
        const masterMap = new Map();
        materials.forEach(m => {
            const partNoKey = (m.partNo || '').trim().toLowerCase();
            if (partNoKey) {
                masterMap.set(partNoKey, {
                    group: m.materialGroup,
                    make: m.make,
                    description: m.description
                });
            }
        });

        // Current date and benchmarks
        const now = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(now.getMonth() - 12);

        // Process Sales
        salesReportItems.forEach(item => {
            const key = (item.particulars || '').trim();
            const lowerKey = key.toLowerCase();

            if (!materialMap.has(lowerKey)) {
                const masterInfo = masterMap.get(lowerKey);
                materialMap.set(lowerKey, {
                    description: key,
                    group: masterInfo?.group || 'UNCATEGORIZED',
                    make: masterInfo?.make || 'N/A',
                    sales: [],
                    distinctCustomers: new Set(),
                    fyData: {
                        [FY_2526]: { qty: 0, customers: new Set(), months: new Set() },
                        [FY_2425]: { qty: 0, customers: new Set(), months: new Set() }
                    }
                });
            }

            const mData = materialMap.get(lowerKey);
            const fy = getFY(item.date);
            const d = new Date(item.date);
            const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;

            mData.sales.push(item);
            mData.distinctCustomers.add(item.customerName);

            if (mData.fyData[fy]) {
                mData.fyData[fy].qty += (item.quantity || 0);
                mData.fyData[fy].customers.add(item.customerName);
                mData.fyData[fy].months.add(monthKey);
            }
        });

        // Finalize and Classify
        const results = Array.from(materialMap.values()).map(m => {
            // Movement Classification (based on Active Months in FY 25-26)
            const activeMonthsCurrent = m.fyData[FY_2526].months.size;
            const lastSaleDate = m.sales.length > 0 ? new Date(Math.max(...m.sales.map((s: any) => new Date(s.date).getTime()))) : new Date(0);

            let movementClass = 'NON-MOVING';
            if (lastSaleDate >= twelveMonthsAgo) {
                if (activeMonthsCurrent >= 9) movementClass = 'FAST RUNNER';
                else if (activeMonthsCurrent >= 3) movementClass = 'SLOW RUNNER';
            }

            // Stock Strategy (based on customer count)
            const totalCustCount = m.distinctCustomers.size;
            let stockStrategy = 'MADE TO ORDER';
            if (totalCustCount > 10) stockStrategy = 'GENERAL STOCK';
            else if (totalCustCount >= 5) stockStrategy = 'AGAINST ORDER';

            return {
                ...m,
                movementClass,
                stockStrategy,
                lastSaleDate,
                // Metrics per FY
                metrics: {
                    [FY_2526]: {
                        activeMonths: m.fyData[FY_2526].months.size,
                        totalCust: m.fyData[FY_2526].customers.size,
                        avgCust: m.fyData[FY_2526].months.size > 0 ? m.fyData[FY_2526].customers.size / 12 : 0,
                        totalQty: m.fyData[FY_2526].qty,
                        avgQty: m.fyData[FY_2526].months.size > 0 ? m.fyData[FY_2526].qty / 12 : 0
                    },
                    [FY_2425]: {
                        activeMonths: m.fyData[FY_2425].months.size,
                        totalCust: m.fyData[FY_2425].customers.size,
                        avgCust: m.fyData[FY_2425].months.size > 0 ? m.fyData[FY_2425].customers.size / 12 : 0,
                        totalQty: m.fyData[FY_2425].qty,
                        avgQty: m.fyData[FY_2425].months.size > 0 ? m.fyData[FY_2425].qty / 12 : 0
                    }
                }
            };
        });

        return results;
    }, [salesReportItems, materials]);

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
            "Active Mos (25-26)": d.metrics[FY_2526].activeMonths,
            "Cust Count (25-26)": d.metrics[FY_2526].totalCust,
            "Avg Cust (25-26)": d.metrics[FY_2526].avgCust.toFixed(2),
            "Qty Sold (25-26)": d.metrics[FY_2526].totalQty,
            "Avg Qty (25-26)": d.metrics[FY_2526].avgQty.toFixed(2)
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
                <div className="flex flex-wrap gap-4 items-start bg-gray-50/50 p-2 rounded-lg border border-gray-200">
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
                            {visibleColumns.activeMonths && <th colSpan={2} className="border border-gray-300 px-3 py-1 bg-blue-50 text-center text-blue-800">Active Months</th>}
                            {visibleColumns.customerCount && <th colSpan={4} className="border border-gray-300 px-3 py-1 bg-green-50 text-center text-green-800">Customer Count</th>}
                            {visibleColumns.qtySold && <th colSpan={4} className="border border-gray-300 px-3 py-1 bg-orange-50 text-center text-orange-800">Quantity Sold</th>}
                        </tr>
                        {/* Hierarchical Header Row 2 */}
                        <tr className="text-[9px] font-bold text-gray-600 uppercase">
                            {visibleColumns.activeMonths && (
                                <>
                                    <th className="border border-gray-300 px-2 py-1 bg-blue-50/50 text-center">{FY_2526}</th>
                                    <th className="border border-gray-300 px-2 py-1 bg-blue-50/50 text-center">{FY_2425}</th>
                                </>
                            )}
                            {visibleColumns.customerCount && (
                                <>
                                    <th colSpan={2} className="border border-gray-300 px-2 py-1 bg-green-50/50 text-center">{FY_2526}</th>
                                    <th colSpan={2} className="border border-gray-300 px-2 py-1 bg-green-50/50 text-center">{FY_2425}</th>
                                </>
                            )}
                            {visibleColumns.qtySold && (
                                <>
                                    <th colSpan={2} className="border border-gray-300 px-2 py-1 bg-orange-50/50 text-center">{FY_2526}</th>
                                    <th colSpan={2} className="border border-gray-300 px-2 py-1 bg-orange-50/50 text-center">{FY_2425}</th>
                                </>
                            )}
                        </tr>
                        {/* Hierarchical Header Row 3 */}
                        <tr className="text-[8px] font-black text-gray-400 uppercase text-center">
                            {visibleColumns.activeMonths && (
                                <>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer" onClick={() => handleSort(`metrics.${FY_2526}.activeMonths`)}>Months {renderSortIcon(`metrics.${FY_2526}.activeMonths`)}</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer" onClick={() => handleSort(`metrics.${FY_2425}.activeMonths`)}>Months {renderSortIcon(`metrics.${FY_2425}.activeMonths`)}</th>
                                </>
                            )}
                            {visibleColumns.customerCount && (
                                <>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-green-50/30" onClick={() => handleSort(`metrics.${FY_2526}.totalCust`)}>Total Count</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-green-50/30" onClick={() => handleSort(`metrics.${FY_2526}.avgCust`)}>Avg / Month</th>

                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-green-50/30" onClick={() => handleSort(`metrics.${FY_2425}.totalCust`)}>Total Count</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-green-50/30" onClick={() => handleSort(`metrics.${FY_2425}.avgCust`)}>Avg / Month</th>
                                </>
                            )}

                            {visibleColumns.qtySold && (
                                <>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-orange-50/30" onClick={() => handleSort(`metrics.${FY_2526}.totalQty`)}>Total Qty</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-orange-50/30" onClick={() => handleSort(`metrics.${FY_2526}.avgQty`)}>Avg / Month</th>

                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-orange-50/30" onClick={() => handleSort(`metrics.${FY_2425}.totalQty`)}>Total Qty</th>
                                    <th className="border border-gray-300 px-2 py-1 select-none cursor-pointer bg-orange-50/30" onClick={() => handleSort(`metrics.${FY_2425}.avgQty`)}>Avg / Month</th>
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

                                {/* Active Months */}
                                {visibleColumns.activeMonths && (
                                    <>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50/10">{item.metrics[FY_2526].activeMonths}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50/10">{item.metrics[FY_2425].activeMonths}</td>
                                    </>
                                )}

                                {/* Customer Count */}
                                {visibleColumns.customerCount && (
                                    <>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-black text-green-700 bg-green-50/10">{item.metrics[FY_2526].totalCust}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-mono text-gray-500 bg-green-50/10">{item.metrics[FY_2526].avgCust.toFixed(1)}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-black text-green-700 bg-green-50/10">{item.metrics[FY_2425].totalCust}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-mono text-gray-500 bg-green-50/10">{item.metrics[FY_2425].avgCust.toFixed(1)}</td>
                                    </>
                                )}

                                {/* Qty Sold */}
                                {visibleColumns.qtySold && (
                                    <>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-black text-orange-700 bg-orange-50/10">{item.metrics[FY_2526].totalQty}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-mono text-gray-500 bg-orange-50/10">{item.metrics[FY_2526].avgQty.toFixed(1)}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-black text-orange-700 bg-orange-50/10">{item.metrics[FY_2425].totalQty}</td>
                                        <td className="border border-gray-200 px-2 py-1 text-center font-mono text-gray-500 bg-orange-50/10">{item.metrics[FY_2425].avgQty.toFixed(1)}</td>
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
    <div className="flex flex-col gap-1 min-w-[150px]">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
            <Filter className="w-2.5 h-2.5" /> {label}
        </span>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar p-1 bg-white border border-gray-200 rounded">
            {options.slice(0, 20).map((opt: string) => (
                <button
                    key={opt}
                    onClick={() => onSelect(opt)}
                    className={`px-2 py-0.5 rounded-[4px] text-[8px] font-bold uppercase transition-all border ${selected === opt
                        ? 'bg-green-700 text-white border-green-800 shadow-sm'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-green-400 hover:text-green-700'
                        }`}
                >
                    {opt}
                </button>
            ))}
            {options.length > 20 && <span className="text-[7px] text-gray-300 font-bold ml-1">+{options.length - 20} more</span>}
        </div>
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
