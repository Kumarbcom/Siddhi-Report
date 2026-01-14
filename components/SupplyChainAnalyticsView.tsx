
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
    Info
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
        const now = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(now.getMonth() - 12);
        const twentyFourMonthsAgo = new Date();
        twentyFourMonthsAgo.setMonth(now.getMonth() - 24);

        salesReportItems.forEach(item => {
            const key = item.particulars.trim();
            if (!materialMap.has(key)) {
                materialMap.set(key, {
                    description: key,
                    sales: [],
                    distinctCustomers24m: new Set(),
                    fySales: {},
                    monthlySales: {},
                });
            }
            const mData = materialMap.get(key);
            const d = new Date(item.date);
            const fy = getFY(item.date);
            const monthKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;

            mData.sales.push(item);
            if (d >= twentyFourMonthsAgo) mData.distinctCustomers24m.add(item.customerName);
            mData.fySales[fy] = (mData.fySales[fy] || 0) + (item.quantity || 0);
            mData.monthlySales[monthKey] = (mData.monthlySales[monthKey] || 0) + (item.quantity || 0);
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

            const last3FYs = [];
            for (let i = 0; i < 3; i++) {
                const year = now.getFullYear() - i;
                const fy = getFY(new Date(year, 3, 1));
                last3FYs.push(fy);
            }

            const fy_0 = m.fySales[last3FYs[0]] || 0;
            const fy_1 = m.fySales[last3FYs[1]] || 0;
            const fy_2 = m.fySales[last3FYs[2]] || 0;

            const forecast = (fy_0 * 0.5) + (fy_1 * 0.3) + (fy_2 * 0.2);
            const monthlyForecast = forecast / 12;

            return {
                ...m,
                avgMonthlyQty,
                regularTotalQty,
                activeMonthsInFY,
                movementClass,
                stockStrategy,
                customerCount,
                lastSaleDate,
                fyMetrics: { [last3FYs[0]]: fy_0, [last3FYs[1]]: fy_1, [last3FYs[2]]: fy_2 },
                forecast: monthlyForecast,
                peakQty: Math.max(...(Object.values(m.monthlySales) as number[]), 0),
                recommendedStock: monthlyForecast * 1.5,
                reorderQty: monthlyForecast
            };
        });

        const sortedByQty = [...results].sort((a, b) => b.regularTotalQty - a.regularTotalQty);
        const globalTotalQty = sortedByQty.reduce((acc, cur) => acc + cur.regularTotalQty, 0);
        let cumulative = 0;
        sortedByQty.forEach(item => {
            cumulative += item.regularTotalQty;
            if (item.movementClass === 'Fast Runner' && (cumulative / globalTotalQty > 0.3)) {
                // Optionally demote here if strict top 30% is desired, but usually 
                // "Fast Runner" implies high volume. We'll leave it as is for now.
            }
        });

        return results;
    }, [salesReportItems]);

    const handleExport = () => {
        const ws = utils.json_to_sheet(analyticsData.map(d => ({
            "Material": d.description,
            "FY Qty": d.fyMetrics[Object.keys(d.fyMetrics)[0]],
            "Movement": d.movementClass,
            "Strategy": d.stockStrategy,
            "Monthly Forecast": d.forecast.toFixed(2),
            "Rec. Stock": d.recommendedStock.toFixed(2)
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
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Supply Chain Planning</h1>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Advanced Inventory Analytics & Forecasting</p>
                </div>
                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-black shadow-lg shadow-green-100 hover:bg-green-700 transition-all">
                    <FileDown className="w-4 h-4" /> Export Report
                </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-x-auto whitespace-nowrap">
                <TabButton active={activeTab === 'movement'} onClick={() => setActiveTab('movement')} icon={RefreshCw} label="Movement" />
                <TabButton active={activeTab === 'strategy'} onClick={() => setActiveTab('strategy')} icon={TrendingUp} label="Strategy" />
                <TabButton active={activeTab === 'planning'} onClick={() => setActiveTab('planning')} icon={BarChart3} label="Planning" />
                <TabButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={AlertTriangle} label="Insights" />
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
        <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-50/90 backdrop-blur-sm shadow-sm z-10">
                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Active Mos</th>
                    <th className="px-6 py-4">Project?</th>
                    <th className="px-6 py-4">Class</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
                {data.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-gray-800">{item.description}</td>
                        <td className="px-6 py-4 text-xs font-mono">{item.activeMonthsInFY}</td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${item.avgMonthlyQty > 0 && item.regularTotalQty < item.avgMonthlyQty * 12 ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>{item.avgMonthlyQty > 0 && item.regularTotalQty < item.avgMonthlyQty * 12 ? 'Yes' : 'No'}</span>
                        </td>
                        <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.movementClass === 'Fast Runner' ? 'bg-green-50 text-green-700 border border-green-200' : item.movementClass === 'Slow Runner' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>{item.movementClass}</span></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const StrategyTable = ({ data }: { data: any[] }) => (
    <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-50/90 backdrop-blur-sm shadow-sm z-10">
                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Cust Count</th>
                    <th className="px-6 py-4">Strategy</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
                {data.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-gray-800">{item.description}</td>
                        <td className="px-6 py-4 text-xs font-mono">{item.customerCount}</td>
                        <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${item.stockStrategy === 'General Stock' ? 'bg-blue-50 text-blue-700 border border-blue-200' : item.stockStrategy === 'Against Customer Order' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>{item.stockStrategy}</span></td>
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
                <thead className="sticky top-0 bg-gray-50/90 backdrop-blur-sm shadow-sm z-10">
                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Description</th>
                        {fyKeys.map(k => <th key={k} className="px-6 py-4">{k}</th>)}
                        <th className="px-6 py-4 bg-indigo-50/50">Forecast</th>
                        <th className="px-6 py-4 bg-green-50/50">Rec. Stock</th>
                        <th className="px-6 py-4">Procurement</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {data.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4 text-xs font-bold text-gray-800">{item.description}</td>
                            {fyKeys.map(k => <td key={k} className="px-6 py-4 text-xs font-mono text-gray-500">{Math.round(item.fyMetrics[k]) || '-'}</td>)}
                            <td className="px-6 py-4 bg-indigo-50/30 text-indigo-700 font-black text-xs">{item.forecast.toFixed(2)}</td>
                            <td className="px-6 py-4 bg-green-50/30 text-green-700 font-black text-xs">{item.recommendedStock.toFixed(2)}</td>
                            <td className="px-6 py-4"><span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${item.stockStrategy === 'General Stock' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'}`}>{item.stockStrategy === 'General Stock' ? 'Stock Purchase' : item.stockStrategy}</span></td>
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
