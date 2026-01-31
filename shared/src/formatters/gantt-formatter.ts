/**
 * Gantt Formatter
 *
 * Generates HTML/SVG for Gantt chart export.
 * Consumed by both PDF export (Backend) and Print Preview (Frontend).
 */

import { GanttProjectionOutput } from '../types/gantt.js';
import { compilePdfStyles } from './compile-pdf-styles.js';
import { BFA_TOKENS } from './style-tokens.js';
import { escapeHtml, sanitizeCssColor } from './format-utils.js';

const B = compilePdfStyles(BFA_TOKENS);

/**
 * Generate standalone HTML for Gantt chart.
 */
export function generateGanttHtml(
    projection: GanttProjectionOutput,
    options: {
        title?: string;
        printBackground?: boolean;
    } = {}
): string {
    const { totalWidth, totalHeight, lanes, ticks } = projection;

    // CSS for the chart
    const styles = `
        body { font-family: ${B.fonts.primaryStack}; margin: 0; padding: 20px; }
        .gantt-container { position: relative; border: 1px solid ${B.colors.border}; overflow: hidden; }
        .gantt-header { height: 40px; border-bottom: 1px solid #eee; background: #f8f9fa; }
        .gantt-body { position: relative; }
        .lane { border-bottom: 1px solid #f0f0f0; box-sizing: border-box; position: absolute; width: 100%; }
        .lane-label { font-size: 12px; padding: 4px 8px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tick { position: absolute; top: 0; bottom: 0; border-left: 1px solid #eee; }
        .tick.major { border-left: 1px solid ${B.colors.border}; }
        .tick-label { position: absolute; top: 0; font-size: ${B.sizes.meta}; color: ${B.colors.textSecondary}; padding: 4px; }
        .item { position: absolute; border-radius: 4px; box-sizing: border-box; font-size: ${B.sizes.micro}; color: white; padding: 2px 4px; overflow: hidden; white-space: nowrap; }
        h1 { font-size: 24px; margin-bottom: 20px; }
    `;

    // Generate Ticks HTML for header (with visible labels)
    const ticksHtml = ticks.map(t => `
        <div class="tick ${escapeHtml(t.type)}" style="left: ${t.x}px;">
            <div class="tick-label">${escapeHtml(t.label)}</div>
        </div>
    `).join('');

    // Generate grid lines for body (labels hidden via CSS)
    const gridLinesHtml = ticks.map(t => `
        <div class="tick ${escapeHtml(t.type)}" style="left: ${t.x}px;"></div>
    `).join('');

    // Generate Lanes & Items HTML
    const lanesHtml = lanes.map(lane => {
        const itemsHtml = lane.items.map(item => `
            <div class="item" style="
                left: ${item.x}px;
                top: ${item.y}px;
                width: ${item.width}px;
                height: ${item.height}px;
                background-color: ${sanitizeCssColor(item.color || B.colors.accent, B.colors.accent)};
            ">
                ${escapeHtml(item.label)}
            </div>
        `).join('');

        return `
            <div class="lane" style="top: ${lane.y}px; height: ${lane.height}px;">
                <div class="lane-label" style="padding-left: ${lane.depth * 20 + 8}px;">
                    ${escapeHtml(lane.label)}
                </div>
                ${itemsHtml}
            </div>
        `;
    }).join('');

    const safeTitle = escapeHtml(options.title || 'Gantt Export');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${safeTitle}</title>
            <style>
                ${B.fontCss}
                ${B.cssText}
                ${styles}
            </style>
        </head>
        <body>
            ${options.title ? `<h1>${safeTitle}</h1>` : ''}
            <div class="gantt-container" style="width: ${totalWidth}px; height: ${totalHeight + 40}px;">
                <div class="gantt-header" style="position: relative; width: 100%;">
                    ${ticksHtml}
                </div>
                <div class="gantt-body" style="position: relative; height: ${totalHeight}px;">
                    ${gridLinesHtml}
                    ${lanesHtml}
                </div>
            </div>
        </body>
        </html>
    `;
}
