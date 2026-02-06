import { Phone } from 'lucide-react';
import { PhoneInput } from '@autoart/ui';
import type { EditorBlockProps } from './EditorBlockRenderer';

export function PhonePreview({ isActive }: EditorBlockProps) {
    if (!isActive) {
        return (
            <div className="flex items-center gap-2 text-ws-muted">
                <Phone className="w-4 h-4 opacity-40" />
                <span className="text-sm">Phone number</span>
            </div>
        );
    }

    return (
        <div className="w-1/2">
            <PhoneInput disabled placeholder="(555) 000-0000" />
        </div>
    );
}
