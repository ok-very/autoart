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
 * Airtable CSV export parser.
 * Parses flat table exports from Airtable into a simple hierarchy.
 */
export const airtableParser: ParserModule = {
  name: 'airtable',
  version: '1.0',
  description: 'Parse Airtable flat table CSV exports',
  configFields: [
    {
      key: 'titleColumn',
      label: 'Title Column',
      type: 'text',
      defaultValue: 'Name',
      description: 'Column name containing task/item titles',
    },
    {
      key: 'stageColumn',
      label: 'Stage Column',
      type: 'text',
      defaultValue: 'Stage',
      description: 'Column name for grouping items into stages',
    },
    {
      key: 'statusColumn',
      label: 'Status Column',
      type: 'text',
      defaultValue: 'Status',
      description: 'Column name containing task status',
    },
    {
      key: 'projectName',
      label: 'Project Name',
      type: 'text',
      defaultValue: 'Imported from Airtable',
      description: 'Name for the imported project',
    },
  ],

  parse(input: string, config: ParserConfig): ParsedData {
    const rows = parseCSV(input);

    if (rows.length === 0) {
      return {
        projectTitle: String(config.projectName || 'Imported from Airtable'),
        projectMeta: {},
        nodes: [],
      };
    }

    // First row is headers
    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1);

    // Find column indices
    const titleCol = headers.indexOf(String(config.titleColumn || 'Name'));
    const stageCol = headers.indexOf(String(config.stageColumn || 'Stage'));
    const statusCol = headers.indexOf(String(config.statusColumn || 'Status'));

    const nodes: ParsedNode[] = [];
    const stageMap = new Map<string, string>(); // stage name -> tempId

    // Create a default process
    const processTempId = 'temp-process-0';
    nodes.push({
      tempId: processTempId,
      parentTempId: null,
      type: 'process',
      title: 'Main Workflow',
      metadata: { imported: true, source: 'airtable' },
    });

    let stageCounter = 0;
    let taskCounter = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const title = titleCol >= 0 ? row[titleCol]?.trim() : row[0]?.trim();
      const stageName = stageCol >= 0 ? row[stageCol]?.trim() : 'Default Stage';
      const status = statusCol >= 0 ? row[statusCol]?.trim() : 'Not Started';

      if (!title) continue;

      // Get or create stage
      let stageTempId = stageMap.get(stageName || 'Default Stage');
      if (!stageTempId) {
        stageTempId = `temp-stage-${stageCounter++}`;
        stageMap.set(stageName || 'Default Stage', stageTempId);

        nodes.push({
          tempId: stageTempId,
          parentTempId: processTempId,
          type: 'stage',
          title: stageName || 'Default Stage',
          metadata: {},
        });

        // Create a default subprocess under the stage
        const subTempId = `temp-subprocess-${stageCounter}`;
        nodes.push({
          tempId: subTempId,
          parentTempId: stageTempId,
          type: 'subprocess',
          title: 'Tasks',
          metadata: { stageGroup: true },
        });

        // Update stageMap to point to subprocess for task parenting
        stageMap.set(`${stageName}-sub`, subTempId);
      }

      // Get subprocess tempId
      const subTempId = stageMap.get(`${stageName || 'Default Stage'}-sub`) || stageTempId;

      // Create task
      const taskTempId = `temp-task-${taskCounter++}`;
      const metadata: Record<string, unknown> = { rowIndex: i + 1 };

      if (status) metadata.status = status;

      // Add all other columns as metadata
      headers.forEach((header, idx) => {
        if (idx !== titleCol && idx !== stageCol && idx !== statusCol) {
          const value = row[idx]?.trim();
          if (value) {
            metadata[header] = value;
          }
        }
      });

      nodes.push({
        tempId: taskTempId,
        parentTempId: subTempId,
        type: 'task',
        title,
        metadata,
      });
    }

    return {
      projectTitle: String(config.projectName || 'Imported from Airtable'),
      projectMeta: {
        source: 'airtable',
        rowCount: dataRows.length,
        importedAt: new Date().toISOString(),
      },
      nodes,
    };
  },
};
