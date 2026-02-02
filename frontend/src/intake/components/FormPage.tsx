/**
 * FormPage - Public form renderer using React Hook Form + Zod
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FormProvider } from 'react-hook-form';
import { fetchForm, submitForm } from '../api';
import { BlockRenderer } from './BlockRenderer';
import { useIntakeForm } from '../hooks/useIntakeForm';
import type { IntakeFormConfig } from '@autoart/shared';

export function FormPage() {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);

  const {
    data: form,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['form', uniqueId],
    queryFn: () => fetchForm(uniqueId!),
    enabled: !!uniqueId,
  });

  // Build config from form data
  const config = useMemo<IntakeFormConfig | null>(() => {
    if (!form) return null;

    // Gather all blocks from all pages
    const allBlocks = form.pages
      .sort((a, b) => a.page_index - b.page_index)
      .flatMap((page) => page.blocks_config?.blocks || []);

    return {
      blocks: allBlocks,
      settings: form.pages[0]?.blocks_config?.settings,
    };
  }, [form]);



  // Initialize hook only when config is available
  const formEngine = useIntakeForm({
    config: config ?? { blocks: [] },
    submitFn: async (data) => {
      const uploadCode = (data.upload_code as string) || `UC-${Date.now()}`;
      await submitForm(uniqueId!, uploadCode, data);
    },
    onSubmitSuccess: () => {
      navigate(`/${uniqueId}/success`);
    },
  });

  const { rhf, onSubmit, isSubmitting, submitError, isSubmitted } = formEngine;

  // Handle redirect on successful submission
  useEffect(() => {
    if (isSubmitted) {
      const redirectUrl = config?.settings?.redirectUrl;
      if (redirectUrl) {
        const timer = setTimeout(() => {
          window.location.href = redirectUrl;
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [isSubmitted, config]);

  // Validation for page navigation
  const validateCurrentPage = async (): Promise<boolean> => {
    if (!form || !config) return false;

    const pages = form.pages.sort((a, b) => a.page_index - b.page_index);
    const currentPageData = pages[currentPage];
    if (!currentPageData?.blocks_config?.blocks) return true;

    // Validate only the fields on the current page
    const pageBlockIds = currentPageData.blocks_config.blocks.map((b: { id: string }) => b.id);
    const result = await rhf.trigger(pageBlockIds);
    return result;
  };

  const handleSubmit = rhf.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  const handleNext = async () => {
    const isValid = await validateCurrentPage();
    if (isValid) {
      setCurrentPage((p) => p + 1);
    }
  };

  const handlePrev = () => {
    setCurrentPage((p) => p - 1);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Error state
  if (error || !form) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-ws-h1 font-semibold text-ws-fg mb-2">Form Not Found</h1>
          <p className="text-ws-text-secondary">
            This form may have been disabled or doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  // Success state (after submission)
  if (isSubmitted) {
    const confirmationMessage = config?.settings?.confirmationMessage
      ?? 'Thank you! Your response has been recorded.';
    const redirectUrl = config?.settings?.redirectUrl;

    // Auto-redirect if configured


    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-ws-h1 font-semibold text-ws-fg mb-2">Submitted!</h1>
          <p className="text-ws-text-secondary">{confirmationMessage}</p>
          {redirectUrl && (
            <p className="text-sm text-ws-muted mt-4">Redirecting...</p>
          )}
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
        <h1 className="text-ws-h1 font-semibold text-ws-fg">{form.title}</h1>
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
          <p className="text-sm text-ws-text-secondary mt-2">
            Page {currentPage + 1} of {pages.length}
          </p>
        </div>
      )}

      {/* Page Title */}
      {(currentPageData?.blocks_config?.settings as any)?.pageTitle && (
        <h2 className="text-ws-h2 font-semibold text-ws-fg mb-4">
          {(currentPageData.blocks_config.settings as any).pageTitle}
        </h2>
      )}

      {/* Form with React Hook Form Provider */}
      <FormProvider {...rhf}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} />
          ))}

          {/* Empty state */}
          {blocks.length === 0 && (
            <div className="text-center py-12 text-ws-text-secondary">
              This page has no questions yet.
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handlePrev}
              disabled={isFirstPage}
              className={`px-4 py-2 rounded ${isFirstPage ? 'text-ws-muted cursor-not-allowed' : 'text-ws-text-secondary hover:bg-slate-100'}`}
            >
              Previous
            </button>

            {isLastPage ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
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

          {submitError && (
            <p className="text-red-600 text-sm text-center">{submitError}</p>
          )}
        </form>
      </FormProvider>
    </div>
  );
}
