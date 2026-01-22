import { useState } from 'react';
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import {
  useIntakeForm,
  useUpdateIntakeForm,
  useIntakeSubmissions,
} from '../../api/hooks';
import {
  Button,
  TextInput,
  Badge,
  Spinner,
  Card,
  Label,
  Select,
} from '@autoart/ui';

import type { IntakeSubmission, IntakeFormStatus } from '@autoart/shared';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

const FORMS_BASE_URL = 'https://forms.autoart.work';

interface IntakeDetailPanelProps {
  formId: string;
  onBack?: () => void;
}

export function IntakeDetailPanel({ formId, onBack }: IntakeDetailPanelProps) {
  const { data: form, isLoading } = useIntakeForm(formId);
  const { data: submissions, isLoading: loadingSubmissions } =
    useIntakeSubmissions(formId);
  const updateForm = useUpdateIntakeForm();

  const [editingUrl, setEditingUrl] = useState(false);
  const [sharepointUrl, setSharepointUrl] = useState('');

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
      <div className="p-4 text-center text-slate-500">Form not found</div>
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
          <h2 className="text-lg font-semibold">{form.title}</h2>
          <div className="text-sm text-slate-500">{form.unique_id}</div>
        </div>
        <Badge variant={form.status === 'active' ? 'success' : 'neutral'}>
          {form.status}
        </Badge>
      </div>

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
              <span className="text-sm text-slate-600 truncate flex-1">
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

      {/* Submissions */}
      <div>
        <h3 className="font-medium mb-3">
          Submissions ({submissions?.length ?? 0})
        </h3>

        {loadingSubmissions ? (
          <Spinner />
        ) : submissions?.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No submissions yet.
          </p>
        ) : (
          <div className="space-y-2">
            {submissions?.map((sub) => (
              <SubmissionRow key={sub.id} submission={sub} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubmissionRow({ submission }: { submission: IntakeSubmission }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className="p-3 cursor-pointer hover:bg-slate-50"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-sm">{submission.upload_code}</span>
          <span className="text-xs text-slate-500 ml-2">
            {new Date(submission.created_at).toLocaleString()}
          </span>
        </div>
      </div>

      {expanded && (
        <pre className="mt-3 text-xs bg-slate-100 p-2 rounded overflow-auto max-h-48">
          {JSON.stringify(submission.metadata, null, 2)}
        </pre>
      )}
    </Card>
  );
}
