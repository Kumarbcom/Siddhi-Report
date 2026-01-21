import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Fix the categorization logic with CORRECT requirements
const oldLogic = `            // Rebuild: Has sales ONLY in 2023-24 AND 2025-26 (NOT in 2024-25) - Check first!
            if (has202324 && !has202425 && has202526) {
                rebuildCustomers.push({ ...customerRecord, category: 'Rebuild' });
                groupCount.rebuild++;
            }
            // New: Has sales ONLY in 2025-26 (NOT in 2023-24 or 2024-25)
            else if (!has202324 && !has202425 && has202526) {
                newCustomers.push({ ...customerRecord, category: 'New' });
                groupCount.new++;
            }
            // Repeat: Has sales in EITHER 2023-24 OR 2024-25 (or both) AND also in 2025-26
            else if ((has202324 || has202425) && has202526) {
                repeatCustomers.push({ ...customerRecord, category: 'Repeat' });
                groupCount.repeat++;
            }
            // Lost: Has sales in 2023-24 or 2024-25 BUT NO sales in 2025-26
            else if ((has202324 || has202425) && !has202526) {
                lostCustomers.push({ ...customerRecord, category: 'Lost' });
                groupCount.lost++;
            }`;

const newLogic = `            // Repeat: Sales in ALL THREE years (2023-24 AND 2024-25 AND 2025-26)
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
            }`;

content = content.replace(oldLogic, newLogic);

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed customer categorization logic!');
console.log('');
console.log('CORRECT LOGIC:');
console.log('- Repeat: Sales in ALL THREE years (2023-24 AND 2024-25 AND 2025-26)');
console.log('- Rebuild: Sales in 2023-24 AND 2025-26 (NOT in 2024-25)');
console.log('- New: Sales ONLY in 2025-26 (NOT in 2023-24 or 2024-25)');
console.log('- Lost: NO sales in 2025-26 BUT sales in 2023-24 OR 2024-25');
