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
        <div className="fixed inset-0 bg-white z-[9999] overflow-auto print:relative">
            {/* Close button - only visible on screen */}
            <button
                onClick={onClose}
                className="fixed top-4 right-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 print:hidden"
            >
                Close Preview
            </button>

            {/* Print content */}
            <div className="max-w-4xl mx-auto p-8 print:p-0">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black uppercase mb-2">Minutes of Meeting (MOM)</h1>
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-12 h-1 bg-indigo-600"></div>
                        <span className="text-xs font-black text-indigo-600 uppercase">Official Record</span>
                        <div className="w-12 h-1 bg-indigo-600"></div>
                    </div>
                    <div className="font-black text-lg mb-2">{mom.title}</div>
                    <div className="text-sm font-bold text-gray-600">Date: {mom.date}</div>
                </div>

                {/* Attendees */}
                {mom.attendees && mom.attendees.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-xs font-black uppercase text-gray-400 mb-2">Attendees ({mom.attendees.length})</h3>
                        <div className="flex flex-wrap gap-2">
                            {mom.attendees.map((attendee, idx) => (
                                <span key={idx} className="bg-gray-100 px-3 py-1 rounded text-sm font-bold border border-gray-200">
                                    {attendee}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Agenda Items */}
                <table className="w-full border-collapse mb-12">
                    <thead>
                        <tr className="border-b-2 border-gray-900">
                            <th className="py-3 text-left w-12 text-xs font-black uppercase text-gray-400">#</th>
                            <th className="py-3 text-left text-xs font-black uppercase text-gray-400">Agenda & Discussion</th>
                            <th className="py-3 text-left w-48 text-xs font-black uppercase text-gray-400">Action Account</th>
                            <th className="py-3 text-left w-32 text-xs font-black uppercase text-gray-400">Timeline</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mom.items?.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100" style={{ pageBreakInside: 'avoid' }}>
                                <td className="py-4 align-top text-sm font-black">{item.slNo}</td>
                                <td className="py-4 px-2 align-top">
                                    <div className="font-black text-sm mb-1">{item.agendaItem}</div>
                                    <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                                        {item.discussion}
                                    </div>
                                </td>
                                <td className="py-4 align-top pr-2">
                                    <div className="flex flex-wrap gap-1">
                                        {item.actionAccount.map(acc => (
                                            <span key={acc} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold border border-gray-200">
                                                {acc}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="py-4 align-top">
                                    <div className="text-xs font-black">{item.timeline}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Signatures */}
                <div className="flex justify-around mt-16 pt-8 border-t border-gray-900" style={{ pageBreakInside: 'avoid' }}>
                    <div className="text-center">
                        <div className="w-48 border-t border-gray-900 pt-2">
                            <p className="text-xs font-black uppercase">Prepared By</p>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="w-48 border-t border-gray-900 pt-2">
                            <p className="text-xs font-black uppercase">Approved By</p>
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
                    }
                    
                    table {
                        page-break-inside: auto;
                    }
                    
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                }
            `}</style>
        </div>
    );
};
