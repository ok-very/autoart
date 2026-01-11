/**
 * Permit Mapping Rules
 *
 * Rules for interpreting CSV rows as permit-related events:
 * - PERMIT_ISSUED: Development Permit, Building Permit, Rezoning, etc.
 * - MILESTONE_ACHIEVED: DP/BP/RZ milestones (triggered by permit events)
 *
 * Note: PERMIT_ISSUED can trigger MILESTONE_ACHIEVED for corresponding
 * milestone types (DP → Development Permit milestone, etc.)
 */

import type { MappingRule, MappingContext, InterpretationOutput } from './types.js';

const PERMIT_ISSUED = 'PERMIT_ISSUED';
const MILESTONE_ACHIEVED = 'MILESTONE_ACHIEVED';

/**
 * Permit type normalization map.
 */
const PERMIT_TYPES: Record<string, { type: string; milestoneType?: string }> = {
    'dp': { type: 'Development Permit', milestoneType: 'DP' },
    'development permit': { type: 'Development Permit', milestoneType: 'DP' },
    'development': { type: 'Development Permit', milestoneType: 'DP' },
    'bp': { type: 'Building Permit', milestoneType: 'BP' },
    'building permit': { type: 'Building Permit', milestoneType: 'BP' },
    'building': { type: 'Building Permit', milestoneType: 'BP' },
    'rz': { type: 'Rezoning', milestoneType: 'RZ' },
    'rezoning': { type: 'Rezoning', milestoneType: 'RZ' },
    'electrical': { type: 'Electrical Permit' },
    'electrical permit': { type: 'Electrical Permit' },
    'plumbing': { type: 'Plumbing Permit' },
    'plumbing permit': { type: 'Plumbing Permit' },
    'occupancy': { type: 'Occupancy Permit' },
    'occupancy permit': { type: 'Occupancy Permit' },
};

/**
 * Extract permit type from text.
 */
function extractPermitType(text: string): { type: string; milestoneType?: string } | null {
    const lowerText = text.toLowerCase();

    // Direct lookup
    for (const [key, value] of Object.entries(PERMIT_TYPES)) {
        if (lowerText.includes(key)) {
            return value;
        }
    }

    return null;
}

/**
 * Extract permit number from text (e.g., "DP-2024-1234", "#123456").
 */
function extractPermitNumber(text: string): string | undefined {
    // Pattern: "DP-2024-1234", "BP#12345", "#123456", "permit #123"
    const patterns = [
        /(?:DP|BP|RZ)[-#]?\d{4}[-#]?\d+/i,
        /permit\s*#?\s*(\d+)/i,
        /#(\d{4,})/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[0] || match[1];
    }

    return undefined;
}

/**
 * Extract issuing authority from text.
 */
function extractAuthority(text: string): string | undefined {
    const patterns = [
        /(?:from|by|issued\s+by)\s+([^,;.]+)/i,
        /(?:city\s+of|municipality\s+of|county\s+of)\s+([^,;.]+)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
    }

    return undefined;
}

export const permitMappingRules: MappingRule[] = [
    // PERMIT_ISSUED rules
    {
        id: 'permit-received',
        description: 'Permit received/granted/issued',
        pattern: /(?:development|building|dp|bp|rz|rezoning)\s*(?:permit)?\s*(?:received|granted|issued|approved)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const permitInfo = extractPermitType(ctx.text);
            if (!permitInfo) return [];

            const outputs: InterpretationOutput[] = [{
                kind: 'fact_candidate',
                factKind: PERMIT_ISSUED,
                payload: {
                    permitType: permitInfo.type,
                    permitNumber: extractPermitNumber(ctx.text),
                    issuingAuthority: extractAuthority(ctx.text),
                },
                confidence: 'high',
            }];

            // If this permit type maps to a milestone, also emit MILESTONE_ACHIEVED
            if (permitInfo.milestoneType) {
                outputs.push({
                    kind: 'fact_candidate',
                    factKind: MILESTONE_ACHIEVED,
                    payload: {
                        milestoneType: permitInfo.milestoneType,
                        milestoneName: `${permitInfo.type} Received`,
                    },
                    confidence: 'high',
                });
            }

            return outputs;
        },
        priority: 12,
        terminal: true,
    },
    {
        id: 'permit-application-submitted',
        description: 'Permit application submitted',
        pattern: /(?:development|building|dp|bp|rz|rezoning)\s*(?:permit)?\s*(?:application)?\s*submitted/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const permitInfo = extractPermitType(ctx.text);
            return [{
                kind: 'action_hint',
                hintType: 'prepare',
                text: `Awaiting ${permitInfo?.type || 'permit'} approval`,
                phase: 'after_completion',
            }];
        },
        priority: 8,
    },
    {
        id: 'permit-status-approved',
        description: 'Permit status shows approved',
        pattern: /^(?:approved|issued|granted)$/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            // This matches when status column says "approved" etc.
            // Need parent context to determine permit type
            const parentLower = (ctx.parentTitle || '').toLowerCase();
            const permitInfo = extractPermitType(parentLower);

            if (!permitInfo) {
                // Generic approval without specific permit type
                return [{
                    kind: 'fact_candidate',
                    factKind: PERMIT_ISSUED,
                    payload: {
                        permitType: 'Permit',
                    },
                    confidence: 'medium',
                }];
            }

            const outputs: InterpretationOutput[] = [{
                kind: 'fact_candidate',
                factKind: PERMIT_ISSUED,
                payload: {
                    permitType: permitInfo.type,
                },
                confidence: 'high',
            }];

            if (permitInfo.milestoneType) {
                outputs.push({
                    kind: 'fact_candidate',
                    factKind: MILESTONE_ACHIEVED,
                    payload: {
                        milestoneType: permitInfo.milestoneType,
                        milestoneName: `${permitInfo.type} Received`,
                    },
                    confidence: 'high',
                });
            }

            return outputs;
        },
        priority: 6,
    },
    {
        id: 'city-approval-permit',
        description: 'City approval (often permit-related)',
        pattern: /city\s*(?:approval|approved)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const permitInfo = extractPermitType(ctx.text) || extractPermitType(ctx.parentTitle || '');

            return [{
                kind: 'fact_candidate',
                factKind: PERMIT_ISSUED,
                payload: {
                    permitType: permitInfo?.type || 'City Approval',
                    issuingAuthority: 'City',
                },
                confidence: permitInfo ? 'high' : 'medium',
            }];
        },
        priority: 9,
    },

    // MILESTONE_ACHIEVED rules (non-permit milestones)
    {
        id: 'milestone-ppap',
        description: 'PPAP milestone (Pre-Public Art Plan)',
        pattern: /ppap\s*(?:complete|approved|submitted|received)/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: MILESTONE_ACHIEVED,
            payload: {
                milestoneType: 'PPAP',
                milestoneName: 'Pre-Public Art Plan Complete',
            },
            confidence: 'high',
        }],
        priority: 11,
        terminal: true,
    },
    {
        id: 'milestone-dpap',
        description: 'DPAP milestone (Design Public Art Plan)',
        pattern: /dpap\s*(?:complete|approved|submitted|received)/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: MILESTONE_ACHIEVED,
            payload: {
                milestoneType: 'DPAP',
                milestoneName: 'Design Public Art Plan Complete',
            },
            confidence: 'high',
        }],
        priority: 11,
        terminal: true,
    },
    {
        id: 'milestone-checklist',
        description: 'Checklist milestone',
        pattern: /checklist\s*(?:complete|signed|approved)/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: MILESTONE_ACHIEVED,
            payload: {
                milestoneType: 'Checklist',
                milestoneName: 'Checklist Complete',
            },
            confidence: 'high',
        }],
        priority: 10,
    },
    {
        id: 'milestone-eoi',
        description: 'EOI milestone (Expression of Interest)',
        pattern: /eoi\s*(?:complete|closed|issued)/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: MILESTONE_ACHIEVED,
            payload: {
                milestoneType: 'EOI',
                milestoneName: 'Expression of Interest Complete',
            },
            confidence: 'high',
        }],
        priority: 10,
    },
    {
        id: 'milestone-tor',
        description: 'TOR milestone (Terms of Reference)',
        pattern: /tor\s*(?:complete|approved|signed)/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: MILESTONE_ACHIEVED,
            payload: {
                milestoneType: 'TOR',
                milestoneName: 'Terms of Reference Complete',
            },
            confidence: 'high',
        }],
        priority: 10,
    },
    {
        id: 'milestone-selection-panel',
        description: 'Selection Panel milestone (SP#1, AO, SP#2)',
        pattern: /(?:sp#?[12]|ao|artist\s*(?:open|selection))\s*(?:complete|held|concluded)/i,
        emits: (ctx: MappingContext): InterpretationOutput[] => {
            const lowerText = ctx.text.toLowerCase();
            let milestoneType = 'SP';

            if (lowerText.includes('sp#1') || lowerText.includes('sp1')) {
                milestoneType = 'SP#1';
            } else if (lowerText.includes('ao') || lowerText.includes('artist open')) {
                milestoneType = 'AO';
            } else if (lowerText.includes('sp#2') || lowerText.includes('sp2')) {
                milestoneType = 'SP#2';
            }

            return [{
                kind: 'fact_candidate',
                factKind: MILESTONE_ACHIEVED,
                payload: {
                    milestoneType,
                    milestoneName: `${milestoneType} Complete`,
                },
                confidence: 'high',
            }];
        },
        priority: 11,
    },
    {
        id: 'milestone-install',
        description: 'Install milestone',
        pattern: /install(?:ation)?\s*(?:complete|finished|done)/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: MILESTONE_ACHIEVED,
            payload: {
                milestoneType: 'Install',
                milestoneName: 'Installation Complete',
            },
            confidence: 'high',
        }],
        priority: 11,
        terminal: true,
    },
    {
        id: 'milestone-unveiling',
        description: 'Unveiling milestone',
        pattern: /unveil(?:ing)?\s*(?:complete|held|done)/i,
        emits: (): InterpretationOutput[] => [{
            kind: 'fact_candidate',
            factKind: MILESTONE_ACHIEVED,
            payload: {
                milestoneType: 'Unveiling',
                milestoneName: 'Unveiling Complete',
            },
            confidence: 'high',
        }],
        priority: 11,
        terminal: true,
    },
];
