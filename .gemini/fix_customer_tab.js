import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Find and remove customer categorization from sales section
const startMarker = '{/* Customer Categorization Section */}';
const endMarker = '                        </div>\r\n                    ) : activeSubTab === \'inventory\'';

const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
    console.log('ERROR: Could not find customer categorization section start marker');
    process.exit(1);
}

// Find the actual start (go back to find the opening div)
let actualStart = content.lastIndexOf('\r\n\r\n', startIndex);
if (actualStart === -1) actualStart = startIndex;

const endIndex = content.indexOf(endMarker, startIndex);
if (endIndex === -1) {
    console.log('ERROR: Could not find customer categorization section end marker');
    process.exit(1);
}

// Extract the customer section
const customerSection = content.substring(actualStart, endIndex).trim();
console.log('Found customer section, length:', customerSection.length);

// Remove it from sales
content = content.substring(0, actualStart) + '\r\n' + content.substring(endIndex);
console.log('Removed customer section from sales tab');

// Step 2: Add customer tab section
const insertMarker = '                    ) : null}';
const insertIndex = content.indexOf(insertMarker);

if (insertIndex === -1) {
    console.log('ERROR: Could not find insertion point');
    process.exit(1);
}

// Create the customer tab section
const customerTab = `                    ) : activeSubTab === 'customer' ? (
                        <div className="flex flex-col gap-4">
${customerSection}
                        </div>
`;

// Insert it
content = content.substring(0, insertIndex) + customerTab + '\r\n' + content.substring(insertIndex);
console.log('Added customer section to Customer Analysis tab');

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ SUCCESS!');
console.log('1. Removed customer categorization from Sales tab');
console.log('2. Added customer categorization to Customer Analysis tab');
console.log('3. File saved successfully');
