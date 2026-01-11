# BFA To-Do Document Schema Analysis
**Document Source:** `2026_01_08_Ballard Fine Art To Do.rtf`  
**Analysis Date:** January 9, 2026

## Executive Summary

This document contains project tracking data for Ballard Fine Art (BFA), a public art consulting firm managing ~60+ development projects across British Columbia. The structure follows a hierarchical organization pattern with standardized metadata fields and status tracking.

---

## I. Document Structure

### A. Primary Hierarchy
```
Document Root
├── Section Headers (Project Category Anchors)
│   ├── Individual Project Blocks
│   │   ├── Project Header (Title + Metadata)
│   │   ├── Contact List
│   │   ├── Timeline/Status Data
│   │   ├── Budget Information
│   │   ├── Selection Panel Data
│   │   ├── Project Status Bullets
│   │   └── Next Steps/BFA Actions
```

### B. Project Category Anchors (Major Sections)
1. **Public Art Projects** (Main body - majority of content)
2. **CORPORATE ART** (Explicit section marker)
3. **PRIVATE and CORPORATE ART** (Explicit section marker)

---

## II. Project Header Patterns

### A. Standard Project Header Format
```
(Initials) Client Name: Project Name, Location (Art: $X | Total: $Y) Install: Date/Status
```

**Components:**
- **Staff Initials**: `(JB)`, `(AC)`, `(JB/NY)`, `(KH)`, `(SF)`, `(JJ/SE)`, etc.
  - Single: One project manager
  - Dual: Collaborative management
  - Pattern suggests staff assignments
  
- **Client Name**: Developer/Organization
  - Examples: `Polygon Homes`, `QuadReal`, `City of Burnaby`, `Onni`, `Shape`
  
- **Project Name + Location**: Descriptive identifier
  - Format: `[Project Name], [City/Area]`
  - Examples: `Emerald Place PH 1, Burnaby`, `Richmond Centre (Phase II Art: TBCK)`
  
- **Budget Fields**:
  - `Art: $X` or `Artwork: $X` - Direct artwork budget
  - `Total: $X` - All-in project budget including fees
  - `TBC` - To Be Confirmed
  
- **Install Date/Status**:
  - Dates: `May 2025`, `2026/2027`, `Summer 2026`
  - Status: `ON HOLD`, `HOLD`, `PENDING`, `COMPLETE`, `TBC`, `TBD`

### B. Variant Patterns

#### Variant 1: Multi-Phase Projects
```
(JB/NY) Polygon Homes: Emerald Place PH 1, PH2, PH3, Burnaby
Phase 1 - (Art: $640,000/ Total:$750,000)      Install 2028
Phase 2 - (Art: $/ Total:$1M)                   Install TBD
Phase 3 - (Art: $/ Total:$550,000)              Install TBD
```

#### Variant 2: Abbreviated/Minimal Headers
```
(AC) Bosa: PRIVATE ART: 1515 Alberni Presentation Centre
```
- Missing budget/install data
- Private art indicator in title

#### Variant 3: Status-Emphasized Headers
```
Clayoquot Wilderness Lodge - Coast Construction tab (Artwork: | Total: ) Install: ON HOLD
```
- Status highlighted
- Empty budget placeholders

#### Variant 4: Master Plans
```
(JB) Peterson: Sperling (6800 Lougheed Hwy), Burnaby (Total: $4,730,000.00/Phase 1: $1,320,000)
```
- Master budget shown
- Phase breakdowns in body

---

## III. Contact Schema

### A. Standard Contact Patterns

#### Pattern 1: Role-Based Lists
```
PM: [Name] | Architect: [Name] | Landscape: [Name] | City: [Name]
```

**Common Roles:**
- `PM` / `Project Manager` / `Development Manager`
- `Architect` / `Architect of Record` / `Design Architect`
- `Landscape Architect` / `LArch` / `LA`
- `City` / `Planner` / `Rezoning Planner`
- `BAG` (Burnaby Art Gallery)
- `Owner` / `Contact`
- `DPAP` / `PPAP` / `SP` contacts

#### Pattern 2: Organizational Grouping
```
Polygon: Jacqueline Garvin, Development Manager & Celia Dawson, VP of Art and Design
Architect: Victor Tam + Dirk Buttjes, Buttjes Architecture
```

#### Pattern 3: Inline Role Attribution
```
Tannis Knutson - Clinical Planning Project Leader
Connor Wong, Development Coordinator
```

### B. Contact Name Patterns
- **Full Name + Role**: `Mary Flesher - Chief Clinical Planner`
- **Name Only (Comma List)**: `Jessica, Karen, Tom`
- **Email Addresses**: `ap.ocl@onni.com`, `purchasing@burnaby.ca`
- **Phone/Location**: Rarely included

### C. Contact Metadata
- **Primary Contact Indicators**: Listed first, `main contact`
- **Role Hierarchy**: Owner → PM → Architect → City
- **Firm Associations**: `(IBI Group)`, `(Perkins & Will)`

---

## IV. Timeline & Status Schema

### A. Milestone Abbreviations

#### Planning/Approval Phase
- **PPAP**: Preliminary Public Art Plan
- **DPAP**: Detailed Public Art Plan
- **PAP**: Public Art Plan (generic)
- **Checklist**: Initial submission milestone

#### Selection Process
- **EOI**: Expression of Interest
- **TOR**: Terms of Reference
- **SP#1** / **SP #1**: Selection Panel Meeting 1
- **AO** / **A/O**: Artist Orientation
- **SP#2** / **SP #2**: Selection Panel Meeting 2
- **CA**: Community Advisory (meeting)

#### Execution Phase
- **DD**: Detailed Design
- **DP**: Development Permit
- **BP**: Building Permit
- **RZ**: Rezoning
- **PTR**: (Project-specific, likely "Proposal To Rezoning")

### B. Date Formats
- **Month Day, Year**: `March 14, 2024`
- **Year-MM-DD**: `2024-03-28`, `23-11-15`
- **Abbreviated**: `Oct 18th`, `24-12-13`
- **Relative**: `Jan to F/U`, `targeted for end of 2020`

### C. Status Indicators
```
Project Status: [freeform text]
BFA Project Status: [standardized summary]
BFA Next Steps: [action items]
```

**Common Status Values:**
- Timeline-based: `DPAP`, `Contract signed`, `DD phase`, `Awaiting approval`
- Blockers: `ON HOLD`, `PENDING`, `DELAYED`, `CANCELLED`
- Completion: `COMPLETE`, `Done`

---

## V. Budget Information Schema

### A. Budget Field Types
1. **Artwork Budget**: Direct artist compensation
   - Labels: `Art:`, `Artwork:`
   - Format: `$640,000`, `$1M`, `$TBC`

2. **Total Budget**: All project costs
   - Labels: `Total:`
   - Includes: Artwork + BFA fees + contingency

3. **Phase Budgets**: Multi-phase allocations
   ```
   Ph 1 Estimate: $1.32M
   Ph 2 Estimate: $1.55M
   Total = 4.73M
   ```

4. **Budget Notes**:
   - `TBC` / `TBD`: To Be Confirmed/Determined
   - Parenthetical context: `(city isn't contributing money - reduced by $2.1 Million)`

### B. Financial Metadata
- **Accounting Contacts**: `ap@placemakergroup.ca`, `Britta Masaua (Accountant)`
- **Invoice References**: `Phase 3 invoice paid`, `Submit all honoraria invoice`
- **Payment Status**: `first invoice not paid`, `overdue payment`

---

## VI. Selection Panel Schema

### A. Panel Membership Structure
```
Selection Panel: [Name1, Role1], [Name2], [Name3, Role3 (Org)]
```

**Composition Patterns:**
- **Developer Rep**: Project manager or owner
- **Design Team**: Architect and/or Landscape Architect
- **City Rep**: Planner or Arts Manager
- **Artist Reps**: 1-2 established artists
- **Community Rep**: Indigenous, academic, or local organization

### B. Artist Selection Data
```
Shortlisted Artists: [Artist1], [Artist2], [Artist3]
Alternates: [Alt1], [Alt2]
Selected Artist: [Name]
Artwork Title: [Title]
```

**Alternates Notation:**
- Numbered: `1. Alex Morrison 2. Russna Kaur`
- Replacement context: `(Alt: Robyn Sparrow for Marianne Nicolson)`

### C. Panel Meeting Data
- **Dates**: Specific dates for SP#1, AO, SP#2
- **Timing**: `3-5pm`, `11:00 am`
- **Status**: `TBC`, `DELAYED`

---

## VII. Action Item Schema

### A. Bullet Structure
Projects use bullet points (●, ○, ■) for action tracking:

```
● Top-level action item
○ Sub-action or detail
  ■ Third-level detail or outcome
```

### B. Action Item Patterns

#### Pattern 1: Status Update
```
● Artist Contract Divya (Onni Template) -sent to Eric for review with Divya's comments
```

#### Pattern 2: Follow-Up Action
```
● Jan to f/u with Malcom Long on advice for the public art process in coquitlam (2023-08-21)
```

#### Pattern 3: Conditional Next Step
```
● Once TOR approved by council, we can move forward with SP process
```

#### Pattern 4: Timeline Reference
```
● Targeting DP issuance for October 2023 – provide project terms of reference
```

### C. Action Metadata
- **Owner**: `Jan to`, `BFA to`, `Alannah to`
- **Date Context**: `(2024-04-12)`, `week of July 18`
- **Status Markers**: `Done`, `COMPLETE`, `pending`, `waiting`

---

## VIII. Phenotype Analysis: Information Blob Variants

### Phenotype 1: **Active Development Project**
**Characteristics:**
- Complete header with all budget fields populated
- Full contact list (5-8 roles)
- All milestone dates filled in
- Selection panel named with 4-5 members
- Artist selected
- Active status bullets with recent dates
- Clear "Next Steps" section

**Example:** `(JB/NY) Polygon Homes: Emerald Place PH 1, Burnaby`

---

### Phenotype 2: **On Hold / Delayed Project**
**Characteristics:**
- Header includes `ON HOLD` or `HOLD`
- Budget may be partial or `TBC`
- Milestone dates incomplete or stopped midway
- Status bullets focus on delay reasons
- No recent activity (dates 6+ months old)
- "Next Steps" may be missing or say "Check in [future date]"

**Example:** `(JB) Open Sky - Jameson, Edmonton (Art: $60,000) Install: Late 2024 (ON HOLD)`

---

### Phenotype 3: **Early Stage / Feasibility Project**
**Characteristics:**
- Header budget: `(Total: $)` or `TBC`
- Contacts: Limited to PM and maybe architect
- Milestones: Only Checklist or PPAP mentioned
- Status: `PENDING`, `Awaiting confirmation`
- Next Steps: High-level planning actions

**Example:** `(AC) Onni: Coquitlam College 7 towers, 3 phases (Art: $?) (Total: $) PENDING`

---

### Phenotype 4: **Multi-Phase Master Project**
**Characteristics:**
- Parent header with total budget
- Sub-headers for each phase with individual budgets
- Status tracked per phase
- Mixed install dates across phases
- Separate action lists per phase

**Example:** `(JB) Peterson: Sperling (6800 Lougheed Hwy), Burnaby (Total: $4,730,000.00)`

---

### Phenotype 5: **Completed/Installed Project**
**Characteristics:**
- Install date in past
- May include `COMPLETE` marker
- Status bullets describe final deliverables
- Fewer action items, mostly archival references
- Focused on documentation and closeout

**Example:** `(SF) Century Group - Century City, Surrey` with `Cheung's Food Market | COMPLETE`

---

### Phenotype 6: **Private/Corporate Art (Non-Public)**
**Characteristics:**
- Often listed under separate section header
- May lack city planner contacts
- Different approval process (no PPAP/DPAP)
- Abbreviated status tracking
- Sometimes missing formal budgets

**Example:** `(A) Marcon Elmbridge (Private Art Interior) Art TBC`

---

### Phenotype 7: **Cancelled/Terminated Project**
**Characteristics:**
- Explicit note: `(Contract Cancelled)`, `Project closing`
- Full project history preserved
- Explanation of termination reason
- May include honoraria payment tracking

**Example:** `(JB/EK) City of Burnaby - Burnaby Lake Rec Centre (Contract Cancelled)`

---

### Phenotype 8: **Stub Entry / Placeholder**
**Characteristics:**
- Minimal header
- Limited or no contacts
- Action items reference initial outreach
- May have been superseded or never activated
- Often at end of document

**Example:** `(J) IFortune Homes: Royal Oak Ave - Burnaby (Artwork – $) (Total: $400,000)`

---

## IX. Special Notation Patterns

### A. Highlighted/Priority Items
- **Background shading notation**: Text with `\chshdng10000\chcbpat6\chcfpat6` (yellow highlighting)
- **Strikethrough/Underline**: Title emphasis
- Typically marks: Current month actions, critical follow-ups

### B. Embedded References
- **Email references**: `(see email in meetings folder)`
- **Document links**: `<https://docs.google.com/document/...>`
- **File paths**: `<ftp://ftp.onni.com> username: northroadburnaby password: North22`

### C. Conditional Logic
```
If [condition], then [action]
Example: "if selecting not host indigenous artist then consultation with Snuneymuxw first nation required"
```

### D. Quotation Blocks
Direct quotes from emails/communications:
```
● [Name] (Date): "Hi Jill, Thanks for checking in. We are still finalizing..."
```

---

## X. Staff Assignment Codes

### Observed Initials
- **JB** - Primary project manager (highest frequency ~40%)
- **NY** / **Nora** - Collaboration role
- **AC** / **Alannah** - Project manager
- **KH** - Project manager
- **SF** - Historical projects
- **ST** / **Sara** / **S/A** - Designer/writer roles
- **EK** - Support/coordination
- **MM** - Limited appearances
- **J** / **Jan** - Company principal (follow-up owner)

### Assignment Patterns
- Single initial: Sole ownership
- Dual initials `(JB/NY)`: Collaborative or handoff
- Change over time: `(ST/NY)` → suggests staff transition

---

## XI. Geographic Distribution

### Primary Jurisdictions
1. **City of Burnaby** - Highest concentration (~15 projects)
   - Contacts: Grant Taylor (Planner), Jennifer Cane (BAG), Allison Collins
   
2. **City of Richmond** - Second highest (~10 projects)
   - Contacts: Biliana Velkova, Tom Hsu
   
3. **City of Vancouver** - (~8 projects)
   - Planners by neighborhood/district
   
4. **City of Surrey** - (~5 projects)
   - Contact: Cris Mora (Public Art Manager)
   
5. **City of Coquitlam** - (~3 projects)
   - Contacts: Ted Uhrich, Karen Basi
   
6. **Other**: Port Moody, Nanaimo, North Vancouver, Edmonton

---

## XII. Recurring Client Entities

### Major Developers
1. **Polygon Homes** - 3+ projects
2. **Onni** - 4+ projects  
3. **QuadReal** - 3+ projects
4. **Shape** - 2+ projects (including private tower)
5. **Williams Consulting** - 4+ projects
6. **Peterson** - 2 projects
7. **Reliance Properties** - 2 projects

### Public Institutions
- **Fraser Health / Royal Columbian Hospital**
- **City of Burnaby** (direct client for recreation centres)

### Architect Firms (Recurring)
- **IBI Group** / **ZGF** / **GBL Architects** / **DYS Architecture**
- **Perkins + Will** / **Hariri Pontarini Architects**

### Landscape Architects (Recurring)
- **PWL** / **PFS** / **Perry & Associates** / **Durante Kreuk** / **Hapa Collaborative**

---

## XIII. Data Quality Observations

### Completeness Variations
1. **High Completeness** (Active projects):
   - All fields populated
   - Recent action dates
   - Clear next steps
   
2. **Moderate Completeness** (Planning phase):
   - Budget estimates (`$TBC`)
   - Contact lists growing
   - Milestones in progress
   
3. **Low Completeness** (Stubs/On-Hold):
   - Minimal header
   - Placeholder values
   - Old or missing dates

### Date Consistency
- **Format inconsistency**: Mix of `YYYY-MM-DD`, `Month DD, YYYY`, `YY-MM-DD`
- **Relative dates**: `Jan to F/U`, `early 2023`, `mid-April`
- **Highlighting current month**: Actions with `Jan` often highlighted

### Budget Notation
- **Precision varies**: `$640,000` vs `$1M` vs `$TBC`
- **Canadian dollars implied**: No currency symbols beyond `$`
- **Rounded estimates**: Master plans often use `$1M`, `$1.5M`

---

## XIV. Parsing Recommendations

### Critical Anchor Points for Extraction
1. **Project Header Line** (Regex pattern):
   ```
   \([\w/]+\)\s+[^:]+:\s+[^(]+\(Art[:|]\s+\$[^)]+\)\s+.*Install:
   ```

2. **Contact Block** (Keywords):
   - Start: `PM:`, `Contact:`, `Owner:`
   - Roles: `Architect`, `Landscape`, `City`, `Planner`

3. **Timeline Block** (Keywords):
   - `PPAP:`, `DPAP:`, `SP#1:`, `AO:`, `SP#2:`

4. **Status Block** (Keywords):
   - `Project Status:`, `BFA Project Status:`, `BFA Next Steps:`

5. **Selection Block** (Keywords):
   - `Selection Panel:`, `Shortlisted Artists:`, `Selected Artist:`, `Artwork Title:`

### Entity Recognition Challenges
- **Name ambiguity**: Is "Victoria" a person or city?
- **Role variations**: `PM` = Project Manager or Program Manager?
- **Date parsing**: Multiple formats require unified normalization
- **Status inference**: No formal controlled vocabulary

### Recommended Data Model
```json
{
  "projectId": "string (generated)",
  "staffInitials": ["string"],
  "clientName": "string",
  "projectName": "string",
  "location": "string",
  "budgets": {
    "artwork": "number | null",
    "total": "number | null",
    "phases": [{"phase": "string", "amount": "number"}]
  },
  "installDate": "date | string (TBD/HOLD)",
  "status": "enum(active, hold, pending, complete, cancelled)",
  "contacts": [
    {"name": "string", "role": "string", "org": "string", "email": "string"}
  ],
  "milestones": {
    "ppap": "date | null",
    "dpap": "date | null",
    "sp1": "date | null",
    "ao": "date | null",
    "sp2": "date | null"
  },
  "selectionPanel": {
    "members": ["string"],
    "shortlist": ["string"],
    "alternates": ["string"],
    "selectedArtist": "string | null",
    "artworkTitle": "string | null"
  },
  "statusNotes": "string",
  "nextSteps": "string",
  "actionItems": [
    {"text": "string", "owner": "string", "date": "date | null", "complete": "boolean"}
  ]
}
```

---

## XV. Schema Variance Summary

### High-Variance Fields
1. **Contact Formats** - 8 distinct patterns observed
2. **Date Formats** - 4+ notation styles
3. **Budget Completeness** - Range from full detail to `TBC`
4. **Action Item Depth** - 0-20+ bullets per project

### Low-Variance Fields
1. **Staff Initials** - Consistent pattern `(XX)` or `(XX/YY)`
2. **Install Status Keywords** - Limited set: `HOLD`, `TBC`, `COMPLETE`, dates
3. **Milestone Abbreviations** - Standardized acronyms

### Context-Dependent Variance
- **Private vs Public Projects**: Private often lacks city planner, PPAP/DPAP
- **Phase Status**: Multi-phase projects duplicate structure
- **Project Maturity**: Early-stage projects sparser than active ones

---

## XVI. Integration Points

### Monday.com Connector Mapping
Based on verified Monday.com schema in emails project:

```python
# Field Mappings
project_header → Monday Item Name
staff_initials → Person field (staff assignments)
client_name → Text field (searchable)
status → Status column (custom labels)
install_date → Date column
artwork_budget → Numbers column
total_budget → Numbers column
contacts → Long Text field (structured)
milestones → Multiple Date columns
next_steps → Long Text field
action_items → Subitems or Updates

# RenderHint suggestions
"status" → "status"
"install_date" → "date"
"artwork_budget" → "number"
"staff_initials" → "person"
"contacts" → "longtext"
"milestones" → "timeline"
```

### Autoart Project Log Integration
- **ProjectLogView compatibility**: Each bullet can be an ActionCard
- **Status field alignment**: Map HOLD/PENDING to autoart status taxonomy
- **Timeline visualization**: PPAP→DPAP→SP1→AO→SP2 as milestone events

---

## XVII. Conclusion

This document represents a **mature, organically evolved project tracking system** with:
- **~60+ active/historical projects**
- **8 distinct information phenotypes**
- **Moderate standardization** (headers, milestones) with **high contextual flexibility** (contacts, actions)
- **Strong geographic clustering** (Burnaby, Richmond, Vancouver)
- **Clear workflow stages** (Planning → Selection → Design → Installation)

The schema supports both **structured extraction** (budgets, dates, names) and **unstructured context** (status narratives, email quotes). Successful parsing requires **hybrid approach**:
1. Pattern-based extraction for standardized fields
2. NLP/semantic parsing for contacts and action items
3. Contextual inference for status and phase determination

The variability in completeness and format reflects **real-world project lifecycle diversity** rather than data quality issues - it's a feature, not a bug.

---

## Appendix: Sample Record Breakdown

**Project:** `(JB/NY) Polygon Homes: Emerald Place PH 1, Burnaby`

```
Header:
  Staff: [JB, NY]
  Client: Polygon Homes
  Project: Emerald Place PH 1
  Location: Burnaby
  Budget:
    Artwork: $640,000
    Total: $750,000
  Install: 2028
  
Contacts:
  - Jacqueline Garvin (Development Manager, Polygon)
  - Celia Dawson (VP of Art and Design, Polygon)
  - Devon Smart (Development Manager, Polygon)
  - Victor Tam (Architect, Buttjes Architecture)
  - Dirk Buttjes (Architect, Buttjes Architecture)
  - Chris Phillips (Landscape Architect, PFS)
  - Jaclyn Ryback (Landscape Architect, PFS)
  - Grant Taylor (City Planner, Burnaby)
  
Milestones:
  PPAP: March 14, 2024
  DPAP: December 17, 2024
  SP1: null
  AO: null
  SP2: null
  
Status: "Longlist sent to Polygon 2025-05-13"
Next Steps: "Awaiting update on timing from Polygon, as there may be some delays"

Phases:
  - Phase 1: $750,000 (2028)
  - Phase 2: $1M (TBD)
  - Phase 3: $550,000 (TBD)
```

---

**End of Schema Analysis**
