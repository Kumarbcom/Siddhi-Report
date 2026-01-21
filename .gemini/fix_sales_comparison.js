import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// Fix previousDataForComparison PY String Format
// It was calculating 2024-2025 instead of 2024-25, causing empty results for "Vs Total Prev FY"
const oldCode = 'const pyString = `${pyStart}-${pyStart + 1}`;';
const newCode = 'const pyString = `${pyStart}-${(parseInt(parts[1]) - 1).toString().padStart(2, \'0\')}`;';

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    console.log('✅ Fixed Previous Year string format in previousDataForComparison');
} else {
    console.log('⚠️ Could not find exact string match. Current file content around pyStart:');
    const idx = content.indexOf('const pyStart');
    if (idx !== -1) {
        console.log(content.substring(idx, idx + 200));
    }
}

fs.writeFileSync(filePath, content, 'utf8');
