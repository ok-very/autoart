import type { FormBlock } from '@autoart/shared';
import { ShortAnswerPreview } from './ShortAnswerPreview';
import { ParagraphPreview } from './ParagraphPreview';
import { EmailPreview } from './EmailPreview';
import { PhonePreview } from './PhonePreview';
import { NumberPreview } from './NumberPreview';
import { DatePreview } from './DatePreview';
import { TimePreview } from './TimePreview';
import { FileUploadPreview } from './FileUploadPreview';
import { MultipleChoicePreview } from './MultipleChoicePreview';
import { CheckboxPreview } from './CheckboxPreview';
import { DropdownPreview } from './DropdownPreview';
import { SectionHeaderPreview } from './SectionHeaderPreview';
import { DescriptionPreview } from './DescriptionPreview';
import { ImagePreview } from './ImagePreview';

export interface EditorBlockProps {
    block: FormBlock;
    isActive: boolean;
    onUpdate?: (id: string, updates: Partial<FormBlock>) => void;
}

const previewMap: Record<string, React.ComponentType<EditorBlockProps>> = {
    short_answer: ShortAnswerPreview,
    paragraph: ParagraphPreview,
    email: EmailPreview,
    phone: PhonePreview,
    number: NumberPreview,
    date: DatePreview,
    time: TimePreview,
    file_upload: FileUploadPreview,
    multiple_choice: MultipleChoicePreview,
    checkbox: CheckboxPreview,
    dropdown: DropdownPreview,
    section_header: SectionHeaderPreview,
    description: DescriptionPreview,
    image: ImagePreview,
};

export function EditorBlockRenderer({ block, isActive, onUpdate }: EditorBlockProps) {
    const blockType = block.kind === 'module' ? block.type : 'short_answer';
    const Preview = previewMap[blockType] ?? ShortAnswerPreview;
    return <Preview block={block} isActive={isActive} onUpdate={onUpdate} />;
}
