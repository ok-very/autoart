/**
 * BlockRenderer - Factory component that renders FormBlocks by type
 */

import type { FormBlock, ModuleBlock, RecordBlock as RecordBlockType } from '@autoart/shared';
import {
  ShortAnswer,
  Paragraph,
  Email,
  Phone,
  NumberInput,
  DateInput,
  TimeInput,
  FileUpload,
  MultipleChoice,
  Checkbox,
  Dropdown,
  SectionHeader,
  Description,
  ImageBlock,
  RecordBlock,
} from './blocks';

// Module block type to component mapping
const MODULE_COMPONENTS: Record<
  string,
  React.FC<{ block: ModuleBlock; value: unknown; onChange: (value: unknown) => void; error?: string }>
> = {
  short_answer: ShortAnswer as never,
  paragraph: Paragraph as never,
  email: Email as never,
  phone: Phone as never,
  number: NumberInput as never,
  date: DateInput as never,
  time: TimeInput as never,
  file_upload: FileUpload as never,
  multiple_choice: MultipleChoice as never,
  checkbox: Checkbox as never,
  dropdown: Dropdown as never,
};

// Static blocks that don't collect input
const STATIC_BLOCKS = ['section_header', 'description', 'image'];

interface BlockRendererProps {
  block: FormBlock;
  value: unknown;
  onChange: (blockId: string, value: unknown) => void;
  error?: string;
}

export function BlockRenderer({ block, value, onChange, error }: BlockRendererProps) {
  // Handle record blocks
  if (block.kind === 'record') {
    return <RecordBlock block={block as RecordBlockType} />;
  }

  const moduleBlock = block as ModuleBlock;

  // Handle static display blocks
  if (moduleBlock.type === 'section_header') {
    return <SectionHeader block={moduleBlock} />;
  }
  if (moduleBlock.type === 'description') {
    return <Description block={moduleBlock} />;
  }
  if (moduleBlock.type === 'image') {
    return <ImageBlock block={moduleBlock} />;
  }

  // Handle input blocks
  const Component = MODULE_COMPONENTS[moduleBlock.type];
  if (!Component) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
        Unsupported block type: <code>{moduleBlock.type}</code>
      </div>
    );
  }

  return (
    <Component
      block={moduleBlock}
      value={value}
      onChange={(newValue) => onChange(block.id, newValue)}
      error={error}
    />
  );
}

/**
 * Check if a block collects user input (vs static display)
 */
export function isInputBlock(block: FormBlock): boolean {
  if (block.kind === 'record') {
    return false;
  }
  return !STATIC_BLOCKS.includes((block as ModuleBlock).type);
}
