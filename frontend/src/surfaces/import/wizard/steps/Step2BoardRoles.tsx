
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

export function Step2BoardRoles({ onNext, onBack }: StepProps) {
    return (
        <Stack className="h-full">
            <Text size="lg" weight="bold">Step 2: Configure Board Roles</Text>
            <Text>Define how each board should be interpreted (e.g., as a Project or Task List).</Text>

            <div className="flex-1 border rounded bg-slate-50 p-4">
                <Text color="dimmed" align="center">Board Roles UI will go here</Text>
            </div>

            <Inline justify="between">
                <Button onClick={onBack} variant="default">Back</Button>
                <Button onClick={onNext} variant="primary">Next: Group Roles</Button>
            </Inline>
        </Stack>
    );
}
