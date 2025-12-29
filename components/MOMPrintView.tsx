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

interface Attendee {
    id: string;
    name: string;
}

interface MOMPrintViewProps {
    mom: MOM;
    attendeeMaster: Attendee[];
    onClose: () => void;
}

export const MOMPrintView: React.FC<MOMPrintViewProps> = ({ mom, attendeeMaster, onClose }) => {
    React.useEffect(() => {
        // Filter out empty agenda items
        const validItems = mom.items?.filter(item =>
            item.agendaItem?.trim() || item.discussion?.trim()
        ) || [];

        // Resolve attendee IDs to names with robust checking
        const attendeeNames = mom.attendees?.map(id => {
            const cleanId = (id || '').trim();
            const attendee = attendeeMaster.find(a => a.id.toLowerCase() === cleanId.toLowerCase());
            return attendee ? attendee.name : cleanId; // Fallback to ID if not found
        }) || [];

        // Create print content HTML
        const printHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${mom.title} - ${mom.date}</title>
    <style>
        /* Reset */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #000;
            background: white;
            /* Ensure content can flow to multiple pages */
            height: auto !important;
            overflow: visible !important;
            display: block !important;
        }

        /* Page setup */
        @page {
            size: A4 portrait;
            margin: 15mm;
        }

        /* Header */
        .page-header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid #000;
        }

        .company-name {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 6px;
            text-transform: uppercase;
        }

        .document-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 10px;
            text-transform: uppercase;
        }

        .meeting-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .meeting-date {
            font-size: 12px;
            color: #333;
        }

        /* Attendees */
        .attendees-section {
            margin-bottom: 16px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .attendees-section h3 {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            color: #666;
            margin-bottom: 6px;
        }

        .attendees-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .attendee-badge {
            background: #f5f5f5;
            border: 1px solid #ccc;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
        }

        /* Table */
        .agenda-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        .agenda-table thead {
            display: table-header-group;
        }

        .agenda-table tbody {
            display: table-row-group;
        }

        .agenda-table thead tr {
            border-bottom: 2px solid #000;
        }

        .agenda-table th {
            padding: 8px 4px;
            text-align: left;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            color: #666;
        }

        .col-number { width: 30px; }
        .col-action { width: 140px; }
        .col-timeline { width: 100px; }

        .agenda-row {
            border-bottom: 1px solid #ddd;
            page-break-inside: auto; /* Allow breaking inside rows if needed, or avoid */
            break-inside: avoid;
        }

        .agenda-table td {
            padding: 10px 4px;
            vertical-align: top;
            font-size: 11px;
        }

        .cell-number {
            font-weight: 600;
        }

        .agenda-title {
            font-weight: 600;
            margin-bottom: 4px;
            color: #000;
        }

        .agenda-discussion {
            font-size: 10px;
            color: #333;
            white-space: pre-wrap;
            line-height: 1.5;
        }

        .action-list {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .action-badge {
            background: #f5f5f5;
            border: 1px solid #ccc;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 500;
            display: inline-block;
        }

        .cell-timeline {
            font-size: 10px;
            font-weight: 500;
        }

        /* Signatures */
        .signatures-footer {
            display: flex;
            justify-content: space-around;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #000;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .signature-block {
            text-align: center;
        }

        .signature-line {
            width: 150px;
            border-top: 1px solid #666;
            margin-bottom: 6px;
        }

        .signature-block p {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            color: #666;
        }

        @media print {
            html, body {
                height: auto !important;
                overflow: visible !important;
            }
            .print-button {
                display: none;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="page-header">
        <h1 class="company-name">Siddhi Kabel Corporation</h1>
        <h2 class="document-title">Minutes of Meeting</h2>
        <div class="meeting-title">${mom.title}</div>
        <div class="meeting-date">Date: ${mom.date}</div>
    </div>

    <!-- Attendees -->
    ${attendeeNames && attendeeNames.length > 0 ? `
    <div class="attendees-section">
        <h3>Attendees (${attendeeNames.length})</h3>
        <div class="attendees-list">
            ${attendeeNames.map(name => `
                <span class="attendee-badge">${name}</span>
            `).join('')}
        </div>
    </div>
    ` : ''}

    <!-- Agenda Table -->
    ${validItems.length > 0 ? `
    <table class="agenda-table">
        <thead>
            <tr>
                <th class="col-number">#</th>
                <th class="col-agenda">Agenda & Discussion</th>
                <th class="col-action">Action</th>
                <th class="col-timeline">Timeline</th>
            </tr>
        </thead>
        <tbody>
            ${validItems.map(item => `
                <tr class="agenda-row">
                    <td class="cell-number">${item.slNo}</td>
                    <td class="cell-agenda">
                        ${item.agendaItem ? `<div class="agenda-title">${item.agendaItem}</div>` : ''}
                        ${item.discussion ? `<div class="agenda-discussion">${item.discussion}</div>` : ''}
                    </td>
                    <td class="cell-action">
                        ${item.actionAccount && item.actionAccount.length > 0 ? `
                            <div class="action-list">
                                ${item.actionAccount.map(acc => `
                                    <span class="action-badge">${acc}</span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </td>
                    <td class="cell-timeline">
                        ${item.timeline ? `<div>${item.timeline}</div>` : ''}
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    ` : ''}

    <!-- Signatures -->
    <div class="signatures-footer">
        <div class="signature-block">
            <div class="signature-line"></div>
            <p>Prepared By</p>
        </div>
        <div class="signature-block">
            <div class="signature-line"></div>
            <p>Approved By</p>
        </div>
    </div>
    <script>
        window.onload = function() {
             setTimeout(function() {
                 window.print();
             }, 500);
        }
    </script>
</body>
</html>
        `;

        // Open in new window
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(printHTML);
            printWindow.document.close();
        }

        // Close the modal immediately
        onClose();

        return () => {
            // Cleanup if needed
        };
    }, [mom, attendeeMaster, onClose]);

    // Return null since we're opening a new window
    return null;
};
