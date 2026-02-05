import { AtSign } from 'lucide-react';
import { EmailInput } from '@autoart/ui';
import type { EditorBlockProps } from './EditorBlockRenderer';

export function EmailPreview({ isActive }: EditorBlockProps) {
    if (!isActive) {
        return (
            <div className="flex items-center gap-2 text-ws-muted">
                <AtSign className="w-4 h-4 opacity-40" />
                <span className="text-sm">Email address</span>
            </div>
        );
    }

    return (
        <div className="w-1/2">
            <EmailInput disabled placeholder="name@example.com" />
        </div>
    );
}
