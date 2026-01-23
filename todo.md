Priority: Import Wizard

HIGHEST PRIORITY:
- Step 6: successful import operation seems to run but populated records aren't visible anywhere
-Step 5: nothing really seems to happen in this view: do we still need it?
-step 4: requires a call of workspace to show acutal layout of selection inspector and classification panel
    - subtask: ClassificationPanel still not displaying properly - trace the file through git and find the version that contained complete functionality rather than placeholder code, reimpliment. Handled external-internal work, fact definitions, and so on.
-general maintenance: field definitions have changed and things like timeline can be aligned; "custom" field is nonspecific and should be avoided

-step 2: housekeeping item: when entries are heirarchically linked, it is helpful to know that the parent is "In Progress" with the pill-tag, but it is also helpful to tag it with the parent's name (same format)

-step 3: "Attention: Anthem - East 2nd: No Title column mapped. Items without titles are harder to identify." Warning appears with unclear context, probably stale.
    -general maintenance: field definitions have changed and things like timeline can be aligned; "custom" field is nonspecific and should be avoided. make sure mappings reflect actual project architecture.


complete{


connect to monday oauth returns:
{"error":"invalid_request","error_description":"Invalid redirect_uri"}

are we going to need webhooks for monday?
}

incomplete{
review project workflow data terminus and backtrace a useful seed data set to replace the current migration.
fieldsview
*contact group populates automatically and I cannot figure out if its layout is proposed or implemented because I cannot backtrace how the categories came to be.
they aren't canonical so I have to be able to understand how they were created
inspector doesn't attach to field view
remigrate the db and refresh the application

Monday Interpreter Alignment: ✓ VERIFIED - Both systems treat stages as independent metadata, not constraints. No parent-child stage validation in either system. One improvement: consider storing stageKind explicitly in item metadata (currently derived from groupId lookup). Related to nested group parentage feature.
}


ProjectWorkFlowView
-add action button to projects center-area workflow view similar to the one implemented in @intakeform editor.flow new entries and add button down
make default button with no entries nicer or just an icon

-project dropdown needs refactor, new project button broken, other selections irrelevant, including template (as projects exist as records)
- proposed new action button exists in @projectlistview

-make sure project workflow view works with new project creation flow

exportcontextprovider for panels when aggregate is active or within an aggregate workflow

step 4 needs new column names

create a wrapper for our @richtext element @frontend/src/ui/molecules/EditableCell.tsx  wrapper (which is probably something different,  so that forces wrap to cell beyond 50 characters and allows styled preview on click in a transient (editable) . maybe you need a text edit module that should be generally mapped to the implementation

-autohelper: incremental rescan and full ingestion (should be called Index Filetree or Map Files) doesn't work, unclear if functions are merely cosmetic
-connection to helper from frontend Ingestion/Import interface fails.

-create generalized runner script for pulling contact information / company / website, etc

-ensure import data from runner is persisting in db.
