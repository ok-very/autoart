
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

export function Step6Preview({ onNext, onBack }: StepProps) {
    return (
        <Stack className="h-full">
            <Text size="lg" weight="bold">Step 6: Preview Import</Text>
            <Text>Review the interpreted plan before execution. Click items to inspect details.</Text>

            <div className="flex-1 border rounded bg-slate-50 p-4">
                <Text color="dimmed" align="center">Preview UI will go here (Reusing MondayPreviewView logic)</Text>
            </div>

            <Inline justify="between">
                <Button onClick={onBack} variant="default">Back</Button>
                <Button onClick={onNext} variant="primary">Next: Execute</Button>
            </Inline>
        </Stack>
    );
}
