
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
    Users,
    Grid
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
        // Case-insensitive lookup map for material details
        const masterMap = new Map();
        materials.forEach(m => {
            const desc = m.description.trim().toLowerCase();
            // Store the group and any other relevant fields
            masterMap.set(desc, {
                group: m.materialGroup,
                partNo: m.partNo,
                make: m.make
            });
        });

        const now = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(now.getMonth() - 12);
        const twentyFourMonthsAgo = new Date();
        twentyFourMonthsAgo.setMonth(now.getMonth() - 24);

        salesReportItems.forEach(item => {
            const key = item.particulars.trim();
            const lowerKey = key.toLowerCase();

            if (!materialMap.has(lowerKey)) {
                const masterInfo = masterMap.get(lowerKey);
                materialMap.set(lowerKey, {
                    description: key,
                    group: masterInfo?.group || 'Uncategorized',
                    make: masterInfo?.make || 'N/A',
                    sales: [],
                    distinctCustomers24m: new Set(),
                    fySales: {},
                    monthlySales: {},
                    monthlyCustomers: {},
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
            "Make": d.make,
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
        <div className="flex flex-col h-full gap-2 p-3 bg-[#f3f4f6]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-3 border border-gray-200 shadow-sm rounded-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-700 rounded-lg text-white">
                        <Grid className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-gray-900 tracking-tight uppercase leading-tight">Supply Chain Master Sheet</h1>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Excel-Style Analytical View</p>
                    </div>
                </div>
                <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-green-700 text-white rounded text-xs font-bold hover:bg-green-800 transition-all border border-green-900 overflow-hidden shadow-sm">
                    <FileDown className="w-4 h-4" /> EXPORT EXCEL
                </button>
            </div>

            <div className="flex items-center bg-white border border-gray-200 rounded-md p-0.5 overflow-x-auto whitespace-nowrap scrollbar-hide">
                <ExcelTab active={activeTab === 'movement'} onClick={() => setActiveTab('movement')} label="Movement Analysis" />
                <ExcelTab active={activeTab === 'strategy'} onClick={() => setActiveTab('strategy')} label="Stock Strategy" />
                <ExcelTab active={activeTab === 'planning'} onClick={() => setActiveTab('planning')} label="Planning & Forecast" />
                <ExcelTab active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} label="Insights" />
            </div>

            <div className="flex-1 min-h-0 bg-white border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                {activeTab === 'movement' && <ExcelTable data={analyticsData} type="movement" />}
                {activeTab === 'strategy' && <ExcelTable data={analyticsData} type="strategy" />}
                {activeTab === 'planning' && <ExcelTable data={analyticsData} type="planning" />}
                {activeTab === 'insights' && <InsightsView insights={getInsights} />}
            </div>

            {/* Excel Status Bar */}
            <div className="bg-green-700 text-white px-3 py-1 text-[10px] font-bold flex justify-between items-center rounded-b-md">
                <div className="flex gap-4">
                    <span>READY</span>
                    <span>ITEMS: {analyticsData.length}</span>
                </div>
                <div className="flex gap-4 uppercase">
                    <span>{activeTab} VIEW</span>
                    <span>100% SCALE</span>
                </div>
            </div>
        </div>
    );
};

const ExcelTab = ({ active, onClick, label }: any) => (
    <button
        onClick={onClick}
        className={`px-4 py-1.5 text-[11px] font-bold uppercase transition-all border-r border-gray-100 ${active ? 'bg-[#f3f4f6] text-green-800 border-b-2 border-b-green-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
    >
        {label}
    </button>
);

const ExcelTable = ({ data, type }: { data: any[], type: string }) => {
    const fyKeys = type === 'planning' ? Object.keys(data[0]?.fyMetrics || {}) : [];

    return (
        <div className="overflow-auto flex-1 scrollbar-thin">
            <table className="w-full text-left border-collapse table-auto min-w-max border-r border-b border-gray-200">
                <thead className="sticky top-0 bg-[#f8f9fa] z-20">
                    <tr className="text-[10px] font-bold text-gray-600 uppercase">
                        <th className="border border-gray-300 px-3 py-2 bg-gray-100 w-10 text-center">#</th>
                        <th className="border border-gray-300 px-3 py-2 hover:bg-gray-200 cursor-pointer">Group</th>
                        <th className="border border-gray-300 px-3 py-2 hover:bg-gray-200 cursor-pointer min-w-[300px]">Description</th>

                        {type === 'movement' && (
                            <>
                                <th className="border border-gray-300 px-3 py-2 text-center">Mo. Act.</th>
                                <th className="border border-gray-300 px-2 py-1 text-center min-w-[350px]">Customer Matrix (12M)</th>
                                <th className="border border-gray-300 px-3 py-2 text-center">Project Order</th>
                                <th className="border border-gray-300 px-3 py-2">Classification</th>
                            </>
                        )}

                        {type === 'strategy' && (
                            <>
                                <th className="border border-gray-300 px-3 py-2 text-center">Cust (24M)</th>
                                <th className="border border-gray-300 px-3 py-2">Last Sale</th>
                                <th className="border border-gray-300 px-3 py-2">Stock Strategy</th>
                            </>
                        )}

                        {type === 'planning' && (
                            <>
                                {fyKeys.map(k => <th key={k} className="border border-gray-300 px-3 py-2 text-right">{k}</th>)}
                                <th className="border border-gray-300 px-3 py-2 text-right bg-blue-50">Weight Forecast</th>
                                <th className="border border-gray-300 px-3 py-2 text-right bg-green-50">Rec. Stock</th>
                                <th className="border border-gray-300 px-3 py-2">Sugg. Procurement</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody className="text-[11px]">
                    {data.map((item, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 even:bg-gray-50/30 transition-colors">
                            <td className="border border-gray-200 px-2 py-1 text-center text-gray-400 font-mono">{idx + 1}</td>
                            <td className="border border-gray-200 px-3 py-1 font-bold text-gray-600 uppercase">{item.group}</td>
                            <td className="border border-gray-200 px-3 py-1 font-bold text-gray-900 uppercase truncate max-w-[400px]" title={item.description}>{item.description}</td>

                            {type === 'movement' && (
                                <>
                                    <td className="border border-gray-200 px-3 py-1 text-center font-bold text-indigo-700">{item.activeMonthsInFY}</td>
                                    <td className="border border-gray-200 px-2 py-1">
                                        <div className="flex gap-[2px]">
                                            {item.monthWiseCustCount.map((mc: any, i: number) => (
                                                <div key={i} className="flex flex-col items-center min-w-[28px] border-x border-gray-100 bg-white" title={`${mc.month}: ${mc.count} Customers`}>
                                                    <span className="text-[7px] font-bold text-gray-400">{mc.month.split('-')[1]}</span>
                                                    <span className={`text-[9px] font-black ${mc.count > 0 ? 'text-green-700' : 'text-gray-300'}`}>{mc.count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="border border-gray-200 px-3 py-1 text-center">
                                        <span className={item.avgMonthlyQty > 0 && item.regularTotalQty < item.avgMonthlyQty * 12 ? 'text-orange-600' : 'text-gray-300'}>
                                            {item.avgMonthlyQty > 0 && item.regularTotalQty < item.avgMonthlyQty * 12 ? '• PROJECT' : '• REGULAR'}
                                        </span>
                                    </td>
                                    <td className="border border-gray-200 px-3 py-1 font-black">
                                        <span className={
                                            item.movementClass === 'Fast Runner' ? 'text-green-600' :
                                                item.movementClass === 'Slow Runner' ? 'text-amber-600' : 'text-gray-400'
                                        }>{item.movementClass}</span>
                                    </td>
                                </>
                            )}

                            {type === 'strategy' && (
                                <>
                                    <td className="border border-gray-200 px-3 py-1 text-center font-bold text-blue-700">{item.customerCount}</td>
                                    <td className="border border-gray-200 px-3 py-1 text-gray-500">{new Date(item.lastSaleDate).toLocaleDateString()}</td>
                                    <td className="border border-gray-200 px-3 py-1 font-bold text-purple-700">{item.stockStrategy}</td>
                                </>
                            )}

                            {type === 'planning' && (
                                <>
                                    {fyKeys.map(k => <td key={k} className="border border-gray-200 px-3 py-1 text-right text-gray-500 font-mono">{Math.round(item.fyMetrics[k]) || 0}</td>)}
                                    <td className="border border-gray-200 px-3 py-1 text-right font-black text-blue-700 bg-blue-50/30">{item.forecast.toFixed(2)}</td>
                                    <td className="border border-gray-200 px-3 py-1 text-right font-black text-green-700 bg-green-50/30">{item.recommendedStock.toFixed(2)}</td>
                                    <td className="border border-gray-200 px-3 py-1">
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                                            {item.stockStrategy === 'General Stock' ? 'STOCK PURCHASE' : 'ORDER LINKED'}
                                        </span>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const InsightsView = ({ insights }: { insights: any[] }) => (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto bg-gray-50">
        {insights.map((insight, idx) => (
            <div key={idx} className={`p-4 border bg-white flex flex-col gap-3 shadow-sm ${insight.type === 'warning' ? 'border-l-4 border-l-orange-500' :
                    insight.type === 'danger' ? 'border-l-4 border-l-red-500' :
                        'border-l-4 border-l-blue-500'
                }`}>
                <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-xs font-black text-gray-700 uppercase tracking-tighter">{insight.title}</h3>
                    <span className="text-xl font-black text-gray-900">{insight.count}</span>
                </div>
                <div className="space-y-1">
                    {insight.items.map((it: string, i: number) => (
                        <div key={i} className="text-[10px] font-bold text-gray-500 truncate uppercase flex items-center gap-1">
                            <span className="w-1 h-1 bg-gray-300 rounded-full" /> {it}
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

export default SupplyChainAnalyticsView;
