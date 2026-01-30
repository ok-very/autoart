/**
 * Invoice DOCX Formatter
 *
 * Generates a Word document from InvoiceExportModel using the `docx` package.
 * Uses Source Serif 4 for content and IBM Plex Mono for amounts,
 * following the AutoArt design system parchment aesthetic.
 *
 * Returns a `docx.Document` object. Caller serializes with `Packer.toBuffer()`.
 */

import {
    Document,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TextRun,
    AlignmentType,
    BorderStyle,
    WidthType,
    HeadingLevel,
    TableLayoutType,
    ShadingType,
    convertInchesToTwip,
} from 'docx';

import type { InvoiceExportModel } from './invoice-pdf-formatter.js';

// ============================================================================
// DESIGN TOKENS
// ============================================================================

const FONTS = {
    serif: 'Source Serif 4',
    serifFallback: 'Georgia',
    mono: 'IBM Plex Mono',
    monoFallback: 'Courier New',
};

const COLORS = {
    charcoalInk: '2E2E2C',
    secondary: '5A5A57',
    ashTaupe: 'D6D2CB',
    oxideBlue: '3F5C6E',
    burntUmber: '8A5A3C',
    mossGreen: '6F7F5C',
    ironRed: '8C4A4A',
    parchment: 'F5F2ED',
};

const BORDER_THIN = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: COLORS.ashTaupe,
};

const BORDER_NONE = {
    style: BorderStyle.NONE,
    size: 0,
    color: 'FFFFFF',
};

const BORDER_THICK = {
    style: BorderStyle.SINGLE,
    size: 2,
    color: COLORS.charcoalInk,
};

// ============================================================================
// HELPERS
// ============================================================================

function formatCents(cents: number, currency: string): string {
    const dollars = cents / 100;
    return dollars.toLocaleString('en-CA', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function monoRun(text: string, options?: { bold?: boolean; size?: number; color?: string }): TextRun {
    return new TextRun({
        text,
        font: { name: FONTS.mono, hint: undefined },
        size: options?.size ?? 24, // 12pt
        bold: options?.bold,
        color: options?.color ?? COLORS.charcoalInk,
    });
}

function serifRun(text: string, options?: { bold?: boolean; size?: number; color?: string; allCaps?: boolean }): TextRun {
    return new TextRun({
        text,
        font: { name: FONTS.serif, hint: undefined },
        size: options?.size ?? 28, // 14pt
        bold: options?.bold,
        color: options?.color ?? COLORS.charcoalInk,
        allCaps: options?.allCaps,
    });
}

function labelRun(text: string): TextRun {
    return new TextRun({
        text,
        font: { name: FONTS.serif, hint: undefined },
        size: 20, // 10pt
        color: COLORS.burntUmber,
        allCaps: true,
    });
}

function noBorderCell(children: Paragraph[], options?: { width?: number }): TableCell {
    return new TableCell({
        children,
        borders: {
            top: BORDER_NONE,
            bottom: BORDER_NONE,
            left: BORDER_NONE,
            right: BORDER_NONE,
        },
        width: options?.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    });
}

// ============================================================================
// DOCUMENT BUILDER
// ============================================================================

export function generateInvoiceDocx(invoice: InvoiceExportModel): Document {
    const { currency } = invoice;

    return new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: FONTS.serif,
                        size: 28, // 14pt
                        color: COLORS.charcoalInk,
                    },
                    paragraph: {
                        spacing: { line: 276 }, // 1.5 line height
                    },
                },
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: convertInchesToTwip(0.75),
                            right: convertInchesToTwip(0.75),
                            bottom: convertInchesToTwip(0.75),
                            left: convertInchesToTwip(0.75),
                        },
                    },
                },
                children: [
                    // ── Header ──────────────────────────────────
                    ...buildHeader(invoice),

                    // ── Client Block ────────────────────────────
                    ...buildClientBlock(invoice),

                    // ── Line Items ──────────────────────────────
                    ...buildLineItemsTable(invoice, currency),

                    // ── Totals ──────────────────────────────────
                    ...buildTotals(invoice, currency),

                    // ── Payment History ─────────────────────────
                    ...buildPaymentHistory(invoice, currency),

                    // ── Notes ───────────────────────────────────
                    ...buildNotes(invoice),
                ],
            },
        ],
    });
}

// ============================================================================
// SECTIONS
// ============================================================================

function buildHeader(invoice: InvoiceExportModel): Paragraph[] {
    const statusText = invoice.status.toUpperCase();

    return [
        // Two-column header via a borderless table
        new Paragraph({
            children: [],
        }),
        ...buildHeaderTable(invoice, statusText),
        // Divider line
        new Paragraph({
            border: {
                bottom: { style: BorderStyle.SINGLE, size: 3, color: COLORS.charcoalInk },
            },
            spacing: { before: 100, after: 300 },
        }),
    ];
}

function buildHeaderTable(invoice: InvoiceExportModel, statusText: string): Paragraph[] {
    // Use a single-row borderless table for left/right layout
    const headerTable = new Table({
        rows: [
            new TableRow({
                children: [
                    // Left: INVOICE title + status
                    noBorderCell([
                        new Paragraph({
                            children: [
                                serifRun('INVOICE', { bold: true, size: 40 }), // 20pt
                            ],
                            spacing: { after: 80 },
                        }),
                        new Paragraph({
                            children: [
                                serifRun(statusText, {
                                    size: 22,
                                    bold: true,
                                    color: statusColor(invoice.status),
                                    allCaps: true,
                                }),
                            ],
                        }),
                    ], { width: 50 }),
                    // Right: Invoice metadata
                    noBorderCell([
                        new Paragraph({
                            children: [labelRun('Invoice Number')],
                            alignment: AlignmentType.RIGHT,
                        }),
                        new Paragraph({
                            children: [monoRun(invoice.invoiceNumber, { size: 26 })],
                            alignment: AlignmentType.RIGHT,
                            spacing: { after: 120 },
                        }),
                        new Paragraph({
                            children: [labelRun('Issue Date')],
                            alignment: AlignmentType.RIGHT,
                        }),
                        new Paragraph({
                            children: [monoRun(invoice.issueDate || '\u2014', { size: 26 })],
                            alignment: AlignmentType.RIGHT,
                            spacing: { after: 120 },
                        }),
                        new Paragraph({
                            children: [labelRun('Due Date')],
                            alignment: AlignmentType.RIGHT,
                        }),
                        new Paragraph({
                            children: [monoRun(invoice.dueDate || '\u2014', { size: 26 })],
                            alignment: AlignmentType.RIGHT,
                        }),
                    ], { width: 50 }),
                ],
            }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
    });

    // Paragraphs can't contain tables directly; return as array with table cast
    return [headerTable as unknown as Paragraph];
}

function buildClientBlock(invoice: InvoiceExportModel): Paragraph[] {
    const parts: Paragraph[] = [
        new Paragraph({
            children: [labelRun('Bill To')],
            spacing: { after: 60 },
        }),
    ];

    if (invoice.client.name) {
        parts.push(new Paragraph({
            children: [serifRun(invoice.client.name, { bold: true })],
        }));
    }
    if (invoice.client.company) {
        parts.push(new Paragraph({
            children: [serifRun(invoice.client.company)],
        }));
    }
    if (invoice.client.address) {
        parts.push(new Paragraph({
            children: [serifRun(invoice.client.address, { color: COLORS.secondary })],
        }));
    }
    if (invoice.client.email) {
        parts.push(new Paragraph({
            children: [serifRun(invoice.client.email, { color: COLORS.secondary })],
        }));
    }
    if (invoice.client.phone) {
        parts.push(new Paragraph({
            children: [serifRun(invoice.client.phone, { color: COLORS.secondary })],
        }));
    }

    parts.push(new Paragraph({ spacing: { after: 300 } }));

    return parts;
}

function buildLineItemsTable(invoice: InvoiceExportModel, currency: string): Paragraph[] {
    if (invoice.lineItems.length === 0) return [];

    const headerRow = new TableRow({
        tableHeader: true,
        children: [
            headerCell('Description', AlignmentType.LEFT, 40),
            headerCell('Qty', AlignmentType.RIGHT, 10),
            headerCell('Unit Price', AlignmentType.RIGHT, 18),
            headerCell('Tax', AlignmentType.RIGHT, 12),
            headerCell('Amount', AlignmentType.RIGHT, 20),
        ],
    });

    const dataRows = invoice.lineItems.map((li) =>
        new TableRow({
            children: [
                // Description + item type
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [serifRun(li.description)],
                        }),
                        ...(li.itemType ? [new Paragraph({
                            children: [serifRun(li.itemType, { size: 22, color: COLORS.secondary })],
                        })] : []),
                    ],
                    borders: { top: BORDER_NONE, bottom: BORDER_THIN, left: BORDER_NONE, right: BORDER_NONE },
                    width: { size: 40, type: WidthType.PERCENTAGE },
                }),
                // Qty
                dataCell(String(li.qty), AlignmentType.RIGHT, 10),
                // Unit price
                dataCell(formatCents(li.unitPrice, currency), AlignmentType.RIGHT, 18),
                // Tax rate
                dataCell(`${li.vatRate}%`, AlignmentType.RIGHT, 12),
                // Line total
                dataCell(formatCents(li.lineTotal, currency), AlignmentType.RIGHT, 20, true),
            ],
        })
    );

    const table = new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
    });

    return [table as unknown as Paragraph];
}

function buildTotals(invoice: InvoiceExportModel, currency: string): Paragraph[] {
    const rows: TableRow[] = [
        totalsRow('Subtotal', formatCents(invoice.subtotal, currency)),
        totalsRow('Tax', formatCents(invoice.taxTotal, currency)),
        totalsSummaryRow('Total', formatCents(invoice.total, currency)),
    ];

    if (invoice.amountPaid > 0) {
        rows.push(
            totalsRow('Paid', `-${formatCents(invoice.amountPaid, currency)}`, COLORS.mossGreen),
            totalsSummaryRow('Balance Due', formatCents(invoice.balanceDue, currency)),
        );
    }

    const totalsTable = new Table({
        rows,
        width: { size: 40, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
    });

    return [
        new Paragraph({ spacing: { before: 300 } }),
        new Paragraph({
            children: [],
            alignment: AlignmentType.RIGHT,
        }),
        totalsTable as unknown as Paragraph,
    ];
}

function buildPaymentHistory(invoice: InvoiceExportModel, currency: string): Paragraph[] {
    if (invoice.payments.length === 0) return [];

    const parts: Paragraph[] = [
        new Paragraph({
            border: {
                top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.ashTaupe },
            },
            spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
            children: [labelRun('Payment History')],
            spacing: { after: 120 },
        }),
    ];

    const headerRow = new TableRow({
        tableHeader: true,
        children: [
            headerCell('Date', AlignmentType.LEFT, 25),
            headerCell('Method', AlignmentType.LEFT, 25),
            headerCell('Reference', AlignmentType.LEFT, 25),
            headerCell('Amount', AlignmentType.RIGHT, 25),
        ],
    });

    const paymentRows = invoice.payments.map((p) =>
        new TableRow({
            children: [
                dataCell(p.date, AlignmentType.LEFT, 25),
                dataCell(p.method, AlignmentType.LEFT, 25),
                dataCell(p.reference, AlignmentType.LEFT, 25),
                dataCell(formatCents(p.amount, currency), AlignmentType.RIGHT, 25),
            ],
        })
    );

    const table = new Table({
        rows: [headerRow, ...paymentRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
    });

    parts.push(table as unknown as Paragraph);
    return parts;
}

function buildNotes(invoice: InvoiceExportModel): Paragraph[] {
    if (!invoice.notes) return [];

    return [
        new Paragraph({ spacing: { before: 300 } }),
        new Paragraph({
            children: [serifRun(invoice.notes, { size: 26, color: COLORS.secondary })],
            shading: {
                type: ShadingType.CLEAR,
                color: 'auto',
                fill: COLORS.parchment,
            },
            indent: { left: convertInchesToTwip(0.15) },
            border: {
                left: { style: BorderStyle.SINGLE, size: 3, color: COLORS.oxideBlue },
            },
            spacing: { before: 200, after: 200 },
        }),
    ];
}

// ============================================================================
// TABLE CELL BUILDERS
// ============================================================================

function headerCell(text: string, alignment: (typeof AlignmentType)[keyof typeof AlignmentType], widthPct: number): TableCell {
    return new TableCell({
        children: [
            new Paragraph({
                children: [
                    new TextRun({
                        text: text.toUpperCase(),
                        font: { name: FONTS.serif, hint: undefined },
                        size: 20, // 10pt
                        bold: true,
                        color: COLORS.secondary,
                    }),
                ],
                alignment,
            }),
        ],
        borders: {
            top: BORDER_NONE,
            bottom: BORDER_THICK,
            left: BORDER_NONE,
            right: BORDER_NONE,
        },
        width: { size: widthPct, type: WidthType.PERCENTAGE },
    });
}

function dataCell(text: string, alignment: (typeof AlignmentType)[keyof typeof AlignmentType], widthPct: number, bold?: boolean): TableCell {
    return new TableCell({
        children: [
            new Paragraph({
                children: [monoRun(text, { bold })],
                alignment,
            }),
        ],
        borders: {
            top: BORDER_NONE,
            bottom: BORDER_THIN,
            left: BORDER_NONE,
            right: BORDER_NONE,
        },
        width: { size: widthPct, type: WidthType.PERCENTAGE },
    });
}

function totalsRow(label: string, amount: string, amountColor?: string): TableRow {
    return new TableRow({
        children: [
            noBorderCell([
                new Paragraph({
                    children: [serifRun(label, { size: 28 })],
                }),
            ], { width: 60 }),
            noBorderCell([
                new Paragraph({
                    children: [monoRun(amount, { color: amountColor })],
                    alignment: AlignmentType.RIGHT,
                }),
            ], { width: 40 }),
        ],
    });
}

function totalsSummaryRow(label: string, amount: string): TableRow {
    return new TableRow({
        children: [
            new TableCell({
                children: [
                    new Paragraph({
                        children: [serifRun(label, { bold: true, size: 32 })],
                    }),
                ],
                borders: {
                    top: BORDER_THICK,
                    bottom: BORDER_NONE,
                    left: BORDER_NONE,
                    right: BORDER_NONE,
                },
                width: { size: 60, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
                children: [
                    new Paragraph({
                        children: [monoRun(amount, { bold: true, size: 32 })],
                        alignment: AlignmentType.RIGHT,
                    }),
                ],
                borders: {
                    top: BORDER_THICK,
                    bottom: BORDER_NONE,
                    left: BORDER_NONE,
                    right: BORDER_NONE,
                },
                width: { size: 40, type: WidthType.PERCENTAGE },
            }),
        ],
    });
}

// ============================================================================
// STATUS COLOR MAP
// ============================================================================

function statusColor(status: string): string {
    switch (status.toLowerCase()) {
        case 'draft': return COLORS.secondary;
        case 'sent': return COLORS.oxideBlue;
        case 'paid': return COLORS.mossGreen;
        case 'overdue': return COLORS.ironRed;
        case 'void': return COLORS.secondary;
        default: return COLORS.charcoalInk;
    }
}
