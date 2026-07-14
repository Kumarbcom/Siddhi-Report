const fs = require('fs');
let content = fs.readFileSync('c:\\Siddhi Report\\components\\DashboardView.tsx', 'utf8');

// 1. Remove stockPlanning from activeSubTab type
content = content.replace(/ \| 'stockPlanning'/g, '');

// 2. Remove stockPlanning states
const stateVarsToRemove = [
    /const \[selectedStockItem, setSelectedStockItem\] = useState<string \| null>\(null\);\r?\n/,
    /const \[stockSearchTerm, setStockSearchTerm\] = useState\(''\);\r?\n/,
    /const \[stockSlicers, setStockSlicers\] = useState\(\{ make: 'ALL', group: 'ALL', strategy: 'ALL', class: 'ALL' \}\);\r?\n/,
    /const \[stockQuickFilter, setStockQuickFilter\] = useState<'ALL' \| 'SHORTAGE' \| 'REFILL'>\('ALL'\);\r?\n/,
    /const \[stockSortConfig, setStockSortConfig\] = useState<\{ key: string, direction: 'asc' \| 'desc' \} \| null>\(\{ key: 'salesCY', direction: 'desc' \}\);\r?\n/
];

stateVarsToRemove.forEach(regex => {
    content = content.replace(regex, '');
});

// 3. Remove stockPlanningData useMemo block
const regexData = /const stockPlanningData = useMemo\(\(\) => \{[\s\S]*?\}, \[materials, closingStock, pendingSO, pendingPO, enrichedSales, activeSubTab\]\);\r?\n/g;
content = content.replace(regexData, '');

// 4. Remove filteredStockPlanning block
const regexFiltered = /const filteredStockPlanning = useMemo\(\(\) => \{[\s\S]*?\}, \[stockPlanningData, stockSlicers, stockSearchTerm, stockSortConfig, stockQuickFilter\]\);\r?\n/g;
content = content.replace(regexFiltered, '');

// 5. Remove handleStockSort
const regexSort = /const handleStockSort = \([\s\S]*?\}\);\r?\n/g;
content = content.replace(regexSort, '');

// 6. Remove handleExportStockPlanning
const regexExport = /const handleExportStockPlanning = \(\) => \{[\s\S]*?\.xlsx\`\);\r?\n    \};\r?\n/g;
content = content.replace(regexExport, '');

// 7. Remove stockPlanningTotals
const regexTotals = /const stockPlanningTotals = useMemo\(\(\) => \{[\s\S]*?\}, \[stockPlanningData, stockSlicers, stockSearchTerm\]\);\r?\n/g;
content = content.replace(regexTotals, '');

// 8. Remove the JSX block
const jsxRegex = /\) : activeSubTab === 'stockPlanning' \? \([\s\S]*?(?=\) : activeSubTab === 'customerAnalysis' \?)/g;
content = content.replace(jsxRegex, '');

fs.writeFileSync('c:\\Siddhi Report\\components\\DashboardView.tsx', content);
console.log('Successfully cleaned DashboardView.tsx');
