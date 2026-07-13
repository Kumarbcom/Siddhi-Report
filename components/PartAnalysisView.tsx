import React, { useState, useMemo } from 'react';
import { Material, ClosingStockItem, PendingSOItem, PendingPOItem, SalesReportItem, CustomerMasterItem } from '../types';
import { Search, Package, TrendingUp, DollarSign, Activity, FileBarChart, PieChart as PieIcon, Factory, Calendar, Clock, ArrowUpRight, ArrowDownRight, Layers, BarChart3, TrendingDown, CheckCircle2, AlertTriangle, AlertCircle, Plus, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import Chart from 'react-apexcharts';

interface PartAnalysisViewProps {
    materials: Material[];
    closingStock: ClosingStockItem[];
    pendingSO: PendingSOItem[];
    pendingPO: PendingPOItem[];
    salesReportItems: SalesReportItem[];
    customers: CustomerMasterItem[];
}

const formatLargeValue = (val: number, compact: boolean = false) => {
    if (isNaN(val) || val === null) return '-';
    if (val === 0) return '0';
    const absVal = Math.abs(val);
    const prefix = compact ? '' : 'Rs. ';

    if (absVal >= 10000000) return `${prefix}${(val / 10000000).toFixed(2)} Cr`;
    if (absVal >= 100000) return `${prefix}${(val / 100000).toFixed(2)} L`;
    return `${prefix}${Math.round(val).toLocaleString('en-IN')}`;
};

const roundToTen = (num: number) => {
    if (num <= 0) return 0;
    return Math.ceil(num / 10) * 10;
};

const PartAnalysisView: React.FC<PartAnalysisViewProps> = ({
    materials, closingStock, pendingSO, pendingPO, salesReportItems, customers
}) => {
    const [partSearch, setPartSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'sales' | 'stock'>('sales');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleCol = (id: string) => {
        setExpandedCols(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Find matched data based on part no or description
    const activeData = useMemo(() => {
        if (!partSearch.trim()) return null;
        const search = partSearch.toLowerCase().trim();

        let mat = materials.find(m => (m.partNo || '').toLowerCase() === search || (m.materialCode || '').toLowerCase() === search);
        if (mat) return { partNo: mat.partNo || '', description: mat.description || '' };

        let so = pendingSO.find(s => (s.partNo || '').toLowerCase() === search);
        if (so) return { partNo: so.partNo || '', description: so.itemName || '' };

        let po = pendingPO.find(p => (p.partNo || '').toLowerCase() === search);
        if (po) return { partNo: po.partNo || '', description: po.itemName || '' };

        let st = closingStock.find(s => (s.description || '').toLowerCase().includes(search));
        if (st) return { partNo: search, description: st.description || '' };

        let sa = salesReportItems.find(s => (s.particulars || '').toLowerCase().includes(search));
        if (sa) return { partNo: search, description: sa.particulars || '' };

        return { partNo: search, description: `Search: ${partSearch}` };
    }, [partSearch, materials, pendingSO, pendingPO, closingStock, salesReportItems]);

    // Data for active material
    const matKey = activeData ? activeData.partNo.toLowerCase().trim() : '';
    const descKey = activeData ? activeData.description.toLowerCase().trim() : '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayT = today.getTime();

    const parseDate = (val: any): Date => {
        if (!val) return new Date();
        if (val instanceof Date) return new Date(val);
        if (typeof val === 'number') return new Date((Math.round(val) - 25568) * 86400 * 1000);
        const d = new Date(val);
        if (isNaN(d.getTime())) {
            const parts = val.split(/[-/.]/);
            if (parts.length === 3) {
                if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                let y = parseInt(parts[2]);
                if (y < 100) y += 2000;
                return new Date(y, parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
        }
        return d;
    };

    // Calculate Stock Metrics
    const stockMetrics = useMemo(() => {
        if (!matKey && !descKey) return null;

        let currentStock = 0;
        closingStock.forEach(s => {
            if (s.description?.toLowerCase().trim() === descKey) currentStock += (s.quantity || 0);
        });

        let soDue = 0, soSch = 0, soVal = 0;
        pendingSO.forEach(s => {
            const pk = (s.partNo || '').toLowerCase().trim();
            const dk = (s.itemName || '').toLowerCase().trim();
            if (pk === matKey || dk === descKey) {
                const bal = s.balanceQty || 0;
                const d = parseDate(s.dueDate).getTime();
                if (d <= todayT) soDue += bal;
                else soSch += bal;
                soVal += (bal * (s.rate || 0));
            }
        });

        let poDue = 0, poSch = 0, poVal = 0;
        pendingPO.forEach(p => {
            const pk = (p.partNo || '').toLowerCase().trim();
            const dk = (p.itemName || '').toLowerCase().trim();
            if (pk === matKey || dk === descKey) {
                const bal = p.balanceQty || 0;
                const d = parseDate(p.dueDate).getTime();
                if (d <= todayT) poDue += bal;
                else poSch += bal;
                poVal += (bal * (p.rate || 0));
            }
        });

        const netQty = currentStock - soDue;
        const totalOpenSO = soDue + soSch;
        const totalOpenPO = poDue + poSch;
        const stockCalculated = currentStock + totalOpenPO - totalOpenSO;

        // Sales for last 12 months for Avg
        const twelveMonthsAgo = new Date(today);
        twelveMonthsAgo.setMonth(today.getMonth() - 12);
        const t12 = twelveMonthsAgo.getTime();
        
        let sales12mQty = 0;
        let sales12mVal = 0;
        salesReportItems.forEach(s => {
            const pk = (s.particulars || '').toLowerCase().trim();
            if (pk === descKey || (matKey && pk.includes(matKey))) {
                const sd = parseDate(s.date).getTime();
                if (sd >= t12 && sd <= todayT) {
                    sales12mQty += (s.quantity || 0);
                    sales12mVal += (s.value || 0);
                }
            }
        });
        const avg12mQty = sales12mQty / 12;

        let min = roundToTen(avg12mQty);
        let re = roundToTen(avg12mQty * 1.5);
        let max = min * 2;

        const exStock = Math.max(0, currentStock - (totalOpenSO + max));
        const exPO = Math.max(0, (netQty - max) - exStock);
        const poNeed = Math.max(0, max - netQty);
        const expGap = (soDue + max) - currentStock;
        const expQty = (expGap > 0 && totalOpenPO > 0) ? Math.min(totalOpenPO, expGap) : 0;

        let status = 'Normal';
        let statusColor = 'text-green-600 bg-green-50 border-green-200';
        if (currentStock < min) { status = '🚨 Critical Shortage (Emergency Book)'; statusColor = 'text-rose-700 bg-rose-50 border-rose-200'; }
        else if (currentStock < re) { status = '⚠️ Below Reorder (Indication to Book)'; statusColor = 'text-amber-700 bg-amber-50 border-amber-200'; }
        else if (exStock > 0) { status = '🛑 Excess Stock'; statusColor = 'text-purple-700 bg-purple-50 border-purple-200'; }
        else if (exPO > 0) { status = '✋ Excess PO (Hold/Cancel)'; statusColor = 'text-indigo-700 bg-indigo-50 border-indigo-200'; }
        
        return {
            currentStock, soDue, soSch, poDue, poSch, netQty, stockCalculated, avg12mQty, min, re, max,
            exStock, exPO, poNeed, expQty, status, statusColor, totalOpenSO, totalOpenPO
        };
    }, [activeData, closingStock, pendingSO, pendingPO, salesReportItems]);

    // Calculate Sales Metrics
    const salesData = useMemo(() => {
        if (!matKey && !descKey) return null;

        // Extract relevant sales
        const relevantSales = salesReportItems.filter(s => {
            const pk = (s.particulars || '').toLowerCase().trim();
            return pk === descKey || (matKey && pk.includes(matKey));
        });

        if (relevantSales.length === 0) return null;

        let totalVal = 0;
        const yearsSet = new Set<string>();

        // Build base tree
        // Group -> Name -> Year -> Month -> { qty, val }
        const tree: Record<string, Record<string, Record<string, Record<string, { qty: number, val: number }>>>> = {};

        relevantSales.forEach(s => {
            const d = parseDate(s.date);
            const yr = d.getFullYear().toString();
            const mo = d.toLocaleString('default', { month: 'short' });
            yearsSet.add(yr);

            const cName = (s.customerName || 'Unknown').trim();
            const custMatch = customers.find(c => c.customerName.toLowerCase().trim() === cName.toLowerCase());
            const cGroup = custMatch ? (custMatch.customerGroup || custMatch.group || 'UNASSIGNED') : 'UNASSIGNED';

            if (!tree[cGroup]) tree[cGroup] = {};
            if (!tree[cGroup][cName]) tree[cGroup][cName] = {};
            if (!tree[cGroup][cName][yr]) tree[cGroup][cName][yr] = {};
            if (!tree[cGroup][cName][yr][mo]) tree[cGroup][cName][yr][mo] = { qty: 0, val: 0 };

            tree[cGroup][cName][yr][mo].qty += (s.quantity || 0);
            tree[cGroup][cName][yr][mo].val += (s.value || 0);
            totalVal += (s.value || 0);
        });

        const years = Array.from(yearsSet).sort();
        const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Compute aggregated tree
        const grouped = Object.entries(tree).map(([groupName, namesObj]) => {
            let groupVal = 0;
            let groupQty = 0;
            const groupYears: Record<string, { qty: number, val: number }> = {};
            
            const names = Object.entries(namesObj).map(([name, yearsObj]) => {
                let nameVal = 0;
                let nameQty = 0;
                const nameYears: Record<string, { qty: number, val: number }> = {};
                
                years.forEach(y => {
                    nameYears[y] = { qty: 0, val: 0 };
                    if (yearsObj[y]) {
                        Object.values(yearsObj[y]).forEach(m => {
                            nameYears[y].qty += m.qty;
                            nameYears[y].val += m.val;
                        });
                    }
                    nameVal += nameYears[y].val;
                    nameQty += nameYears[y].qty;
                    
                    if (!groupYears[y]) groupYears[y] = { qty: 0, val: 0 };
                    groupYears[y].qty += nameYears[y].qty;
                    groupYears[y].val += nameYears[y].val;
                });
                
                groupVal += nameVal;
                groupQty += nameQty;

                return { name, years: yearsObj, nameYears, nameVal, nameQty };
            });

            return { groupName, names, groupYears, groupVal, groupQty };
        }).sort((a, b) => b.groupVal - a.groupVal);

        return { grouped, years, monthsOrder, totalVal };
    }, [activeData, salesReportItems, customers]);

    // Compute Chart Data
    const chartData = useMemo(() => {
        if (!salesData || !stockMetrics) return null;
        
        // 1. Stock Projection Line Chart
        const pt1 = stockMetrics.currentStock;
        const pt2 = pt1 + stockMetrics.totalOpenPO;
        const shortfall = stockMetrics.max - pt2;
        const pt3 = shortfall > 0 ? stockMetrics.max : null;

        const stockChart: ApexCharts.ApexOptions = {
            chart: { type: 'line', toolbar: { show: false }, background: 'transparent' },
            stroke: { width: [4, 4, 4], curve: 'straight', dashArray: [0, 5, 5] },
            colors: ['#3B82F6', '#10B981', '#EF4444'],
            markers: { size: 5 },
            annotations: {
                yaxis: [
                    { y: stockMetrics.totalOpenSO, borderColor: '#8B5CF6', strokeDashArray: 2, label: { text: `Open SO: ${formatLargeValue(stockMetrics.totalOpenSO, true)}`, style: { color: '#fff', background: '#8B5CF6' }, position: 'left', offsetX: 10, offsetY: 0 } },
                    { y: stockMetrics.max, borderColor: '#3B82F6', strokeDashArray: 4, label: { text: `Max: ${formatLargeValue(stockMetrics.max, true)}`, style: { color: '#fff', background: '#3B82F6', padding: { left: 4, right: 4, top: 2, bottom: 2 } }, position: 'right', textAnchor: 'end', offsetX: -5, offsetY: 0 } },
                    { y: stockMetrics.re, borderColor: '#F59E0B', strokeDashArray: 4, label: { text: `Reorder: ${formatLargeValue(stockMetrics.re, true)}`, style: { color: '#fff', background: '#F59E0B', padding: { left: 4, right: 4, top: 2, bottom: 2 } }, position: 'right', textAnchor: 'end', offsetX: -5, offsetY: 0 } },
                    { y: stockMetrics.min, borderColor: '#EF4444', strokeDashArray: 4, label: { text: `Min: ${formatLargeValue(stockMetrics.min, true)}`, style: { color: '#fff', background: '#EF4444', padding: { left: 4, right: 4, top: 2, bottom: 2 } }, position: 'right', textAnchor: 'end', offsetX: -5, offsetY: 0 } }
                ]
            },
            xaxis: { categories: ['Current', 'w/ PO', 'Target Max'] },
            yaxis: { min: 0, title: { text: 'Quantity' }, labels: { formatter: (val: number) => formatLargeValue(val, true) } },
            grid: { borderColor: '#f1f5f9' },
            dataLabels: { 
                enabled: true, 
                enabledOnSeries: [0, 1, 2],
                formatter: (val: number, opts: any) => {
                    if (opts.seriesIndex === 0 && opts.dataPointIndex === 0) return formatLargeValue(val, true);
                    if (opts.seriesIndex === 1 && opts.dataPointIndex === 1) return formatLargeValue(val, true);
                    if (opts.seriesIndex === 2 && opts.dataPointIndex === 2 && val !== null) return formatLargeValue(val, true);
                    return '';
                },
                offsetY: -5, 
                style: { fontSize: '10px', fontWeight: 'bold', colors: ['#475569'] },
                background: { enabled: true, foreColor: '#fff', borderRadius: 2, padding: 2, borderWidth: 0 }
            }
        };
        const stockSeries = [
            { name: 'Current Stock', data: [pt1, null, null] },
            { name: 'PO Projection', data: [pt1, pt2, null] },
            { name: 'Shortfall', data: [null, pt2, pt3] }
        ];

        // 2. YoY Sales Bar Chart
        const yoyCategories = salesData.years;
        const yoyVals = salesData.years.map(y => {
            let sum = 0;
            salesData.grouped.forEach(g => sum += g.groupYears[y]?.val || 0);
            return sum;
        });
        const yoyChart: ApexCharts.ApexOptions = {
            chart: { type: 'bar', toolbar: { show: false } },
            plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
            colors: ['#6366F1'],
            xaxis: { categories: yoyCategories },
            yaxis: { labels: { formatter: (val: number) => formatLargeValue(val, true) } },
            dataLabels: { enabled: true, formatter: (val: number) => formatLargeValue(val, true), style: { fontSize: '10px', colors: ['#fff'] } }
        };
        const yoySeries = [{ name: 'Sales Value', data: yoyVals }];

        // 3. Customer Group Pie Chart (Current Year)
        const currYear = salesData.years[salesData.years.length - 1];
        const pieLabels: string[] = [];
        const pieVals: number[] = [];
        salesData.grouped.forEach(g => {
            const v = g.groupYears[currYear]?.val || 0;
            if (v > 0) { pieLabels.push(g.groupName); pieVals.push(v); }
        });
        const pieChart: ApexCharts.ApexOptions = {
            chart: { type: 'donut' },
            labels: pieLabels,
            legend: { show: false },
            dataLabels: { enabled: true, formatter: (val: number) => val.toFixed(1) + '%' },
            tooltip: { enabled: true, y: { formatter: (val: number) => formatLargeValue(val) } },
            plotOptions: { pie: { donut: { size: '65%' } } }
        };
        const pieSeries = pieVals;

        // 4. Area Chart Monthly Consumption
        const areaLabels: string[] = [];
        const areaVals: number[] = [];
        salesData.years.forEach(y => {
            salesData.monthsOrder.forEach(m => {
                let sum = 0;
                salesData.grouped.forEach(g => {
                    g.names.forEach(n => {
                        sum += n.years[y]?.[m]?.val || 0;
                    });
                });
                if (sum > 0 || areaLabels.length > 0) { // Don't push leading zeros
                    areaLabels.push(`${m} ${y}`);
                    areaVals.push(sum);
                }
            });
        });
        const areaChart: ApexCharts.ApexOptions = {
            chart: { type: 'area', toolbar: { show: false } },
            stroke: { curve: 'smooth', width: 2 },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 90, 100] } },
            colors: ['#10B981'],
            xaxis: { categories: areaLabels, labels: { show: true, style: { fontSize: '10px' } } },
            yaxis: { labels: { formatter: (val: number) => formatLargeValue(val, true) } },
            dataLabels: { enabled: true, offsetY: -5, style: { fontSize: '9px', fontWeight: 'normal', colors: ['#475569'] }, background: { enabled: true, foreColor: '#fff', borderRadius: 2, padding: 2, borderWidth: 0 } }
        };
        // Fix for dataLabels formatter in ApexCharts options
        areaChart.dataLabels = { ...areaChart.dataLabels, formatter: (val: number) => formatLargeValue(val, true) };
        const areaSeries = [{ name: 'Consumption', data: areaVals }];

        // 5. Top 5 Customer Groups
        const allGroups: {name: string, val: number}[] = [];
        salesData.grouped.forEach(g => allGroups.push({name: g.groupName.toLowerCase(), val: g.groupVal}));
        allGroups.sort((a, b) => b.val - a.val);
        const top5 = allGroups.slice(0, 5);
        
        const top5Chart: ApexCharts.ApexOptions = {
            chart: { type: 'bar', toolbar: { show: false } },
            plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '40%' } },
            colors: ['#F59E0B'],
            xaxis: { categories: top5.map(c => c.name), labels: { formatter: (val: number) => formatLargeValue(val, true) } },
            dataLabels: { enabled: false }
        };
        const top5Series = [{ name: 'Value', data: top5.map(c => c.val) }];

        return { stockChart, stockSeries, yoyChart, yoySeries, pieChart, pieSeries, areaChart, areaSeries, top5Chart, top5Series };
    }, [salesData, stockMetrics]);

    return (
        <div className="h-full w-full flex flex-col bg-gray-50/50 overflow-hidden relative">
            {/* Top Bar */}
            <div className="bg-white/90 backdrop-blur-xl border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row gap-4 items-center justify-between flex-shrink-0 shadow-sm z-10 sticky top-0">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">Part Number Analysis</h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">AI Assisted Deep Dive</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto flex-wrap">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Enter Part No or Material Code..."
                            value={partSearch}
                            onChange={(e) => setPartSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-100 border-none rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-400 placeholder:font-medium"
                        />
                    </div>
                    
                    <div className="flex bg-slate-100/80 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('sales')}
                            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${activeTab === 'sales' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Sales Analysis
                        </button>
                        <button
                            onClick={() => setActiveTab('stock')}
                            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${activeTab === 'stock' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Stock Analysis
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {!activeData ? (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto animate-fade-in-up opacity-50">
                        <Search className="w-16 h-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-black text-gray-500 uppercase tracking-widest">Awaiting Part Number</h3>
                        <p className="text-sm text-gray-400 mt-2">Enter a valid Part Number or Material Code in the search bar above to generate the AI analysis report.</p>
                    </div>
                ) : (
                    <div className="h-full flex flex-col xl:flex-row gap-4 animate-fade-in-up">
                        {/* Left Side: Report Table */}
                        <div className="flex-1 bg-white border border-gray-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">{activeTab === 'sales' ? 'Sales Matrix' : 'Stock Status'}</h3>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{activeData.description}</p>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-auto custom-scrollbar p-4 relative">
                                {activeTab === 'sales' && salesData && (
                                    <div className="min-w-max">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr>
                                                    <th className="p-3 bg-indigo-50 border-b border-r border-indigo-100 font-black text-indigo-900 text-xs uppercase sticky left-0 z-10 w-64 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Customer / Group</th>
                                                    {salesData.years.map(y => (
                                                        <React.Fragment key={y}>
                                                            <th colSpan={expandedCols.has(y) ? 14 : 2} className="p-3 bg-indigo-50 border-b border-r border-indigo-100 font-black text-indigo-900 text-xs uppercase text-center">
                                                                <button onClick={() => toggleCol(y)} className="flex items-center justify-center gap-1 w-full hover:text-indigo-600">
                                                                    {y} {expandedCols.has(y) ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                                                </button>
                                                            </th>
                                                        </React.Fragment>
                                                    ))}
                                                    <th colSpan={4} className="p-3 bg-emerald-50 border-b border-emerald-100 font-black text-emerald-900 text-xs uppercase text-center">Total Summary</th>
                                                </tr>
                                                <tr>
                                                    <th className="p-2 bg-indigo-50/50 border-b border-r border-indigo-100 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"></th>
                                                    {salesData.years.map(y => (
                                                        <React.Fragment key={`${y}-sub`}>
                                                            {expandedCols.has(y) && salesData.monthsOrder.map(m => (
                                                                <th key={m} className="p-2 bg-gray-50 border-b border-r border-gray-100 text-[10px] font-bold text-gray-500 text-center min-w-[80px]">{m}</th>
                                                            ))}
                                                            <th className="p-2 bg-indigo-50/30 border-b border-r border-indigo-100 text-[10px] font-bold text-indigo-700 text-right min-w-[80px]">Qty</th>
                                                            <th className="p-2 bg-indigo-50/30 border-b border-r border-indigo-100 text-[10px] font-bold text-indigo-700 text-right min-w-[100px]">Value</th>
                                                        </React.Fragment>
                                                    ))}
                                                    <th className="p-2 bg-emerald-50/30 border-b border-r border-emerald-100 text-[10px] font-bold text-emerald-700 text-right">Total Qty</th>
                                                    <th className="p-2 bg-emerald-50/30 border-b border-r border-emerald-100 text-[10px] font-bold text-emerald-700 text-right">Total Value</th>
                                                    <th className="p-2 bg-emerald-50/30 border-b border-r border-emerald-100 text-[10px] font-bold text-emerald-700 text-right">% Sales</th>
                                                    <th className="p-2 bg-emerald-50/30 border-b border-emerald-100 text-[10px] font-bold text-emerald-700 text-right">YoY %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {salesData.grouped.map(g => {
                                                    const isExpanded = expandedRows.has(g.groupName);
                                                    
                                                    // Calculate YoY for Group
                                                    const prevYear = salesData.years.length > 1 ? salesData.years[salesData.years.length - 2] : null;
                                                    const currYear = salesData.years[salesData.years.length - 1];
                                                    const prevVal = prevYear ? (g.groupYears[prevYear]?.val || 0) : 0;
                                                    const currVal = g.groupYears[currYear]?.val || 0;
                                                    const yoy = prevVal > 0 ? ((currVal - prevVal) / prevVal) * 100 : 0;
                                                    
                                                    return (
                                                        <React.Fragment key={g.groupName}>
                                                            {/* Group Row */}
                                                            <tr className="hover:bg-indigo-50/30 transition-colors group">
                                                                <td className="p-2 border-b border-r border-gray-100 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-indigo-50/30">
                                                                    <button onClick={() => toggleRow(g.groupName)} className="flex items-center gap-2 font-bold text-xs text-gray-800 w-full text-left">
                                                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-500" /> : <ChevronRight className="w-4 h-4 text-indigo-500" />}
                                                                        {g.groupName}
                                                                    </button>
                                                                </td>
                                                                {salesData.years.map(y => (
                                                                    <React.Fragment key={`${g.groupName}-${y}`}>
                                                                        {expandedCols.has(y) && salesData.monthsOrder.map(m => {
                                                                            let mQty = 0; let mVal = 0;
                                                                            g.names.forEach(n => { mQty += (n.years[y]?.[m]?.qty || 0); mVal += (n.years[y]?.[m]?.val || 0); });
                                                                            return (
                                                                                <td key={m} className="p-2 border-b border-r border-gray-100 text-xs text-center text-gray-600 bg-gray-50/30">
                                                                                    {mQty > 0 ? <div className="flex flex-col"><span className="font-medium text-gray-700">{mQty}</span><span className="text-[9px] text-gray-400">{formatLargeValue(mVal, true)}</span></div> : '-'}
                                                                                </td>
                                                                            );
                                                                        })}
                                                                        <td className="p-2 border-b border-r border-gray-100 text-xs font-bold text-right text-gray-700 bg-indigo-50/10">{g.groupYears[y]?.qty?.toLocaleString() || '-'}</td>
                                                                        <td className="p-2 border-b border-r border-gray-100 text-xs font-bold text-right text-indigo-700 bg-indigo-50/10">{formatLargeValue(g.groupYears[y]?.val)}</td>
                                                                    </React.Fragment>
                                                                ))}
                                                                <td className="p-2 border-b border-r border-gray-100 text-xs font-black text-right text-gray-800 bg-emerald-50/10">{g.groupQty.toLocaleString()}</td>
                                                                <td className="p-2 border-b border-r border-gray-100 text-xs font-black text-right text-emerald-700 bg-emerald-50/10">{formatLargeValue(g.groupVal)}</td>
                                                                <td className="p-2 border-b border-r border-gray-100 text-xs font-bold text-right text-gray-600 bg-emerald-50/10">{((g.groupVal / salesData.totalVal) * 100).toFixed(1)}%</td>
                                                                <td className={`p-2 border-b border-gray-100 text-xs font-bold text-right bg-emerald-50/10 ${yoy > 0 ? 'text-emerald-600' : yoy < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                                                                    {yoy !== 0 ? `${yoy > 0 ? '+' : ''}${yoy.toFixed(1)}%` : '-'}
                                                                </td>
                                                            </tr>
                                                            {/* Expanded Customer Rows */}
                                                            {isExpanded && g.names.map(n => {
                                                                const nPrevVal = prevYear ? (n.nameYears[prevYear]?.val || 0) : 0;
                                                                const nCurrVal = n.nameYears[currYear]?.val || 0;
                                                                const nYoy = nPrevVal > 0 ? ((nCurrVal - nPrevVal) / nPrevVal) * 100 : 0;
                                                                
                                                                return (
                                                                    <tr key={n.name} className="hover:bg-slate-50 transition-colors group">
                                                                        <td className="p-2 border-b border-r border-gray-50 bg-white sticky left-0 z-10 pl-8 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50">
                                                                            <span className="text-xs text-gray-600 truncate block max-w-[200px]" title={n.name}>{n.name}</span>
                                                                        </td>
                                                                        {salesData.years.map(y => (
                                                                            <React.Fragment key={`${n.name}-${y}`}>
                                                                                {expandedCols.has(y) && salesData.monthsOrder.map(m => {
                                                                                    const cell = n.years[y]?.[m];
                                                                                    return (
                                                                                        <td key={m} className="p-2 border-b border-r border-gray-50 text-[10px] text-center text-gray-500">
                                                                                            {cell?.qty > 0 ? <div className="flex flex-col"><span className="font-medium text-gray-600">{cell.qty}</span><span className="text-[8px] text-gray-400">{formatLargeValue(cell.val, true)}</span></div> : '-'}
                                                                                        </td>
                                                                                    );
                                                                                })}
                                                                                <td className="p-2 border-b border-r border-gray-50 text-[11px] text-right text-gray-600">{n.nameYears[y]?.qty?.toLocaleString() || '-'}</td>
                                                                                <td className="p-2 border-b border-r border-gray-50 text-[11px] text-right text-gray-600">{formatLargeValue(n.nameYears[y]?.val)}</td>
                                                                            </React.Fragment>
                                                                        ))}
                                                                        <td className="p-2 border-b border-r border-gray-50 text-[11px] font-medium text-right text-gray-700">{n.nameQty.toLocaleString()}</td>
                                                                        <td className="p-2 border-b border-r border-gray-50 text-[11px] font-medium text-right text-gray-700">{formatLargeValue(n.nameVal)}</td>
                                                                        <td className="p-2 border-b border-r border-gray-50 text-[10px] font-medium text-right text-gray-500">{((n.nameVal / salesData.totalVal) * 100).toFixed(1)}%</td>
                                                                        <td className={`p-2 border-b border-gray-50 text-[10px] font-medium text-right ${nYoy > 0 ? 'text-emerald-500' : nYoy < 0 ? 'text-rose-500' : 'text-gray-400'}`}>
                                                                            {nYoy !== 0 ? `${nYoy > 0 ? '+' : ''}${nYoy.toFixed(1)}%` : '-'}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {salesData.grouped.length === 0 && (
                                                    <tr><td colSpan={100} className="p-8 text-center text-gray-500 italic">No sales data found for this part.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {activeTab === 'stock' && stockMetrics && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">Current Stock</p>
                                            <p className="text-2xl font-black text-blue-700">{stockMetrics.currentStock.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Open SO (Due + Sch)</p>
                                            <p className="text-2xl font-black text-amber-700">{stockMetrics.soDue.toLocaleString()} <span className="text-sm text-amber-500">+ {stockMetrics.soSch.toLocaleString()}</span></p>
                                        </div>
                                        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                                            <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-1">Open PO (Due + Sch)</p>
                                            <p className="text-2xl font-black text-purple-700">{stockMetrics.poDue.toLocaleString()} <span className="text-sm text-purple-500">+ {stockMetrics.poSch.toLocaleString()}</span></p>
                                        </div>
                                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Calculated Stock</p>
                                            <p className="text-2xl font-black text-emerald-700">{stockMetrics.stockCalculated.toLocaleString()}</p>
                                        </div>

                                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Net Qty (Stock - Due SO)</p>
                                            <p className="text-2xl font-black text-gray-700">{stockMetrics.netQty.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Avg 12M Sales</p>
                                            <p className="text-2xl font-black text-gray-700">{stockMetrics.avg12mQty.toLocaleString(undefined, {maximumFractionDigits:1})}</p>
                                        </div>
                                        
                                        <div className="col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Thresholds (Min / Reorder / Max)</p>
                                                    <p className="text-xl font-black text-slate-700">
                                                        {stockMetrics.min.toLocaleString()} / <span className="text-amber-600">{stockMetrics.re.toLocaleString()}</span> / {stockMetrics.max.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className={`px-4 py-2 rounded-xl border ${stockMetrics.statusColor}`}>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1">System Status</p>
                                                    <p className="text-sm font-black">{stockMetrics.status}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Req. for Max Stock</p>
                                                    <p className="text-lg font-bold text-slate-600">{Math.max(0, stockMetrics.max - stockMetrics.netQty).toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">Balance to Book (vs PO)</p>
                                                    <p className={`text-lg font-black ${Math.max(0, (stockMetrics.max - stockMetrics.netQty) - stockMetrics.totalOpenPO) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {Math.max(0, (stockMetrics.max - stockMetrics.netQty) - stockMetrics.totalOpenPO).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side: Charts */}
                        <div className="w-full xl:w-[45%] flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                            {activeTab === 'stock' && chartData && stockMetrics ? (
                                <>
                                    <div className="bg-white border border-gray-200 rounded-3xl shadow-sm flex flex-col overflow-hidden p-4 flex-shrink-0">
                                       <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest mb-0 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-indigo-500"/> Stock Projection</h3>
                                       <div className="h-[250px] w-full mt-1">
                                           <Chart options={chartData.stockChart} series={chartData.stockSeries} type="line" height="100%" />
                                       </div>
                                       {stockMetrics.currentStock < stockMetrics.min && (
                                            <div className="mt-2 p-2 bg-rose-500 rounded-xl border border-rose-600 flex items-center justify-center gap-3 animate-pulse shadow-sm">
                                                <AlertTriangle className="w-5 h-5 text-white flex-shrink-0 animate-bounce" />
                                                <div className="flex items-center gap-3">
                                                    <p className="text-xs font-black text-white uppercase tracking-widest drop-shadow-sm">EMERGENCY TO BOOK</p>
                                                    <p className="text-[10px] text-rose-100 font-medium drop-shadow-sm">Qty to book: <b className="text-white text-xs bg-rose-600/50 px-1.5 py-0.5 rounded ml-1">{(stockMetrics.max - stockMetrics.netQty).toLocaleString()}</b></p>
                                                </div>
                                            </div>
                                       )}
                                       {stockMetrics.currentStock >= stockMetrics.min && stockMetrics.currentStock < stockMetrics.re && (
                                            <div className="mt-2 p-2 bg-amber-500 rounded-xl border border-amber-600 flex items-center justify-center gap-3 shadow-sm">
                                                <AlertCircle className="w-5 h-5 text-white flex-shrink-0 animate-bounce" />
                                                <div className="flex items-center gap-3">
                                                    <p className="text-xs font-black text-white uppercase tracking-widest drop-shadow-sm">INDICATION TO BOOK</p>
                                                    <p className="text-[10px] text-amber-100 font-medium drop-shadow-sm">Suggested Qty: <b className="text-white text-xs bg-amber-600/50 px-1.5 py-0.5 rounded ml-1">{(stockMetrics.max - stockMetrics.netQty).toLocaleString()}</b></p>
                                                </div>
                                            </div>
                                       )}
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-3xl shadow-sm flex flex-col overflow-hidden p-4 flex-shrink-0">
                                       <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500"/> YoY Sales Value</h3>
                                       <div className="h-[180px] w-full">
                                           <Chart options={chartData.yoyChart} series={chartData.yoySeries} type="bar" height="100%" />
                                       </div>
                                    </div>
                                </>
                            ) : chartData ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
                                        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-4">
                                            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest mb-2 text-center">Current Year Consumption</h3>
                                            <div className="h-[220px]">
                                                <Chart options={chartData.pieChart} series={chartData.pieSeries} type="donut" height="100%" />
                                            </div>
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-4">
                                            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest mb-2 text-center">Top 5 Customer Groups</h3>
                                            <div className="h-[220px]">
                                                <Chart options={chartData.top5Chart} series={chartData.top5Series} type="bar" height="100%" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-4 flex-shrink-0">
                                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest mb-2">Consumption Pattern (Trend)</h3>
                                        <div className="h-[250px]">
                                            <Chart options={chartData.areaChart} series={chartData.areaSeries} type="area" height="100%" />
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PartAnalysisView;
