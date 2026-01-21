import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// --- 1. Redesign Header (Layout Adjustment) ---
// Find main header container line
// Old: <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between flex-shrink-0 shadow-sm z-10">
// New: Use standard flex-row on larger screens, better alignment.

// Identifying snippet uniqueness
const oldHeaderClass = 'className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between flex-shrink-0 shadow-sm z-10"';
const newHeaderClass = 'className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col lg:flex-row gap-4 items-center justify-between flex-shrink-0 shadow-sm z-10 sticky top-0 bg-white/90 backdrop-blur-md"';

if (content.includes(oldHeaderClass)) {
    content = content.replace(oldHeaderClass, newHeaderClass);
    console.log('✅ Updated Header Layout Class (Alignment Fix)');
} else {
    // Try generic Layout if exact string match fails (likely spacing)
    // We will search for "bg-white border-b border-gray-200 px-4 py-3 flex"
    const genericSearch = /className="bg-white border-b border-gray-200 px-4 py-3 flex [^"]+"/;
    if (genericSearch.test(content)) {
        content = content.replace(genericSearch, newHeaderClass);
        console.log('✅ Updated Header Layout Class (Regex Match)');
    }
}

// Find Filters Container
// Old: <div className="flex flex-wrap items-center gap-3">
// New: <div className="flex flex-wrap items-center gap-2 justify-end">
const oldFilterCont = 'className="flex flex-wrap items-center gap-3"';
const newFilterCont = 'className="flex flex-wrap items-center gap-2 lg:gap-3"';
content = content.replace(oldFilterCont, newFilterCont);


// --- 2. Upgrade HorizontalBarChart to show Previous & Growth ---

// We need to locate the mapping inside HorizontalBarChart
// Look for lines:
// <span className="font-bold text-gray-900 flex-shrink-0 bg-white pl-1">{formatLargeValue(total, true)}</span>
// replace with a block that includes Previous and Growth

const chartValSearch = `<span className="font-bold text-gray-900 flex-shrink-0 bg-white pl-1">{formatLargeValue(total, true)}</span>`;
const chartValReplace = `
                                    <div className="flex flex-col items-end min-w-[60px] bg-white pl-1">
                                        <span className="font-bold text-gray-900 leading-none">{formatLargeValue(total, true)}</span>
                                        {item.previous !== undefined && item.previous > 0 && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <span className="text-[7px] text-gray-400 font-medium tracking-tight">LY: {formatLargeValue(item.previous, true)}</span>
                                                <span className={\`text-[7px] font-bold \${((total - item.previous)/item.previous) >= 0 ? 'text-green-600' : 'text-red-500'}\`}>
                                                    {((total - item.previous)/item.previous) >= 0 ? '↑' : '↓'}{Math.abs(((total - item.previous)/item.previous) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>`;

if (content.includes(chartValSearch)) {
    content = content.replace(chartValSearch, chartValReplace);
    console.log('✅ Upgraded HorizontalBarChart to show Last Year & Growth');
} else {
    console.log('⚠️ Could not find HorizontalBarChart value span. Check spacing.');
    // Try to locate by context
    const part = 'formatLargeValue(total, true)}</span>';
    const split = content.split(part);
    if (split.length > 1) {
        // Too risky to replace blindly without full context match
        console.log('Manual intervention might be needed for chart.');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
