import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Filter State
if (!content.includes('const [selectedCustCategory, setSelectedCustCategory]')) {
    content = content.replace(
        'const [selectedFY, setSelectedFY] = useState<string>(\'\');',
        'const [selectedFY, setSelectedFY] = useState<string>(\'\');\n    const [selectedCustCategory, setSelectedCustCategory] = useState<string>(\'ALL\');'
    );
}

// 2. Fix KPI Return (No Data Fix)
content = content.replace(
    /return\s*\{\s*currVal,\s*currQty,/g,
    'return {\n            currVal, currValFY, currQty,'
);
// Dependencies
content = content.replace(
    /,\s*\[currentData,\s*previousDataForComparison,\s*yoyData\]\);/g,
    ', [currentData, previousDataForComparison, yoyData, enrichedSales, selectedFY, selectedMake, selectedMatGroup]);'
);


// 3. Fix Logic (Priority Order)
const logicStart = '// Repeat: Sales in ALL THREE years'; // From previous fix
const logicEnd = 'if (has202324 || has202425 || has202526) groupCount.total++;';

// We need to match whatever is there.
// I'll use the unique signature of the start of the block I wrote last time.
const blockStartSig = 'if (has202324 && has202425 && has202526) {';
// Start index is slightly before that.
let logicStartIndex = content.indexOf(blockStartSig);
if (logicStartIndex !== -1) {
    // Go back to comment
    logicStartIndex = content.lastIndexOf('// Repeat:', logicStartIndex);
} else {
    // Fallback to searching for Rebuild?
    logicStartIndex = content.indexOf('// Rebuild:');
}

if (logicStartIndex !== -1) {
    let logicEndIndex = content.indexOf(logicEnd, logicStartIndex);

    const correctLogic = `// 1. Rebuild: Sales in 23-24 & 25-26 (Gap in 24-25)
            if (has202324 && !has202425 && has202526) {
                rebuildCustomers.push({ ...customerRecord, category: 'Rebuild' });
                groupCount.rebuild++;
            }
            // 2. New: Sales ONLY in 25-26
            else if (!has202324 && !has202425 && has202526) {
                newCustomers.push({ ...customerRecord, category: 'New' });
                groupCount.new++;
            }
            // 3. Repeat: Sales in 24-25 & 25-26 (Continuous) - Covers both 2-year and 3-year repeats
            else if (has202425 && has202526) {
                repeatCustomers.push({ ...customerRecord, category: 'Repeat' });
                groupCount.repeat++;
            }
            // 4. Lost: Sales in previous years but NO sales in 25-26
            else if ((has202324 || has202425) && !has202526) {
                lostCustomers.push({ ...customerRecord, category: 'Lost' });
                groupCount.lost++;
            }
            `;

    content = content.substring(0, logicStartIndex) + correctLogic + content.substring(logicEndIndex);
}

// 4. Replace Cards with Clickable Filterable Cards
// Find the grid container: <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
const cardsStart = content.indexOf('<div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">');
if (cardsStart !== -1) {
    // Find end of this div. It contains 5 cards.
    // I'll search for the Group-wise section start to define end.
    const sectionsEnd = content.indexOf('<div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-4">', cardsStart);
    // Go back one closing div
    const cardsEnd = content.lastIndexOf('</div>', sectionsEnd);

    // Check if reasonable distance
    if (sectionsEnd - cardsStart < 5000) {
        const newCardsUI = `<div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
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
                                </div>`; // Closing div matched manually

        content = content.replace(content.substring(cardsStart, cardsEnd + 6), newCardsUI); // +6 for </div>
    }
}

// 5. Update Table to Filter
const tableMapStart = '{[...customerCategorization.repeatCustomers, ...customerCategorization.rebuildCustomers, ...customerCategorization.newCustomers, ...customerCategorization.lostCustomers].map((cust, idx) =>';
const newTableMap = `{[...customerCategorization.repeatCustomers, ...customerCategorization.rebuildCustomers, ...customerCategorization.newCustomers, ...customerCategorization.lostCustomers]
                                            .filter(c => selectedCustCategory === 'ALL' || c.category === selectedCustCategory)
                                            .map((cust, idx) =>`;

content = content.replace(tableMapStart, newTableMap);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Updated interactive dashboard with filtering, logic, and layout!');
