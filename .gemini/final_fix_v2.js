import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix yoyData (YTD Logic)
const fyViewComment = '// FY view: Use FULL previous year (no YTD filter)';
const newFyLogic = `// FY view: Apply YTD Filter (Same period last year) for YTD Comparison (yoyData)
            // This ensures YTD Comparison matches "Current YTD" vs "Previous YTD"
            const today = new Date();
            const cutoffDate = new Date(today);
            cutoffDate.setFullYear(today.getFullYear() - 1);
            
            data = data.filter(i => i.rawDate <= cutoffDate);
            console.log(\`Applied YTD filter for FY view. Cutoff: \${cutoffDate.toDateString()}. Records: \${data.length}\`);
            `;

if (content.includes(fyViewComment)) {
    content = content.replace(fyViewComment, newFyLogic);
    // Remove the following console log about FULL previous year
    content = content.replace('console.log(`Using FULL previous year for comparison (no YTD filter)`);', '');
}

// 2. Update Label "vs Prev FY" -> "vs Total Prev FY"
content = content.replace(/'vs Prev FY'/g, "'vs Total Prev FY'");

// 3. Replace Customer Content
// We match the start of the customer tab
const customerTabStart = ') : activeSubTab === \'customer\' ? (';
const customerTabEnd = ') : null';

const startIdx = content.lastIndexOf(customerTabStart);
const endIdx = content.lastIndexOf(customerTabEnd);

if (startIdx !== -1 && endIdx !== -1) {
    // Preserve formatting with large string
    const newCustomerParams = `) : activeSubTab === 'customer' ? (
                        <div className="flex flex-col gap-4">
                            {/* Customer Categorization Section */}
                            <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-200 shadow-sm">
                                <h3 className="text-sm font-black text-purple-900 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Customer Categorization Analysis
                                    <span className="text-[10px] font-normal text-purple-600 bg-white px-2 py-0.5 rounded-full">FY 2023-24 to 2025-26</span>
                                </h3>
                                {/* Filter Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                                    <div 
                                        onClick={() => setSelectedCustCategory('ALL')}
                                        className={\`bg-white p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md \${selectedCustCategory === 'ALL' ? 'border-purple-500 ring-2 ring-purple-200' : 'border-purple-200 shadow-sm'}\`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-purple-600 uppercase">Total Customers</p>
                                                <p className="text-2xl font-black text-purple-700">{customerCategorization.totalCustomers}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">Click to view all</p>
                                            </div>
                                            <Users className={\`w-8 h-8 text-purple-500 \${selectedCustCategory === 'ALL' ? 'opacity-100' : 'opacity-20'}\`} />
                                        </div>
                                    </div>
                                    <div 
                                        onClick={() => setSelectedCustCategory('Repeat')}
                                        className={\`bg-white p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md \${selectedCustCategory === 'Repeat' ? 'border-green-500 ring-2 ring-green-200' : 'border-green-200 shadow-sm'}\`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-green-600 uppercase">Repeat Customers</p>
                                                <p className="text-2xl font-black text-green-700">{customerCategorization.totalRepeat}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">Continuous (24-25 & 25-26)</p>
                                            </div>
                                            <RefreshCw className={\`w-8 h-8 text-green-500 \${selectedCustCategory === 'Repeat' ? 'opacity-100' : 'opacity-20'}\`} />
                                        </div>
                                    </div>
                                    <div 
                                        onClick={() => setSelectedCustCategory('Rebuild')}
                                        className={\`bg-white p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md \${selectedCustCategory === 'Rebuild' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-orange-200 shadow-sm'}\`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-orange-600 uppercase">Rebuild Customers</p>
                                                <p className="text-2xl font-black text-orange-700">{customerCategorization.totalRebuild}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">Returned (Gap in 24-25)</p>
                                            </div>
                                            <History className={\`w-8 h-8 text-orange-500 \${selectedCustCategory === 'Rebuild' ? 'opacity-100' : 'opacity-20'}\`} />
                                        </div>
                                    </div>
                                    <div 
                                        onClick={() => setSelectedCustCategory('New')}
                                        className={\`bg-white p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md \${selectedCustCategory === 'New' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-200 shadow-sm'}\`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-blue-600 uppercase">New Customers</p>
                                                <p className="text-2xl font-black text-blue-700">{customerCategorization.totalNew}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">Only in 25-26</p>
                                            </div>
                                            <UserPlus className={\`w-8 h-8 text-blue-500 \${selectedCustCategory === 'New' ? 'opacity-100' : 'opacity-20'}\`} />
                                        </div>
                                    </div>
                                    <div 
                                        onClick={() => setSelectedCustCategory('Lost')}
                                        className={\`bg-white p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md \${selectedCustCategory === 'Lost' ? 'border-red-500 ring-2 ring-red-200' : 'border-red-200 shadow-sm'}\`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-red-600 uppercase">Lost Customers</p>
                                                <p className="text-2xl font-black text-red-700">{customerCategorization.totalLost}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">No sales in 25-26</p>
                                            </div>
                                            <UserMinus className={\`w-8 h-8 text-red-500 \${selectedCustCategory === 'Lost' ? 'opacity-100' : 'opacity-20'}\`} />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-4">
                                    <h4 className="text-[10px] font-black text-gray-700 uppercase mb-2 flex items-center gap-2">
                                        <Layers className="w-3 h-3" /> Group-wise Customer Distribution
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {customerCategorization.groupCounts.map((gc, idx) => (
                                            <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-100">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-[10px] text-gray-700 max-w-[120px] truncate" title={gc.group}>{gc.group}</span>
                                                    <span className="bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-0.5 rounded">Σ {gc.total}</span>
                                                </div>
                                                <div className="flex gap-2 text-[8px] text-gray-500">
                                                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>R:{gc.repeat}</span>
                                                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>Rb:{gc.rebuild}</span>
                                                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>N:{gc.new}</span>
                                                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>L:{gc.lost}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                                                    <th className="py-2 px-2 border-r border-gray-200">Category</th>
                                                    <th className="py-2 px-2 border-r border-gray-200">Group</th>
                                                    <th className="py-2 px-3 border-r border-gray-200">Customer Name</th>
                                                    <th className="py-2 px-2 border-r border-gray-200 text-right text-gray-400">23-24 Qty</th>
                                                    <th className="py-2 px-2 border-r border-gray-200 text-right text-gray-400">23-24 Val</th>
                                                    <th className="py-2 px-2 border-r border-gray-200 text-right text-gray-400">24-25 Qty</th>
                                                    <th className="py-2 px-2 border-r border-gray-200 text-right text-gray-400">24-25 Val</th>
                                                    <th className="py-2 px-2 border-r border-gray-200 text-right text-blue-600 bg-blue-50/50">25-26 Qty</th>
                                                    <th className="py-2 px-2 border-r border-gray-200 text-right text-blue-700 bg-blue-50/50">25-26 Val</th>
                                                    <th className="py-2 px-2 text-right">YTD Comparison</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 text-[10px]">
                                                {[...customerCategorization.repeatCustomers, ...customerCategorization.rebuildCustomers, ...customerCategorization.newCustomers, ...customerCategorization.lostCustomers]
                                                    .filter(c => selectedCustCategory === 'ALL' || c.category === selectedCustCategory)
                                                    .map((cust, idx) => (
                                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="py-1 px-2 border border-gray-200">
                                                            <span className={\`px-2 py-0.5 rounded-full text-[8px] font-bold \${cust.category === 'Repeat' ? 'bg-green-100 text-green-700' : cust.category === 'Rebuild' ? 'bg-orange-100 text-orange-700' : cust.category === 'Lost' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}\`}>{cust.category}</span>
                                                        </td>
                                                        <td className="py-1 px-2 border border-gray-200 text-gray-600 text-[9px] font-bold">{cust.group}</td>
                                                        <td className="py-1 px-3 border border-gray-200 font-bold text-gray-900">{cust.customerName}</td>
                                                        <td className="py-1 px-2 border border-gray-200 text-right text-gray-600">{cust.fy202324Qty.toLocaleString()}</td>
                                                        <td className="py-1 px-2 border border-gray-200 text-right font-bold text-gray-700">{formatLargeValue(cust.fy202324Value, true)}</td>
                                                        <td className="py-1 px-2 border border-gray-200 text-right text-gray-600">{cust.fy202425Qty.toLocaleString()}</td>
                                                        <td className="py-1 px-2 border border-gray-200 text-right font-bold text-gray-700">{formatLargeValue(cust.fy202425Value, true)}</td>
                                                        <td className="py-1 px-2 border border-gray-200 text-right text-blue-600 font-bold">{cust.fy202526Qty.toLocaleString()}</td>
                                                        <td className="py-1 px-2 border border-gray-200 text-right font-black text-blue-700">{formatLargeValue(cust.fy202526Value, true)}</td>
                                                        <td className="py-1 px-2 border border-gray-200 text-right">
                                                            <span className={\`font-bold \${cust.ytdGrowth >= 0 ? 'text-green-600' : 'text-red-600'}\`}>{cust.ytdGrowth >= 0 ? '+' : ''}{cust.ytdGrowth.toFixed(1)}%</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>`;

    content = content.substring(0, startIdx) + newCustomerParams + content.substring(endIdx);
} else {
    console.error('Could not find Customer Tab block to replace.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Final Fix: YTD Logic updated, Sales Labels updated, Customer Tab Replaced safely.');
