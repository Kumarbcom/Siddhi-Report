import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

console.log('Reading file...');

// Locate the block by comment
const startMarker = '// Repeat: Has sales in EITHER 2023-24 OR 2024-25 (or both) AND also in 2025-26';
const index = content.indexOf(startMarker);

if (index === -1) {
    console.error('CRITICAL: Could not find the logic block starting with Repeat comment.');
    // Try to find the lines directly
    const altStart = 'if ((has202324 || has202425) && has202526)';
    const altIndex = content.indexOf(altStart);
    if (altIndex !== -1) {
        console.log('Found block by code signature instead of comment.');
    } else {
        console.error('Cannot find logic block at all. Printing surrounding text...');
        console.log(content.substring(Math.max(0, content.indexOf('category: \'Repeat\'') - 200), content.indexOf('category: \'Repeat\'') + 200));
        process.exit(1);
    }
}

// We want to replace the whole checks for Repeat, Rebuild, New, Lost.
// Let's identify the end of the block.
// It ends before: if (has202324 || has202425 || has202526) groupCount.total++;

const endMarkerKey = 'if (has202324 || has202425 || has202526) groupCount.total++;';
const endIndex = content.indexOf(endMarkerKey, index);

if (endIndex === -1) {
    console.error('CRITICAL: Could not find end of logic block.');
    process.exit(1);
}

// Get the text to replace
const originalBlock = content.substring(index, endIndex);
console.log('Found block to replace length:', originalBlock.length);

// NEW CORRECT LOGIC
const newLogic = `// Repeat: Sales in ALL THREE years (2023-24 AND 2024-25 AND 2025-26)
            if (has202324 && has202425 && has202526) {
                repeatCustomers.push({ ...customerRecord, category: 'Repeat' });
                groupCount.repeat++;
            }
            // Rebuild: Sales in 2023-24 AND 2025-26 (NOT in 2024-25)
            else if (has202324 && !has202425 && has202526) {
                rebuildCustomers.push({ ...customerRecord, category: 'Rebuild' });
                groupCount.rebuild++;
            }
            // New: Sales ONLY in 2025-26 (NOT in 2023-24 or 2024-25)
            else if (!has202324 && !has202425 && has202526) {
                newCustomers.push({ ...customerRecord, category: 'New' });
                groupCount.new++;
            }
            // Lost: NO sales in 2025-26 BUT sales in 2023-24 OR 2024-25
            else if ((has202324 || has202425) && !has202526) {
                lostCustomers.push({ ...customerRecord, category: 'Lost' });
                groupCount.lost++;
            }
            `;

// Perform replacement
const newContent = content.substring(0, index) + newLogic + content.substring(endIndex);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('✅ Successfully updated customer categorization logic to Strict Repeat (AND) condition.');
