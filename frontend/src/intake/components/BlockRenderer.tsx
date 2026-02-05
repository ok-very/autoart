/**
 * BlockRenderer - Factory component that renders FormBlocks by type
 *
 * Uses React Hook Form context - blocks access form state via useFormContext
 */

import type { FormBlock, ModuleBlock } from '@autoart/shared';
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
  // Handle static display blocks
  if (block.type === 'section_header') {
    return <SectionHeader block={block} />;
  }
  if (block.type === 'description') {
    return <Description block={block} />;
  }
  if (block.type === 'image') {
    return <ImageBlock block={block} />;
  }

  // Handle input blocks
  const Component = MODULE_COMPONENTS[block.type];
  if (!Component) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
        Unsupported block type: <code>{block.type}</code>
      </div>
    );
  }

  return <Component block={block} />;
}

/**
 * Check if a block collects user input (vs static display)
 */
export function isInputBlock(block: FormBlock): boolean {
  return !STATIC_BLOCKS.includes(block.type);
}
