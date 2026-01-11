/**
 * Fact Kind Inferrer
 *
 * Infers human-readable fact kind labels from unstructured text.
 * Used to provide smart suggestions when no exact rule matches.
 *
 * Pattern: Extract "[Object] [Past-Tense Verb]" from text
 * Example: "Submit Fee Proposal to Developer" → "Fee Proposal Submitted"
 */

// ============================================================================
// TYPES
// ============================================================================

export interface InferredFactKind {
    /** Human-readable label (e.g., "Fee Proposal Submitted") */
    label: string;
    /** SCREAMING_SNAKE_CASE key (e.g., "FEE_PROPOSAL_SUBMITTED") */
    key: string;
    /** Confidence in the inference (0-1) */
    confidence: number;
    /** Source of inference */
    source: 'verb-object' | 'template' | 'fallback';
}

// ============================================================================
// VERB MAPPINGS
// ============================================================================

/**
 * Map base verbs to past tense
 */
const VERB_TO_PAST: Record<string, string> = {
    submit: 'Submitted',
    send: 'Sent',
    receive: 'Received',
    complete: 'Completed',
    finish: 'Finished',
    approve: 'Approved',
    reject: 'Rejected',
    sign: 'Signed',
    cancel: 'Cancelled',
    request: 'Requested',
    deliver: 'Delivered',
    issue: 'Issued',
    create: 'Created',
    update: 'Updated',
    review: 'Reviewed',
    confirm: 'Confirmed',
    schedule: 'Scheduled',
    meet: 'Met',
    call: 'Called',
    email: 'Emailed',
    notify: 'Notified',
    pay: 'Paid',
    invoice: 'Invoiced',
    bill: 'Billed',
    draft: 'Drafted',
    file: 'Filed',
    record: 'Recorded',
    log: 'Logged',
    close: 'Closed',
    open: 'Opened',
    start: 'Started',
    begin: 'Begun',
    end: 'Ended',
    hold: 'Held',
    release: 'Released',
    transfer: 'Transferred',
    assign: 'Assigned',
    delegate: 'Delegated',
    escalate: 'Escalated',
    resolve: 'Resolved',
    accept: 'Accepted',
    decline: 'Declined',
    negotiate: 'Negotiated',
    agree: 'Agreed',
    decide: 'Decided',
    determine: 'Determined',
    finalize: 'Finalized',
    prepare: 'Prepared',
    coordinate: 'Coordinated',
    setup: 'Setup',
    arrange: 'Arranged',
    book: 'Booked',
    reserve: 'Reserved',
};

/**
 * Prepositions and particles to strip from object
 */
const STRIP_SUFFIXES = [
    /\s+(to|from|with|for|by|at|in|on|about|regarding)\s+.+$/i,
    /\s+(the|a|an)\s+/gi,
];

/**
 * Common noise words to skip at start
 */
const NOISE_PREFIXES = [
    /^(please|could you|can you|need to|have to|must|should|will|would)\s+/i,
    /^(i need to|we need to|i will|we will)\s+/i,
];

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Infer a fact kind from free-form text.
 *
 * @example
 * inferFactKind("Submit Fee Proposal to Developer")
 * // { label: "Fee Proposal Submitted", key: "FEE_PROPOSAL_SUBMITTED", confidence: 0.7 }
 */
export function inferFactKind(text: string): InferredFactKind {
    // Clean and normalize
    let cleaned = text.trim();

    // Strip noise prefixes
    for (const pattern of NOISE_PREFIXES) {
        cleaned = cleaned.replace(pattern, '');
    }

    // Try verb-object extraction
    const voResult = extractVerbObject(cleaned);
    if (voResult) {
        return voResult;
    }

    // Fallback: use first 3-4 significant words
    return createFallbackInference(text);
}

/**
 * Convert human label to SCREAMING_SNAKE_CASE
 */
export function toSnakeCase(label: string): string {
    return label
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

// ============================================================================
// EXTRACTION LOGIC
// ============================================================================

/**
 * Extract verb and object from text, convert to past tense label
 */
function extractVerbObject(text: string): InferredFactKind | null {
    const words = text.split(/\s+/);
    if (words.length < 2) return null;

    // First word is likely the verb
    const verb = words[0].toLowerCase();
    const pastTense = VERB_TO_PAST[verb];

    if (!pastTense) return null;

    // Rest is the object (strip trailing preposition phrases)
    let objectPart = words.slice(1).join(' ');
    for (const pattern of STRIP_SUFFIXES) {
        objectPart = objectPart.replace(pattern, '');
    }

    // Clean up the object
    objectPart = objectPart.trim();
    if (!objectPart || objectPart.length < 2) return null;

    // Title case the object
    const objectTitleCase = objectPart
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

    const label = `${objectTitleCase} ${pastTense}`;
    const key = toSnakeCase(label);

    return {
        label,
        key,
        confidence: 0.7,
        source: 'verb-object',
    };
}

/**
 * Create fallback inference using first significant words
 */
function createFallbackInference(text: string): InferredFactKind {
    // Extract first 3-4 words, strip common words
    const words = text.split(/\s+/).slice(0, 4);
    const significant = words.filter(
        w => w.length > 2 && !/^(the|a|an|to|for|by|in|on|at|of)$/i.test(w)
    );

    if (significant.length === 0) {
        return {
            label: 'Item Noted',
            key: 'ITEM_NOTED',
            confidence: 0.2,
            source: 'fallback',
        };
    }

    const label = significant
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

    return {
        label,
        key: toSnakeCase(label),
        confidence: 0.3,
        source: 'fallback',
    };
}
