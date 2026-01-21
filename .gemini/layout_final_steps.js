import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'components', 'DashboardView.tsx');

let content = fs.readFileSync(filePath, 'utf8');

// The Old Slicer Block Start
const oldStart = '<div className="flex flex-wrap items-center gap-2 lg:gap-3">';
// We need to find the matching closing div.
// It contains "Array.from({ length: 53 }" and Ends with "))} </select> </div> )}" usually.
// I'll search for the END of the sales block.
// The next line after the block is `</div>` (closing the activeSubTab 'sales' div).

// I'll use a brute force replacement of the KNOWN chunk of code I viewed in previous step.
// I'll construct the Old Block from the view.

const oldBlockSearch = `<div className="flex flex-wrap items-center gap-2 lg:gap-3">
                        <select value={selectedMake} onChange={e => setSelectedMake(e.target.value)} title="Make Slicer" className="bg-white border border-blue-300 text-[10px] rounded-md px-2 py-1.5 font-bold text-blue-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 max-w-[100px]">
                            {uniqueMakes.map(m => (
                                <option key={m} value={m}>{m === 'ALL' ? 'ALL MAKES' : m}</option>
                            ))}
                        </select>
                        <select value={selectedMatGroup} onChange={e => setSelectedMatGroup(e.target.value)} title="Material Group Slicer" className="bg-white border border-emerald-300 text-[10px] rounded-md px-2 py-1.5 font-bold text-emerald-700 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 max-w-[120px]">
                            {uniqueMatGroups.map(mg => (
                                <option key={mg} value={mg}>{mg === 'ALL' ? 'ALL GROUPS' : mg}</option>
                            ))}
                        </select>
                        <div className="flex bg-gray-100 p-1 rounded-lg">{(['FY', 'MONTH', 'WEEK'] as const).map(v => (<button key={v} onClick={() => setTimeView(v)} className={\`px-3 py-1 rounded-md text-xs font-medium transition-all \${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}\`}> {v} </button>))}</div>

                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setGroupingMode('MERGED')}
                                className={\`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all \${groupingMode === 'MERGED' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}\`}
                                title="Use Merged Groups (Giridhar, Office, Online)"
                            >
                                Merged
                            </button>
                            <button
                                onClick={() => setGroupingMode('RAW')}
                                className={\`px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all \${groupingMode === 'RAW' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}\`}
                                title="Use Raw Customer Groups (OEM, End User, etc.)"
                            >
                                Raw
                            </button>
                        </div>
                        <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500">{uniqueFYs.length > 0 ? uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>) : <option value="">No FY Data</option>}</select>

                        {timeView === 'MONTH' && (
                            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500">
                                {["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((m, i) => (
                                    <option key={m} value={i}>{m}</option>
                                ))}
                            </select>
                        )}

                        {timeView === 'WEEK' && (
                            <div className="flex items-center gap-2">
                                <select value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} className="bg-white border border-gray-300 text-xs rounded-md px-2 py-1.5 font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500">
                                    {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                                        <option key={w} value={w}>Week {w}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>`;

// Since formatting might differ (spaces/tabs), I will replace using `content.indexOf` logic for Start and End.
// Start: `<div className="flex flex-wrap items-center gap-2 lg:gap-3">`
// End: `)}` that closes the WEEK block? No, the div closes after WEEK block.
// I'll assume the structure is consistent.

// New Structure
const newBlock = `
                    <div className="flex flex-col items-end gap-1.5">
                        {/* Row 1: Filters */}
                        <div className="flex items-center gap-2">
                            <select value={selectedMake} onChange={e => setSelectedMake(e.target.value)} title="Make Slicer" className="bg-white border border-blue-300 text-[10px] rounded-md px-2 py-1 font-bold text-blue-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 h-7">
                                {uniqueMakes.map(m => ( <option key={m} value={m}>{m === 'ALL' ? 'ALL MAKES' : m}</option> ))}
                            </select>
                            <select value={selectedMatGroup} onChange={e => setSelectedMatGroup(e.target.value)} title="Material Group Slicer" className="bg-white border border-emerald-300 text-[10px] rounded-md px-2 py-1 font-bold text-emerald-700 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 h-7">
                                {uniqueMatGroups.map(mg => ( <option key={mg} value={mg}>{mg === 'ALL' ? 'ALL GROUPS' : mg}</option> ))}
                            </select>
                            <div className="flex bg-gray-100 p-0.5 rounded-md h-7 items-center">
                                <button onClick={() => setGroupingMode('MERGED')} className={\`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all \${groupingMode === 'MERGED' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}\`}>Merged</button>
                                <button onClick={() => setGroupingMode('RAW')} className={\`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all \${groupingMode === 'RAW' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}\`}>Raw</button>
                            </div>
                        </div>

                        {/* Row 2: Time & FY */}
                        <div className="flex items-center gap-2">
                            <div className="flex bg-gray-100 p-0.5 rounded-md h-7 items-center">
                                {(['FY', 'MONTH', 'WEEK'] as const).map(v => (
                                    <button key={v} onClick={() => setTimeView(v)} className={\`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all \${timeView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}\`}>{v}</button>
                                ))}
                            </div>
                            <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="bg-white border border-gray-300 text-[10px] rounded-md px-2 py-1 font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 h-7">
                                {uniqueFYs.length > 0 ? uniqueFYs.map(fy => <option key={fy} value={fy}>{fy}</option>) : <option value="">No Data</option>}
                            </select>
                        </div>

                        {/* Row 3: Detail Selectors */}
                        {(timeView === 'MONTH' || timeView === 'WEEK') && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                                {timeView === 'MONTH' && (
                                    <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-white border border-gray-300 text-[10px] rounded-md px-2 py-1 font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 h-7 w-24">
                                        {["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"].map((m, i) => ( <option key={m} value={i}>{m}</option> ))}
                                    </select>
                                )}
                                {timeView === 'WEEK' && (
                                    <select value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} className="bg-white border border-gray-300 text-[10px] rounded-md px-2 py-1 font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 h-7 w-24">
                                        {Array.from({ length: 53 }, (_, i) => i + 1).map(w => ( <option key={w} value={w}>Week {w}</option> ))}
                                    </select>
                                )}
                            </div>
                        )}
                    </div>`;

// Execution
const startMarker = '<div className="flex flex-wrap items-center gap-2 lg:gap-3">';
const startIdx = content.indexOf(startMarker);

if (startIdx !== -1) {
    // Find the end.
    // We look for the closing div of this container.
    // It is followed by `)}`
    // I will count braces/divs? No.
    // I'll look for `</select>` of WEEK? Or `</div>` of WEEK?
    // The old block had:
    // ...
    // {timeView === 'WEEK' && ( ... </div> )} </div>
    // So the sequence `)} </div>` at the end
    // But ` MONTH` block also has `)}`.

    // I'll scan forward for `</div>` until I find the one that closes the main div.
    // It's the one before `)}` (closing activeSubTab 'sales').

    // Actually, I can use a simpler marker:
    const endMarker = '))} </select> </div> )} </div>'; // Brittle.

    // Let's use `indexOf` for the Weekly block content end.
    const weekMarker = '{Array.from({ length: 53 }, (_, i) => i + 1).map(w => (';
    const weekIdx = content.indexOf(weekMarker, startIdx);
    if (weekIdx !== -1) {
        // Find the closure of the week block.
        // It ends with `</select> </div> )}`
        const closeWeekIdx = content.indexOf('</select>', weekIdx);
        // Then `</div>` (closing flex gap-2)
        // Then `)}` (closing timeView===WEEK)
        // Then `</div>` (closing main slicer div)

        // I'll look for `</div>` at offset closeWeekIdx + some.
        // I will take a substring around there and find the last `</div>`.

        // Let's rely on the fact that the previous view showed lines 1858-1860+
        // 1860: {Array.from...
        // 1861: <option...
        // 1862: ))}
        // 1863: </select>
        // 1864: </div>
        // 1865: )}
        // 1866: </div> (Closing Slicer Div)

        // I'll search for `</div>` after `</select>` of week.
        // Then `)}`.
        // Then `</div>`.

        let cursor = closeWeekIdx;
        cursor = content.indexOf('</div>', cursor) + 6; // closes week div
        cursor = content.indexOf(')}', cursor) + 2;     // closes week conditional

        // The NEXT `</div>` is the one we want. (Closing slicer div).
        // Wait, what if week is NOT rendered (conditional)?
        // Ah, this is source code replacement. The code is STATIC.
        // The code EXIST in the file.

        // So yes, scanning past the Week block is safe.
        const msg = content.substring(cursor, cursor + 20); // Debug
        // Expected: `</div>` or spaces/newlines then `</div>`.
        const blockEndIdx = content.indexOf('</div>', cursor) + 6;

        console.log(`Replacing logic from ${startIdx} to ${blockEndIdx}`);
        content = content.substring(0, startIdx) + newBlock + content.substring(blockEndIdx);
        console.log('✅ Replaced Slicer Section with Stacked Layout (3 Steps)');
        fs.writeFileSync(filePath, content, 'utf8');
    } else {
        console.log('⚠️ Could not find Week Block inside Slicers.');
    }
} else {
    console.log('⚠️ Could not find Slicer Start Marker.');
}
