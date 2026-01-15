
import { useState, useCallback } from 'react';
import { Stack } from '../../../ui/atoms/Stack';
import { Card } from '../../../ui/atoms/Card';
import { Text } from '../../../ui/atoms/Text';
import { Button } from '../../../ui/atoms/Button';
import { ProgressBar } from '../../../ui/atoms/ProgressBar';
import { Inline } from '../../../ui/atoms/Inline';

// Import Steps (Placeholders for now)
import { Step1SelectBoards } from './steps/Step1SelectBoards';
import { Step2BoardRoles } from './steps/Step2BoardRoles';
import { Step3GroupRoles } from './steps/Step3GroupRoles';
import { Step4Columns } from './steps/Step4Columns';
import { Step5Templates } from './steps/Step5Templates';
import { Step6Preview } from './steps/Step6Preview';
import { Step7Execute } from './steps/Step7Execute';

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
    { number: 2, title: 'Board Roles', component: Step2BoardRoles },
    { number: 3, title: 'Group Roles', component: Step3GroupRoles },
    { number: 4, title: 'Columns', component: Step4Columns },
    { number: 5, title: 'Links & Templates', component: Step5Templates },
    { number: 6, title: 'Preview', component: Step6Preview },
    { number: 7, title: 'Execute', component: Step7Execute },
];

export function MondayImportWizardView({
    session,
    plan,
    onSelectItem,
    onReset,
    onSessionCreated,
}: MondayImportWizardViewProps) {
    const [currentStep, setCurrentStep] = useState(1);

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
        <Stack className="h-full bg-slate-50 relative overflow-hidden" gap="none">
            {/* Wizard Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <Stack gap="sm">
                    <Inline align="center" justify="between">
                        <Text size="lg" weight="bold">Monday.com Import Wizard</Text>
                        <Text size="sm" color="dimmed">Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}</Text>
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
                        plan={plan}
                        onSelectItem={onSelectItem}
                        onSessionCreated={onSessionCreated}
                    />
                </Card>
            </div>

            {/* Footer / Controls (Moved into steps or kept global?)
                Ideally steps manage their own validation state, but global nav logic is here.
                We pass onNext/onBack to step components so they can trigger nav after validation.
            */}
        </Stack>
    );
}
