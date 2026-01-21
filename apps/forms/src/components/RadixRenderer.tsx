import type { RadixElement } from '@autoart/shared';

const ALLOWED_TYPES = new Set([
  'Box',
  'Flex',
  'Grid',
  'Text',
  'Heading',
  'Button',
  'TextField',
  'TextArea',
  'Select',
  'Checkbox',
  'Label',
  'Card',
  'Separator',
  'Link',
]);

interface RadixRendererProps {
  node: RadixElement;
  formData: Record<string, unknown>;
  onFieldChange: (name: string, value: unknown) => void;
}

export function RadixRenderer({
  node,
  formData,
  onFieldChange,
}: RadixRendererProps) {
  if (!ALLOWED_TYPES.has(node.type)) {
    console.warn(`Unknown or disallowed node type: ${node.type}`);
    return null;
  }

  const { type, props = {}, children } = node;
  const renderedChildren = children?.map((child, i) => (
    <RadixRenderer
      key={i}
      node={child}
      formData={formData}
      onFieldChange={onFieldChange}
    />
  ));

  switch (type) {
    case 'Box':
      return <div className={props.className as string}>{renderedChildren}</div>;


    case 'Flex':
      const gapMap: Record<string, string> = {
        '1': 'gap-1', '2': 'gap-2', '3': 'gap-3', '4': 'gap-4', '6': 'gap-6', '8': 'gap-8'
      };
      const gapClass = props.gap ? (gapMap[props.gap as string] || '') : '';
      return (
        <div
          className={`flex ${props.direction === 'column' ? 'flex-col' : 'flex-row'} ${gapClass} ${props.className || ''}`}
        >
          {renderedChildren}
        </div>
      );


    case 'Grid':
      const gridColsMap: Record<string, string> = {
        '1': 'grid-cols-1', '2': 'grid-cols-2', '3': 'grid-cols-3', '4': 'grid-cols-4', '6': 'grid-cols-6', '12': 'grid-cols-12'
      };
      const gridGapMap: Record<string, string> = {
        '1': 'gap-1', '2': 'gap-2', '3': 'gap-3', '4': 'gap-4', '6': 'gap-6', '8': 'gap-8'
      };
      const colsClass = props.columns ? (gridColsMap[props.columns as string] || '') : '';
      const gridGapClass = props.gap ? (gridGapMap[props.gap as string] || '') : '';
      return (
        <div
          className={`grid ${colsClass} ${gridGapClass} ${props.className || ''}`}
        >
          {renderedChildren}
        </div>
      );

    case 'Text':
      return (
        <p className={`text-slate-700 ${props.className || ''}`}>
          {props.content as string}
          {renderedChildren}
        </p>
      );

    case 'Heading':
      const HeadingTag = `h${props.level || 2}` as keyof JSX.IntrinsicElements;
      return (
        <HeadingTag className={`font-semibold ${props.className || ''}`}>
          {props.content as string}
          {renderedChildren}
        </HeadingTag>
      );

    case 'Button':
      return (
        <button
          type={(props.type as 'button' | 'submit') || 'button'}
          className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition ${props.className || ''}`}
        >
          {props.label as string}
          {renderedChildren}
        </button>
      );

    case 'TextField':
      const fieldName = props.name as string;
      return (
        <input
          type={(props.inputType as string) || 'text'}
          name={fieldName}
          placeholder={props.placeholder as string}
          value={(formData[fieldName] as string) || ''}
          onChange={(e) => onFieldChange(fieldName, e.target.value)}
          required={props.required as boolean}
          className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${props.className || ''}`}
        />
      );

    case 'TextArea':
      const textareaName = props.name as string;
      return (
        <textarea
          name={textareaName}
          placeholder={props.placeholder as string}
          value={(formData[textareaName] as string) || ''}
          onChange={(e) => onFieldChange(textareaName, e.target.value)}
          required={props.required as boolean}
          rows={(props.rows as number) || 4}
          className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${props.className || ''}`}
        />
      );

    case 'Select':
      const selectName = props.name as string;
      const options = (props.options as Array<{ value: string; label: string }>) || [];
      return (
        <select
          name={selectName}
          value={(formData[selectName] as string) || ''}
          onChange={(e) => onFieldChange(selectName, e.target.value)}
          required={props.required as boolean}
          className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${props.className || ''}`}
        >
          <option value="">{props.placeholder as string || 'Select...'}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case 'Checkbox':
      const checkboxName = props.name as string;
      return (
        <label className={`flex items-center gap-2 ${props.className || ''}`}>
          <input
            type="checkbox"
            name={checkboxName}
            checked={(formData[checkboxName] as boolean) || false}
            onChange={(e) => onFieldChange(checkboxName, e.target.checked)}
            className="w-4 h-4"
          />
          <span>{props.label as string}</span>
        </label>
      );

    case 'Label':
      return (
        <label className={`block text-sm font-medium text-slate-700 ${props.className || ''}`}>
          {props.content as string}
          {renderedChildren}
        </label>
      );

    case 'Card':
      return (
        <div className={`bg-white rounded-lg shadow p-4 ${props.className || ''}`}>
          {renderedChildren}
        </div>
      );

    case 'Separator':
      return <hr className={`my-4 border-slate-200 ${props.className || ''}`} />;

    case 'Link':
      const href = props.href as string || '#';
      // Sanitize href to prevent XSS via dangerous protocols
      const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|\/|#)/i;
      const safeHref = SAFE_URL_PATTERN.test(href.trim()) ? href : '#';
      return (
        <a
          href={safeHref}
          target={props.target as string}
          rel={props.target === '_blank' ? 'noopener noreferrer' : undefined}
          className={`text-blue-600 hover:underline ${props.className || ''}`}
        >
          {props.content as string}
          {renderedChildren}
        </a>
      );

    default:
      return null;
  }
}
