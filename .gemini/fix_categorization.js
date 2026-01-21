import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Find the section and replace it completely
const startMarker = '            // Repeat: Has sales in EITHER 2023-24 OR 2024-25 (or both) AND also in 2025-26';
const endMarker = '            if (has202324 || has202425 || has202526) groupCount.total++;';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.log('ERROR: Could not find markers');
    process.exit(1);
}

const newLogic = `            // Repeat: Has sales in EITHER 2023-24 OR 2024-25 (or both) AND also in 2025-26
            if ((has202324 || has202425) && has202526) { 
                repeatCustomers.push({ ...customerRecord, category: 'Repeat' }); 
                groupCount.repeat++; 
            }
            // Rebuild: Has sales ONLY in 2023-24 AND 2025-26 (NOT in 2024-25)
            else if (has202324 && !has202425 && has202526) { 
                rebuildCustomers.push({ ...customerRecord, category: 'Rebuild' }); 
                groupCount.rebuild++; 
            }
            // New: Has sales ONLY in 2025-26 (NOT in 2023-24 or 2024-25)
            else if (!has202324 && !has202425 && has202526) { 
                newCustomers.push({ ...customerRecord, category: 'New' }); 
                groupCount.new++; 
            }
            `;

content = content.substring(0, startIndex) + newLogic + content.substring(endIndex);

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed customer categorization logic!');
console.log('');
console.log('Correct logic now:');
console.log('- Repeat: Sales in EITHER 2023-24 OR 2024-25 (or both) AND also in 2025-26');
console.log('- Rebuild: Sales ONLY in 2023-24 AND 2025-26 (NOT in 2024-25)');
console.log('- New: Sales ONLY in 2025-26 (NOT in 2023-24 or 2024-25)');
