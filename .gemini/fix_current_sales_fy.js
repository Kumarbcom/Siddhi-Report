import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Add currValFY calculation (full FY value, not filtered by month/week)
const oldKpisCalc = `    const kpis = useMemo(() => {
        const currVal = currentData.reduce((acc, i) => acc + (i.value || 0), 0);
        const currQty = currentData.reduce((acc, i) => acc + (i.quantity || 0), 0);`;

const newKpisCalc = `    const kpis = useMemo(() => {
        // Calculate FULL FY values (not filtered by month/week) for "Current Sales FY"
        const fullFYData = enrichedSales.filter(i => {
            if (i.fiscalYear !== selectedFY) return false;
            if (selectedMake !== 'ALL' && i.make !== selectedMake) return false;
            if (selectedMatGroup !== 'ALL' && i.matGroup !== selectedMatGroup) return false;
            return true;
        });
        const currValFY = fullFYData.reduce((acc, i) => acc + (i.value || 0), 0);
        
        const currVal = currentData.reduce((acc, i) => acc + (i.value || 0), 0);
        const currQty = currentData.reduce((acc, i) => acc + (i.quantity || 0), 0);`;

content = content.replace(oldKpisCalc, newKpisCalc);

// Step 2: Add currValFY to the return statement
const oldReturn = `        return {
            currVal, currQty, uniqueCusts, avgOrder,`;

const newReturn = `        return {
            currVal, currValFY, currQty, uniqueCusts, avgOrder,`;

content = content.replace(oldReturn, newReturn);

// Step 3: Update the KPI card to use currValFY instead of currVal
const oldKpiCard = `                                    { label: 'Current Sales', val: kpis.currVal, prev: kpis.prevVal, yoy: kpis.yoyVal, isCurr: true, text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100', icon: DollarSign },`;

const newKpiCard = `                                    { label: 'Current Sales FY', val: kpis.currValFY, prev: kpis.prevVal, yoy: kpis.yoyVal, isCurr: true, text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100', icon: DollarSign },`;

content = content.replace(oldKpiCard, newKpiCard);

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed Current Sales FY KPI!');
console.log('');
console.log('Changes made:');
console.log('- Added currValFY calculation (full FY value, ignoring month/week filters)');
console.log('- Updated "Current Sales" KPI to use currValFY');
console.log('- Renamed label to "Current Sales FY" for clarity');
console.log('- Now shows same logic as Quantity (FY) but for sales value');
