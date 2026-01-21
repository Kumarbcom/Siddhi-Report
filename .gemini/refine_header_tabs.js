import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// --- Refine Header for "Full Width & Distributed Equally" ---

// 1. Update Tab Container to use Grid (Equal Width Distribution) and Full Width
// Search for the Tab Container class. It was:
// className="flex bg-gray-200/50 backdrop-blur-sm p-1.5 rounded-xl border border-gray-200 shadow-inner overflow-hidden"
// We'll replace it.

const oldTabCont = /(className="flex bg-gray-200\/50 backdrop-blur-sm p-1\.5 rounded-xl border border-gray-200 shadow-inner overflow-hidden")/g;
const newTabCont = 'className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-1.5 bg-gray-100/80 p-1.5 rounded-xl border border-gray-200 shadow-inner w-full xl:flex-1"';

if (oldTabCont.test(content)) {
    content = content.replace(oldTabCont, newTabCont);
    console.log('✅ Updated Tabs Container to Full Width Grid (Equal Distribution)');
} else {
    // Try relaxed match
    const relaxed = /className="flex bg-gray-200\/50[^"]+"/;
    if (relaxed.test(content)) {
        content = content.replace(relaxed, newTabCont);
        console.log('✅ Updated Tabs Container (Relaxed Match)');
    } else {
        console.log('⚠️ Could not find Tab Container to update.');
    }
}

// 2. Update Tab Buttons to fill their grid cells
// Search for the button logic inside the map
// Current snippet start: <button\n                            key={tab}\n                            onClick={() => setActiveSubTab(tab)}\n                            className={`px-5 py-2
// We need to change the className string.
// It matches: className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-500 ease-out transform active:scale-95 ${activeSubTab === tab ? 'bg-white text-indigo-700 shadow-[0_8px_16px_rgba(0,0,0,0.12)] scale-[1.02] translate-y-0' : 'text-gray-500 hover:text-indigo-600 hover:bg-white/40 hover:-translate-y-0.5'}`}

const oldBtnClassRegex = /className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-500 ease-out transform active:scale-95 \${activeSubTab === tab \? 'bg-white text-indigo-700 shadow-\[0_8px_16px_rgba\(0,0,0,0\.12\)\] scale-\[1\.02\] translate-y-0' : 'text-gray-500 hover:text-indigo-600 hover:bg-white\/40 hover:-translate-y-0\.5'}`}/;

const newBtnClass = 'className={`w-full py-2.5 rounded-lg text-[10px] xl:text-xs font-black uppercase tracking-wider transition-all duration-300 transform active:scale-95 flex items-center justify-center ${activeSubTab === tab ? 'bg-white text - indigo - 700 shadow - sm scale - [1.02]' : 'text - gray - 500 hover: text - indigo - 600 hover: bg - white / 40'}`}';

if (oldBtnClassRegex.test(content)) {
    content = content.replace(oldBtnClassRegex, newBtnClass);
    console.log('✅ Updated Tab Buttons style for Equal Width');
} else {
    // Try to find by unique parts if exact match fails
    const uniquePart = "activeSubTab === tab ? 'bg-white text-indigo-700 shadow-[0_8px_16px_rgba(0,0,0,0.12)]";
    const startIdx = content.indexOf('className={`px-5 py-2');
    if (startIdx !== -1 && content.includes(uniquePart)) {
        // Find the full class string end
        const endPart = "hover:-translate-y-0.5'}`}";
        const endIdx = content.indexOf(endPart, startIdx);
        if (endIdx !== -1) {
            const fullMatch = content.substring(startIdx, endIdx + endPart.length);
            content = content.replace(fullMatch, newBtnClass);
            console.log('✅ Updated Tab Buttons style (Substring Match)');
        } else {
            console.log('⚠️ Found start of button class but not end.');
        }
    } else {
        console.log('⚠️ Could not find exact button class string.');
    }
}

// 3. Update Main Header Container to ensure it spans full width properly
// We changed it in previous step to: 'className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col lg:flex-row gap-4 items-center justify-between flex-shrink-0 shadow-sm z-10 sticky top-0 bg-white/90 backdrop-blur-md"'
// We should check if "justify-between" is appropriate if we want tabs to grow.
// "justify-between" puts space between Tabs and Filters.
// If Tabs are flex-1, they will push filters to end anyway. So this is fine.

fs.writeFileSync(filePath, content, 'utf8');
