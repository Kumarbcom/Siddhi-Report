import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Change grid to 5 columns
content = content.replace(
    '<div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">',
    '<div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">'
);

// Step 2: Find and replace the entire cards section with reordered cards
const oldCards = `                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
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
                                </div>`;

const newCards = `                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
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
                                    <div className="bg-white p-3 rounded-lg border-2 border-green-200 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-green-600 uppercase">Repeat Customers</p>
                                                <p className="text-2xl font-black text-green-700">{customerCategorization.totalRepeat}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">Either 23-24 or 24-25 + 25-26</p>
                                            </div>
                                            <RefreshCw className="w-8 h-8 text-green-500 opacity-20" />
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border-2 border-orange-200 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-orange-600 uppercase">Rebuild Customers</p>
                                                <p className="text-2xl font-black text-orange-700">{customerCategorization.totalRebuild}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">Only 23-24 + 25-26</p>
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
                                    <div className="bg-white p-3 rounded-lg border-2 border-red-200 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-red-600 uppercase">Lost Customers</p>
                                                <p className="text-2xl font-black text-red-700">{customerCategorization.totalLost}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">No sales in 25-26</p>
                                            </div>
                                            <UserMinus className="w-8 h-8 text-red-500 opacity-20" />
                                        </div>
                                    </div>
                                </div>`;

content = content.replace(oldCards, newCards);

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Rearranged cards and added Lost customer card!');
console.log('');
console.log('New order:');
console.log('1. Total Customers (Purple)');
console.log('2. Repeat Customers (Green)');
console.log('3. Rebuild Customers (Orange) - Updated description');
console.log('4. New Customers (Blue)');
console.log('5. Lost Customers (Red)');
