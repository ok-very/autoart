/**
 * ArtCollector Wizard View
 *
 * Main orchestrator for the 4-step ArtCollector wizard:
 * 1. Source Input - URL or folder path
 * 2. Stream & Review - Real-time preview gallery with select/discard
 * 3. Text & Slugs - Edit text + generate slugs
 * 4. Tearsheet Builder - justified-layout preview, export options
 */

import { useState, useCallback, useMemo } from 'react';
import { Stack, Card, Text, ProgressBar, Inline } from '@autoart/ui';

import {
  ArtCollectorContextProvider,
  type ArtCollectorContextValue,
} from '../context/ArtCollectorContext';
import { Step1Source } from '../steps/Step1Source';
import { Step2StreamReview } from '../steps/Step2StreamReview';
import { Step3TextSlugs } from '../steps/Step3TextSlugs';
import { Step4Tearsheet } from '../steps/Step4Tearsheet';

import type {
  ArtifactPreview,
  TextElement,
  TearsheetConfig,
  StreamProgress,
} from '../types';

const STEPS = [
  { number: 1, title: 'Select Source', component: Step1Source },
  { number: 2, title: 'Stream & Review', component: Step2StreamReview },
  { number: 3, title: 'Text & Slugs', component: Step3TextSlugs },
  { number: 4, title: 'Tearsheet', component: Step4Tearsheet },
];

const DEFAULT_TEARSHEET: TearsheetConfig = {
  pages: [],
  currentPageIndex: 0,
  pageSize: 'letter',
  orientation: 'landscape',
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
  shuffleSeed: Date.now(),
};

export function ArtCollectorWizardView() {
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Source
  const [sourceType, setSourceType] = useState<'web' | 'local'>('local');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourcePath, setSourcePath] = useState('');

  // Step 2: Artifacts
  const [artifacts, setArtifacts] = useState<ArtifactPreview[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState<StreamProgress>({
    stage: 'idle',
    percent: 0,
  });

  // Step 3: Text & Slugs
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [prunedTextIds, setPrunedTextIds] = useState<Set<string>>(new Set());
  const [slugOverrides, setSlugOverrides] = useState<Map<string, string>>(new Map());

  // Step 4: Tearsheet
  const [tearsheet, setTearsheet] = useState<TearsheetConfig>(DEFAULT_TEARSHEET);
  const [availableImages, setAvailableImages] = useState<string[]>([]);

  // Artifact handlers
  const addArtifact = useCallback((artifact: ArtifactPreview) => {
    setArtifacts((prev) => [...prev, artifact]);
    if (artifact.selected) {
      setSelectedIds((prev) => new Set([...prev, artifact.ref_id]));
    }
    setAvailableImages((prev) => [...prev, artifact.ref_id]);
  }, []);

  const toggleArtifactSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllArtifacts = useCallback(() => {
    setSelectedIds(new Set(artifacts.map((a) => a.ref_id)));
  }, [artifacts]);

  const deselectAllArtifacts = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Text handlers
  const pruneText = useCallback((id: string) => {
    setPrunedTextIds((prev) => new Set([...prev, id]));
  }, []);

  const restoreText = useCallback((id: string) => {
    setPrunedTextIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Slug handlers
  const setSlugOverride = useCallback((artifactId: string, slug: string) => {
    setSlugOverrides((prev) => new Map(prev).set(artifactId, slug));
  }, []);

  const clearSlugOverride = useCallback((artifactId: string) => {
    setSlugOverrides((prev) => {
      const next = new Map(prev);
      next.delete(artifactId);
      return next;
    });
  }, []);

  // Tearsheet handlers
  const updateTearsheet = useCallback((config: Partial<TearsheetConfig>) => {
    setTearsheet((prev) => ({ ...prev, ...config }));
  }, []);

  const addImageToPage = useCallback(
    (artifactId: string, pageIndex?: number) => {
      const targetIndex = pageIndex ?? tearsheet.currentPageIndex;
      setTearsheet((prev) => {
        const pages = [...prev.pages];
        if (!pages[targetIndex]) {
          pages[targetIndex] = {
            id: `page-${targetIndex}`,
            imageRefs: [],
            shuffleSeed: Date.now(),
          };
        }
        pages[targetIndex] = {
          ...pages[targetIndex],
          imageRefs: [...pages[targetIndex].imageRefs, artifactId],
        };
        return { ...prev, pages };
      });
      setAvailableImages((prev) => prev.filter((id) => id !== artifactId));
    },
    [tearsheet.currentPageIndex]
  );

  const removeImageFromPage = useCallback(
    (artifactId: string, pageIndex: number) => {
      setTearsheet((prev) => {
        const pages = [...prev.pages];
        if (pages[pageIndex]) {
          pages[pageIndex] = {
            ...pages[pageIndex],
            imageRefs: pages[pageIndex].imageRefs.filter((id) => id !== artifactId),
          };
        }
        return { ...prev, pages };
      });
      setAvailableImages((prev) => [...prev, artifactId]);
    },
    []
  );

  const shufflePage = useCallback((pageIndex: number) => {
    setTearsheet((prev) => {
      const pages = [...prev.pages];
      if (pages[pageIndex]) {
        pages[pageIndex] = {
          ...pages[pageIndex],
          shuffleSeed: Date.now(),
        };
      }
      return { ...prev, pages };
    });
  }, []);

  // Create context value
  const contextValue = useMemo<ArtCollectorContextValue>(
    () => ({
      sourceType,
      setSourceType,
      sourceUrl,
      setSourceUrl,
      sourcePath,
      setSourcePath,
      artifacts,
      addArtifact,
      toggleArtifactSelection,
      selectAllArtifacts,
      deselectAllArtifacts,
      selectedIds,
      isStreaming,
      setIsStreaming,
      streamProgress,
      setStreamProgress,
      textElements,
      setTextElements,
      pruneText,
      restoreText,
      prunedTextIds,
      slugOverrides,
      setSlugOverride,
      clearSlugOverride,
      tearsheet,
      updateTearsheet,
      addImageToPage,
      removeImageFromPage,
      shufflePage,
      availableImages,
    }),
    [
      sourceType,
      sourceUrl,
      sourcePath,
      artifacts,
      addArtifact,
      toggleArtifactSelection,
      selectAllArtifacts,
      deselectAllArtifacts,
      selectedIds,
      isStreaming,
      streamProgress,
      textElements,
      pruneText,
      restoreText,
      prunedTextIds,
      slugOverrides,
      setSlugOverride,
      clearSlugOverride,
      tearsheet,
      updateTearsheet,
      addImageToPage,
      removeImageFromPage,
      shufflePage,
      availableImages,
    ]
  );

  // Navigation
  const progress = (currentStep / STEPS.length) * 100;
  const CurrentStepComponent = STEPS[currentStep - 1].component;

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  return (
    <ArtCollectorContextProvider value={contextValue}>
      <Stack className="h-full bg-slate-50 relative overflow-hidden" gap="none">
        {/* Wizard Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <Stack gap="sm">
            <Inline align="center" justify="between">
              <Text size="lg" weight="bold">
                Art Collector
              </Text>
              <Text size="sm" color="muted">
                Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
              </Text>
            </Inline>
            <ProgressBar value={progress} size="sm" />
          </Stack>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          <Card
            className="min-h-[400px] h-full shadow-sm border border-slate-200"
            padding="lg"
          >
            <CurrentStepComponent onNext={handleNext} onBack={handleBack} />
          </Card>
        </div>
      </Stack>
    </ArtCollectorContextProvider>
  );
}
