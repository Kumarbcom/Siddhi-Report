import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// Update Sequential Labels (Previous Period)
content = content.replace(
    "'vs Prev Wk'",
    "'vs Prev Week'"
);
content = content.replace(
    "'vs Prev Mo'",
    "'vs Prev Month'"
);

// Update YoY Labels (Last Year Same Period)
// The user finds "YTD" / "YoY" confusing. "vs Last Year" covers both cases (YTD Last Year or Same Month Last Year).
content = content.replace(
    "{timeView === 'FY' ? 'YTD Comp' : 'YoY Comp'}",
    "'vs Last Year'"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Sales Labels Refined for Clarity');
