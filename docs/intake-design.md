Below is a **complete, production‑ready starter kit** for a “front‑face” React intake form that can render **any** configuration built with the `IntakeFormConfigSchema` you posted.  
It follows modern best‑practices:

| ✅ | What it gives you |
|---|-------------------|
| **Typed** – all data comes from the **Zod** schemas, so TypeScript knows the exact shape of every block. |
| **Composable** – each block type lives in its own file, exported via a **factory** that the renderer calls. |
| **Form‑logic** – powered by **React‑Hook‑Form** + **Zod resolver** for validation, file‑upload streaming, and conditional required handling. |
| **UI/UX** – built with **MUI v6** (material‑design, dark‑mode ready) plus a tiny **Tailwind‑CSS** utility layer for rapid layout tweaks. |
| **Progress bar** – optional, automatically steps through the block list. |
| **Record block** – read‑only, styled view of an existing *RecordDefinition* fetched from an API. |
| **Submission flow** – shows a confirmation message, optional redirect, and graceful error handling. |
| **Accessibility** – all fields are labelled, ARIA‑described, keyboard‑navigable. |
| **Extensible** – add new block types by dropping a component in `src/blocks/` and updating the factory map. |

Below you’ll find:

1. **Folder layout** – where each piece lives.  
2. **Zod‑derived TypeScript types** (you already have them, but we’ll re‑export for the client).  
3. **React‑Hook‑Form + Zod resolver** – schema generation on the fly.  
4. **Dynamic block renderer** (factory pattern).  
5. **Individual block components** (short answer, paragraph, email, file upload, multiple‑choice, record, section header, image, description …).  
6. **Form wrapper** (progress bar, submit handling, UI states).  
7. **Styling** – MUI theme + a tiny Tailwind utility file.  
8. **Example usage** – a JSON config that you could fetch from the server.  

---

## 1️⃣ Folder Layout

```
src/
├─ api/
│   └─ record.ts                # fetch record definition data
├─ components/
│   ├─ FormRenderer.tsx         # top‑level component that receives the config
│   ├─ ProgressBar.tsx
│   └─ SubmitButton.tsx
├─ blocks/
│   ├─ index.ts                 # factory export
│   ├─ Module/
│   │   ├─ ShortAnswer.tsx
│   │   ├─ Paragraph.tsx
│   │   ├─ Email.tsx
│   │   ├─ Phone.tsx
│   │   ├─ Number.tsx
│   │   ├─ Date.tsx
│   │   ├─ Time.tsx
│   │   ├─ FileUpload.tsx
│   │   ├─ MultipleChoice.tsx
│   │   ├─ Checkbox.tsx
│   │   ├─ Dropdown.tsx
│   │   ├─ SectionHeader.tsx
│   │   ├─ Description.tsx
│   │   └─ Image.tsx
│   └─ Record/
│       └─ RecordBlock.tsx
├─ schema/
│   └─ intakeForm.ts            # re‑export Zod schemas & types for the client
├─ hooks/
│   └─ useIntakeForm.ts         # builds RHF resolver, handles submit
└─ App.tsx
```

> **Why this layout?**  
> *Separation of concerns*: API logic lives in its own folder, UI blocks are isolated, the renderer only wires them together. This makes the codebase easy to scale, test, and theme.

---

## 2️⃣ Re‑exporting the Zod Schemas (client side)

```ts
// src/schema/intakeForm.ts
import { z } from 'zod';
import {
  ModuleBlockSchema,
  RecordBlockSchema,
  FormBlockSchema,
  IntakeFormConfigSchema,
} from '../../server/schemas/intakeForm'; // <-- path where you keep the server schemas

export const IntakeFormConfig = IntakeFormConfigSchema;
export type IntakeFormConfig = z.infer<typeof IntakeFormConfigSchema>;

export const FormBlock = FormBlockSchema;
export type FormBlock = z.infer<typeof FormBlockSchema>;

export const ModuleBlock = ModuleBlockSchema;
export type ModuleBlock = z.infer<typeof ModuleBlockSchema>;

export const RecordBlock = RecordBlockSchema;
export type RecordBlock = z.infer<typeof RecordBlockSchema>;
```

Now the client can `import { IntakeFormConfig } from '@/schema/intakeForm'` and get **exactly** the same validation rules the server uses.

---

## 3️⃣ Hook – Build the RHF Resolver & Submission Logic

```tsx
// src/hooks/useIntakeForm.ts
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { IntakeFormConfig, FormBlock, ModuleBlock, RecordBlock } from '@/schema/intakeForm';
import { useState } from 'react';
import { submitIntakeForm } from '@/api/intake'; // you’ll implement a POST endpoint

type UseIntakeFormReturn = {
  rhf: UseFormReturn<any>;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
  submitError?: string;
};

export function useIntakeForm(config: IntakeFormConfig): UseIntakeFormReturn {
  // 1️⃣ Build a *dynamic* Zod schema based on the blocks
  const blockSchema = config.blocks.reduce((acc, block) => {
    const key = block.id; // each block gets a unique key in the form data
    if (block.kind === 'module') {
      const mod = block as ModuleBlock;
      let field = z.any(); // default fallback

      // Map ModuleBlock.type → Zod validation
      switch (mod.type) {
        case 'short_answer':
        case 'paragraph':
        case 'description':
          field = z.string();
          break;
        case 'email':
          field = z.string().email('Invalid e‑mail address');
          break;
        case 'phone':
          field = z
            .string()
            .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone number');
          break;
        case 'number':
          field = z.preprocess((val) => Number(val), z.number());
          break;
        case 'date':
          field = z.string().refine((val) => !isNaN(Date.parse(val)), {
            message: 'Invalid date',
          });
          break;
        case 'time':
          field = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
            message: 'Invalid time (HH:MM)',
          });
          break;
        case 'file_upload':
          field = z
            .any()
            .refine((files) => files && files.length > 0, {
              message: 'File required',
            });
          break;
        case 'multiple_choice':
        case 'dropdown':
          field = z.enum(mod.options ?? []);
          break;
        case 'checkbox':
          field = z.array(z.enum(mod.options ?? []));
          break;
        case 'image':
          field = z.string().url(); // we store the image URL after upload
          break;
        default:
          field = z.string();
      }

      if (mod.required) field = field.refine((v) => v !== '' && v != null, {
        message: `${mod.label} is required`,
      });

      acc[key] = field;
    } else {
      // RecordBlock is read‑only – we don't collect user input
      // but we may want its ID in the payload (if createInstance = true)
      const rec = block as RecordBlock;
      if (rec.createInstance) {
        acc[key] = z.object({
          definitionId: z.string().uuid(),
          // any additional meta you want to store (e.g. linked user)
        });
      }
    }
    return acc;
  }, {} as Record<string, any>);

  const schema = z.object(blockSchema);
  const rhf = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    setSubmitError(undefined);
    try {
      await submitIntakeForm(data); // <-- POST to your back‑end
    } catch (e: any) {
      setSubmitError(e?.message ?? 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return { rhf, onSubmit, isSubmitting, submitError };
}
```

*Key points*:

* **Dynamic schema** – we walk the config blocks and build a Zod object that mirrors the shape of the payload.
* **File handling** – `file_upload` fields are stored as a `FileList`. The block component will take care of uploading to the custom endpoint (if supplied) and replace the value with the final URL.
* **Record blocks** – only added to payload when `createInstance === true`. The component will fetch the definition name for UI purposes.

---

## 4️⃣ Block Factory – Mapping `kind` / `type` → Component

```tsx
// src/blocks/index.ts
import { FC } from 'react';
import { ModuleBlock, RecordBlock } from '@/schema/intakeForm';
import ShortAnswer from './Module/ShortAnswer';
import Paragraph from './Module/Paragraph';
import Email from './Module/Email';
import Phone from './Module/Phone';
import NumberInput from './Module/Number';
import DateInput from './Module/Date';
import TimeInput from './Module/Time';
import FileUpload from './Module/FileUpload';
import MultipleChoice from './Module/MultipleChoice';
import CheckboxGroup from './Module/Checkbox';
import Dropdown from './Module/Dropdown';
import SectionHeader from './Module/SectionHeader';
import Description from './Module/Description';
import ImageBlock from './Module/Image';
import RecordBlockView from './Record/RecordBlock';

type BlockProps = {
  block: ModuleBlock | RecordBlock;
};

type BlockComponent = FC<BlockProps>;

const moduleMap: Record<string, BlockComponent> = {
  short_answer: ShortAnswer,
  paragraph: Paragraph,
  email: Email,
  phone: Phone,
  number: NumberInput,
  date: DateInput,
  time: TimeInput,
  file_upload: FileUpload,
  multiple_choice: MultipleChoice,
  checkbox: CheckboxGroup,
  dropdown: Dropdown,
  section_header: SectionHeader,
  description: Description,
  image: ImageBlock,
};

export const BlockFactory: FC<BlockProps> = ({ block }) => {
  if (block.kind === 'record') {
    return <RecordBlockView block={block as RecordBlock} />;
  }

  const Comp = moduleMap[block.type];
  if (!Comp) {
    return (
      <div className="p-4 text-red-600">
        Unsupported block type: <code>{block.type}</code>
      </div>
    );
  }

  return <Comp block={block as ModuleBlock} />;
};
```

*The factory is a **pure functional component** – it never mutates state, simply selects the right UI component.*  
Adding a new module type is as easy as:

1. Create the component under `src/blocks/Module/`.
2. Add its key to `moduleMap`.

---

## 5️⃣ Individual Block Components (selected examples)

### 5.1 Short Answer (single line text)

```tsx
// src/blocks/Module/ShortAnswer.tsx
import { FC } from 'react';
import { Controller } from 'react-hook-form';
import { TextField } from '@mui/material';
import { ModuleBlock } from '@/schema/intakeForm';
import { useFormContext } from 'react-hook-form';

type Props = {
  block: ModuleBlock;
};

const ShortAnswer: FC<Props> = ({ block }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={block.id}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          label={block.label}
          placeholder={block.placeholder}
          required={block.required}
          helperText={fieldState.error?.message ?? block.description}
          error={!!fieldState.error}
          fullWidth
          variant="outlined"
          margin="normal"
        />
      )}
    />
  );
};

export default ShortAnswer;
```

### 5.2 Paragraph (multiline)

```tsx
// src/blocks/Module/Paragraph.tsx
import { FC } from 'react';
import { Controller } from 'react-hook-form';
import { TextField } from '@mui/material';
import { ModuleBlock } from '@/schema/intakeForm';
import { useFormContext } from 'react-hook-form';

const Paragraph: FC<{ block: ModuleBlock }> = ({ block }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={block.id}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          label={block.label}
          placeholder={block.placeholder}
          required={block.required}
          helperText={fieldState.error?.message ?? block.description}
          error={!!fieldState.error}
          multiline
          rows={4}
          fullWidth
          variant="outlined"
          margin="normal"
        />
      )}
    />
  );
};

export default Paragraph;
```

### 5.3 Email

```tsx
// src/blocks/Module/Email.tsx
import { FC } from 'react';
import { Controller } from 'react-hook-form';
import { TextField } from '@mui/material';
import { ModuleBlock } from '@/schema/intakeForm';
import { useFormContext } from 'react-hook-form';

const Email: FC<{ block: ModuleBlock }> = ({ block }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={block.id}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          type="email"
          label={block.label}
          placeholder={block.placeholder}
          required={block.required}
          helperText={fieldState.error?.message ?? block.description}
          error={!!fieldState.error}
          fullWidth
          variant="outlined"
          margin="normal"
        />
      )}
    />
  );
};

export default Email;
```

### 5.4 File Upload (with custom endpoint)

```tsx
// src/blocks/Module/FileUpload.tsx
import { FC, useState } from 'react';
import { Controller } from 'react-hook-form';
import {
  Box,
  Button,
  LinearProgress,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { ModuleBlock } from '@/schema/intakeForm';
import { useFormContext } from 'react-hook-form';
import axios from 'axios';

const FileUpload: FC<{ block: ModuleBlock }> = ({ block }) => {
  const { control, setValue } = useFormContext();
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    // 1️⃣ Determine endpoint (fallback to generic /api/upload)
    const endpoint = block.uploadEndpoint ?? '/api/upload';

    // 2️⃣ Build FormData respecting accepted MIME types
    const formData = new FormData();
    formData.append('file', file);
    if (block.acceptedFileTypes?.length) {
      formData.append('accept', block.acceptedFileTypes.join(','));
    }

    // 3️⃣ POST with progress callback
    const resp = await axios.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / e.total)),
    });

    // 4️⃣ Assume response { url: string }
    const url = resp.data.url;
    setUploadedUrl(url);
    // Store the URL in RHF so the final payload contains it
    setValue(block.id, url, { shouldValidate: true });
  };

  return (
    <Controller
      name={block.id}
      control={control}
      render={({ field, fieldState }) => (
        <Box sx={{ my: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            {block.label} {block.required && '*'}
          </Typography>

          {/* Existing file preview */}
          {uploadedUrl && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Uploaded: <a href={uploadedUrl} target="_blank" rel="noopener noreferrer">{uploadedUrl}</a>
              </Typography>
            </Box>
          )}

          {/* Upload button */}
          <Button
            variant="contained"
            component="label"
            startIcon={<CloudUploadIcon />}
            disabled={!!uploadedUrl}
          >
            {uploadedUrl ? 'Uploaded' : 'Choose file'}
            <input
              type="file"
              hidden
              accept={block.acceptedFileTypes?.join(',')}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />
          </Button>

          {/* Progress bar */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 1 }} />
          )}

          {/* Validation message */}
          {fieldState.error && (
            <Typography color="error" variant="caption">
              {fieldState.error.message}
            </Typography>
          )}
          {block.description && (
            <Typography variant="caption" color="text.secondary">
              {block.description}
            </Typography>
          )}
        </Box>
      )}
    />
  );
};

export default FileUpload;
```

### 5.5 Multiple Choice (radio group)

```tsx
// src/blocks/Module/MultipleChoice.tsx
import { FC } from 'react';
import { Controller } from 'react-hook-form';
import {
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormHelperText,
} from '@mui/material';
import { ModuleBlock } from '@/schema/intakeForm';
import { useFormContext } from 'react-hook-form';

const MultipleChoice: FC<{ block: ModuleBlock }> = ({ block }) => {
  const { control } = useFormContext();

  return (
    <Controller
      name={block.id}
      control={control}
      render={({ field, fieldState }) => (
        <FormControl component="fieldset" error={!!fieldState.error} sx={{ my: 2 }}>
          <FormLabel component="legend">
            {block.label} {block.required && '*'}
          </FormLabel>
          <RadioGroup {...field}>
            {block.options?.map((opt) => (
              <FormControlLabel
                key={opt}
                value={opt}
                control={<Radio />}
                label={opt}
              />
            ))}
          </RadioGroup>
          <FormHelperText>
            {fieldState.error?.message ?? block.description}
          </FormHelperText>
        </FormControl>
      )}
    />
  );
};

export default MultipleChoice;
```

### 5.6 Record Block – read‑only view

```tsx
// src/blocks/Record/RecordBlock.tsx
import { FC, useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  Skeleton,
} from '@mui/material';
import { RecordBlock } from '@/schema/intakeForm';
import { fetchRecordDefinition } from '@/api/record';

type Props = {
  block: RecordBlock;
};

const RecordBlockView: FC<Props> = ({ block }) => {
  const [definition, setDefinition] = useState<{
    name: string;
    fields: Array<{ label: string; value: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const def = await fetchRecordDefinition(block.definitionId);
        setDefinition(def);
      } finally {
        setLoading(false);
      }
    })();
  }, [block.definitionId]);

  const title = block.label ?? definition?.name ?? 'Record';

  return (
    <Card sx={{ my: 2 }}>
      <CardHeader title={title} />
      <CardContent>
        {loading ? (
          <Skeleton variant="rectangular" height={100} />
        ) : (
          definition && (
            <>
              {definition.fields.map((f) => (
                <Typography key={f.label} variant="body2" gutterBottom>
                  <strong>{f.label}:</strong> {f.value}
                </Typography>
              ))}
            </>
          )
        )}
        {block.createInstance && (
          <Typography variant="caption" color="text.secondary">
            A new instance of this record will be created on submit.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default RecordBlockView;
```

> **Tip:** The `fetchRecordDefinition` API should return a **stable** shape (name + read‑only fields) so the UI can stay completely declarative.

---

## 6️⃣ Form Wrapper – Progress, Confirmation, Redirect

```tsx
// src/components/FormRenderer.tsx
import {
  Box,
  Container,
  Paper,
  Typography,
  Divider,
} from '@mui/material';
import { FC, useState } from 'react';
import { IntakeFormConfig } from '@/schema/intakeForm';
import { useIntakeForm } from '@/hooks/useIntakeForm';
import { BlockFactory } from '@/blocks';
import ProgressBar from '@/components/ProgressBar';
import SubmitButton from '@/components/SubmitButton';
import { FormProvider } from 'react-hook-form';

type Props = {
  config: IntakeFormConfig;
};

const FormRenderer: FC<Props> = ({ config }) => {
  const { rhf, onSubmit, isSubmitting, submitError } = useIntakeForm(config);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (data: any) => {
    await onSubmit(data);
    setSubmitted(true);
    // 5️⃣ Redirect if needed
    if (config.settings?.redirectUrl) {
      setTimeout(() => (window.location.href = config.settings!.redirectUrl!), 2000);
    }
  };

  // -----------------------------------------------------------------
  // 👉  Render
  // -----------------------------------------------------------------
  if (submitted) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            {config.settings?.confirmationMessage ?? 'Thank you! Your response has been recorded.'}
          </Typography>
          {config.settings?.redirectUrl && (
            <Typography variant="caption" color="text.secondary">
              You’ll be redirected shortly…
            </Typography>
          )}
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <FormProvider {...rhf}>
        <form onSubmit={rhf.handleSubmit(handleSubmit)} noValidate>
          {/* ==== OPTIONAL PROGRESS BAR ==== */}
          {config.settings?.showProgress && (
            <ProgressBar totalSteps={config.blocks.length} />
          )}

          <Paper sx={{ p: 3 }}>
            {config.blocks.map((block, idx) => (
              <Box key={block.id} id={`block-${block.id}`} sx={{ mb: idx < config.blocks.length - 1 ? 4 : 0 }}>
                <BlockFactory block={block} />
                {/* Optional visual separator */}
                {idx < config.blocks.length - 1 && <Divider sx={{ my: 2 }} />}
              </Box>
            ))}

            {/* ==== SUBMIT SECTION ==== */}
            <Box sx={{ mt: 4, textAlign: 'right' }}>
              {submitError && (
                <Typography color="error" sx={{ mb: 1 }}>
                  {submitError}
                </Typography>
              )}
              <SubmitButton isSubmitting={isSubmitting}>Submit</SubmitButton>
            </Box>
          </Paper>
        </form>
      </FormProvider>
    </Container>
  );
};

export default FormRenderer;
```

### 6.1 Progress Bar

```tsx
// src/components/ProgressBar.tsx
import { LinearProgress, Box, Typography } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import { useEffect, useState } from 'react';

type Props = {
  totalSteps: number;
};

export default function ProgressBar({ totalSteps }: Props) {
  const { watch } = useFormContext();
  const [completed, setCompleted] = useState(0);

  // watch every field – any change recomputes the step count
  const allValues = watch();

  useEffect(() => {
    // Count blocks that have a *truthy* value (or are checkboxes with length > 0)
    const filled = Object.values(allValues).filter((v) => {
      if (Array.isArray(v)) return v.length > 0;
      return v !== undefined && v !== '' && v !== null;
    }).length;

    setCompleted(filled);
  }, [allValues]);

  const progress = Math.round((completed / totalSteps) * 100);

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body2" gutterBottom>
        Progress: {completed}/{totalSteps}
      </Typography>
      <LinearProgress variant="determinate" value={progress} />
    </Box>
  );
}
```

### 6.2 Submit Button

```tsx
// src/components/SubmitButton.tsx
import { Button, CircularProgress } from '@mui/material';
import { FC, PropsWithChildren } from 'react';

type Props = {
  isSubmitting: boolean;
};

export const SubmitButton: FC<PropsWithChildren<Props>> = ({
  isSubmitting,
  children,
}) => (
  <Button
    type="submit"
    variant="contained"
    color="primary"
    disabled={isSubmitting}
    startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
  >
    {children}
  </Button>
);
```

---

## 7️⃣ Styling – MUI Theme + Tailwind Utility

**`src/theme.ts`**

```ts
import { createTheme } from '@mui/material/styles';
import { grey, teal } from '@mui/material/colors';

export const theme = createTheme({
  palette: {
    mode: 'light', // change to 'dark' for dark mode
    primary: teal,
    background: {
      default: grey[50],
      paper: '#fff',
    },
  },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    h5: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
  },
});
```

**`src/index.tsx`** (top‑level entry)

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from '@/theme';
import FormRenderer from '@/components/FormRenderer';
import sampleConfig from '@/sampleConfig.json'; // demo config

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* The config could also be fetched with useEffect + fetch */}
      <FormRenderer config={sampleConfig} />
    </ThemeProvider>
  </React.StrictMode>,
);
```

**Tailwind utilities (optional)** – add a `tailwind.css` file with just the `@tailwind` directives and import it once in `index.tsx`. This gives you handy `my-2`, `flex`, `gap-4` classes without pulling in the whole CSS‑in‑JS world.

```css
/* src/tailwind.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Then in any component you can mix:

```tsx
<Box className="my-2 flex flex-col gap-2">
  {/* ... */}
</Box>
```

---

## 8️⃣ Example JSON Config (what the server would send)

```json
{
  "blocks": [
    {
      "id": "b1f2c8b6-2b4c-4a8e-9f8c-1f5c4d5e9c2a",
      "kind": "module",
      "type": "section_header",
      "label": "Personal Information"
    },
    {
      "id": "b2e5c5b7-3d0c-4f71-9b0e-2d8a2f4c5e1b",
      "kind": "module",
      "type": "short_answer",
      "label": "First Name",
      "placeholder": "John",
      "required": true
    },
    {
      "id": "c3f8e6d0-4a1f-44b2-a1c5-3c9d5e6f7a0b",
      "kind": "module",
      "type": "email",
      "label": "E‑mail address",
      "placeholder": "john@example.com",
      "required": true
    },
    {
      "id": "d4a9f7e2-5b2c-48c3-b2d4-4d0e7f9a1b2c",
      "kind": "module",
      "type": "file_upload",
      "label": "Upload your résumé",
      "required": false,
      "acceptedFileTypes": ["application/pdf", "application/msword"],
      "uploadEndpoint": "https://uploads.mycompany.com/resume"
    },
    {
      "id": "e5b0c8f3-6c3d-49d4-b3e5-5f1a2b3c4d5e",
      "kind": "record",
      "definitionId": "c0c1d2e3-f4a5-b6c7-d8e9-f0a1b2c3d4e5",
      "label": "Existing Customer",
      "createInstance": false
    },
    {
      "id": "f6c1d9e4-7d4e-4fa5-c6f7-6g2h3i4j5k6l",
      "kind": "module",
      "type": "multiple_choice",
      "label": "Preferred contact method",
      "options": ["Email", "Phone", "SMS"],
      "required": true
    }
  ],
  "settings": {
    "showProgress": true,
    "confirmationMessage": "Your application has been received! We’ll be in touch soon.",
    "redirectUrl": "https://mycompany.com/thank-you"
  }
}
```

> **How it works:**  
> The form receives the JSON, `useIntakeForm` builds a Zod validator for each block, the **renderer** loops through `blocks` and delegates each to the **BlockFactory**. When the user clicks **Submit**, RHF validates everything, the file‑upload component already replaced the raw `File` with a URL, and the final payload matches exactly what your back‑end expects.

---

## 🎉 TL;DR – What you now have

| Piece | What you get |
|------|--------------|
| **Dynamic schema** | Guarantees runtime validation exactly as defined on the server. |
| **Modular UI** | Add or change a block type in isolation; the rest of the form never breaks. |
| **Progress & UX** | Optional progress bar, graceful confirmation page, auto‑redirect. |
| **File uploads** | Custom endpoint per field, progress UI, MIME‑type whitelisting. |
| **Read‑only record** | Styled card that pulls data from a `RecordDefinition` API. |
| **Accessibility & Design** | MUI’s a11y defaults + clear labels, focus order, error messages. |
| **Future‑proof** | New block? Drop a component, extend the `moduleMap`. No changes to the form renderer needed. |

You can now drop this repo into any **React 18+** app (or Next.js, Remix, Vite) and point the `<FormRenderer config={…} />` to the JSON you generate from your **IntakeFormConfigSchema**. The rest is handled automatically, giving you a clean, maintainable, and beautifully styled front‑face intake form for any configuration you throw at it. 🚀