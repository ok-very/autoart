import { useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchForm, submitForm } from '../api';
import { BlockRenderer, isInputBlock } from './BlockRenderer';

export function FormPage() {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    data: form,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['form', uniqueId],
    queryFn: () => fetchForm(uniqueId!),
    enabled: !!uniqueId,
  });

  const submit = useMutation({
    mutationFn: () => {
      const uploadCode = (formData.upload_code as string) || `UC-${Date.now()}`;
      return submitForm(uniqueId!, uploadCode, formData);
    },
    onSuccess: () => {
      navigate(`/${uniqueId}/success`);
    },
  });

  const handleFieldChange = (blockId: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [blockId]: value }));
    // Clear error when field is modified
    if (errors[blockId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[blockId];
        return next;
      });
    }
  };

  const validateCurrentPage = (): boolean => {
    if (!form) return false;

    const pages = form.pages.sort((a, b) => a.page_index - b.page_index);
    const currentPageData = pages[currentPage];
    if (!currentPageData?.blocks_config?.blocks) return true;

    const newErrors: Record<string, string> = {};

    for (const block of currentPageData.blocks_config.blocks) {
      if (block.kind === 'module' && block.required && isInputBlock(block)) {
        const value = formData[block.id];
        if (value === undefined || value === null || value === '' ||
            (Array.isArray(value) && value.length === 0)) {
          newErrors[block.id] = `${block.label} is required`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validateCurrentPage()) {
      submit.mutate();
    }
  };

  const handleNext = () => {
    if (validateCurrentPage()) {
      setCurrentPage((p) => p + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Form Not Found</h1>
          <p className="text-slate-600">
            This form may have been disabled or doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  const pages = form.pages.sort((a, b) => a.page_index - b.page_index);
  const currentPageData = pages[currentPage];
  const isLastPage = currentPage === pages.length - 1;
  const isFirstPage = currentPage === 0;
  const blocks = currentPageData?.blocks_config?.blocks || [];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{form.title}</h1>
        {form.sharepoint_request_url && (
          <a
            href={form.sharepoint_request_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm mt-2 inline-block"
          >
            Request files from SharePoint
          </a>
        )}
      </div>

      {/* Progress */}
      {pages.length > 1 && (
        <div className="mb-6">
          <div className="flex items-center gap-2">
            {pages.map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded ${i <= currentPage ? 'bg-blue-600' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Page {currentPage + 1} of {pages.length}
          </p>
        </div>
      )}

      {/* Page Title */}
      {currentPageData?.blocks_config?.settings?.pageTitle && (
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          {currentPageData.blocks_config.settings.pageTitle}
        </h2>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            value={formData[block.id]}
            onChange={handleFieldChange}
            error={errors[block.id]}
          />
        ))}

        {/* Empty state */}
        {blocks.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            This page has no questions yet.
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={isFirstPage}
            className={`px-4 py-2 rounded ${isFirstPage ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-100'}`}
          >
            Previous
          </button>

          {isLastPage ? (
            <button
              type="submit"
              disabled={submit.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submit.isPending ? 'Submitting...' : 'Submit'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Next
            </button>
          )}
        </div>

        {submit.error && (
          <p className="text-red-600 text-sm text-center">
            Failed to submit. Please try again.
          </p>
        )}
      </form>
    </div>
  );
}
