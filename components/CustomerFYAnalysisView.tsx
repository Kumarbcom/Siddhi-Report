import React, { useState, useMemo } from 'react';
import { SalesReportItem, CustomerMasterItem } from '../types';
import {
    Users, TrendingUp, TrendingDown, UserPlus, UserCheck, UserMinus, RefreshCw,
    ArrowUp, ArrowDown, PieChart as PieIcon, DollarSign, Hash, Calendar,
    Filter, Search, ChevronDown, ChevronUp, ChevronRight, BarChart3, Download, Layers, Minus
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

// Normalizes group names — merges variants like "Online business - Giridhar" → "Online Business"
const getNormalizedGroup = (group: string | undefined): string => {
    if (!group) return 'Ungrouped';
    const g = group.trim();
    if (g.toLowerCase().startsWith('online business')) return 'Online Business';
    return g;
};

const fmt = (v: number) => Math.round(v).toLocaleString('en-IN');

const GrowthBadge = ({ curr, prev }: { curr: number; prev: number }) => {
    if (prev === 0 && curr === 0) return <span className="text-gray-400 font-bold text-[9px]">—</span>;
    if (prev === 0 && curr > 0) return <span className="inline-flex items-center gap-0.5 text-emerald-600 font-black text-[9px] bg-emerald-50 px-1.5 py-0.5 rounded">NEW</span>;
    if (prev > 0 && curr === 0) return <span className="inline-flex items-center gap-0.5 text-rose-600 font-black text-[9px] bg-rose-50 px-1.5 py-0.5 rounded">LOST</span>;
    const pct = ((curr - prev) / prev) * 100;
    const isPos = pct >= 0;
    return (
        <div className={`flex items-center justify-center gap-1 font-bold ${isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isPos ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
            {Math.abs(pct).toFixed(1)}%
        </div>
    );
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
        customers.forEach(c => groups.add(getNormalizedGroup(c.group)));
        return Array.from(groups).sort();
    }, [customers]);

    // Build a case-insensitive, trimmed customer lookup map
    const customerMap = useMemo(() => {
        const map = new Map<string, CustomerMasterItem>();
        customers.forEach(c => {
            const key = (c.customerName || '').trim().toLowerCase();
            if (key) map.set(key, c);
        });
        return map;
    }, [customers]);

    const lastSalesDate = useMemo(() => {
        let max = new Date(2025, 3, 1);
        if (salesReportItems.length === 0) return new Date();

        const dateCache = new Map<any, Date>();
        const getDateFast = (val: any) => {
            if (!val) return null;
            if (dateCache.has(val)) return dateCache.get(val)!;
            const res = parseDate(val);
            if (res) dateCache.set(val, res);
            return res;
        };

        salesReportItems.forEach(sale => {
            const d = getDateFast(sale.date);
            if (d && d > max) max = d;
        });
        return max;
    }, [salesReportItems]);

    const currentFY = getFiscalYear(lastSalesDate);

    const customerSalesByFY = useMemo(() => {
        const data: Record<string, any> = {};
        const fy24Start = new Date(2024, 3, 1);   // April 1, 2024
        const fy25Start = new Date(2025, 3, 1);   // April 1, 2025

        // YTD cutoff: same day last year for prior, this year for current
        const currentYTDEnd = lastSalesDate;
        const prevYTDEnd = new Date(lastSalesDate.getFullYear() - 1, lastSalesDate.getMonth(), lastSalesDate.getDate());

        const dateCache = new Map<any, Date>();
        const getDateFast = (val: any) => {
            if (!val) return null;
            if (dateCache.has(val)) return dateCache.get(val)!;
            const res = parseDate(val);
            if (res) dateCache.set(val, res);
            return res;
        };

        salesReportItems.forEach(sale => {
            const invoiceDate = getDateFast(sale.date);
            if (!invoiceDate) return;
            const fy = getFiscalYear(invoiceDate);

            // Case-insensitive + trimmed customer name matching
            const rawName = (sale.customerName || '').trim();
            const lookupKey = rawName.toLowerCase();
            const custInfo = customerMap.get(lookupKey);

            // Use the canonical name from master if found, else use the sales name
            const custName = custInfo ? custInfo.customerName : rawName || 'Unknown Customer';

            if (!data[custName]) {
                data[custName] = {
                    customerName: custName,
                    group: getNormalizedGroup(custInfo?.group),
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

            // YTD 24-25: Apr 1, 2024 → same date last year
            if (invoiceDate >= fy24Start && invoiceDate <= prevYTDEnd) {
                data[custName].ytd202425.qty += qty; data[custName].ytd202425.value += value;
            }
            // YTD 25-26: Apr 1, 2025 → lastSalesDate
            if (invoiceDate >= fy25Start && invoiceDate <= currentYTDEnd) {
                data[custName].ytd202526.qty += qty; data[custName].ytd202526.value += value;
            }
        });
        return Object.values(data);
    }, [salesReportItems, customerMap, lastSalesDate]);

    // Get value for current/previous periods respecting comparisonMode
    const getCurrVal = (c: any) => comparisonMode === 'full' ? c.fy202526.value : c.ytd202526.value;
    const getPrevVal = (c: any) => comparisonMode === 'full' ? c.fy202425.value : c.ytd202425.value;

    const customerCategories = useMemo(() => {
        const total = new Set<string>();
        const repeat = new Set<string>();
        const newCust = new Set<string>();
        const rebuild = new Set<string>();
        const lost = new Set<string>();

        customerSalesByFY.forEach(cust => {
            const has2324 = cust.fy202324.value > 0;
            const has2425 = cust.fy202425.value > 0;    // always full FY for category context
            const hasCurr = getCurrVal(cust) > 0;       // current period (mode-aware)
            const hasPrev = getPrevVal(cust) > 0;        // previous period (mode-aware)

            if (hasCurr) {
                total.add(cust.customerName);
                if (hasPrev) repeat.add(cust.customerName);                  // bought in both periods
                else if (!has2324 && !hasPrev) newCust.add(cust.customerName); // brand new
                else rebuild.add(cust.customerName);                          // was inactive prev period
            }
            // Lost: had prev period but not current
            if (hasPrev && !hasCurr) lost.add(cust.customerName);
        });

        return { total, repeat, newCust, rebuild, lost };
    }, [customerSalesByFY, comparisonMode]);

    const kpis = useMemo(() => {
        const prevTotal = customerSalesByFY.filter(c => getPrevVal(c) > 0).length;
        const currTotal = customerCategories.total.size;

        return {
            total: {
                current: currTotal, previous: prevTotal,
                diff: currTotal - prevTotal,
                pct: prevTotal > 0 ? ((currTotal - prevTotal) / prevTotal) * 100 : 0
            },
            repeat: {
                current: customerCategories.repeat.size, previous: prevTotal,
                diff: 0, pct: prevTotal > 0 ? (customerCategories.repeat.size / prevTotal) * 100 : 0,
                label: 'of prev period buyers returned'
            },
            new: { current: customerCategories.newCust.size, label: 'First time buyers this period' },
            rebuild: { current: customerCategories.rebuild.size, label: 'Re-engaged after gap' },
            lost: { current: customerCategories.lost.size, label: 'Active last period, silent now' }
        };
    }, [customerSalesByFY, customerCategories, comparisonMode]);

    const filteredData = useMemo(() => {
        let filtered = customerSalesByFY.filter(c =>
            (selectedGroup === 'ALL' || c.group === selectedGroup) &&
            (c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.group.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        if (sortConfig) {
            filtered.sort((a: any, b: any) => {
                let aVal: any, bVal: any;
                if (sortConfig.key === 'customerName') { aVal = a.customerName; bVal = b.customerName; }
                else if (sortConfig.key === 'group') { aVal = a.group; bVal = b.group; }
                else if (sortConfig.key === 'customerGroup') { aVal = a.customerGroup; bVal = b.customerGroup; }
                else if (sortConfig.key === 'trend') {
                    const aPrev = getPrevVal(a), aCurr = getCurrVal(a);
                    const bPrev = getPrevVal(b), bCurr = getCurrVal(b);
                    aVal = aPrev > 0 ? ((aCurr - aPrev) / aPrev) * 100 : (aCurr > 0 ? 999 : 0);
                    bVal = bPrev > 0 ? ((bCurr - bPrev) / bPrev) * 100 : (bCurr > 0 ? 999 : 0);
                } else if (sortConfig.key.includes('qty') || sortConfig.key.includes('value')) {
                    const [fy, metric] = sortConfig.key.split('_');
                    aVal = a[fy][metric]; bVal = b[fy][metric];
                }
                if (typeof aVal === 'string') return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                return sortConfig.direction === 'asc' ? (aVal ?? 0) - (bVal ?? 0) : (bVal ?? 0) - (aVal ?? 0);
            });
        }
        return filtered;
    }, [customerSalesByFY, searchTerm, sortConfig, selectedGroup, comparisonMode]);

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [expandedSubGroups, setExpandedSubGroups] = useState<Record<string, boolean>>({});
    const toggleGroup = (g: string) => setExpandedGroups(prev => ({ ...prev, [g]: !prev[g] }));
    const toggleSubGroup = (key: string) => setExpandedSubGroups(prev => ({ ...prev, [key]: !prev[key] }));

    const groupedData = useMemo(() => {
        const groups: Record<string, Record<string, any[]>> = {};
        filteredData.forEach(cust => {
            const primary = pivotBy === 'group' ? (cust.group || 'Ungrouped') : (cust.customerGroup || 'Unspecified');
            const secondary = pivotBy === 'group' ? (cust.customerGroup || 'Unspecified') : (cust.group || 'Ungrouped');
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
        count2425: acc.count2425 + ((comparisonMode === 'full' ? curr.fy202425.value : curr.ytd202425.value) > 0 ? 1 : 0),
        count2526: acc.count2526 + ((comparisonMode === 'full' ? curr.fy202526.value : curr.ytd202526.value) > 0 ? 1 : 0),
    }), { fy2324_qty: 0, fy2324_val: 0, fy2425_qty: 0, fy2425_val: 0, fy2526_qty: 0, fy2526_val: 0, count2425: 0, count2526: 0 });

    const handleSort = (key: string) => setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

    const handleExportToExcel = () => {
        const dataToExport = filteredData.map(c => ({
            'Group': c.group, 'Customer Group': c.customerGroup, 'Customer Name': c.customerName,
            'FY 23-24 Qty': c.fy202324.qty, 'Value 23-24': c.fy202324.value,
            'FY 24-25 Qty': c.fy202425.qty, 'Value 24-25': c.fy202425.value,
            'FY 25-26 Qty': c.fy202526.qty, 'Value 25-26': c.fy202526.value,
            'YTD 24-25 Value': c.ytd202425.value, 'YTD 25-26 Value': c.ytd202526.value,
        }));
        const ws = utils.json_to_sheet(dataToExport);
        const wb = utils.book_new(); utils.book_append_sheet(wb, ws, "Customer Analysis");
        writeFile(wb, `Customer_FY_Analysis_FY${currentFY}.xlsx`);
    };

    const periodLabel = comparisonMode === 'ytd' ? 'YTD' : 'Full FY';
    const lyLabel = comparisonMode === 'ytd' ? 'LY YTD' : 'LY Full';

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-gradient-to-br from-blue-50 via-white to-indigo-50">
            <div className="max-w-[1800px] mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Customer Sales – FY Analysis</h1>
                            <p className="text-sm text-gray-500 font-medium mt-1">
                                Tracking <span className="font-black text-blue-700">{customerSalesByFY.length}</span> unique customers ·{' '}
                                <span className="font-black text-purple-700">{customerCategories.total.size}</span> active in {periodLabel} 25-26 ·{' '}
                                <span className="font-black text-indigo-700">{customerSalesByFY.filter(c => getPrevVal(c) > 0).length}</span> active in {lyLabel}
                            </p>
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
                    <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-500" /><span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">Pivot Hierarchy:</span></div>
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                                <button onClick={() => { setPivotBy('group'); setExpandedGroups({}); setExpandedSubGroups({}); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${pivotBy === 'group' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>Group View</button>
                                <button onClick={() => { setPivotBy('customerGroup'); setExpandedGroups({}); setExpandedSubGroups({}); }} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${pivotBy === 'customerGroup' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>Customer Group View</button>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                                <button onClick={() => setComparisonMode('ytd')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${comparisonMode === 'ytd' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>YTD</button>
                                <button onClick={() => setComparisonMode('full')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${comparisonMode === 'full' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>Full FY</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {/* Total Active */}
                    <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5 hover:shadow-md transition-all hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 rounded-xl bg-blue-50"><Users className="w-5 h-5 text-blue-600" /></div>
                            <div className={`text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 ${kpis.total.pct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                {kpis.total.pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(kpis.total.pct).toFixed(0)}%
                            </div>
                        </div>
                        <div className="text-3xl font-black text-gray-900 mb-1 tabular-nums">{kpis.total.current.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Customers</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">vs {kpis.total.previous} in {lyLabel}</div>
                    </div>

                    {/* Repeat */}
                    <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-5 hover:shadow-md transition-all hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 rounded-xl bg-emerald-50"><UserCheck className="w-5 h-5 text-emerald-600" /></div>
                            <div className="text-[10px] font-black px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                                {kpis.total.previous > 0 ? ((kpis.repeat.current / kpis.total.previous) * 100).toFixed(0) : 0}%
                            </div>
                        </div>
                        <div className="text-3xl font-black text-gray-900 mb-1 tabular-nums">{kpis.repeat.current.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Repeat Customers</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">Bought in both {lyLabel} &amp; now</div>
                    </div>

                    {/* New */}
                    <div className="bg-white rounded-2xl shadow-sm border border-sky-100 p-5 hover:shadow-md transition-all hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 rounded-xl bg-sky-50"><UserPlus className="w-5 h-5 text-sky-600" /></div>
                            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-sky-50 text-sky-700">New</span>
                        </div>
                        <div className="text-3xl font-black text-gray-900 mb-1 tabular-nums">{kpis.new.current.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">New Customers</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">First time buyers this period</div>
                    </div>

                    {/* Rebuild */}
                    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-5 hover:shadow-md transition-all hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 rounded-xl bg-orange-50"><RefreshCw className="w-5 h-5 text-orange-600" /></div>
                            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-orange-50 text-orange-700">Re-engaged</span>
                        </div>
                        <div className="text-3xl font-black text-gray-900 mb-1 tabular-nums">{kpis.rebuild.current.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rebuild Customers</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">Silent last period, active now</div>
                    </div>

                    {/* Lost */}
                    <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-5 hover:shadow-md transition-all hover:-translate-y-1">
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 rounded-xl bg-rose-50"><UserMinus className="w-5 h-5 text-rose-600" /></div>
                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${kpis.lost.current > 0 ? 'bg-rose-50 text-rose-700' : 'bg-gray-50 text-gray-500'}`}>At Risk</span>
                        </div>
                        <div className="text-3xl font-black text-gray-900 mb-1 tabular-nums">{kpis.lost.current.toLocaleString('en-IN')}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lost Customers</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">Active in {lyLabel}, silent now</div>
                    </div>
                </div>

                {/* Search & Filter */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex justify-between items-center gap-4 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-xl">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input type="text" placeholder="Search by customer name or group..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm" />
                    </div>
                    <div className="flex gap-4 items-center">
                        <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)} className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold">
                            <option value="ALL">All Groups</option>
                            {uniqueGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <button onClick={() => { setExpandedGroups({}); setExpandedSubGroups({}); }} className="px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200 rounded-lg">Collapse All</button>
                        <span className="text-xs font-bold text-gray-400">{filteredData.length} customers shown</span>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-auto max-h-[calc(100vh-480px)]">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-50 text-[9px] font-bold text-gray-600 uppercase tracking-tight">
                                <tr className="bg-gray-100 border-b border-gray-200">
                                    <th className="sticky left-0 z-50 py-1 px-4 text-left border-r border-gray-300 bg-gray-100 w-[300px]">
                                        <div className="flex items-center gap-2"><Layers className="w-3 h-3 text-gray-400" />{pivotBy === 'group' ? 'Group / Customer Group / Customer' : 'Customer Group / Group / Customer'}</div>
                                    </th>
                                    <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-blue-50/50">FY 23-24 (Full)</th>
                                    <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-indigo-50/50">FY 24-25 {comparisonMode === 'ytd' ? '(YTD)' : '(Full)'}</th>
                                    <th colSpan={2} className="py-1 px-2 text-center border-r border-gray-300 bg-purple-50/50">FY 25-26 {comparisonMode === 'ytd' ? '(YTD)' : '(Full)'}</th>
                                    <th className="py-1 px-2 text-center bg-gray-200 whitespace-nowrap">Growth vs {lyLabel}</th>
                                    <th className="py-1 px-2 text-center bg-yellow-50/50 text-yellow-800">Share %</th>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <th className="sticky left-0 z-50 py-2 px-4 border-r whitespace-nowrap bg-gray-50">Hierarchy</th>
                                    <th className="py-2 px-2 text-right bg-blue-50/30">Qty</th><th className="py-2 px-2 text-right border-r bg-blue-50/30">Value</th>
                                    <th className="py-2 px-2 text-right bg-indigo-50/30">Qty</th><th className="py-2 px-2 text-right border-r bg-indigo-50/30">Value</th>
                                    <th className="py-2 px-2 text-right bg-purple-50/30">Qty</th><th className="py-2 px-2 text-right border-r bg-purple-50/30">Value</th>
                                    <th className="py-2 px-2 text-center bg-gray-100">Growth %</th>
                                    <th className="py-2 px-2 text-center bg-yellow-50/30">Share %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-[10px] text-gray-700">
                                {(() => {
                                    const totalFY2526 = filteredData.reduce((acc, c) => acc + getCurrVal(c), 0);
                                    return Object.entries(groupedData).map(([groupName, subGroups]) => {
                                        const groupItems = Object.values(subGroups).flat();
                                        const gTotal = calculateTotals(groupItems);
                                        const isExpanded = expandedGroups[groupName];
                                        return (
                                            <React.Fragment key={groupName}>
                                                <tr className="bg-gray-100/80 hover:bg-gray-200 transition-colors border-b border-gray-200 cursor-pointer" onClick={() => toggleGroup(groupName)}>
                                                    <td className="sticky left-0 z-20 py-2 px-4 border-r bg-gray-100/80">
                                                        <div className="flex items-center gap-2 font-black text-gray-800">
                                                            {isExpanded ? <ChevronDown className="w-3 h-3 text-blue-600 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                                                            {groupName}
                                                            <span className="ml-2 text-[9px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                                                {gTotal.count2526} / {gTotal.count2425} cust
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-2 text-right font-bold">{fmt(gTotal.fy2324_qty)}</td>
                                                    <td className="py-2 px-2 text-right border-r font-bold">{fmt(gTotal.fy2324_val)}</td>
                                                    <td className="py-2 px-2 text-right font-bold">{fmt(gTotal.fy2425_qty)}</td>
                                                    <td className="py-2 px-2 text-right border-r font-bold">{fmt(gTotal.fy2425_val)}</td>
                                                    <td className="py-2 px-2 text-right font-black">{fmt(gTotal.fy2526_qty)}</td>
                                                    <td className="py-2 px-2 text-right border-r font-black">{fmt(gTotal.fy2526_val)}</td>
                                                    <td className="py-2 px-2 text-center font-bold">
                                                        <GrowthBadge curr={gTotal.fy2526_val} prev={gTotal.fy2425_val} />
                                                    </td>
                                                    <td className="py-2 px-2 text-center font-bold bg-yellow-50/50 text-yellow-800">
                                                        {totalFY2526 > 0 ? ((gTotal.fy2526_val / totalFY2526) * 100).toFixed(1) : 0}%
                                                    </td>
                                                </tr>
                                                {isExpanded && Object.entries(subGroups).map(([subGroupName, subCustomers]) => {
                                                    const subKey = `${groupName}-${subGroupName}`;
                                                    const sgTotal = calculateTotals(subCustomers);
                                                    const isSgExpanded = expandedSubGroups[subKey];
                                                    return (
                                                        <React.Fragment key={subKey}>
                                                            <tr className="bg-gray-50 hover:bg-gray-100 cursor-pointer" onClick={() => toggleSubGroup(subKey)}>
                                                                <td className="sticky left-0 z-10 py-1.5 px-4 pl-8 border-r bg-gray-50">
                                                                    <div className="flex items-center gap-2 font-bold text-gray-700">
                                                                        {isSgExpanded ? <ChevronDown className="w-3 h-3 text-indigo-500 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                                                                        {subGroupName}
                                                                        <span className="text-[9px] font-bold bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                                                                            {sgTotal.count2526}/{sgTotal.count2425}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="py-1.5 px-2 text-right text-gray-500">{fmt(sgTotal.fy2324_qty)}</td>
                                                                <td className="py-1.5 px-2 text-right border-r text-gray-500">{fmt(sgTotal.fy2324_val)}</td>
                                                                <td className="py-1.5 px-2 text-right text-indigo-600">{fmt(sgTotal.fy2425_qty)}</td>
                                                                <td className="py-1.5 px-2 text-right border-r text-indigo-600">{fmt(sgTotal.fy2425_val)}</td>
                                                                <td className="py-1.5 px-2 text-right text-purple-700 font-bold">{fmt(sgTotal.fy2526_qty)}</td>
                                                                <td className="py-1.5 px-2 text-right border-r text-purple-700 font-bold">{fmt(sgTotal.fy2526_val)}</td>
                                                                <td className="py-1.5 px-2 text-center font-bold">
                                                                    <GrowthBadge curr={sgTotal.fy2526_val} prev={sgTotal.fy2425_val} />
                                                                </td>
                                                                <td className="py-1.5 px-2 text-center text-yellow-700 font-medium">
                                                                    {totalFY2526 > 0 ? ((sgTotal.fy2526_val / totalFY2526) * 100).toFixed(1) : 0}%
                                                                </td>
                                                            </tr>
                                                            {isSgExpanded && subCustomers.map((cust: any) => {
                                                                const valCurr = getCurrVal(cust);
                                                                const valPrev = getPrevVal(cust);
                                                                const qtyCurr = comparisonMode === 'full' ? cust.fy202526.qty : cust.ytd202526.qty;
                                                                const qtyPrev = comparisonMode === 'full' ? cust.fy202425.qty : cust.ytd202425.qty;
                                                                return (
                                                                    <tr key={cust.customerName} className="hover:bg-blue-50/20 border-b border-gray-50">
                                                                        <td className="sticky left-0 z-10 py-1 px-4 pl-12 border-r truncate text-gray-600 bg-white max-w-[260px]" title={cust.customerName}>
                                                                            {cust.customerName}
                                                                        </td>
                                                                        <td className="py-1 px-2 text-right text-gray-400">{fmt(cust.fy202324.qty)}</td>
                                                                        <td className="py-1 px-2 text-right border-r text-gray-400">{fmt(cust.fy202324.value)}</td>
                                                                        <td className="py-1 px-2 text-right text-indigo-600/70">{fmt(qtyPrev)}</td>
                                                                        <td className="py-1 px-2 text-right border-r text-indigo-600/70">{fmt(valPrev)}</td>
                                                                        <td className="py-1 px-2 text-right text-purple-700 font-bold">{fmt(qtyCurr)}</td>
                                                                        <td className="py-1 px-2 text-right border-r text-purple-700 font-black">{fmt(valCurr)}</td>
                                                                        <td className="py-1 px-2 text-center font-medium">
                                                                            <GrowthBadge curr={valCurr} prev={valPrev} />
                                                                        </td>
                                                                        <td className="py-1 px-2 text-center text-gray-500">
                                                                            {totalFY2526 > 0 ? ((valCurr / totalFY2526) * 100).toFixed(1) : 0}%
                                                                        </td>
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
