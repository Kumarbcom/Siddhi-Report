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
        const timer = setTimeout(() => {
            window.print();
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    // Filter out empty agenda items
    const validItems = mom.items?.filter(item =>
        item.agendaItem?.trim() || item.discussion?.trim()
    ) || [];

    return (
        <div className="mom-print-container">
            {/* Screen-only header */}
            <div className="screen-only-header">
                <h2>MOM Print Preview</h2>
                <button onClick={onClose}>Close Preview</button>
            </div>

            {/* Print content */}
            <div className="print-content">
                {/* Company & Title Header */}
                <div className="page-header">
                    <h1 className="company-name">Siddhi Kabel Corporation</h1>
                    <h2 className="document-title">Minutes of Meeting</h2>
                    <div className="meeting-info">
                        <div className="meeting-title">{mom.title}</div>
                        <div className="meeting-date">Date: {mom.date}</div>
                    </div>
                </div>

                {/* Attendees - Only if present */}
                {mom.attendees && mom.attendees.length > 0 && (
                    <div className="attendees-section">
                        <h3>Attendees ({mom.attendees.length})</h3>
                        <div className="attendees-list">
                            {mom.attendees.map((attendee, idx) => (
                                <span key={idx} className="attendee-badge">{attendee}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Agenda Table - Only valid items */}
                {validItems.length > 0 && (
                    <table className="agenda-table">
                        <thead>
                            <tr>
                                <th className="col-number">#</th>
                                <th className="col-agenda">Agenda & Discussion</th>
                                <th className="col-action">Action</th>
                                <th className="col-timeline">Timeline</th>
                            </tr>
                        </thead>
                        <tbody>
                            {validItems.map((item, index) => (
                                <tr key={item.id} className="agenda-row">
                                    <td className="cell-number">{item.slNo}</td>
                                    <td className="cell-agenda">
                                        {item.agendaItem && (
                                            <div className="agenda-title">{item.agendaItem}</div>
                                        )}
                                        {item.discussion && (
                                            <div className="agenda-discussion">{item.discussion}</div>
                                        )}
                                    </td>
                                    <td className="cell-action">
                                        {item.actionAccount && item.actionAccount.length > 0 && (
                                            <div className="action-list">
                                                {item.actionAccount.map(acc => (
                                                    <span key={acc} className="action-badge">{acc}</span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="cell-timeline">
                                        {item.timeline && <div>{item.timeline}</div>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Signatures Footer */}
                <div className="signatures-footer">
                    <div className="signature-block">
                        <div className="signature-line"></div>
                        <p>Prepared By</p>
                    </div>
                    <div className="signature-block">
                        <div className="signature-line"></div>
                        <p>Approved By</p>
                    </div>
                </div>
            </div>

            <style>{`
                /* ============================================
                   SCREEN VIEW STYLES
                   ============================================ */
                .mom-print-container {
                    position: fixed;
                    inset: 0;
                    background: white;
                    z-index: 9999;
                    overflow-y: auto;
                }

                .screen-only-header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: white;
                    border-bottom: 1px solid #e5e7eb;
                    padding: 12px 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 10;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }

                .screen-only-header h2 {
                    font-size: 14px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #111827;
                    margin: 0;
                }

                .screen-only-header button {
                    padding: 8px 16px;
                    background: #111827;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .screen-only-header button:hover {
                    background: #374151;
                }

                .print-content {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 80px 32px 32px;
                }

                /* ============================================
                   COMMON STYLES (Screen & Print)
                   ============================================ */
                .page-header {
                    text-align: center;
                    margin-bottom: 24px;
                    padding-bottom: 16px;
                    border-bottom: 2px solid #1f2937;
                }

                .company-name {
                    font-size: 18px;
                    font-weight: 700;
                    color: #1f2937;
                    margin: 0 0 8px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .document-title {
                    font-size: 20px;
                    font-weight: 700;
                    color: #111827;
                    margin: 0 0 12px 0;
                    text-transform: uppercase;
                }

                .meeting-info {
                    margin-top: 8px;
                }

                .meeting-title {
                    font-size: 15px;
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 4px;
                }

                .meeting-date {
                    font-size: 13px;
                    color: #6b7280;
                }

                .attendees-section {
                    margin-bottom: 20px;
                }

                .attendees-section h3 {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #6b7280;
                    margin: 0 0 8px 0;
                }

                .attendees-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .attendee-badge {
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 500;
                    color: #374151;
                }

                .agenda-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 40px;
                }

                .agenda-table thead tr {
                    border-bottom: 2px solid #1f2937;
                }

                .agenda-table th {
                    padding: 8px 4px;
                    text-align: left;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #6b7280;
                }

                .col-number { width: 40px; }
                .col-action { width: 160px; }
                .col-timeline { width: 110px; }

                .agenda-row {
                    border-bottom: 1px solid #e5e7eb;
                }

                .agenda-table td {
                    padding: 12px 4px;
                    vertical-align: top;
                    font-size: 12px;
                    color: #374151;
                }

                .cell-number {
                    font-weight: 600;
                }

                .agenda-title {
                    font-weight: 600;
                    margin-bottom: 4px;
                    color: #111827;
                }

                .agenda-discussion {
                    font-size: 11px;
                    color: #4b5563;
                    white-space: pre-wrap;
                    line-height: 1.5;
                }

                .action-list {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .action-badge {
                    background: #f9fafb;
                    border: 1px solid #e5e7eb;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 500;
                    display: inline-block;
                }

                .cell-timeline {
                    font-size: 11px;
                    font-weight: 500;
                }

                .signatures-footer {
                    display: flex;
                    justify-content: space-around;
                    margin-top: 48px;
                    padding-top: 24px;
                    border-top: 2px solid #1f2937;
                }

                .signature-block {
                    text-align: center;
                }

                .signature-line {
                    width: 160px;
                    border-top: 1px solid #9ca3af;
                    margin-bottom: 8px;
                }

                .signature-block p {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: #6b7280;
                    margin: 0;
                }

                /* ============================================
                   PRINT-SPECIFIC STYLES
                   ============================================ */
                @media print {
                    /* Hide screen-only elements */
                    .screen-only-header {
                        display: none !important;
                    }

                    /* Reset container for print */
                    .mom-print-container {
                        position: static;
                        overflow: visible;
                        background: white;
                    }

                    .print-content {
                        max-width: 100%;
                        padding: 0;
                        margin: 0;
                    }

                    /* Page setup */
                    @page {
                        size: A4;
                        margin: 15mm 15mm 15mm 15mm;
                    }

                    /* Ensure body/html don't constrain */
                    html, body {
                        height: auto !important;
                        overflow: visible !important;
                        margin: 0;
                        padding: 0;
                    }
                    
                    /* All containers must allow expansion */
                    * {
                        max-height: none !important;
                    }

                    /* Header stays together */
                    .page-header {
                        page-break-after: avoid;
                        page-break-inside: avoid;
                    }

                    /* Attendees stay together */
                    .attendees-section {
                        page-break-after: avoid;
                        page-break-inside: avoid;
                    }

                    /* Table can break across pages */
                    .agenda-table {
                        page-break-inside: auto;
                    }

                    /* Rows can break across pages */
                    .agenda-row {
                        page-break-inside: auto;
                        page-break-after: auto;
                    }

                    /* Cells can break if needed */
                    .agenda-table td {
                        page-break-inside: auto;
                    }

                    /* Footer stays together on last page */
                    .signatures-footer {
                        page-break-inside: avoid;
                        page-break-before: auto;
                        margin-top: 48px;
                    }

                    /* Ensure black text in print */
                    * {
                        color: black !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    /* Keep borders visible */
                    .page-header,
                    .signatures-footer {
                        border-color: black !important;
                    }

                    .agenda-table thead tr {
                        border-color: black !important;
                    }
                }
            `}</style>
        </div>
    );
};
