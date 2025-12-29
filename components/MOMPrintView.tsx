import React from 'react';

interface MOMItem {
    id: string;
    slNo: number;
    agendaItem: string;
    discussion: string;
    actionAccount: string[];
    timeline: string;
}

interface MOM {
    id?: string;
    title: string;
    date: string;
    attendees: string[];
    items: MOMItem[];
}

interface MOMPrintViewProps {
    mom: MOM;
    onClose: () => void;
}

export const MOMPrintView: React.FC<MOMPrintViewProps> = ({ mom, onClose }) => {
    React.useEffect(() => {
        // Auto-print when component mounts
        const timer = setTimeout(() => {
            window.print();
        }, 500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 bg-white z-[9999] print:static print:w-full print:h-auto">
            {/* Close button - only visible on screen */}
            <div className="print:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 p-3 flex justify-between items-center z-10 shadow-sm">
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">MOM Print Preview</h2>
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 text-sm font-bold transition-colors"
                >
                    Close Preview
                </button>
            </div>

            {/* Print content */}
            <div className="min-h-screen overflow-y-auto pt-14 print:min-h-0 print:h-auto print:overflow-visible print:pt-0">
                <div className="max-w-4xl mx-auto p-8 print:p-0 print:max-w-none print:w-full">
                    {/* Header */}
                    <div className="text-center mb-6 pb-4 border-b-2 border-gray-900">
                        <h1 className="text-2xl font-bold uppercase mb-3 tracking-wide">Minutes of Meeting</h1>
                        <div className="text-base font-semibold mb-1">{mom.title}</div>
                        <div className="text-sm text-gray-600">Date: {mom.date}</div>
                    </div>

                    {/* Attendees */}
                    {mom.attendees && mom.attendees.length > 0 && (
                        <div className="mb-5">
                            <h3 className="text-xs font-semibold uppercase text-gray-600 mb-2">Attendees ({mom.attendees.length})</h3>
                            <div className="flex flex-wrap gap-1.5">
                                {mom.attendees.map((attendee, idx) => (
                                    <span key={idx} className="bg-gray-50 px-2.5 py-1 rounded text-xs font-medium border border-gray-200">
                                        {attendee}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Agenda Items */}
                    <table className="w-full border-collapse mb-10">
                        <thead>
                            <tr className="border-b-2 border-gray-800">
                                <th className="py-2 text-left w-10 text-xs font-semibold uppercase text-gray-600">#</th>
                                <th className="py-2 text-left text-xs font-semibold uppercase text-gray-600">Agenda & Discussion</th>
                                <th className="py-2 text-left w-40 text-xs font-semibold uppercase text-gray-600">Action</th>
                                <th className="py-2 text-left w-28 text-xs font-semibold uppercase text-gray-600">Timeline</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mom.items?.map((item, index) => (
                                <tr key={item.id} className="border-b border-gray-200" style={{ pageBreakBefore: index > 0 ? 'auto' : 'avoid', pageBreakAfter: 'auto' }}>
                                    <td className="py-3 align-top text-sm font-semibold">{item.slNo}</td>
                                    <td className="py-3 px-2 align-top">
                                        <div className="font-semibold text-sm mb-1">{item.agendaItem}</div>
                                        <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                                            {item.discussion}
                                        </div>
                                    </td>
                                    <td className="py-3 align-top pr-2">
                                        <div className="flex flex-wrap gap-1">
                                            {item.actionAccount.map(acc => (
                                                <span key={acc} className="bg-gray-50 text-gray-700 px-2 py-0.5 rounded text-xs font-medium border border-gray-200">
                                                    {acc}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-3 align-top">
                                        <div className="text-xs font-medium">{item.timeline}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Signatures */}
                    <div className="flex justify-around mt-12 pt-6 border-t-2 border-gray-800" style={{ pageBreakInside: 'avoid' }}>
                        <div className="text-center">
                            <div className="w-40 border-t border-gray-400 pt-2">
                                <p className="text-xs font-semibold uppercase text-gray-600">Prepared By</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="w-40 border-t border-gray-400 pt-2">
                                <p className="text-xs font-semibold uppercase text-gray-600">Approved By</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        margin: 15mm;
                        size: A4;
                    }
                    
                    body {
                        margin: 0;
                        padding: 0;
                        overflow: visible;
                    }
                    
                    /* Force all containers to expand */
                    div {
                        height: auto !important;
                        max-height: none !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                    }
                    
                    table {
                        page-break-inside: auto;
                    }
                    
                    thead {
                        display: table-header-group;
                    }
                    
                    tr {
                        page-break-inside: auto;
                        page-break-after: auto;
                    }
                    
                    td {
                        page-break-inside: auto;
                    }
                }
            `}</style>
        </div>
    );
};
