/**
 * ConfirmUnlinkView
 *
 * Confirmation dialog for unlinking entities (e.g., email from action/record).
 */

import { Unlink } from 'lucide-react';
import { useState } from 'react';

import { useUIStore } from '@/stores';

import type { OverlayProps, ConfirmUnlinkContext } from '../../../overlay/types';
import { Alert } from '@autoart/ui';
import { Button } from '@autoart/ui';
import { Inline } from '@autoart/ui';
import { Stack } from '@autoart/ui';
import { Text } from '@autoart/ui';

type ConfirmUnlinkViewProps = OverlayProps<ConfirmUnlinkContext, { unlinked: boolean }>;

export function ConfirmUnlinkView(props: ConfirmUnlinkViewProps) {
    const { context, onSubmit, onClose } = props;
    const { targetTitle, onConfirm } = context;

    const { closeOverlay } = useUIStore();
    const [isUnlinking, setIsUnlinking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        if (onClose) {
            onClose();
        } else {
            closeOverlay();
        }
    };

    const handleConfirm = async () => {
        setIsUnlinking(true);
        setError(null);
        try {
            await onConfirm();

            onSubmit({
                success: true,
                data: { unlinked: true },
            });
        } catch (err) {
            console.error('Unlink action failed:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unlink failed. Please try again.';
            setError(errorMessage);
            setIsUnlinking(false);

            onSubmit({
                success: false,
                error: errorMessage,
            });
        }
    };

    return (
        <div className="max-w-lg mx-auto">
            <Stack gap="lg">
                {/* Header */}
                <Inline gap="md" align="start">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-yellow-100 text-yellow-600">
                        <Unlink size={24} />
                    </div>
                    <div className="flex-1">
                        <Text size="lg" weight="medium" className="mb-1">Remove Link</Text>
                        <Text size="sm" color="muted">
                            Are you sure you want to remove the link to this item?
                        </Text>
                        <Text size="sm" weight="medium" className="mt-2 bg-slate-100 px-3 py-1.5 rounded inline-block">
                            {targetTitle}
                        </Text>
                    </div>
                </Inline>

                {/* Error */}
                {error && (
                    <Alert variant="error">
                        {error}
                    </Alert>
                )}

                {/* Actions */}
                <Inline justify="end" gap="sm" className="pt-4 border-t border-slate-100">
                    <Button
                        variant="secondary"
                        onClick={handleClose}
                        disabled={isUnlinking}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleConfirm}
                        disabled={isUnlinking}
                    >
                        {isUnlinking ? 'Removing...' : 'Remove Link'}
                    </Button>
                </Inline>
            </Stack>
        </div>
    );
}
