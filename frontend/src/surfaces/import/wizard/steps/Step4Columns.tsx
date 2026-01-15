
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

export function Step4Columns({ onNext, onBack }: StepProps) {
    return (
        <Stack className="h-full">
            <Text size="lg" weight="bold">Step 4: Map Columns</Text>
            <Text>Assign semantic roles to columns (e.g., Status, Due Date, Assignee).</Text>

            <div className="flex-1 border rounded bg-slate-50 p-4">
                <Text color="dimmed" align="center">Column Mapping UI will go here</Text>
            </div>

            <Inline justify="between">
                <Button onClick={onBack} variant="default">Back</Button>
                <Button onClick={onNext} variant="primary">Next: Templates</Button>
            </Inline>
        </Stack>
    );
}
