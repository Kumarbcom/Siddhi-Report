import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// We need to find the KPI array definition.
// It starts with [{ label: ... }]
// I'll search for the specific line we changed earlier.

const searchString = "{ label: 'Current Sales FY', val: kpis.currValFY, prev: kpis.prevVal, yoy: kpis.yoyVal, isCurr: true, text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100', icon: DollarSign },";
const replaceString = "{ label: timeView === 'FY' ? 'Current Sales FY' : 'Current Sales', val: timeView === 'FY' ? kpis.currValFY : kpis.currVal, prev: kpis.prevVal, yoy: kpis.yoyVal, isCurr: true, text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100', icon: DollarSign },";

if (content.includes(searchString)) {
    content = content.replace(searchString, replaceString);
    console.log('✅ Updated Sales KPI to be dynamic (FY vs Month/Week logic)');
} else {
    // Try to find with "vs Total Prev FY" label modification if I changed it inside the array? 
    // No, label change was just string replace globally.
    // Try finding by parts if spaces filtered
    const looseRegex = /\{\s*label:\s*'Current Sales FY',\s*val:\s*kpis\.currValFY,[\s\S]*?icon:\s*DollarSign\s*\},/;
    if (looseRegex.test(content)) {
        content = content.replace(looseRegex, replaceString);
        console.log('✅ Updated Sales KPI (using regex match)');
    } else {
        console.error('❌ Could not find KPI card definition to update.');
        // Print snippet for debug
        const snippetStart = content.indexOf('const kpis = useMemo');
        console.log('Snippet around kpis:', content.substring(snippetStart + 500, snippetStart + 1500));
    }
}

fs.writeFileSync(filePath, content, 'utf8');
