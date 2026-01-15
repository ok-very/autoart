
import { Stack } from '../../../../ui/atoms/Stack';
import { Text } from '../../../../ui/atoms/Text';
import { Button } from '../../../../ui/atoms/Button';
import { Inline } from '../../../../ui/atoms/Inline';

interface StepProps {
    onNext: () => void;
    onBack: () => void;
    session: any;
    plan: any;
    onSelectItem: (item: any) => void;
}

export function Step7Execute({ onNext, onBack }: StepProps) {
    return (
        <Stack className="h-full">
            <Text size="lg" weight="bold">Step 7: Execute Import</Text>
            <Text>Ready to import data into AutoArt.</Text>

            <div className="flex-1 border rounded bg-slate-50 p-4">
                <Text color="dimmed" align="center">Execution Log / Progress Bar</Text>
            </div>

            <Inline justify="between">
                <Button onClick={onBack} variant="default">Back</Button>
                <Button onClick={() => alert('Start!')} variant="primary">Start Import</Button>
            </Inline>
        </Stack>
    );
}
