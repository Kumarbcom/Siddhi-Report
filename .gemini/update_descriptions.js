import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Update Repeat card description
content = content.replace(
    '<p className="text-[8px] text-gray-500 mt-1">Either 23-24 or 24-25 + 25-26</p>',
    '<p className="text-[8px] text-gray-500 mt-1">All 3 years: 23-24, 24-25, 25-26</p>'
);

// Update Rebuild card description
content = content.replace(
    '<p className="text-[8px] text-gray-500 mt-1">Only 23-24 + 25-26</p>',
    '<p className="text-[8px] text-gray-500 mt-1">23-24 + 25-26 (not 24-25)</p>'
);

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Updated card descriptions!');
console.log('- Repeat: "All 3 years: 23-24, 24-25, 25-26"');
console.log('- Rebuild: "23-24 + 25-26 (not 24-25)"');
