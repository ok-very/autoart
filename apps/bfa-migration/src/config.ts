/**
 * BFA ClickUp migration configuration
 *
 * All ClickUp workspace IDs, custom field IDs, and phase mappings.
 */

export const CLICKUP = {
    workspaceId: '9014240887',
    spaceId: '90140886432',       // BFA space
    folderId: '90144269771',       // Project Template folder
    listId: '901414366813',        // Vancouver Project Template 2026
} as const;

/** BFA Project Phases custom field (drop-down) */
export const PHASE_FIELD_ID = '4abc75c1-c264-43c5-87a9-f116ad09e0fa';

/** Stage number → BFA Project Phases option UUID */
export const PHASE_OPTIONS: Record<number, string> = {
    1:  'eb7af0e2-174d-40e3-835e-c46cf00cb90f',  // Project Introduction
    2:  '54f30092-2365-494d-8527-694b453872d9',  // PPAP
    3:  'd915bc10-5ee9-43df-b8fd-52396d1a6674',  // DPAP
    4:  'd915bc10-5ee9-43df-b8fd-52396d1a6674',  // Community Engagement → DPAP (closest)
    5:  '27ee5137-9f71-480d-a13a-cdbc7ebe0a0e',  // SP #1 - Artist Long List
    6:  '7f3a0b97-425a-4ca3-a05c-3f3b35ce590e',  // SP#2 - Artist Concept Proposals
    7:  '3e54fd5c-5243-49cb-9c76-a1ccee4a0d51',  // Contract
    8:  '9a54c988-2f31-4e55-a9ba-bdb246cc67b3',  // Detailed Design
    9:  '3a3f7c7f-d949-4fc9-afd8-580fbffe4f64',  // 50% Fabrication (default for stage 9)
    10: 'f040f8c7-f4c3-4b75-89f1-69273bef15df',  // Installation
    11: '30c99a30-8328-4ee4-9181-01b61a80defd',  // Final Docs
};

/** Fabrication sub-phases for stage 9 tasks */
export const FAB_100_OPTION = 'b64cea4a-43a6-4e17-b1db-050d55e86b74';
