
import React, { useState, useMemo } from 'react';
import { SalesReportItem, Material, ClosingStockItem } from '../types';
import {
    TrendingUp,
    Package,
    RefreshCw,
    BarChart3,
    AlertTriangle,
    LineChart,
    ChevronRight,
    Calendar,
    Filter,
    FileDown,
    Info,
    Users
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
    if (month >= 3) {
        return `FY ${year}-${(year + 1).toString().slice(-2)}`;
    } else {
        return `FY ${year - 1}-${year.toString().slice(-2)}`;
    }
};

const SupplyChainAnalyticsView: React.FC<AnalyticsProps> = ({ salesReportItems, materials, closingStock }) => {
    const [activeTab, setActiveTab] = useState<'movement' | 'strategy' | 'planning' | 'insights'>('movement');

    const analyticsData = useMemo(() => {
        const materialMap = new Map<string, any>();
        const masterMap = new Map(materials.map(m => [m.description.trim().toLowerCase(), m]));
        const now = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(now.getMonth() - 12);
        const twentyFourMonthsAgo = new Date();
        twentyFourMonthsAgo.setMonth(now.getMonth() - 24);

        salesReportItems.forEach(item => {
            const key = item.particulars.trim();
            const lowerKey = key.toLowerCase();
            if (!materialMap.has(lowerKey)) {
                materialMap.set(lowerKey, {
                    description: key,
                    group: masterMap.get(lowerKey)?.materialGroup || 'Uncategorized',
                    sales: [],
                    distinctCustomers24m: new Set(),
                    fySales: {},
                    monthlySales: {}, // { '2024-04': qty }
                    monthlyCustomers: {}, // { '2024-04': Set of customers }
                });
            }
            const mData = materialMap.get(lowerKey);
            const d = new Date(item.date);
            const fy = getFY(item.date);
            const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;

            mData.sales.push(item);
            if (d >= twentyFourMonthsAgo) mData.distinctCustomers24m.add(item.customerName);

            mData.fySales[fy] = (mData.fySales[fy] || 0) + (item.quantity || 0);
            mData.monthlySales[monthKey] = (mData.monthlySales[monthKey] || 0) + (item.quantity || 0);

            if (!mData.monthlyCustomers[monthKey]) mData.monthlyCustomers[monthKey] = new Set();
            mData.monthlyCustomers[monthKey].add(item.customerName);
        });

        const results = Array.from(materialMap.values()).map(m => {
            const months = Object.keys(m.monthlySales);
            const totalQty = Object.values(m.monthlySales).reduce((a: any, b: any) => a + b, 0) as number;
            const avgMonthlyQty = months.length > 0 ? totalQty / months.length : 0;

            const regularSales = m.sales.filter((s: SalesReportItem) => s.quantity <= 3 * avgMonthlyQty);
            const regularTotalQty = regularSales.reduce((a: any, b: SalesReportItem) => a + (b.quantity || 0), 0) as number;

            const currentFY = getFY(now);
            const currentFYSales = regularSales.filter((s: SalesReportItem) => getFY(s.date) === currentFY);
            const activeMonthsInFY = new Set(currentFYSales.map((s: SalesReportItem) => new Date(s.date).getMonth())).size;

            let movementClass = 'Non-Moving';
            const lastSaleDate = m.sales.reduce((max: Date, s: SalesReportItem) => {
                const d = new Date(s.date);
                return d > max ? d : max;
            }, new Date(0));

            if (lastSaleDate < twelveMonthsAgo) {
                movementClass = 'Non-Moving';
            } else if (activeMonthsInFY >= 9) {
                movementClass = 'Fast Runner';
            } else if (activeMonthsInFY >= 3) {
                movementClass = 'Slow Runner';
            }

            const customerCount = m.distinctCustomers24m.size;
            let stockStrategy = 'Made to Order';
            if (customerCount > 10) stockStrategy = 'General Stock';
            else if (customerCount >= 5) stockStrategy = 'Against Customer Order';

            // Monthly Customer Count Mapping
            const monthWiseCustCount = Object.keys(m.monthlyCustomers).sort().reverse().slice(0, 12).map(mon => ({
                month: mon,
                count: m.monthlyCustomers[mon].size
            }));

            const last3FYs = [];
            for (let i = 0; i < 3; i++) {
                const year = now.getFullYear() - i;
                const fy = getFY(new Date(year, 3, 1));
                last3FYs.push(fy);
            }

            return {
                ...m,
                avgMonthlyQty,
                regularTotalQty,
                activeMonthsInFY,
                movementClass,
                stockStrategy,
                customerCount,
                lastSaleDate,
                fyMetrics: {
                    [last3FYs[0]]: m.fySales[last3FYs[0]] || 0,
                    [last3FYs[1]]: m.fySales[last3FYs[1]] || 0,
                    [last3FYs[2]]: m.fySales[last3FYs[2]] || 0
                },
                monthWiseCustCount,
                forecast: ((m.fySales[last3FYs[0]] || 0) * 0.5 + (m.fySales[last3FYs[1]] || 0) * 0.3 + (m.fySales[last3FYs[2]] || 0) * 0.2) / 12,
                peakQty: Math.max(...(Object.values(m.monthlySales) as number[]), 0),
                recommendedStock: (((m.fySales[last3FYs[0]] || 0) * 0.5 + (m.fySales[last3FYs[1]] || 0) * 0.3 + (m.fySales[last3FYs[2]] || 0) * 0.2) / 12) * 1.5
            };
        });

        return results.sort((a, b) => b.regularTotalQty - a.regularTotalQty);
    }, [salesReportItems, materials]);

    const handleExport = () => {
        const ws = utils.json_to_sheet(analyticsData.map(d => ({
            "Group": d.group,
            "Material": d.description,
            "Movement": d.movementClass,
            "Strategy": d.stockStrategy,
            "Monthly Forecast": d.forecast.toFixed(2),
            "Rec. Stock": d.recommendedStock.toFixed(2),
            "Cust Count (Last 24M)": d.customerCount
        })));
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Analytics");
        writeFile(wb, "Siddhi_SC_Planning.xlsx");
    };

    const getInsights = useMemo(() => {
        const insights = [];
        const wronglyStocked = analyticsData.filter(d => d.stockStrategy === 'Made to Order' && d.movementClass === 'Fast Runner');
        if (wronglyStocked.length > 0) insights.push({ title: "Wrongly stocked (Should be MTO)", count: wronglyStocked.length, items: wronglyStocked.slice(0, 3).map(i => i.description), type: 'warning' });

        const declining = analyticsData.filter(d => {
            const keys = Object.keys(d.fyMetrics);
            return d.movementClass === 'Fast Runner' && d.fyMetrics[keys[0]] < d.fyMetrics[keys[1]];
        });
        if (declining.length > 0) insights.push({ title: "Fast Runners: Declining Trend", count: declining.length, items: declining.slice(0, 3).map(i => i.description), type: 'danger' });

        const warehouseSpace = analyticsData.filter(d => d.movementClass === 'Slow Runner' || d.movementClass === 'Non-Moving');
        if (warehouseSpace.length > 0) insights.push({ title: "Slow movers using space", count: warehouseSpace.length, items: warehouseSpace.slice(0, 3).map(i => i.description), type: 'info' });

        return insights;
    }, [analyticsData]);

    return (
        <div className="flex flex-col h-full gap-4 p-4 lg:p-6 bg-gray-50/50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-xl shadow-indigo-200">
                        <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Supply Chain Planning</h1>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Advanced Inventory Analytics & Forecasting</p>
                    </div>
                </div>
                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-black shadow-lg shadow-green-100 hover:bg-green-700 transition-all">
                    <FileDown className="w-4 h-4" /> Export Report
                </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-x-auto whitespace-nowrap">
                <TabButton active={activeTab === 'movement'} onClick={() => setActiveTab('movement')} icon={RefreshCw} label="Movement Analysis" />
                <TabButton active={activeTab === 'strategy'} onClick={() => setActiveTab('strategy')} icon={TrendingUp} label="Stock Strategy" />
                <TabButton active={activeTab === 'planning'} onClick={() => setActiveTab('planning')} icon={LineChart} label="Planning & Forecast" />
                <TabButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={AlertTriangle} label="Management Insights" />
            </div>

            <div className="flex-1 min-h-0 bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden flex flex-col">
                {activeTab === 'movement' && <MovementTable data={analyticsData} />}
                {activeTab === 'strategy' && <StrategyTable data={analyticsData} />}
                {activeTab === 'planning' && <PlanningTable data={analyticsData} />}
                {activeTab === 'insights' && <InsightsView insights={getInsights} />}
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
        <Icon className="w-4 h-4" /> {label}
    </button>
);

const MovementTable = ({ data }: { data: any[] }) => (
    <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse table-fixed min-w-[1200px]">
            <thead className="sticky top-0 bg-gray-50 shadow-sm z-10">
                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-4 w-40">Group</th>
                    <th className="px-6 py-4 w-80">Description</th>
                    <th className="px-6 py-4 w-24 text-center">Active Mos</th>
                    <th className="px-6 py-4 w-64">Customers (Monthwise Count)</th>
                    <th className="px-6 py-4 w-28 text-center">Project Order?</th>
                    <th className="px-6 py-4 w-32">Classification</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
                {data.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-6 py-4">
                            <span className="text-[10px] font-black py-1 px-2 bg-gray-100 text-gray-600 rounded-md uppercase truncate block">
                                {item.group}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <div>
                                <p className="text-xs font-black text-gray-800 line-clamp-2 leading-tight uppercase">{item.description}</p>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                {item.activeMonthsInFY}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                                {item.monthWiseCustCount.map((mc: any, i: number) => (
                                    <div key={i} className="flex flex-col items-center min-w-[40px] bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                                        <span className="text-[8px] font-black text-gray-400 uppercase">{mc.month.split('-')[1]}</span>
                                        <span className="text-[10px] font-bold text-gray-800">{mc.count}</span>
                                    </div>
                                ))}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${item.avgMonthlyQty > 0 && item.regularTotalQty < item.avgMonthlyQty * 12 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                                {item.avgMonthlyQty > 0 && item.regularTotalQty < item.avgMonthlyQty * 12 ? 'Yes' : 'No'}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight block text-center ${item.movementClass === 'Fast Runner' ? 'bg-green-50 text-green-700 border border-green-200' :
                                    item.movementClass === 'Slow Runner' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                        'bg-gray-50 text-gray-400 border border-gray-200'
                                }`}>
                                {item.movementClass}
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const StrategyTable = ({ data }: { data: any[] }) => (
    <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-50 shadow-sm z-10">
                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Group</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Cust Count (24M)</th>
                    <th className="px-6 py-4">Strategy</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
                {data.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">{item.group}</td>
                        <td className="px-6 py-4 text-xs font-bold text-gray-800 uppercase">{item.description}</td>
                        <td className="px-6 py-4 text-xs font-mono font-bold text-blue-600">
                            <div className="flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" />
                                {item.customerCount} Customers
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.stockStrategy === 'General Stock' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                    item.stockStrategy === 'Against Customer Order' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                        'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}>
                                {item.stockStrategy}
                            </span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const PlanningTable = ({ data }: { data: any[] }) => {
    const fyKeys = Object.keys(data[0]?.fyMetrics || {});
    return (
        <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gray-50 shadow-sm z-10">
                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Group / Description</th>
                        {fyKeys.map(k => <th key={k} className="px-6 py-4">{k}</th>)}
                        <th className="px-6 py-4 bg-indigo-50/50 text-indigo-700">Forecast</th>
                        <th className="px-6 py-4 bg-green-50/50 text-green-700">Rec. Stock</th>
                        <th className="px-6 py-4">Procurement</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {data.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                                <span className="text-[8px] font-black text-gray-400 block uppercase mb-1">{item.group}</span>
                                <p className="text-xs font-bold text-gray-800 uppercase line-clamp-1">{item.description}</p>
                            </td>
                            {fyKeys.map(k => <td key={k} className="px-6 py-4 text-xs font-mono text-gray-500">{Math.round(item.fyMetrics[k]) || '-'}</td>)}
                            <td className="px-6 py-4 bg-indigo-50/30 text-indigo-700 font-black text-xs">{item.forecast.toFixed(2)}</td>
                            <td className="px-6 py-4 bg-green-50/30 text-green-700 font-black text-xs">{item.recommendedStock.toFixed(2)}</td>
                            <td className="px-6 py-4 text-xs">
                                <span className={`px-2 py-1 rounded-lg font-black uppercase text-[10px] ${item.stockStrategy === 'General Stock' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'}`}>
                                    {item.stockStrategy === 'General Stock' ? 'Stock Purchase' : item.stockStrategy}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const InsightsView = ({ insights }: { insights: any[] }) => (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-auto">
        {insights.map((insight, idx) => (
            <div key={idx} className={`p-6 rounded-[2rem] border-2 flex flex-col gap-4 transition-all hover:scale-[1.02] ${insight.type === 'warning' ? 'bg-orange-50/50 border-orange-100' : insight.type === 'danger' ? 'bg-red-50/50 border-red-100' : 'bg-blue-50/50 border-blue-100'}`}>
                <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-2xl ${insight.type === 'warning' ? 'bg-orange-100 text-orange-600' : insight.type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}><LineChart className="w-6 h-6" /></div>
                    <span className="text-2xl font-black text-gray-900">{insight.count}</span>
                </div>
                <h3 className="text-sm font-black text-gray-900 leading-tight mb-2 uppercase tracking-tighter">{insight.title}</h3>
                <div className="space-y-2">
                    {insight.items.map((it: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-gray-600 truncate"><ChevronRight className="w-3 h-3 text-gray-300" /> {it}</div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

export default SupplyChainAnalyticsView;
