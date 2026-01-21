import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'App.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// 1. Reduce Sidebar Navigation spacing (between sections)
// Old: <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar">
const oldNav = 'space-y-6 custom-scrollbar';
const newNav = 'space-y-3 custom-scrollbar'; // Reduced from 6 to 3

if (content.includes(oldNav)) {
    content = content.replace(oldNav, newNav);
    console.log('✅ Compacted Sidebar Section Spacing (space-y-6 -> space-y-3)');
}

// 2. Reduce Sidebar Section Header spacing
// Old: <div className="px-3 mb-3 text-[10px]
// New: mb-1.5
// Regex needed because "px-3 mb-3" might be common? No, specific to this context likely.
const headerRegex = /px-3 mb-3 text-\[10px\]/g;
if (headerRegex.test(content)) {
    content = content.replace(headerRegex, 'px-3 mb-1 text-[9px]'); // Also reduced text size slightly?
    console.log('✅ Compacted Sidebar Headers');
}

// 3. Compacting Sidebar Items (Padding)
// Old: className={`w-full text-left flex items-center gap-3 px-3 py-2.5
// New: py-1.5
const itemRegex = /gap-3 px-3 py-2\.5/g;
if (itemRegex.test(content)) {
    content = content.replace(itemRegex, 'gap-2.5 px-3 py-1.5');
    console.log('✅ Compacted Sidebar Items (Padding & Gap)');
}

fs.writeFileSync(filePath, content, 'utf8');
