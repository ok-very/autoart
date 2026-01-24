/**
 * Gantt Formatter
 * 
 * Generates HTML/SVG for Gantt chart export.
 * Consumed by both PDF export (Backend) and Print Preview (Frontend).
 */

import { GanttProjectionOutput } from '../types/gantt.js';

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
        body { font-family: 'Carlito', 'Calibri', sans-serif; margin: 0; padding: 20px; }
        .gantt-container { position: relative; border: 1px solid #ccc; overflow: hidden; }
        .gantt-header { height: 40px; border-bottom: 1px solid #eee; background: #f8f9fa; }
        .gantt-body { position: relative; }
        .lane { border-bottom: 1px solid #f0f0f0; box-sizing: border-box; position: absolute; width: 100%; }
        .lane-label { font-size: 12px; padding: 4px 8px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tick { position: absolute; top: 0; bottom: 0; border-left: 1px solid #eee; }
        .tick.major { border-left: 1px solid #ccc; }
        .tick-label { position: absolute; top: 0; font-size: 10px; color: #666; padding: 4px; }
        .item { position: absolute; border-radius: 4px; box-sizing: border-box; font-size: 11px; color: white; padding: 2px 4px; overflow: hidden; white-space: nowrap; }
        h1 { font-size: 24px; margin-bottom: 20px; }
    `;

    // Generate Ticks HTML
    const ticksHtml = ticks.map(t => `
        <div class="tick ${t.type}" style="left: ${t.x}px;">
            <div class="tick-label">${t.label}</div>
        </div>
    `).join('');

    // Generate Lanes & Items HTML
    const lanesHtml = lanes.map(lane => {
        const itemsHtml = lane.items.map(item => `
            <div class="item" style="
                left: ${item.x}px; 
                top: ${item.y}px; 
                width: ${item.width}px; 
                height: ${item.height}px; 
                background-color: ${item.color || '#3b82f6'};
            ">
                ${item.label}
            </div>
        `).join('');

        return `
            <div class="lane" style="top: ${lane.y}px; height: ${lane.height}px;">
                <div class="lane-label" style="padding-left: ${lane.depth * 20 + 8}px;">
                    ${lane.label}
                </div>
                ${itemsHtml}
            </div>
        `;
    }).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${options.title || 'Gantt Export'}</title>
            <style>${styles}</style>
        </head>
        <body>
            ${options.title ? `<h1>${options.title}</h1>` : ''}
            <div class="gantt-container" style="width: ${totalWidth}px; height: ${totalHeight + 40}px;">
                <div class="gantt-header" style="position: relative; width: 100%;">
                    ${ticksHtml}
                </div>
                <div class="gantt-body" style="position: relative; height: ${totalHeight}px;">
                    ${ticksHtml.replace(/tick-label/g, 'hidden')} <!-- Grid lines in body -->
                    ${lanesHtml}
                </div>
            </div>
        </body>
        </html>
    `;
}
