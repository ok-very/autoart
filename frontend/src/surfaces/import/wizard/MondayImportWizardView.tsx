
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Stack, Card, Text, ProgressBar, Inline } from '@autoart/ui';

import { useContextStore } from '../../../stores/contextStore';
import { ImportContextProvider, type ImportContextValue } from '../ImportContextProvider';

// Import Steps
import { Step1SelectBoards } from './steps/Step1SelectBoards';
import { Step2ConfigureMapping } from './steps/Step2ConfigureMapping';
import { Step3Columns } from './steps/Step3Columns';
import { Step4Templates } from './steps/Step4Templates';
import { Step5Preview } from './steps/Step5Preview';
import { Step6Execute } from './steps/Step6Execute';

import type { ImportSession, ImportPlan } from '../../../api/hooks/imports';

interface MondayImportWizardViewProps {
    session: ImportSession | null;
    plan: ImportPlan | null;
    onSelectItem: (item: any) => void;
    onReset: () => void;
    onSessionCreated: (session: ImportSession, plan: ImportPlan) => void;
}

const STEPS = [
    { number: 1, title: 'Select Boards', component: Step1SelectBoards },
    { number: 2, title: 'Configure Mapping', component: Step2ConfigureMapping },
    { number: 3, title: 'Columns', component: Step3Columns },
    { number: 4, title: 'Links & Templates', component: Step4Templates },
    { number: 5, title: 'Preview', component: Step5Preview },
    { number: 6, title: 'Execute', component: Step6Execute },
];

export function MondayImportWizardView({
    session,
    plan,
    onSelectItem,
    onReset: _onReset,
    onSessionCreated,
}: MondayImportWizardViewProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [localPlan, setLocalPlan] = useState<ImportPlan | null>(plan);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [inspectorTab, setInspectorTab] = useState('import_details');

    // Track if update is internal to prevent circular updates
    const isInternalUpdate = useRef(false);

    const { setImportSession: setContextImportSession } = useContextStore();

    // Sync external plan changes to local state (only if not triggered by our own update)
    useEffect(() => {
        if (!isInternalUpdate.current) {
            setLocalPlan(plan);
        }
        isInternalUpdate.current = false;
    }, [plan]);

    // Sync session to context store for panel visibility predicates
    useEffect(() => {
        setContextImportSession({
            sessionId: session?.id ?? null,
            planExists: !!localPlan,
        });

        return () => {
            setContextImportSession({ sessionId: null, planExists: false });
        };
    }, [session?.id, !!localPlan, setContextImportSession]);

    // Handle plan updates from child components
    const handlePlanUpdate = useCallback((updatedPlan: ImportPlan) => {
        isInternalUpdate.current = true;
        setLocalPlan(updatedPlan);
        if (session) {
            onSessionCreated(session, updatedPlan);
        }
    }, [session, onSessionCreated]);

    // Handle item selection - sync to both local state and global store
    const handleSelectItem = useCallback((itemId: string | null) => {
        setSelectedItemId(itemId);
        // onSelectItem is selectImportItem from uiStore, expects string | null
        onSelectItem(itemId);
    }, [onSelectItem]);

    // Create context value
    const contextValue = useMemo<ImportContextValue>(() => ({
        session,
        plan: localPlan,
        selectedItemId,
        selectItem: handleSelectItem,
        updatePlan: handlePlanUpdate,
        inspectorTab,
        setInspectorTab,
    }), [session, localPlan, selectedItemId, handleSelectItem, handlePlanUpdate, inspectorTab]);

    // Derived state
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
        <ImportContextProvider value={contextValue}>
            <Stack className="h-full bg-slate-50 relative overflow-hidden" gap="none">
                {/* Wizard Header */}
                <div className="bg-white border-b border-slate-200 px-6 py-4">
                    <Stack gap="sm">
                        <Inline align="center" justify="between">
                            <Text size="lg" weight="bold">Monday.com Import Wizard</Text>
                            <Text size="sm" color="muted">Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}</Text>
                        </Inline>
                        <ProgressBar value={progress} size="sm" />
                    </Stack>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-auto p-6">
                    <Card className="min-h-[400px] h-full shadow-sm border border-slate-200" padding="lg">
                        <CurrentStepComponent
                            onNext={handleNext}
                            onBack={handleBack}
                            session={session}
                            plan={localPlan}
                            onSelectItem={onSelectItem}
                            onSessionCreated={onSessionCreated}
                        />
                    </Card>
                </div>
            </Stack>
        </ImportContextProvider>
    );
}
