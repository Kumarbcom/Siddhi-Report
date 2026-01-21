import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Split into lines
const lines = content.split('\n');

console.log('Line 1978:', JSON.stringify(lines[1977]));
console.log('Line 1979:', JSON.stringify(lines[1978]));
console.log('Line 1980:', JSON.stringify(lines[1979]));
console.log('Line 1981:', JSON.stringify(lines[1980]));
console.log('Line 1982:', JSON.stringify(lines[1981]));

// Fix by replacing lines 1978-1981
lines[1977] = "                        </div>\r";
lines[1978] = "                    ) : activeSubTab === 'inventory' ? (\r";
// Remove the duplicate broken lines
lines.splice(1979, 2);

// Join back
content = lines.join('\n');

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ Fixed syntax error!');
