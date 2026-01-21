import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Fix the categorization logic - Rebuild should be checked BEFORE Repeat
const oldLogic = `            // Repeat: Has sales in EITHER 2023-24 OR 2024-25 (or both) AND also in 2025-26
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
            // Lost: Has sales in 2023-24 or 2024-25 BUT NO sales in 2025-26
            else if ((has202324 || has202425) && !has202526) {
                lostCustomers.push({ ...customerRecord, category: 'Lost' });
                groupCount.lost++;
            }`;

const newLogic = `            // Rebuild: Has sales ONLY in 2023-24 AND 2025-26 (NOT in 2024-25) - Check first!
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

content = content.replace(oldLogic, newLogic);

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed Rebuild customer logic!');
console.log('');
console.log('Order of checks (IMPORTANT):');
console.log('1. Rebuild - Most specific (2023-24 + 2025-26, NOT 2024-25)');
console.log('2. New - Specific (ONLY 2025-26)');
console.log('3. Repeat - General (Either previous year + current)');
console.log('4. Lost - No current year sales');
