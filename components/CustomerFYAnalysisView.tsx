import React, { useState, useMemo } from 'react';
import { SalesReportItem, CustomerMasterItem } from '../types';
import {
    Users, TrendingUp, TrendingDown, UserPlus, UserCheck, UserMinus, RefreshCw,
    ArrowUp, ArrowDown, PieChart as PieIcon, DollarSign, Hash, Calendar,
    Filter, Search, ChevronDown, ChevronUp, ChevronRight, BarChart3, Download, Layers
} from 'lucide-react';
import { utils, writeFile } from 'xlsx';

interface CustomerFYAnalysisViewProps {
    salesReportItems: SalesReportItem[];
    customers: CustomerMasterItem[];
}

const getFiscalYear = (date: Date): string => {
    const month = date.getMonth();
    const year = date.getFullYear();
    if (month >= 3) return `${year}-${(year + 1).toString().slice(-2)}`;
    return `${year - 1}-${year.toString().slice(-2)}`;
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
    const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
    const [pivotBy, setPivotBy] = useState<'group' | 'customerGroup'>('group');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'fy202526_value', direction: 'desc' });

    const uniqueGroups = useMemo(() => {
        const groups = new Set<string>();
        customers.forEach(c => groups.add(c.group || 'Ungrouped'));
        return Array.from(groups).sort();
    }, [customers]);

    const lastSalesDate = useMemo(() => {
        let max = new Date(2025, 3, 1);
        if (salesReportItems.length === 0) return new Date();
        salesReportItems.forEach(sale => {
            const d = parseDate(sale.date);
            if (d && d > max) max = d;
        });
        return max;
    }, [salesReportItems]);

    const currentFY = getFiscalYear(lastSalesDate);

    const customerSalesByFY = useMemo(() => {
        const data: Record<string, any> = {};
        const customerMap = new Map(customers.map(c => [c.customerName, c]));
        const fy24Start = new Date(2024, 3, 1);
        const fy25Start = new Date(2025, 3, 1);
        const currentYTDEnd = lastSalesDate;
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
                    customerGroup: custInfo?.customerGroup || 'Unspecified',
                    fy202324: { qty: 0, value: 0 },
                    fy202425: { qty: 0, value: 0 },
                    fy202526: { qty: 0, value: 0 },
                    ytd202425: { qty: 0, value: 0 },
                    ytd202526: { qty: 0, value: 0 }
                };
            }
            const qty = parseFloat(String(sale.quantity || 0));
            const value = parseFloat(String(sale.value || 0));
            if (fy === '2023-24') { data[custName].fy202324.qty += qty; data[custName].fy202324.value += value; }
            else if (fy === '2024-25') { data[custName].fy202425.qty += qty; data[custName].fy202425.value += value; }
            else if (fy === '2025-26') { data[custName].fy202526.qty += qty; data[custName].fy202526.value += value; }
            if (invoiceDate >= fy24Start && invoiceDate <= prevYTDEnd) { data[custName].ytd202425.qty += qty; data[custName].ytd202425.value += value; }
            if (invoiceDate >= fy25Start && invoiceDate <= currentYTDEnd) { data[custName].ytd202526.qty += qty; data[custName].ytd202526.value += value; }
        });
        return Object.values(data);
    }, [salesReportItems, customers, lastSalesDate]);

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
                if ((has2324 && has2425 && has2526) || (has2425 && has2526)) repeat.add(cust.customerName);
                else if (!has2324 && !has2425 && has2526) newCust.add(cust.customerName);
                else if (has2324 && !has2425 && has2526) rebuild.add(cust.customerName);
            }
            if (has2324 && has2425 && !has2526) lost.add(cust.customerName);
        });
        return { total, repeat, newCust, rebuild, lost };
    }, [customerSalesByFY]);

    const kpis = useMemo(() => {
        const currentData = comparisonMode === 'full' ? customerSalesByFY.map(c => ({ name: c.customerName, ...c.fy202526 })) : customerSalesByFY.map(c => ({ name: c.customerName, ...c.ytd202526 }));
        const previousData = comparisonMode === 'full' ? customerSalesByFY.map(c => ({ name: c.customerName, ...c.fy202425 })) : customerSalesByFY.map(c => ({ name: c.customerName, ...c.ytd202425 }));
        const currentTotal = currentData.filter(c => c.value > 0).length;
        const previousTotal = previousData.filter(c => c.value > 0).length;
        const repeatCurrent = customerSalesByFY.filter(c => c.fy202425.value > 0 && (comparisonMode === 'full' ? c.fy202526.value > 0 : c.ytd202526.value > 0)).length;
        const repeatPrevious = customerSalesByFY.filter(c => c.fy202324.value > 0 && c.fy202425.value > 0).length;
        return {
            total: { current: currentTotal, previous: previousTotal, diff: currentTotal - previousTotal, pct: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0 },
            repeat: { current: repeatCurrent, previous: repeatPrevious, diff: repeatCurrent - repeatPrevious, pct: repeatPrevious > 0 ? ((repeatCurrent - repeatPrevious) / repeatPrevious) * 100 : 0 },
            new: { current: customerCategories.newCust.size, previous: 0, diff: 0, pct: 0 },
            rebuild: { current: customerCategories.rebuild.size, previous: 0, diff: 0, pct: 0 },
            lost: { current: customerCategories.lost.size, previous: 0, diff: 0, pct: 0 }
        };
    }, [customerSalesByFY, customerCategories, comparisonMode]);

    const filteredData = useMemo(() => {
        let filtered = customerSalesByFY.filter(c => (selectedGroup === 'ALL' || c.group === selectedGroup) && (c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || c.group.toLowerCase().includes(searchTerm.toLowerCase())));
        if (sortConfig) {
            filtered.sort((a, b) => {
                let aVal: any, bVal: any;
                if (sortConfig.key === 'customerName') { aVal = a.customerName; bVal = b.customerName; }
                else if (sortConfig.key === 'group') { aVal = a.group; bVal = b.group; }
                else if (sortConfig.key === 'customerGroup') { aVal = a.customerGroup; bVal = b.customerGroup; }
                else if (sortConfig.key.includes('qty') || sortConfig.key.includes('value')) { const [fy, metric] = sortConfig.key.split('_'); aVal = (a as any)[fy][metric]; bVal = (b as any)[fy][metric]; }
                else if (sortConfig.key === 'trend') { aVal = a.fy202425.value > 0 ? ((a.fy202526.value - a.fy202425.value) / a.fy202425.value) * 100 : (a.fy202526.value > 0 ? 100 : 0); bVal = b.fy202425.value > 0 ? ((b.fy202526.value - b.fy202425.value) / b.fy202425.value) * 100 : (b.fy202526.value > 0 ? 100 : 0); }
                else if (sortConfig.key === 'contribution') { aVal = a.fy202526.value; bVal = a.fy202526.value; }
                if (typeof aVal === 'string') return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            });
        }
        return filtered;
    }, [customerSalesByFY, searchTerm, sortConfig, selectedGroup]);

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [expandedSubGroups, setExpandedSubGroups] = useState<Record<string, boolean>>({});
    const toggleGroup = (g: string) => setExpandedGroups(prev => ({ ...prev, [g]: !prev[g] }));
    const toggleSubGroup = (key: string) => setExpandedSubGroups(prev => ({ ...prev, [key]: !prev[key] }));

    const groupedData = useMemo(() => {
        const groups: Record<string, Record<string, any[]>> = {};
        filteredData.forEach(cust => {
            let primary = pivotBy === 'group' ? (cust.group || 'Ungrouped') : (cust.customerGroup || 'Unspecified');
            let secondary = pivotBy === 'group' ? (cust.customerGroup || 'Unspecified') : (cust.group || 'Ungrouped');
            if (!groups[primary]) groups[primary] = {};
            if (!groups[primary][secondary]) groups[primary][secondary] = [];
            groups[primary][secondary].push(cust);
        });
        return groups;
    }, [filteredData, pivotBy]);

    const calculateTotals = (items: any[]) => items.reduce((acc, curr) => ({
        fy2324_qty: acc.fy2324_qty + curr.fy202324.qty,
        fy2324_val: acc.fy2324_val + curr.fy202324.value,
        fy2425_qty: acc.fy2425_qty + (comparisonMode === 'full' ? curr.fy202425.qty : curr.ytd202425.qty),
        fy2425_val: acc.fy2425_val + (comparisonMode === 'full' ? curr.fy202425.value : curr.ytd202425.value),
        fy2526_qty: acc.fy2526_qty + (comparisonMode === 'full' ? curr.fy202526.qty : curr.ytd202526.qty),
        fy2526_val: acc.fy2526_val + (comparisonMode === 'full' ? curr.fy202526.value : curr.ytd202526.value),
    }), { fy2324_qty: 0, fy2324_val: 0, fy2425_qty: 0, fy2425_val: 0, fy2526_qty: 0, fy2526_val: 0 });

    const handleSort = (key: string) => setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

    const handleExportToExcel = () => {
        const totalFY2526 = filteredData.reduce((acc, c) => acc + c.fy202526.value, 0);
        const dataToExport = filteredData.map(c => ({ 'Group': c.group, 'Customer Group': c.customerGroup, 'Customer Name': c.customerName, 'FY 23-24 Qty': c.fy202324.qty, 'Value 23-24': c.fy202324.value, 'FY 24-25 Qty': c.fy202425.qty, 'Value 24-25': c.fy202425.value, 'FY 25-26 Qty': c.fy202526.qty, 'Value 25-26': c.fy202526.value }));
        const ws = utils.json_to_sheet(dataToExport);
        const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Customer Analysis");
        writeFile(wb, `Customer_FY_Analysis_FY${currentFY}.xlsx`);
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            <div className="max-w-[1800px] mx-auto p-6 space-y-6">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Customer Sales – FY Analysis</h1>
                            <p className="text-sm text-gray-500 font-medium mt-1">Comprehensive customer performance tracking across fiscal years</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                                <Calendar className="w-4 h-4 text-blue-600" /><span className="text-xs font-bold text-blue-900">FY {currentFY}</span>
                            </div>
                            <button onClick={handleExportToExcel} className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl border border-green-100 hover:bg-green-100 transition-colors">
                                <Download className="w-4 h-4 text-green-600" /><span className="text-xs font-bold text-green-700">Export Excel</span>
                            </button>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-500" /><span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">Pivot Hierarchy:</span></div>
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                                <button onClick={() => { setPivotBy('group'); setExpandedGroups({}); setExpandedSubGroups({}); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${pivotBy === 'group' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>Group View</button>
                                <button onClick={() => { setPivotBy('customerGroup'); setExpandedGroups({}); setExpandedSubGroups({}); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${pivotBy === 'customerGroup' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>Customer Group View</button>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                                <button onClick={() => setViewMode('count')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'count' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}><Hash className="w-3.5 h-3.5 inline mr-1" /> Count</button>
                                <button onClick={() => setViewMode('value')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'value' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}><DollarSign className="w-3.5 h-3.5 inline mr-1" /> Value</button>
                            </div>
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                                <button onClick={() => setComparisonMode('ytd')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${comparisonMode === 'ytd' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>YTD</button>
                                <button onClick={() => setComparisonMode('full')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${comparisonMode === 'full' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>Full FY</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {[
                        { label: 'Total Customers', icon: Users, data: kpis.total, color: 'blue' },
                        { label: 'Repeat Customers', icon: UserCheck, data: kpis.repeat, color: 'green' },
                        { label: 'New Customers', icon: UserPlus, data: kpis.new, color: 'purple' },
                        { label: 'Rebuild Customers', icon: RefreshCw, data: kpis.rebuild, color: 'orange' },
                        { label: 'Lost Customers', icon: UserMinus, data: kpis.lost, color: 'red' }
                    ].map((kpi, idx) => (
                        <div key={idx} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow`}>
                            <div className="flex items-center justify-between mb-3"><kpi.icon className={`w-5 h-5 text-gray-600`} /><div className={`text-xs font-bold px-2 py-1 rounded-lg bg-gray-50 text-gray-700`}>FY 25-26</div></div>
                            <div className="text-3xl font-black text-gray-900 mb-2">{kpi.data.current.toLocaleString('en-IN')}</div>
                            <div className="text-xs font-bold text-gray-400 uppercase mb-3">{kpi.label}</div>
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex justify-between items-center">
                    <div className="relative flex-1 max-w-xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search by customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm" /></div>
                    <div className="flex gap-4 items-center">
                        <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold"><option value="ALL">All Groups</option>{uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}</select>
                        <button onClick={() => { setExpandedGroups({}); setExpandedSubGroups({}); }} className="px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200 rounded-lg">Collapse All</button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col min-h-0 relative">
                    <div className="overflow-auto h-full w-full">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-50 bg-gray-50 shadow-sm text-[9px] font-bold text-gray-600 uppercase tracking-tight">
                                <tr className="bg-gray-100 border-b border-gray-200">
                                    <th className="sticky left-0 z-50 py-1 px-4 text-left border-r border-gray-300 bg-gray-100 w-[300px]"><div className="flex items-center gap-2"><Layers className="w-3 h-3 text-gray-400" />{pivotBy === 'group' ? 'Group / Customer Group / Customer' : 'Customer Group / Group / Customer'}</div></th>
                                    <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-blue-50/50">FY 23-24 (Full)</th>
                                    <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-indigo-50/50">FY 24-25 {comparisonMode === 'ytd' ? '(YTD)' : '(Full)'}</th>
                                    <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-purple-50/50">FY 25-26 {comparisonMode === 'ytd' ? '(YTD)' : '(Full)'}</th>
                                    <th className="py-1 px-2 text-center bg-gray-200">Growth vs LY</th>
                                    <th className="py-1 px-2 text-center bg-yellow-50/50 text-yellow-800">Share %</th>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <th onClick={() => handleSort('group')} className="sticky left-0 z-50 py-2 px-4 border-r whitespace-nowrap bg-gray-50 cursor-pointer">Hierarchy</th>
                                    <th className="py-2 px-2 text-right bg-blue-50/30">Qty</th><th className="py-2 px-2 text-right border-r bg-blue-50/30">Value</th>
                                    <th className="py-2 px-2 text-right bg-indigo-50/30">Qty</th><th className="py-2 px-2 text-right border-r bg-indigo-50/30">Value</th>
                                    <th className="py-2 px-2 text-right bg-purple-50/30">Qty</th><th className="py-2 px-2 text-right border-r bg-purple-50/30">Value</th>
                                    <th className="py-2 px-2 text-center bg-gray-100">Growth %</th>
                                    <th className="py-2 px-2 text-center bg-yellow-50/30">Share %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-[10px] text-gray-700">
                                {(() => {
                                    const totalFY2526 = comparisonMode === 'full' ?
                                        filteredData.reduce((acc, c) => acc + c.fy202526.value, 0) :
                                        filteredData.reduce((acc, c) => acc + c.ytd202526.value, 0);
                                    return Object.entries(groupedData).map(([groupName, subGroups]) => {
                                        const groupItems = Object.values(subGroups).flat(), gTotal = calculateTotals(groupItems), isExpanded = expandedGroups[groupName], gGrowth = gTotal.fy2425_val > 0 ? ((gTotal.fy2526_val - gTotal.fy2425_val) / gTotal.fy2425_val) * 100 : 0;
                                        return (
                                            <React.Fragment key={groupName}>
                                                <tr className="bg-gray-100/80 hover:bg-gray-200 transition-colors border-b border-gray-200 cursor-pointer" onClick={() => toggleGroup(groupName)}>
                                                    <td className="sticky left-0 z-20 py-2 px-4 border-r font-black text-gray-800 flex items-center gap-2 bg-gray-100/80">{isExpanded ? <ChevronDown className="w-3 h-3 text-blue-600" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}{groupName}</td>
                                                    <td className="py-2 px-2 text-right font-bold">{Math.round(gTotal.fy2324_qty).toLocaleString('en-IN')}</td><td className="py-2 px-2 text-right border-r font-bold">{Math.round(gTotal.fy2324_val).toLocaleString('en-IN')}</td>
                                                    <td className="py-2 px-2 text-right font-bold">{Math.round(gTotal.fy2425_qty).toLocaleString('en-IN')}</td><td className="py-2 px-2 text-right border-r font-bold">{Math.round(gTotal.fy2425_val).toLocaleString('en-IN')}</td>
                                                    <td className="py-2 px-2 text-right font-black">{Math.round(gTotal.fy2526_qty).toLocaleString('en-IN')}</td><td className="py-2 px-2 text-right border-r font-black">{Math.round(gTotal.fy2526_val).toLocaleString('en-IN')}</td>
                                                    <td className="py-2 px-2 text-center font-bold">
                                                        <div className={`flex items-center justify-center gap-1 ${gGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {gGrowth >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                            {Math.round(Math.abs(gGrowth))}%
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2 text-center font-bold bg-yellow-50/50 text-yellow-800">{totalFY2526 > 0 ? ((gTotal.fy2526_val / totalFY2526) * 100).toFixed(1) : 0}%</td>
                                                </tr>
                                                {isExpanded && Object.entries(subGroups).map(([subGroupName, customers]) => {
                                                    const subKey = `${groupName}-${subGroupName}`, sgTotal = calculateTotals(customers), isSgExpanded = expandedSubGroups[subKey], sgGrowth = sgTotal.fy2425_val > 0 ? ((sgTotal.fy2526_val - sgTotal.fy2425_val) / sgTotal.fy2425_val) * 100 : 0;
                                                    return (
                                                        <React.Fragment key={subKey}>
                                                            <tr className="bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => toggleSubGroup(subKey)}>
                                                                <td className="sticky left-0 z-10 py-1.5 px-4 pl-8 border-r font-bold text-gray-700 bg-gray-50 flex items-center gap-2">{isSgExpanded ? <ChevronDown className="w-3 h-3 text-indigo-500" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}{subGroupName}</td>
                                                                <td className="py-1.5 px-2 text-right text-gray-500">{Math.round(sgTotal.fy2324_qty).toLocaleString('en-IN')}</td><td className="py-1.5 px-2 text-right border-r text-gray-500">{Math.round(sgTotal.fy2324_val).toLocaleString('en-IN')}</td>
                                                                <td className="py-1.5 px-2 text-right text-indigo-600">{Math.round(sgTotal.fy2425_qty).toLocaleString('en-IN')}</td><td className="py-1.5 px-2 text-right border-r text-indigo-600">{Math.round(sgTotal.fy2425_val).toLocaleString('en-IN')}</td>
                                                                <td className="py-1.5 px-2 text-right text-purple-700 font-bold">{Math.round(sgTotal.fy2526_qty).toLocaleString('en-IN')}</td><td className="py-1.5 px-2 text-right border-r text-purple-700 font-bold">{Math.round(sgTotal.fy2526_val).toLocaleString('en-IN')}</td>
                                                                <td className="py-1.5 px-2 text-center font-bold">
                                                                    <div className={`flex items-center justify-center gap-1 ${sgGrowth >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                                        {sgGrowth >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                                                        {Math.round(Math.abs(sgGrowth))}%
                                                                    </div>
                                                                </td>
                                                                <td className="py-1.5 px-2 text-center text-yellow-700 font-medium">{totalFY2526 > 0 ? ((sgTotal.fy2526_val / totalFY2526) * 100).toFixed(1) : 0}%</td>
                                                            </tr>
                                                            {isSgExpanded && customers.map(cust => {
                                                                const valCurr = comparisonMode === 'full' ? cust.fy202526.value : cust.ytd202526.value;
                                                                const valPrev = comparisonMode === 'full' ? cust.fy202425.value : cust.ytd202425.value;
                                                                const qtyCurr = comparisonMode === 'full' ? cust.fy202526.qty : cust.ytd202526.qty;
                                                                const qtyPrev = comparisonMode === 'full' ? cust.fy202425.qty : cust.ytd202425.qty;
                                                                const growth = valPrev > 0 ? ((valCurr - valPrev) / valPrev) * 100 : 0;
                                                                const totalSalesForContrib = comparisonMode === 'full' ?
                                                                    customerSalesByFY.reduce((acc, c) => acc + c.fy202526.value, 0) :
                                                                    customerSalesByFY.reduce((acc, c) => acc + c.ytd202526.value, 0);

                                                                return (
                                                                    <tr key={cust.customerName} className="hover:bg-blue-50/20 border-b border-gray-50">
                                                                        <td className="sticky left-0 z-10 py-1 px-4 pl-12 border-r truncate text-gray-600 bg-white">{cust.customerName}</td>
                                                                        <td className="py-1 px-2 text-right text-gray-400">{Math.round(cust.fy202324.qty).toLocaleString('en-IN')}</td><td className="py-1 px-2 text-right border-r text-gray-400">{Math.round(cust.fy202324.value).toLocaleString('en-IN')}</td>
                                                                        <td className="py-1 px-2 text-right text-indigo-600/70">{Math.round(qtyPrev).toLocaleString('en-IN')}</td><td className="py-1 px-2 text-right border-r text-indigo-600/70">{Math.round(valPrev).toLocaleString('en-IN')}</td>
                                                                        <td className="py-1 px-2 text-right text-purple-700 font-bold">{Math.round(qtyCurr).toLocaleString('en-IN')}</td><td className="py-1 px-2 text-right border-r text-purple-700 font-black">{Math.round(valCurr).toLocaleString('en-IN')}</td>
                                                                        <td className="py-1 px-2 text-center font-medium">
                                                                            <div className={`flex items-center justify-center gap-1 ${growth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                                {growth >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                                                                                {Math.round(Math.abs(growth))}%
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-1 px-2 text-center text-gray-500">{totalSalesForContrib > 0 ? ((valCurr / totalSalesForContrib) * 100).toFixed(1) : 0}%</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </React.Fragment>
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
