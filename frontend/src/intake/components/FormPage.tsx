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
import { IntakeFormProvider } from '../context/IntakeFormContext';
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
      <div className="flex items-center justify-center min-h-screen bg-pub-bg">
        <div className="pub-spinner" />
      </div>
    );
  }

  // Error state
  if (error || !form) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-pub-bg">
        <div className="text-center">
          <h1 className="text-pub-h1 font-semibold text-pub-fg mb-pub-2">Form Not Found</h1>
          <p className="text-pub-text-secondary">
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

    return (
      <div className="flex items-center justify-center min-h-screen bg-pub-bg">
        <div className="text-center max-w-md mx-auto p-pub-8">
          <div className="pub-success-icon mx-auto mb-pub-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-pub-h1 font-semibold text-pub-fg mb-pub-2">Submitted!</h1>
          <p className="text-pub-text-secondary">{confirmationMessage}</p>
          {redirectUrl && (
            <p className="text-pub-meta text-pub-muted mt-pub-4">Redirecting...</p>
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
    <div className="max-w-2xl mx-auto py-pub-8 px-pub-4 bg-pub-bg min-h-screen">
      {/* Header */}
      <div className="mb-pub-8">
        <h1 className="text-pub-h1 font-semibold text-pub-fg">{form.title}</h1>
        {form.sharepoint_request_url && (
          <a
            href={form.sharepoint_request_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pub-accent hover:underline text-pub-meta mt-pub-2 inline-block"
          >
            Request files from SharePoint
          </a>
        )}
      </div>

      {/* Progress */}
      {pages.length > 1 && (
        <div className="mb-pub-6">
          <div className="flex items-center gap-pub-2">
            {pages.map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-pub-progress ${i <= currentPage ? 'bg-pub-accent' : 'bg-pub-progress-bg'}`}
              />
            ))}
          </div>
          <p className="text-pub-meta text-pub-text-secondary mt-pub-2">
            Page {currentPage + 1} of {pages.length}
          </p>
        </div>
      )}

      {/* Page Title */}
      {(currentPageData?.blocks_config?.settings as any)?.pageTitle && (
        <h2 className="text-pub-h2 font-semibold text-pub-fg mb-pub-4">
          {(currentPageData.blocks_config.settings as any).pageTitle}
        </h2>
      )}

      {/* Form with React Hook Form Provider */}
      <FormProvider {...rhf}>
        <IntakeFormProvider formUniqueId={uniqueId!}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-pub-6">
            {blocks.map((block) => (
              <BlockRenderer key={block.id} block={block} />
            ))}

            {/* Empty state */}
            {blocks.length === 0 && (
              <div className="text-center py-12 text-pub-text-secondary">
                This page has no questions yet.
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-pub-4">
              <button
                type="button"
                onClick={handlePrev}
                disabled={isFirstPage}
                className={`pub-button-text ${isFirstPage ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Previous
              </button>

              {isLastPage ? (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="pub-button-primary"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="pub-button-primary"
                >
                  Next
                </button>
              )}
            </div>

            {submitError && (
              <p className="pub-error text-center">{submitError}</p>
            )}
          </form>
        </IntakeFormProvider>
      </FormProvider>
    </div>
  );
}
