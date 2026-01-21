import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Change grid from 4 columns to 5 for the summary cards
content = content.replace(
    '<div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">',
    '<div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">'
);

// Step 2: Update Repeat card description
content = content.replace(
    '<p className="text-[8px] text-gray-500 mt-1">Sales in 23-24 & 24-25</p>',
    '<p className="text-[8px] text-gray-500 mt-1">Either 23-24 or 24-25 + 25-26</p>'
);

// Step 3: Add Lost customer card after New customer card
const newCustomerCard = `                                    <div className="bg-white p-3 rounded-lg border-2 border-blue-200 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[9px] font-bold text-blue-600 uppercase">New Customers</p>
                                                <p className="text-2xl font-black text-blue-700">{customerCategorization.totalNew}</p>
                                                <p className="text-[8px] text-gray-500 mt-1">Only in 25-26</p>
                                            </div>
                                            <UserPlus className="w-8 h-8 text-blue-500 opacity-20" />
                                        </div>
                                    </div>`;

const withLostCard = `                                    <div className="bg-white p-3 rounded-lg border-2 border-blue-200 shadow-sm">
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
                                    </div>`;

content = content.replace(newCustomerCard, withLostCard);

// Step 4: Update group distribution to include Lost
content = content.replace(
    '<span className="text-blue-600 font-bold">N: {gc.new}</span>',
    '<span className="text-blue-600 font-bold">N: {gc.new}</span>\n                                                    <span className="text-red-600 font-bold">L: {gc.lost}</span>'
);

// Step 5: Update table to include lostCustomers
content = content.replace(
    '{[...customerCategorization.repeatCustomers, ...customerCategorization.rebuildCustomers, ...customerCategorization.newCustomers].map((cust, idx) =>',
    '{[...customerCategorization.repeatCustomers, ...customerCategorization.rebuildCustomers, ...customerCategorization.newCustomers, ...customerCategorization.lostCustomers].map((cust, idx) =>'
);

// Step 6: Add Lost category styling in table
content = content.replace(
    "cust.category === 'Rebuild' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'",
    "cust.category === 'Rebuild' ? 'bg-orange-100 text-orange-700' : cust.category === 'Lost' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'"
);

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Updated UI to include Lost customers!');
console.log('');
console.log('Changes made:');
console.log('- Changed grid from 4 to 5 columns');
console.log('- Added Lost customer summary card (red)');
console.log('- Updated group distribution to show Lost count');
console.log('- Added Lost customers to the detailed table');
console.log('- Added red styling for Lost category badge');
