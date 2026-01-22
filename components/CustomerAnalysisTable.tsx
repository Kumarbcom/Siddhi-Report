import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowUp, ArrowDown, Search, Filter, Download,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Loader2, AlertCircle
} from 'lucide-react';
import { customerAnalysisService, CustomerAnalysisRecord } from '../services/customerAnalysisService';
import * as XLSX from 'xlsx';

export const CustomerAnalysisTable: React.FC = () => {
    // State
    const [data, setData] = useState<CustomerAnalysisRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalRecords, setTotalRecords] = useState(0);
    const [groups, setGroups] = useState<string[]>([]);

    // Filters & Pagination State
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [sortBy, setSortBy] = useState<keyof CustomerAnalysisRecord>('fy_25_26_val');
    const [sortDesc, setSortDesc] = useState(true);

    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [groupFilter, setGroupFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [growthFilter, setGrowthFilter] = useState<'ALL' | 'POSITIVE' | 'NEGATIVE'>('ALL');

    // Debounce Search
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch Data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: records, count } = await customerAnalysisService.fetchAnalysis({
                page,
                pageSize,
                sortBy,
                sortDesc,
                category: categoryFilter,
                group: groupFilter,
                search: debouncedSearch,
                growthFilter
            });
            setData(records || []);
            setTotalRecords(count || 0);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, sortBy, sortDesc, categoryFilter, groupFilter, debouncedSearch, growthFilter]);

    // Fetch Groups on mount
    useEffect(() => {
        customerAnalysisService.getGroups().then(setGroups).catch(console.error);
    }, []);

    // Effect to fetch data when dependencies change
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handlers
    const handleSort = (key: keyof CustomerAnalysisRecord) => {
        if (sortBy === key) {
            setSortDesc(!sortDesc);
        } else {
            setSortBy(key);
            setSortDesc(true); // Default to descending for new columns (usually value based)
        }
    };

    const handleExportExcel = () => {
        // For export, we might want to fetch ALL data matching current filters, not just the page.
        // But for simplicity/performance in this demo, let's export current view or trigger a full fetch.
        // We'll export the current page data for now.
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Customer Analysis");
        XLSX.writeFile(wb, "Customer_Analysis_Report.xlsx");
    };

    // Formatters
    const formatCurrency = (val: number) => {
        if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
        if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
        return `₹${val.toLocaleString()}`;
    };

    const formatNumber = (val: number) => val.toLocaleString();
    const formatPercent = (val: number) => `${val.toFixed(1)}%`;

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden font-sans">
            {/* Toolbar */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-800">Customer Analysis</h2>
                    <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {totalRecords} Records
                    </span>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition-colors shadow-sm"
                    >
                        <Download className="w-3.5 h-3.5" /> Export Excel
                    </button>

                    {/* Pagination Controls (Top) - Optional, but useful */}
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="bg-white border border-gray-300 text-gray-700 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="10">10 / page</option>
                        <option value="25">25 / page</option>
                        <option value="50">50 / page</option>
                        <option value="100">100 / page</option>
                    </select>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto relative custom-scrollbar">
                {loading && (
                    <div className="absolute inset-0 z-20 bg-white/50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                )}

                <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                        {/* Header Row */}
                        <tr className="bg-gray-100 text-[10px] font-black text-gray-700 uppercase border-b border-gray-200">
                            {[
                                { key: 'category', label: 'Category' },
                                { key: 'group_name', label: 'Group' },
                                { key: 'customer_name', label: 'Customer Name', width: '250px' },
                                { key: 'fy_23_24_qty', label: '23-24 Qty', align: 'right' },
                                { key: 'fy_23_24_val', label: '23-24 Val', align: 'right' },
                                { key: 'fy_24_25_qty', label: '24-25 Qty', align: 'right' },
                                { key: 'fy_24_25_val', label: '24-25 Val', align: 'right' },
                                { key: 'fy_25_26_qty', label: '25-26 Qty', align: 'right' },
                                { key: 'fy_25_26_val', label: '25-26 Val', align: 'right' },
                                { key: 'ytd_growth_percentage', label: 'YTD Growth %', align: 'right' },
                            ].map((col) => (
                                <th
                                    key={col.key}
                                    className={`py-3 px-3 border-r border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                                    style={{ width: col.width }}
                                    onClick={() => handleSort(col.key as keyof CustomerAnalysisRecord)}
                                >
                                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : 'justify-between'}`}>
                                        {col.label}
                                        {sortBy === col.key ? (
                                            sortDesc ? <ArrowDown className="w-3 h-3 text-blue-600" /> : <ArrowUp className="w-3 h-3 text-blue-600" />
                                        ) : (
                                            <div className="flex flex-col opacity-30">
                                                <ArrowUp className="w-2 h-2" />
                                                <ArrowDown className="w-2 h-2" />
                                            </div>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>

                        {/* Filter Row */}
                        <tr className="bg-white border-b border-gray-200">
                            <th className="p-1 border-r border-gray-200">
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="w-full text-[10px] bg-gray-50 border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="ALL">All Categories</option>
                                    <option value="Repeat">Repeat</option>
                                    <option value="New">New</option>
                                    <option value="Rebuild">Rebuild</option>
                                    <option value="Lost">Lost</option>
                                </select>
                            </th>
                            <th className="p-1 border-r border-gray-200">
                                <select
                                    value={groupFilter}
                                    onChange={(e) => setGroupFilter(e.target.value)}
                                    className="w-full text-[10px] bg-gray-50 border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 truncate"
                                    style={{ maxWidth: '120px' }}
                                >
                                    <option value="ALL">All Groups</option>
                                    {groups.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </th>
                            <th className="p-1 border-r border-gray-200">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full text-[10px] pl-6 bg-gray-50 border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                </div>
                            </th>
                            {/* Empty cells for financial columns filters (or implement range inputs if needed) */}
                            <th className="p-1 border-r border-gray-200 bg-gray-50/30"></th>
                            <th className="p-1 border-r border-gray-200 bg-gray-50/30"></th>
                            <th className="p-1 border-r border-gray-200 bg-gray-50/30"></th>
                            <th className="p-1 border-r border-gray-200 bg-gray-50/30"></th>
                            <th className="p-1 border-r border-gray-200 bg-gray-50/30"></th>
                            <th className="p-1 border-r border-gray-200 bg-gray-50/30"></th>

                            <th className="p-1 border-r border-gray-200">
                                <select
                                    value={growthFilter}
                                    onChange={(e) => setGrowthFilter(e.target.value as any)}
                                    className="w-full text-[10px] bg-gray-50 border border-gray-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="ALL">All Growth</option>
                                    <option value="POSITIVE">Positive (+)</option>
                                    <option value="NEGATIVE">Negative (-)</option>
                                </select>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px] text-gray-700 divide-y divide-gray-200">
                        {data.length === 0 && !loading ? (
                            <tr>
                                <td colSpan={10} className="py-8 text-center text-gray-400">
                                    No records found matching your filters.
                                </td>
                            </tr>
                        ) : (
                            data.map((record) => (
                                <tr key={record.id} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="py-2 px-3 border-r border-gray-100">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${record.category === 'Repeat' ? 'bg-green-100 text-green-700' :
                                                record.category === 'Rebuild' ? 'bg-orange-100 text-orange-700' :
                                                    record.category === 'Lost' ? 'bg-red-100 text-red-700' :
                                                        'bg-blue-100 text-blue-700'
                                            }`}>
                                            {record.category}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 border-r border-gray-100 font-medium text-gray-600">{record.group_name}</td>
                                    <td className="py-2 px-3 border-r border-gray-100 font-bold text-gray-800">{record.customer_name}</td>

                                    <td className="py-2 px-3 border-r border-gray-100 text-right text-gray-500">{formatNumber(record.fy_23_24_qty)}</td>
                                    <td className="py-2 px-3 border-r border-gray-100 text-right font-medium">{formatCurrency(record.fy_23_24_val)}</td>

                                    <td className="py-2 px-3 border-r border-gray-100 text-right text-gray-500">{formatNumber(record.fy_24_25_qty)}</td>
                                    <td className="py-2 px-3 border-r border-gray-100 text-right font-medium">{formatCurrency(record.fy_24_25_val)}</td>

                                    <td className="py-2 px-3 border-r border-gray-100 text-right text-blue-600 font-medium">{formatNumber(record.fy_25_26_qty)}</td>
                                    <td className="py-2 px-3 border-r border-gray-100 text-right font-black text-blue-700">{formatCurrency(record.fy_25_26_val)}</td>

                                    <td className={`py-2 px-3 border-r border-gray-100 text-right font-bold ${record.ytd_growth_percentage > 0 ? 'text-green-600' : record.ytd_growth_percentage < 0 ? 'text-red-500' : 'text-gray-400'
                                        }`}>
                                        {formatPercent(record.ytd_growth_percentage)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <span className="text-[10px] text-gray-500">
                    Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalRecords)} of {totalRecords} entries
                </span>
                <div className="flex gap-1">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded">
                        Page {page + 1} of {Math.ceil(totalRecords / pageSize) || 1}
                    </span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={(page + 1) * pageSize >= totalRecords}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                </div>
            </div>
        </div>
    );
};
