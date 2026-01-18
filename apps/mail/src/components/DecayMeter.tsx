// DecayMeter - Visual indicator of email age/freshness
// Adapted from demo-triage-inbox.html

import { useState, useEffect } from 'react';

interface DecayMeterProps {
    timestamp: string;
    maxHours?: number;
}

export function DecayMeter({ timestamp, maxHours = 48 }: DecayMeterProps) {
    const [now, setNow] = useState(Date.now());

    // Update every minute to keep meter live
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    const receivedTime = new Date(timestamp).getTime();
    const hoursElapsed = (now - receivedTime) / (1000 * 60 * 60);
    const percentage = Math.min(100, (hoursElapsed / maxHours) * 100);

    // Fresh (0-24h) → Aging (24-48h) → Overdue (48h+)
    let colorClass = 'bg-emerald-500';
    let textColorClass = 'text-emerald-600';
    let label = 'Fresh';

    if (hoursElapsed > 48) {
        colorClass = 'bg-rose-500';
        textColorClass = 'text-rose-600';
        label = 'Overdue';
    } else if (hoursElapsed > 24) {
        colorClass = 'bg-amber-500';
        textColorClass = 'text-amber-600';
        label = 'Aging';
    }

    return (
        <div className="flex flex-col gap-1 w-full max-w-[80px]" title={label}>
            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider">
                <span className={textColorClass}>{Math.round(hoursElapsed)}h</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
