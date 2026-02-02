import { useState } from 'react';
import { Plus, Copy, ExternalLink } from 'lucide-react';
import { useIntakeForms, useCreateIntakeForm } from '../../../api/hooks';
import { Button, TextInput, Badge, Spinner, Card } from '@autoart/ui';
import type { IntakeForm } from '@autoart/shared';

const FORMS_BASE_URL = 'https://forms.autoart.work';

interface IntakeListPanelProps {
  onSelectForm?: (formId: string) => void;
}

export function IntakeListPanel({ onSelectForm }: IntakeListPanelProps) {
  const { data: forms, isLoading } = useIntakeForms();
  const createForm = useCreateIntakeForm();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [search, setSearch] = useState('');

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createForm.mutateAsync({ title: newTitle.trim() });
    setNewTitle('');
    setShowCreate(false);
  };

  const copyPublicUrl = (uniqueId: string) => {
    navigator.clipboard.writeText(`${FORMS_BASE_URL}/${uniqueId}`);
  };

  const filteredForms = forms?.filter((f) =>
    f.title.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-ws-h2 font-semibold">Intake Forms</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" />
          New Form
        </Button>
      </div>

      {showCreate && (
        <Card className="p-4 space-y-3">
          <TextInput
            placeholder="Form title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newTitle.trim() || createForm.isPending}
            >
              {createForm.isPending ? 'Creating...' : 'Create'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setNewTitle('');
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <TextInput
        placeholder="Search forms..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="space-y-2">
        {filteredForms?.length === 0 && (
          <p className="text-sm text-ws-text-secondary text-center py-8">
            No forms found. Create one to get started.
          </p>
        )}

        {filteredForms?.map((form) => (
          <IntakeFormRow
            key={form.id}
            form={form}
            onSelect={() => onSelectForm?.(form.id)}
            onCopyUrl={() => copyPublicUrl(form.unique_id)}
          />
        ))}
      </div>
    </div>
  );
}

interface IntakeFormRowProps {
  form: IntakeForm;
  onSelect: () => void;
  onCopyUrl: () => void;
}

function IntakeFormRow({ form, onSelect, onCopyUrl }: IntakeFormRowProps) {
  return (
    <Card
      className="p-3 cursor-pointer hover:bg-ws-bg transition-colors"
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{form.title}</span>
            <Badge variant={form.status === 'active' ? 'success' : 'neutral'}>
              {form.status}
            </Badge>
          </div>
          <div className="text-xs text-ws-text-secondary mt-1">
            {form.unique_id} · {new Date(form.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onCopyUrl();
            }}
            title="Copy public URL"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`${FORMS_BASE_URL}/${form.unique_id}`, '_blank');
            }}
            title="Open public form"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
