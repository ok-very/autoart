/**
 * BlockRenderer - Factory component that renders FormBlocks by type
 * 
 * Uses React Hook Form context - blocks access form state via useFormContext
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
  React.FC<{ block: ModuleBlock }>
> = {
  short_answer: ShortAnswer,
  paragraph: Paragraph,
  email: Email,
  phone: Phone,
  number: NumberInput,
  date: DateInput,
  time: TimeInput,
  file_upload: FileUpload,
  multiple_choice: MultipleChoice,
  checkbox: Checkbox,
  dropdown: Dropdown,
};

// Static blocks that don't collect input
const STATIC_BLOCKS = ['section_header', 'description', 'image'];

interface BlockRendererProps {
  block: FormBlock;
}

export function BlockRenderer({ block }: BlockRendererProps) {
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

  return <Component block={moduleBlock} />;
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
