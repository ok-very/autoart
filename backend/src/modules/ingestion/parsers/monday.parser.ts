import type { ParserModule, ParsedData, ParsedNode, ParserConfig } from '../parser.types.js';

/**
 * Parse CSV into rows, handling quoted fields correctly.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell);
      if (currentRow.some(c => c.trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell) currentRow.push(currentCell);
  if (currentRow.length > 0 && currentRow.some(c => c.trim())) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Monday.com export parser.
 * Parses CSV exports from Monday.com into a hierarchical structure.
 */
export const mondayParser: ParserModule = {
  name: 'monday',
  version: '2.0',
  description: 'Parse Monday.com standard CSV exports with stage/task hierarchy',
  configFields: [
    {
      key: 'developerRegex',
      label: 'Developer Regex',
      type: 'regex',
      defaultValue: 'Developer:\\s*(.*?)(?:\\n|$)',
      description: 'Extract developer/client from metadata blob',
    },
    {
      key: 'budgetRegex',
      label: 'Budget Regex',
      type: 'regex',
      defaultValue: 'Total Budget:\\s*([$0-9,]+)',
      description: 'Extract budget from metadata blob',
    },
    {
      key: 'stagePattern',
      label: 'Stage Pattern',
      type: 'regex',
      defaultValue: '^Stage\\s+\\d+:',
      description: 'Pattern to identify stage rows',
    },
  ],

  parse(input: string, config: ParserConfig): ParsedData {
    const rows = parseCSV(input);

    // Extract project title from first row
    const projectTitle = rows[0]?.[0]?.trim() || 'Imported Project';

    // Extract metadata from second row (usually a blob of info)
    const projectMeta: Record<string, unknown> = {};
    if (rows.length > 1 && rows[1]?.[0]) {
      const metaBlob = rows[1][0];

      try {
        // Developer/Client regex
        const devRegex = new RegExp(String(config.developerRegex || 'Developer:\\s*(.*?)(?:\\n|$)'), 'i');
        const devMatch = metaBlob.match(devRegex);
        if (devMatch?.[1]) {
          projectMeta.developer = devMatch[1].trim();
        }

        // Budget regex
        const budgetRegex = new RegExp(String(config.budgetRegex || 'Total Budget:\\s*([$0-9,]+)'), 'i');
        const budgetMatch = metaBlob.match(budgetRegex);
        if (budgetMatch?.[1]) {
          projectMeta.budget = budgetMatch[1].trim();
        }

        // Also try to extract project address
        const addressMatch = metaBlob.match(/Project Address:\s*(.*?)(?:\n|$)/i);
        if (addressMatch?.[1]) {
          projectMeta.address = addressMatch[1].trim();
        }
      } catch {
        // Ignore regex errors
      }
    }

    const nodes: ParsedNode[] = [];
    const stagePattern = new RegExp(String(config.stagePattern || '^Stage\\s+\\d+:'), 'i');

    let stageCounter = 0;
    let processCounter = 0;
    let currentStageTempId: string | null = null;
    let currentSubprocessTempId: string | null = null;
    let currentTaskTempId: string | null = null;

    // Create a default process for all stages
    const processTempId = `temp-process-${processCounter++}`;
    nodes.push({
      tempId: processTempId,
      parentTempId: null, // Will be linked to project
      type: 'process',
      title: 'Main Workflow',
      metadata: { imported: true },
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const col0 = (row[0] || '').trim();
      const col1 = (row[1] || '').trim();

      // Skip header rows
      if (col0 === 'Name' && col1 === 'Subitems') continue;
      if (col0 === 'Subitems' && col1 === 'Name') continue;

      // Detect stage rows
      if (stagePattern.test(col0) || col0 === 'Project Files') {
        const stageTempId = `temp-stage-${stageCounter++}`;
        nodes.push({
          tempId: stageTempId,
          parentTempId: processTempId,
          type: 'stage',
          title: col0,
          metadata: { rowIndex: i },
        });
        currentStageTempId = stageTempId;
        currentSubprocessTempId = null;
        currentTaskTempId = null;
        continue;
      }

      // Subtask: empty first column, non-empty second
      if (col0 === '' && col1 !== '') {
        if (currentTaskTempId) {
          // For now, we treat subtasks as tasks under a subprocess
          // If no subprocess exists, create one implicitly
          if (!currentSubprocessTempId && currentStageTempId) {
            const subTempId = `temp-subprocess-implicit-${i}`;
            nodes.push({
              tempId: subTempId,
              parentTempId: currentStageTempId,
              type: 'subprocess',
              title: 'Tasks',
              metadata: { implicit: true },
            });
            currentSubprocessTempId = subTempId;
          }

          nodes.push({
            tempId: `temp-task-sub-${i}`,
            parentTempId: currentSubprocessTempId,
            type: 'task',
            title: col1,
            metadata: {
              isSubtask: true,
              parentTaskTempId: currentTaskTempId,
              rowIndex: i,
            },
          });
        }
        continue;
      }

      // Task row: non-empty first column under a stage
      if (currentStageTempId && col0 !== '') {
        // If this is a main task, we might need a subprocess
        if (!currentSubprocessTempId) {
          const subTempId = `temp-subprocess-${i}`;
          nodes.push({
            tempId: subTempId,
            parentTempId: currentStageTempId,
            type: 'subprocess',
            title: col0, // Use task name as subprocess name
            metadata: { taskGroup: true },
          });
          currentSubprocessTempId = subTempId;
        }

        const taskTempId = `temp-task-${i}`;
        nodes.push({
          tempId: taskTempId,
          parentTempId: currentSubprocessTempId,
          type: 'task',
          title: col0,
          metadata: {
            status: row[3] || 'Not Started',
            targetDate: row[4] || null,
            priority: row[5] || null,
            notes: row[6] || null,
            rowIndex: i,
          },
        });
        currentTaskTempId = taskTempId;

        // Reset subprocess for next task group if the task has subitems indicator
        if (col1 && col1.includes(',')) {
          currentSubprocessTempId = null;
        }
      }
    }

    return {
      projectTitle,
      projectMeta,
      nodes,
    };
  },
};
