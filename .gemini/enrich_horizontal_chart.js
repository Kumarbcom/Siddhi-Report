import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// Target the block we inserted previously
const oldBlockStart = '<div className="flex flex-col items-end min-w-[60px] bg-white pl-1">';
const oldBlockEnd = '</div>'; // This is tricky as there are nested divs.

// I will locate the start, then find the closure of the outer div.
// It closes line 365 in the view.
// It is the div AFTER `title={String(item.label)}` block? No.
// It is inside the `sorted.map`.

// Structure:
// <div className="flex flex-col items-end min-w-[60px] bg-white pl-1">
//    <span ...>{formatLargeValue(total, true)}</span>
//    {item.previous ... (
//       <div ...>
//           <span ...>LY: ...</span>
//           <span ...>...%</span>
//       </div>
//    )}
// </div>

// I'll create a replacement string that matches the context better.
// I'll replace the regex of the logic inside the block.

const targetRegex = /<span className="font-bold text-gray-900 leading-none">\{formatLargeValue\(total, true\)\}<\/span>[\s\S]*?\{item\.previous !== undefined && item\.previous > 0 && \([\s\S]*?<\/div>\s*?\)\}/;
/*
Matches:
<span ...>{formatLargeValue(total, true)}</span>
...
{item.previous !== undefined ... (
   ...
)}
*/

const newContent = `<span className="text-xs md:text-sm font-black text-gray-900 tracking-tight leading-none">{formatLargeValue(total, true)}</span>
                                        {item.previous !== undefined && item.previous > 0 && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-tight">LY: {formatLargeValue(item.previous, true)}</span>
                                                <span className={\`text-[9px] px-1 py-0.5 rounded-md font-black \${((total - item.previous)/item.previous) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}\`}>
                                                    {((total - item.previous)/item.previous) >= 0 ? '↑' : '↓'}{Math.abs(((total - item.previous)/item.previous) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        )}`;

// We need to be careful about the regex matching.
// I'll read the file content and use `indexOf` on a unique part of the OLD code.
// Unique part: `text-[7px] text-gray-400 font-medium tracking-tight`

const uniqueOldPart = 'text-[7px] text-gray-400 font-medium tracking-tight';

if (content.includes(uniqueOldPart)) {
    // We are in the right file and state.
    // I will replace the ENTIRE inner block of the "Right Side" div.

    // Find the Container Start
    const containerStart = '<div className="flex flex-col items-end min-w-[60px] bg-white pl-1">';
    const startIdx = content.indexOf(containerStart);

    if (startIdx !== -1) {
        // Find the END of this container.
        // It ends at line 365.
        // I'll use logical replacement.

        // I'll replace the content INSIDE the div.
        // Inner Start: `>` of container.
        const innerStartIdx = startIdx + containerStart.length;

        // Find where the container closes.
        // It contains `formatLargeValue(total` and `{item.previous`.
        // I'll search for the CLOSING </div> of this specific container.
        // It is followed by `</div>` (closing flex justify-between).
        // It is followed by `<div className="w-full bg-gray-100`.

        const nextSibling = '<div className="w-full bg-gray-100';
        const siblingIdx = content.indexOf(nextSibling, startIdx);

        if (siblingIdx !== -1) {
            // The closing div is before siblingIdx.
            const endIdx = content.lastIndexOf('</div>', siblingIdx); // This might find nested div close?
            // Wait, the container has nested divs inside `{}` blocks.
            // But the content ends with `)} </div>`.
            // So looking for `</div>` before the sibling is correct IF `match` loops don't interfere.
            // Actually, `</div>` is line 365. Sibling is Line 367.
            // There is `</div>` on line 366 (Closing flex justify-between).

            // So:
            // Container (355)
            //    Content...
            // Close Container (365)
            // Close Justify-Between (366)
            // Sibling (367)

            // So `lastIndexOf('</div>', siblingIdx)` finds line 366.
            // We want the one BEFORE that. `lastIndexOf('</div>', line366Idx - 1)`.

            const closeJustifyIdx = content.lastIndexOf('</div>', siblingIdx);
            // Only purely whitespace between closeContainer and closeJustify?
            // Line 365: `                                    </div>`
            // Line 366: `                                </div>`

            const closeContainerIdx = content.lastIndexOf('</div>', closeJustifyIdx - 1);

            console.log(`Replacing content from ${innerStartIdx} to ${closeContainerIdx}`);

            const replacement = `
                                        ${newContent}
                                    `;

            content = content.substring(0, innerStartIdx) + replacement + content.substring(closeContainerIdx);
            console.log('✅ Enriched Horizontal Chart Text (Larger, Bolder, Badges)');
            fs.writeFileSync(filePath, content, 'utf8');
        } else {
            console.log('⚠️ Could not find sibling element to anchor replacement.');
        }
    } else {
        console.log('⚠️ Could not find container start.');
    }
} else {
    console.log('⚠️ Could not find unique old code part. Maybe already updated?');
}
