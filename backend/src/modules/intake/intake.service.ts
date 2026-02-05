import {
  generateUniqueId,
  type CreatedRecord,
} from '@autoart/shared';

import { db } from '../../db/client.js';
import type {
  IntakeForm,
  IntakeFormPage,
  IntakeSubmission,
  NewIntakeForm,
  NewIntakeFormPage,
  IntakeFormUpdate,
} from '../../db/schema.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import { processBlockBindings } from './intake.composer.js';

const MAX_UNIQUE_ID_RETRIES = 5;

export interface IntakeFormWithPages extends IntakeForm {
  pages: IntakeFormPage[];
}

export async function createForm(
  title: string,
  sharepointRequestUrl?: string,
  projectId?: string,
  classificationNodeId?: string
): Promise<IntakeForm> {
  let uniqueId = generateUniqueId(title);
  let retries = 0;

  while (retries < MAX_UNIQUE_ID_RETRIES) {
    try {
      const form = await db
        .insertInto('intake_forms')
        .values({
          unique_id: uniqueId,
          title,
          sharepoint_request_url: sharepointRequestUrl ?? null,
          project_id: projectId ?? null,
          classification_node_id: classificationNodeId ?? null,
        } satisfies NewIntakeForm)
        .returningAll()
        .executeTakeFirstOrThrow();

      return form;
    } catch (err: unknown) {
      const isUniqueViolation =
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === '23505';

      if (isUniqueViolation && retries < MAX_UNIQUE_ID_RETRIES - 1) {
        uniqueId = generateUniqueId(title);
        retries++;
      } else {
        throw err;
      }
    }
  }

  throw new ConflictError('Failed to generate unique ID after multiple attempts');
}

export async function listForms(): Promise<IntakeForm[]> {
  return db
    .selectFrom('intake_forms')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute();
}

export async function getFormById(id: string): Promise<IntakeForm | undefined> {
  return db
    .selectFrom('intake_forms')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}

export async function getFormByUniqueId(uniqueId: string): Promise<IntakeForm | undefined> {
  return db
    .selectFrom('intake_forms')
    .selectAll()
    .where('unique_id', '=', uniqueId)
    .executeTakeFirst();
}

export async function getFormWithPages(id: string): Promise<IntakeFormWithPages | undefined> {
  const form = await getFormById(id);
  if (!form) return undefined;

  const pages = await db
    .selectFrom('intake_form_pages')
    .selectAll()
    .where('form_id', '=', id)
    .orderBy('page_index', 'asc')
    .execute();

  return { ...form, pages };
}

export async function getFormWithPagesByUniqueId(uniqueId: string): Promise<IntakeFormWithPages | undefined> {
  const form = await getFormByUniqueId(uniqueId);
  if (!form) return undefined;

  const pages = await db
    .selectFrom('intake_form_pages')
    .selectAll()
    .where('form_id', '=', form.id)
    .orderBy('page_index', 'asc')
    .execute();

  return { ...form, pages };
}

export async function updateForm(
  id: string,
  updates: IntakeFormUpdate
): Promise<IntakeForm> {
  const form = await db
    .updateTable('intake_forms')
    .set(updates)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();

  if (!form) {
    throw new NotFoundError('IntakeForm', id);
  }

  return form;
}

export async function upsertPage(
  formId: string,
  pageIndex: number,
  blocksConfig: unknown
): Promise<IntakeFormPage> {
  return db
    .insertInto('intake_form_pages')
    .values({
      form_id: formId,
      page_index: pageIndex,
      blocks_config: blocksConfig,
    } satisfies NewIntakeFormPage)
    .onConflict((oc) =>
      oc
        .columns(['form_id', 'page_index'])
        .doUpdateSet({ blocks_config: blocksConfig })
    )
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deletePage(formId: string, pageIndex: number): Promise<void> {
  await db
    .deleteFrom('intake_form_pages')
    .where('form_id', '=', formId)
    .where('page_index', '=', pageIndex)
    .execute();
}

export interface SubmissionWithRecords extends IntakeSubmission {
  createdRecords: CreatedRecord[];
}

/**
 * Create a form submission.
 * If the form has a classification_node_id and blocks have record bindings,
 * creates records + Composer actions within the same transaction.
 */
export async function createSubmission(
  formId: string,
  uploadCode: string,
  metadata: unknown
): Promise<SubmissionWithRecords> {
  return await db.transaction().execute(async (trx) => {
    const submission = await trx
      .insertInto('intake_submissions')
      .values({
        form_id: formId,
        upload_code: uploadCode,
        metadata,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Process block bindings → records + Composer actions
    let createdRecords: CreatedRecord[] = [];

    const form = await trx
      .selectFrom('intake_forms')
      .select(['classification_node_id'])
      .where('id', '=', formId)
      .executeTakeFirst();

    if (form?.classification_node_id) {
      const metadataObj = (typeof metadata === 'object' && metadata !== null)
        ? metadata as Record<string, unknown>
        : {};

      createdRecords = await processBlockBindings(
        formId,
        form.classification_node_id,
        metadataObj,
        trx
      );
    }

    // Persist created records on the submission
    if (createdRecords.length > 0) {
      await trx
        .updateTable('intake_submissions')
        .set({ created_records: JSON.stringify(createdRecords) })
        .where('id', '=', submission.id)
        .execute();
    }

    return {
      ...submission,
      created_records: createdRecords,
      createdRecords,
    };
  });
}

export async function listSubmissions(
  formId: string,
  limit = 50,
  offset = 0
): Promise<IntakeSubmission[]> {
  return db
    .selectFrom('intake_submissions')
    .selectAll()
    .where('form_id', '=', formId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();
}

export async function getSubmissionById(id: string): Promise<IntakeSubmission | undefined> {
  return db
    .selectFrom('intake_submissions')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
}
