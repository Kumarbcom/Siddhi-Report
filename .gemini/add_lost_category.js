import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Update the array initialization to include lostCustomers
content = content.replace(
    'const repeatCustomers = [], rebuildCustomers = [], newCustomers = [];',
    'const repeatCustomers = [], rebuildCustomers = [], newCustomers = [], lostCustomers = [];'
);

// Step 2: Update groupCounts initialization to include lost
content = content.replace(
    "groupCounts.set(data.group, { repeat: 0, rebuild: 0, new: 0, total: 0 })",
    "groupCounts.set(data.group, { repeat: 0, rebuild: 0, new: 0, lost: 0, total: 0 })"
);

// Step 3: Add Lost customer logic after New customer logic
const newCustomerLogic = `            // New: Has sales ONLY in 2025-26 (NOT in 2023-24 or 2024-25)
            else if (!has202324 && !has202425 && has202526) { 
                newCustomers.push({ ...customerRecord, category: 'New' }); 
                groupCount.new++; 
            }`;

const withLostLogic = `            // New: Has sales ONLY in 2025-26 (NOT in 2023-24 or 2024-25)
            else if (!has202324 && !has202425 && has202526) { 
                newCustomers.push({ ...customerRecord, category: 'New' }); 
                groupCount.new++; 
            }
            // Lost: Has sales in 2023-24 or 2024-25 BUT NO sales in 2025-26
            else if ((has202324 || has202425) && !has202526) { 
                lostCustomers.push({ ...customerRecord, category: 'Lost' }); 
                groupCount.lost++; 
            }`;

content = content.replace(newCustomerLogic, withLostLogic);

// Step 4: Add lostCustomers sorting
content = content.replace(
    'newCustomers.sort((a, b) => b.fy202526Value - a.fy202526Value);',
    `newCustomers.sort((a, b) => b.fy202526Value - a.fy202526Value);
        lostCustomers.sort((a, b) => b.fy202425Value - a.fy202425Value);`
);

// Step 5: Update return statement to include lostCustomers
content = content.replace(
    'repeatCustomers, rebuildCustomers, newCustomers, groupCounts: groupCountsArray,',
    'repeatCustomers, rebuildCustomers, newCustomers, lostCustomers, groupCounts: groupCountsArray,'
);

content = content.replace(
    'totalRepeat: repeatCustomers.length, totalRebuild: rebuildCustomers.length,\r\n            totalNew: newCustomers.length, totalCustomers: repeatCustomers.length + rebuildCustomers.length + newCustomers.length',
    'totalRepeat: repeatCustomers.length, totalRebuild: rebuildCustomers.length,\r\n            totalNew: newCustomers.length, totalLost: lostCustomers.length, totalCustomers: repeatCustomers.length + rebuildCustomers.length + newCustomers.length + lostCustomers.length'
);

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Added "Lost" customer category!');
console.log('');
console.log('Complete categorization logic:');
console.log('- Repeat: Sales in EITHER 2023-24 OR 2024-25 (or both) AND also in 2025-26');
console.log('- Rebuild: Sales ONLY in 2023-24 AND 2025-26 (NOT in 2024-25)');
console.log('- New: Sales ONLY in 2025-26 (NOT in 2023-24 or 2024-25)');
console.log('- Lost: Sales in 2023-24 or 2024-25 BUT NO sales in 2025-26');
