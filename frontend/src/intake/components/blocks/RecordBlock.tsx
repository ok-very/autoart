import type { RecordBlock as RecordBlockType } from '@autoart/shared';

interface RecordBlockProps {
  block: RecordBlockType;
}

export function RecordBlock({ block }: RecordBlockProps) {
  // RecordBlocks display read-only information about existing records
  // In a full implementation, this would fetch the record definition data

  return (
    <div className="bg-ws-bg border border-ws-panel-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full" />
        <h4 className="font-medium text-ws-fg">
          {block.label || 'Linked Record'}
        </h4>
      </div>
      <p className="text-sm text-ws-text-secondary">
        This section displays information from an existing record.
      </p>
      {block.createInstance && (
        <p className="text-xs text-ws-muted mt-2">
          A new record instance will be created on submission.
        </p>
      )}
    </div>
  );
}
