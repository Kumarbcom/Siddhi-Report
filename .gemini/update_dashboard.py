import re

# Read the file
with open(r'c:\Siddhi Report\components\DashboardView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Remove customer categorization from sales section (lines ~1979-2099)
# Find and remove the customer categorization section in sales
pattern1 = r'(\s+</div>\r?\n\r?\n\s+{/\* Customer Categorization Section \*/}.*?</div>\r?\n\s+</div>\r?\n\s+\) : activeSubTab === \'inventory\')'
replacement1 = r'\1\n                        </div>\n                    ) : activeSubTab === \'inventory\''

content = re.sub(pattern1, replacement1, content, flags=re.DOTALL)

# Step 2: Add customer tab section before the final null check
# Find the position before ") : null}"
customer_tab_code = '''                    ) : activeSubTab === 'customer' ? (
                        <div className="flex flex-col gap-4">
                            {/* Customer Categorization Dashboard */}
                            <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-200 shadow-sm">
                                <h3 className="text-sm font-black text-purple-900 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Customer Categorization Analysis
                                    <span className="text-[10px] font-normal text-purple-600 bg-white px-2 py-0.5 rounded-full">FY 2023-24 to 2025-26</span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                                    <div className="bg-white p-3 rounded-lg border-2 border-green-200 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-green-600 uppercase">Repeat Customers</p>
                                                <p className="text-2xl font-black text-green-700">{customerCategorization.totalRepeat}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">Sales in 23-24 & 24-25</p>
                                            </div>
                                            <RefreshCw className="w-8 h-8 text-green-500 opacity-20" />
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border-2 border-orange-200 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-orange-600 uppercase">Rebuild Customers</p>
                                                <p className="text-2xl font-black text-orange-700">{customerCategorization.totalRebuild}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">Re-engaged in 25-26</p>
                                            </div>
                                            <History className="w-8 h-8 text-orange-500 opacity-20" />
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border-2 border-blue-200 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-blue-600 uppercase">New Customers</p>
                                                <p className="text-2xl font-black text-blue-700">{customerCategorization.totalNew}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">Only in 25-26</p>
                                            </div>
                                            <UserPlus className="w-8 h-8 text-blue-500 opacity-20" />
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border-2 border-purple-200 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-purple-600 uppercase">Total Customers</p>
                                                <p className="text-2xl font-black text-purple-700">{customerCategorization.totalCustomers}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">All Categories</p>
                                            </div>
                                            <Users className="w-8 h-8 text-purple-500 opacity-20" />
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
                                                <p className="text-[10px] font-bold text-gray-800 mb-1">{gc.group}</p>
                                                <div className="flex gap-2 text-[9px]">
                                                    <span className="text-green-600 font-bold">R: {gc.repeat}</span>
                                                    <span className="text-orange-600 font-bold">Rb: {gc.rebuild}</span>
                                                    <span className="text-blue-600 font-bold">N: {gc.new}</span>
                                                    <span className="text-gray-600 font-bold ml-auto">Σ: {gc.total}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                                        <h4 className="text-[10px] font-black text-gray-700 uppercase flex items-center gap-2">
                                            <Table className="w-3 h-3" /> Detailed Customer Sales Analysis (3-Year Comparison)
                                        </h4>
                                    </div>
                                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                                        <table className="w-full text-left border-collapse min-w-[1200px]">
                                            <thead className="sticky top-0 z-10 bg-gray-100 shadow-sm">
                                                <tr className="text-[9px] font-black text-gray-700 uppercase">
                                                    <th className="py-2 px-2 border border-gray-300">Category</th>
                                                    <th className="py-2 px-2 border border-gray-300">Group</th>
                                                    <th className="py-2 px-3 border border-gray-300">Customer Name</th>
                                                    <th className="py-2 px-2 border border-gray-300 text-right" colSpan={2}>FY 2023-24</th>
                                                    <th className="py-2 px-2 border border-gray-300 text-right" colSpan={2}>FY 2024-25</th>
                                                    <th className="py-2 px-2 border border-gray-300 text-right" colSpan={2}>FY 2025-26</th>
                                                    <th className="py-2 px-2 border border-gray-300 text-right">YTD Growth %</th>
                                                </tr>
                                                <tr className="text-[8px] font-bold text-gray-600 uppercase bg-gray-50">
                                                    <th className="py-1 px-2 border border-gray-300"></th>
                                                    <th className="py-1 px-2 border border-gray-300"></th>
                                                    <th className="py-1 px-2 border border-gray-300"></th>
                                                    <th className="py-1 px-2 border border-gray-300 text-right">Qty</th>
                                                    <th className="py-1 px-2 border border-gray-300 text-right">Sales</th>
                                                    <th className="py-1 px-2 border border-gray-300 text-right">Qty</th>
                                                    <th className="py-1 px-2 border border-gray-300 text-right">Sales</th>
                                                    <th className="py-1 px-2 border border-gray-300 text-right">Qty</th>
                                                    <th className="py-1 px-2 border border-gray-300 text-right">Sales</th>
                                                    <th className="py-1 px-2 border border-gray-300 text-right">25-26 vs 24-25</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 text-[10px]">
                                                {[...customerCategorization.repeatCustomers, ...customerCategorization.rebuildCustomers, ...customerCategorization.newCustomers].map((cust, idx) => (
                                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="py-1 px-2 border border-gray-200">
                                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${cust.category === 'Repeat' ? 'bg-green-100 text-green-700' : cust.category === 'Rebuild' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{cust.category}</span>
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
                                                            <span className={`font-bold ${cust.ytdGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{cust.ytdGrowth >= 0 ? '+' : ''}{cust.ytdGrowth.toFixed(1)}%</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
'''

# Insert before the final ") : null}"
pattern2 = r'(\s+</div>\r?\n\s+\) : null})'
replacement2 = customer_tab_code + r'\1'

content = re.sub(pattern2, replacement2, content)

# Write back
with open(r'c:\Siddhi Report\components\DashboardView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated DashboardView.tsx")
print("1. Removed customer categorization from Sales tab")
print("2. Added customer categorization to Customer Analysis tab")
