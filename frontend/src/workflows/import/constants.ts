import { Check, Play, Lightbulb, ArrowUpRight, Clock } from 'lucide-react';

export const OUTCOME_OPTIONS = [
    { value: 'FACT_EMITTED', label: 'Emit as Fact', icon: Check, color: 'text-green-600' },
    { value: 'DERIVED_STATE', label: 'Derived State', icon: Play, color: 'text-blue-600' },
    { value: 'INTERNAL_WORK', label: 'Internal Work', icon: Lightbulb, color: 'text-amber-500' },
    { value: 'EXTERNAL_WORK', label: 'External Work', icon: ArrowUpRight, color: 'text-purple-500' },
    { value: 'DEFERRED', label: 'Defer', icon: Clock, color: 'text-slate-500' },
] as const;
