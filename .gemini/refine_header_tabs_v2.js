import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// Helper to replace by unique start/end to avoid Regex escaping hell
function replaceBlock(fileContent, startMarker, endMarker, newContent) {
    const startIdx = fileContent.indexOf(startMarker);
    if (startIdx === -1) {
        console.log(`⚠️ Start marker not found: ${startMarker.substring(0, 30)}...`);
        return fileContent;
    }
    const endIdx = fileContent.indexOf(endMarker, startIdx);
    if (endIdx === -1) {
        console.log(`⚠️ End marker not found after start: ${endMarker}`);
        return fileContent;
    }
    const fullEndIdx = endIdx + endMarker.length;
    console.log(`✅ Replacing block from ${startIdx} to ${fullEndIdx}`);
    return fileContent.substring(0, startIdx) + newContent + fileContent.substring(fullEndIdx);
}

// 1. Update Tab Container
const oldTabStart = 'className="flex bg-gray-200/50';
// It ends with shadow-inner overflow-hidden" 
const oldTabEnd = 'overflow-hidden"';
const newTabCont = 'className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-1.5 bg-gray-100/80 p-1.5 rounded-xl border border-gray-200 shadow-inner w-full xl:flex-1"';

content = replaceBlock(content, oldTabStart, oldTabEnd, newTabCont);

// 2. Update Tab Buttons
// className={`px-5 py-2 rounded-lg 
// ...
// hover:-translate-y-0.5'}`}

const oldBtnStart = 'className={`px-5 py-2 rounded-lg';
const oldBtnEnd = "hover:-translate-y-0.5'}`}";

const newBtnClass = 'className={`w-full py-2.5 rounded-lg text-[10px] xl:text-xs font-black uppercase tracking-wider transition-all duration-300 transform active:scale-95 flex items-center justify-center ${activeSubTab === tab ? 'bg-white text - indigo - 700 shadow - sm scale - [1.02]' : 'text - gray - 500 hover: text - indigo - 600 hover: bg - white / 40'}`}';

content = replaceBlock(content, oldBtnStart, oldBtnEnd, newBtnClass);

fs.writeFileSync(filePath, content, 'utf8');
