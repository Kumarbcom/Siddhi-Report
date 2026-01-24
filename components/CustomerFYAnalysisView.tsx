import React, { useState, useMemo } from 'react';
import { SalesReportItem, CustomerMasterItem } from '../types';
import {
    Users, TrendingUp, TrendingDown, UserPlus, UserCheck, UserMinus, RefreshCw,
    ArrowUp, ArrowDown, PieChart as PieIcon, DollarSign, Hash, Calendar,
    Filter, Search, ChevronDown, ChevronUp, BarChart3
} from 'lucide-react';

interface CustomerFYAnalysisViewProps {
    salesReportItems: SalesReportItem[];
    customers: CustomerMasterItem[];
}

// Fiscal Year Helper Functions
const getFiscalYear = (date: Date): string => {
    const month = date.getMonth(); // 0-indexed
    const year = date.getFullYear();
    if (month >= 3) { // April (3) to December (11)
        return `${year}-${(year + 1).toString().slice(-2)}`;
    } else { // January (0) to March (2)
        return `${year - 1}-${year.toString().slice(-2)}`;
    }
};

const parseDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + val * 86400000);
    }
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const CustomerFYAnalysisView: React.FC<CustomerFYAnalysisViewProps> = ({
    salesReportItems,
    customers
}) => {
    const [viewMode, setViewMode] = useState<'count' | 'value'>('value');
    const [comparisonMode, setComparisonMode] = useState<'ytd' | 'full'>('full');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Calculate max date from sales data to determine YTD cutoff
    const lastSalesDate = useMemo(() => {
        let max = new Date(2025, 3, 1); // Default to start of FY 25-26
        if (salesReportItems.length === 0) return new Date();

        salesReportItems.forEach(sale => {
            const d = parseDate(sale.date);
            if (d && d > max) max = d;
        });
        return max;
    }, [salesReportItems]);

    const currentFY = getFiscalYear(lastSalesDate);

    // Customer sales data by FY
    const customerSalesByFY = useMemo(() => {
        const data: Record<string, {
            customerName: string;
            group: string;
            fy202324: { qty: number; value: number };
            fy202425: { qty: number; value: number };
            fy202526: { qty: number; value: number };
            ytd202425: { qty: number; value: number };
            ytd202526: { qty: number; value: number };
        }> = {};

        // Get customer info from master
        const customerMap = new Map(customers.map(c => [c.customerName, c]));

        // Pre-calculate date boundaries to avoid re-creation in loop
        const fy24Start = new Date(2024, 3, 1); // Apr 1, 2024
        const fy25Start = new Date(2025, 3, 1); // Apr 1, 2025

        const currentYTDEnd = lastSalesDate;
        // Previous YTD End is exactly 1 year before current YTD End
        const prevYTDEnd = new Date(lastSalesDate.getFullYear() - 1, lastSalesDate.getMonth(), lastSalesDate.getDate());

        salesReportItems.forEach(sale => {
            const invoiceDate = parseDate(sale.date);
            if (!invoiceDate) return;

            const fy = getFiscalYear(invoiceDate);
            const custName = sale.customerName || 'Unknown Customer';
            const custInfo = customerMap.get(custName);

            if (!data[custName]) {
                data[custName] = {
                    customerName: custName,
                    group: custInfo?.group || 'Ungrouped',
                    fy202324: { qty: 0, value: 0 },
                    fy202425: { qty: 0, value: 0 },
                    fy202526: { qty: 0, value: 0 },
                    ytd202425: { qty: 0, value: 0 },
                    ytd202526: { qty: 0, value: 0 }
                };
            }

            const qty = parseFloat(String(sale.quantity || 0));
            const value = parseFloat(String(sale.value || 0));

            // Full FY data accumulation (Fixed FY Buckets)
            if (fy === '2023-24') {
                data[custName].fy202324.qty += qty;
                data[custName].fy202324.value += value;
            } else if (fy === '2024-25') {
                data[custName].fy202425.qty += qty;
                data[custName].fy202425.value += value;
            } else if (fy === '2025-26') {
                data[custName].fy202526.qty += qty;
                data[custName].fy202526.value += value;
            }

            // YTD Logic: 
            // YTD 24-25: Apr 1, 2024 to (LastSalesDate - 1 Year)
            if (invoiceDate >= fy24Start && invoiceDate <= prevYTDEnd) {
                data[custName].ytd202425.qty += qty;
                data[custName].ytd202425.value += value;
            }

            // YTD 25-26: Apr 1, 2025 to LastSalesDate
            if (invoiceDate >= fy25Start && invoiceDate <= currentYTDEnd) {
                data[custName].ytd202526.qty += qty;
                data[custName].ytd202526.value += value;
            }
        });

        return Object.values(data);
    }, [salesReportItems, customers]);

    // Customer categorization
    const customerCategories = useMemo(() => {
        const total = new Set<string>();
        const repeat = new Set<string>();
        const newCust = new Set<string>();
        const rebuild = new Set<string>();
        const lost = new Set<string>();

        customerSalesByFY.forEach(cust => {
            const has2324 = cust.fy202324.value > 0;
            const has2425 = cust.fy202425.value > 0;
            const has2526 = cust.fy202526.value > 0;

            if (has2526) {
                total.add(cust.customerName);

                // Repeat: purchased in all 3 years OR in 2425 and 2526
                if ((has2324 && has2425 && has2526) || (has2425 && has2526)) {
                    repeat.add(cust.customerName);
                }
                // New: only in 2526
                else if (!has2324 && !has2425 && has2526) {
                    newCust.add(cust.customerName);
                }
                // Rebuild: in 2324, not in 2425, back in 2526
                else if (has2324 && !has2425 && has2526) {
                    rebuild.add(cust.customerName);
                }
            }

            // Lost: in 2324 and 2425, but not in 2526
            if (has2324 && has2425 && !has2526) {
                lost.add(cust.customerName);
            }
        });

        return { total, repeat, newCust, rebuild, lost };
    }, [customerSalesByFY]);

    // KPI Calculations
    const kpis = useMemo(() => {
        const currentData = comparisonMode === 'full'
            ? customerSalesByFY.map(c => ({ name: c.customerName, ...c.fy202526 }))
            : customerSalesByFY.map(c => ({ name: c.customerName, ...c.ytd202526 }));

        const previousData = comparisonMode === 'full'
            ? customerSalesByFY.map(c => ({ name: c.customerName, ...c.fy202425 }))
            : customerSalesByFY.map(c => ({ name: c.customerName, ...c.ytd202425 }));

        const currentTotal = currentData.filter(c => c.value > 0).length;
        const previousTotal = previousData.filter(c => c.value > 0).length;

        const repeatCurrent = Array.from(customerCategories.repeat).filter(name =>
            currentData.find(c => c.name === name && c.value > 0)
        ).length;
        const repeatPrevious = Array.from(customerCategories.repeat).filter(name =>
            previousData.find(c => c.name === name && c.value > 0)
        ).length;

        const newCurrent = customerCategories.newCust.size;
        const newPrevious = customerSalesByFY.filter(c =>
            !c.fy202324.value && !c.fy202425.value && c.fy202425.value > 0
        ).length;

        const rebuildCurrent = customerCategories.rebuild.size;
        const rebuildPrevious = customerSalesByFY.filter(c =>
            c.fy202324.value > 0 && !c.fy202425.value && c.fy202425.value > 0
        ).length;

        const lostCurrent = customerCategories.lost.size;

        return {
            total: { current: currentTotal, previous: previousTotal, diff: currentTotal - previousTotal, pct: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0 },
            repeat: { current: repeatCurrent, previous: repeatPrevious, diff: repeatCurrent - repeatPrevious, pct: repeatPrevious > 0 ? ((repeatCurrent - repeatPrevious) / repeatPrevious) * 100 : 0 },
            new: { current: newCurrent, previous: newPrevious, diff: newCurrent - newPrevious, pct: newPrevious > 0 ? ((newCurrent - newPrevious) / newPrevious) * 100 : 0 },
            rebuild: { current: rebuildCurrent, previous: rebuildPrevious, diff: rebuildCurrent - rebuildPrevious, pct: rebuildPrevious > 0 ? ((rebuildCurrent - rebuildPrevious) / rebuildPrevious) * 100 : 0 },
            lost: { current: lostCurrent, previous: 0, diff: 0, pct: 0 }
        };
    }, [customerSalesByFY, customerCategories, comparisonMode]);

    // Filtered and sorted data
    const filteredData = useMemo(() => {
        let filtered = customerSalesByFY.filter(c =>
            c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.group.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (sortConfig) {
            filtered.sort((a, b) => {
                let aVal: any, bVal: any;

                if (sortConfig.key === 'customerName') {
                    aVal = a.customerName;
                    bVal = b.customerName;
                } else if (sortConfig.key === 'group') {
                    aVal = a.group;
                    bVal = b.group;
                } else if (sortConfig.key.includes('qty') || sortConfig.key.includes('value')) {
                    const [fy, metric] = sortConfig.key.split('_');
                    aVal = (a as any)[fy][metric];
                    bVal = (b as any)[fy][metric];
                }

                if (typeof aVal === 'string') {
                    return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            });
        }

        return filtered;
    }, [customerSalesByFY, searchTerm, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            <div className="max-w-[1800px] mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Customer Sales – FY Analysis</h1>
                            <p className="text-sm text-gray-500 font-medium mt-1">Comprehensive customer performance tracking across fiscal years</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                <span className="text-xs font-bold text-blue-900">FY {currentFY}</span>
                            </div>
                        </div>
                    </div>

                    {/* Toggle Controls */}
                    <div className="mt-6 flex gap-4">
                        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                            <button
                                onClick={() => setViewMode('count')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'count' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}
                            >
                                <Hash className="w-4 h-4 inline mr-1" />
                                Customer Count
                            </button>
                            <button
                                onClick={() => setViewMode('value')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'value' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}
                            >
                                <DollarSign className="w-4 h-4 inline mr-1" />
                                Sales Value
                            </button>
                        </div>

                        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                            <button
                                onClick={() => setComparisonMode('ytd')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${comparisonMode === 'ytd' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}
                            >
                                YTD Comparison
                            </button>
                            <button
                                onClick={() => setComparisonMode('full')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${comparisonMode === 'full' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}
                            >
                                Full FY Comparison
                            </button>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {[
                        { label: 'Total Customers', icon: Users, data: kpis.total, color: 'blue' },
                        { label: 'Repeat Customers', icon: UserCheck, data: kpis.repeat, color: 'green' },
                        { label: 'New Customers', icon: UserPlus, data: kpis.new, color: 'purple' },
                        { label: 'Rebuild Customers', icon: RefreshCw, data: kpis.rebuild, color: 'orange' },
                        { label: 'Lost Customers', icon: UserMinus, data: kpis.lost, color: 'red' }
                    ].map((kpi, idx) => (
                        <div key={idx} className={`bg-white rounded-2xl shadow-sm border border-${kpi.color}-100 p-5 hover:shadow-md transition-shadow`}>
                            <div className="flex items-center justify-between mb-3">
                                <kpi.icon className={`w-5 h-5 text-${kpi.color}-600`} />
                                <div className={`text-xs font-bold px-2 py-1 rounded-lg bg-${kpi.color}-50 text-${kpi.color}-700`}>
                                    FY 25-26
                                </div>
                            </div>
                            <div className="text-3xl font-black text-gray-900 mb-2">{kpi.data.current.toLocaleString()}</div>
                            <div className="text-xs font-bold text-gray-400 uppercase mb-3">{kpi.label}</div>

                            {kpi.label !== 'Lost Customers' && (
                                <div className="space-y-2 pt-3 border-t border-gray-100">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-400 font-bold uppercase text-[9px]">Previous Period</span>
                                            <span className="font-bold text-gray-600">{kpi.data.previous.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-400 font-bold uppercase text-[9px]">Difference</span>
                                            <div className="flex items-center gap-1">
                                                {kpi.data.diff >= 0 ? <ArrowUp className="w-3 h-3 text-green-600" /> : <ArrowDown className="w-3 h-3 text-red-600" />}
                                                <span className={`font-bold ${kpi.data.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {Math.abs(kpi.data.diff)} ({Math.abs(kpi.data.pct).toFixed(1)}%)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Search Bar */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by customer name, code, or group..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Customer Performance Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0 relative">
                    <div className="overflow-auto h-full w-full">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-50 bg-gray-50 shadow-sm text-[9px] font-bold text-gray-600 uppercase tracking-tight select-none">
                                <tr className="bg-gray-100 border-b border-gray-200">
                                    <th colSpan={2} className="sticky left-0 z-50 py-1 px-2 text-center border-r border-gray-300 bg-gray-100">Customer Details</th>
                                    <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-blue-50/50">FY 2023-24</th>
                                    <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-indigo-50/50">FY 2024-25</th>
                                    <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-purple-50/50">FY 2025-26</th>
                                    <th className="py-1 px-2 text-center bg-gray-200">Trend</th>
                                </tr>
                                <tr className="border-b border-gray-200 cursor-pointer">
                                    <th onClick={() => handleSort('customerName')} className="sticky left-0 z-50 py-2 px-2 border-r whitespace-nowrap bg-gray-50 hover:bg-gray-200 group border-b border-gray-200 min-w-[200px]">
                                        <div className="flex items-center gap-1">Customer {sortConfig?.key === 'customerName' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />)}</div>
                                    </th>
                                    <th onClick={() => handleSort('group')} className="py-2 px-2 border-r whitespace-nowrap bg-gray-50 hover:bg-gray-200 group border-b border-gray-200 min-w-[120px]">
                                        <div className="flex items-center gap-1">Group {sortConfig?.key === 'group' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />)}</div>
                                    </th>

                                    <th onClick={() => handleSort('fy202324_qty')} className="py-2 px-2 text-right bg-blue-50/30 hover:bg-blue-100/50 group"><div className="flex items-center justify-end gap-1">Qty {sortConfig?.key === 'fy202324_qty' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />)}</div></th>
                                    <th onClick={() => handleSort('fy202324_value')} className="py-2 px-2 text-right border-r bg-blue-50/30 hover:bg-blue-100/50 group"><div className="flex items-center justify-end gap-1">Val {sortConfig?.key === 'fy202324_value' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />)}</div></th>

                                    <th onClick={() => handleSort('fy202425_qty')} className="py-2 px-2 text-right bg-indigo-50/30 hover:bg-indigo-100/50 group"><div className="flex items-center justify-end gap-1">Qty {sortConfig?.key === 'fy202425_qty' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />)}</div></th>
                                    <th onClick={() => handleSort('fy202425_value')} className="py-2 px-2 text-right border-r bg-indigo-50/30 hover:bg-indigo-100/50 group"><div className="flex items-center justify-end gap-1">Val {sortConfig?.key === 'fy202425_value' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />)}</div></th>

                                    <th onClick={() => handleSort('fy202526_qty')} className="py-2 px-2 text-right bg-purple-50/30 hover:bg-purple-100/50 group"><div className="flex items-center justify-end gap-1">Qty {sortConfig?.key === 'fy202526_qty' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />)}</div></th>
                                    <th onClick={() => handleSort('fy202526_value')} className="py-2 px-2 text-right border-r bg-purple-50/30 hover:bg-purple-100/50 group"><div className="flex items-center justify-end gap-1">Val {sortConfig?.key === 'fy202526_value' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />)}</div></th>

                                    <th className="py-2 px-2 text-center bg-gray-100 font-extrabold hover:bg-gray-200 group">vs PY</th>
                                    <th className="py-2 px-2 text-center bg-yellow-50/50 font-extrabold hover:bg-yellow-100/50 group" title="Contribution to FY 25-26 Sales">Share %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-[10px] text-gray-700">
                                {(() => {
                                    const totalFY2526 = filteredData.reduce((acc, c) => acc + c.fy202526.value, 0);

                                    return filteredData.slice(0, 150).map((cust, idx) => {
                                        const growth = cust.fy202425.value > 0
                                            ? ((cust.fy202526.value - cust.fy202425.value) / cust.fy202425.value) * 100
                                            : cust.fy202526.value > 0 ? 100 : 0;

                                        const share = totalFY2526 > 0 ? (cust.fy202526.value / totalFY2526) * 100 : 0;

                                        let nameColorClass = "text-gray-900";
                                        let badgeLink = null;

                                        if (customerCategories.repeat.has(cust.customerName)) {
                                            nameColorClass = "text-emerald-700 font-bold";
                                            badgeLink = <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider">Repeat</span>;
                                        } else if (customerCategories.newCust.has(cust.customerName)) {
                                            nameColorClass = "text-blue-700 font-bold";
                                            badgeLink = <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider">New</span>;
                                        } else if (customerCategories.rebuild.has(cust.customerName)) {
                                            nameColorClass = "text-orange-700 font-bold";
                                            badgeLink = <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] bg-orange-50 text-orange-700 border border-orange-100 uppercase tracking-wider">Rebuild</span>;
                                        } else if (customerCategories.lost.has(cust.customerName)) {
                                            nameColorClass = "text-red-700 font-bold";
                                            badgeLink = <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] bg-red-50 text-red-700 border border-red-100 uppercase tracking-wider">Lost</span>;
                                        }

                                        return (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors group text-[10px]">
                                                <td className="sticky left-0 z-10 py-1 px-2 border-r truncate max-w-[250px] font-medium bg-white group-hover:bg-gray-50 border-b border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" title={cust.customerName}>
                                                    <div className="flex items-center justify-between">
                                                        <span className={`truncate ${nameColorClass}`}>{cust.customerName}</span>
                                                        {badgeLink}
                                                    </div>
                                                </td>
                                                <td className="py-1 px-2 border-r truncate max-w-[150px] text-gray-500">{cust.group}</td>

                                                <td className="py-1 px-2 text-right bg-blue-50/10 font-medium">{Math.round(cust.fy202324.qty).toLocaleString()}</td>
                                                <td className="py-1 px-2 text-right border-r bg-blue-50/10 text-gray-500">{Math.round(cust.fy202324.value).toLocaleString()}</td>

                                                <td className="py-1 px-2 text-right bg-indigo-50/10 font-medium text-indigo-700">{Math.round(cust.fy202425.qty).toLocaleString()}</td>
                                                <td className="py-1 px-2 text-right border-r bg-indigo-50/10 text-indigo-600/70">{Math.round(cust.fy202425.value).toLocaleString()}</td>

                                                <td className="py-1 px-2 text-right bg-purple-50/10 font-bold text-purple-700">{Math.round(cust.fy202526.qty).toLocaleString()}</td>
                                                <td className="py-1 px-2 text-right border-r bg-purple-50/10 font-black text-purple-900">{Math.round(cust.fy202526.value).toLocaleString()}</td>

                                                <td className="py-1 px-2 text-center">
                                                    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold ${growth >= 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                                                        {growth >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                                        {Math.abs(growth).toFixed(0)}%
                                                    </div>
                                                </td>
                                                <td className="py-1 px-2 text-center bg-yellow-50/10 font-bold text-yellow-700 border-l border-gray-100">
                                                    {share > 0 ? share.toFixed(1) + '%' : '-'}
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerFYAnalysisView;
