import { useState, useMemo } from 'react';
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import {
  useIntakeForm,
  useUpdateIntakeForm,
} from '../../../api/hooks';
import {
  Button,
  TextInput,
  Badge,
  Spinner,
  Card,
  Label,
  Select,
} from '@autoart/ui';
import { SegmentedControl } from '@autoart/ui';

import type { IntakeFormStatus, FormBlock, ModuleBlock } from '@autoart/shared';
import { SubmissionsTable } from '../components/SubmissionsTable';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

const FORMS_BASE_URL = 'https://forms.autoart.work';

type TabValue = 'overview' | 'responses';

interface IntakeDetailPanelProps {
  formId: string;
  onBack?: () => void;
  /** Callback when clicking a created record badge */
  onRecordClick?: (recordId: string) => void;
}

export function IntakeDetailPanel({ formId, onBack, onRecordClick }: IntakeDetailPanelProps) {
  const { data: form, isLoading } = useIntakeForm(formId);
  const updateForm = useUpdateIntakeForm();

  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [editingUrl, setEditingUrl] = useState(false);
  const [sharepointUrl, setSharepointUrl] = useState('');

  // Build block labels from form pages for the submissions table
  const blockLabels = useMemo(() => {
    const labels = new Map<string, string>();
    if (form?.pages) {
      for (const page of form.pages) {
        const blocks = page.blocks_config?.blocks as FormBlock[] | undefined;
        if (blocks) {
          for (const block of blocks) {
            if (block.kind === 'module') {
              labels.set(block.id, (block as ModuleBlock).label);
            }
          }
        }
      }
    }
    return labels;
  }, [form?.pages]);

  const handleStatusChange = (status: IntakeFormStatus) => {
    updateForm.mutate({ id: formId, status });
  };

  const handleSaveSharepointUrl = async () => {
    await updateForm.mutateAsync({
      id: formId,
      sharepoint_request_url: sharepointUrl || null,
    });
    setEditingUrl(false);
  };

  const copyPublicUrl = () => {
    if (form) {
      navigator.clipboard.writeText(`${FORMS_BASE_URL}/${form.unique_id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-4 text-center text-ws-text-secondary">Form not found</div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div className="flex-1">
          <h2 className="text-ws-h2 font-semibold">{form.title}</h2>
          <div className="text-sm text-ws-text-secondary">{form.unique_id}</div>
        </div>
        <Badge variant={form.status === 'active' ? 'success' : 'neutral'}>
          {form.status}
        </Badge>
      </div>

      {/* Tab navigation */}
      <SegmentedControl
        value={activeTab}
        onChange={(val) => setActiveTab(val as TabValue)}
        data={[
          { value: 'overview', label: 'Overview' },
          { value: 'responses', label: 'Responses' },
        ]}
      />

      {/* Tab content */}
      {activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* Public URL */}
          <Card className="p-4">
            <Label>Public URL</Label>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-sm bg-slate-100 px-3 py-2 rounded truncate">
                {FORMS_BASE_URL}/{form.unique_id}
              </code>
              <Button size="sm" variant="ghost" onClick={copyPublicUrl}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  window.open(`${FORMS_BASE_URL}/${form.unique_id}`, '_blank')
                }
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          {/* Settings */}
          <Card className="p-4 space-y-4">
            <div>
              <Select
                label="Status"
                value={form.status}
                onChange={(val) => val && handleStatusChange(val as IntakeFormStatus)}
                data={STATUS_OPTIONS}
              />
            </div>

            <div>
              <Label>SharePoint Request URL</Label>
              {editingUrl ? (
                <div className="flex gap-2 mt-1">
                  <TextInput
                    value={sharepointUrl}
                    onChange={(e) => setSharepointUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleSaveSharepointUrl}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingUrl(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-ws-text-secondary truncate flex-1">
                    {form.sharepoint_request_url || '(not set)'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSharepointUrl(form.sharepoint_request_url || '');
                      setEditingUrl(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <SubmissionsTable
          formId={formId}
          blockLabels={blockLabels}
          onRecordClick={onRecordClick}
        />
      )}
    </div>
  );
}
