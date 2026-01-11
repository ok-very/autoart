/**
 * Seed: Core Record Definitions
 *
 * These are the foundational record types that the system needs.
 * This is REFERENCE DATA - it defines the structure of the system,
 * not user content.
 *
 * These definitions should be:
 * - Stable across environments
 * - Part of the "designed system"
 * - Safe to re-run (idempotent)
 */

import { Kysely } from 'kysely';

import type { Database } from '../schema.js';

export async function seed(db: Kysely<Database>): Promise<void> {
  console.log('  Seeding record definitions...');

  const definitions = [
    {
      name: 'Contact',
      schema_config: JSON.stringify({
        fields: [
          // Core identity - text types with semantic hints
          { key: 'name', type: 'text', label: 'Name', required: true },
          { key: 'email', type: 'text', label: 'Email', renderHint: 'email' },
          { key: 'phone', type: 'text', label: 'Phone', renderHint: 'phone' },
          { key: 'company', type: 'text', label: 'Company/Org' },
          { key: 'role', type: 'text', label: 'Role' },
          // Classification - status with options
          {
            key: 'contactGroup', type: 'status', label: 'Contact Group', options: [
              'Developer/Client', 'Artist/Arts Worker', 'City/Govt', 'Health Care',
              'Architect/Engineer', 'Fabricator/Supplier', 'Selection Panel', 'Miscellaneous',
            ]
          },
          // Free-form notes
          { key: 'notes', type: 'textarea', label: 'Notes' },
        ],
      }),
      styling: JSON.stringify({ color: 'indigo', icon: '👤' }),
    },
    {
      name: 'Location',
      schema_config: JSON.stringify({
        fields: [
          { key: 'name', type: 'text', label: 'Site Name', required: true },
          { key: 'address', type: 'text', label: 'Address' },
          { key: 'city', type: 'text', label: 'City' },
          { key: 'gps', type: 'text', label: 'GPS Coordinates' },
          { key: 'access_notes', type: 'textarea', label: 'Access Notes' },
        ],
      }),
      styling: JSON.stringify({ color: 'emerald', icon: '📍' }),
    },
    {
      name: 'Material',
      schema_config: JSON.stringify({
        fields: [
          { key: 'name', type: 'text', label: 'Material Name', required: true },
          { key: 'sku', type: 'text', label: 'SKU/Part Number' },
          { key: 'supplier', type: 'text', label: 'Supplier' },
          { key: 'unit_cost', type: 'number', label: 'Unit Cost' },
          { key: 'unit', type: 'text', label: 'Unit (ea, kg, m, etc.)' },
        ],
      }),
      styling: JSON.stringify({ color: 'amber', icon: '📦' }),
    },
    {
      name: 'Document',
      schema_config: JSON.stringify({
        fields: [
          { key: 'title', type: 'text', label: 'Document Title', required: true },
          { key: 'type', type: 'select', label: 'Type', options: ['Contract', 'Permit', 'Drawing', 'Report', 'Photo', 'Other'] },
          { key: 'url', type: 'url', label: 'Link/URL' },
          { key: 'date', type: 'date', label: 'Document Date' },
          { key: 'notes', type: 'textarea', label: 'Notes' },
        ],
      }),
      styling: JSON.stringify({ color: 'slate', icon: '📄' }),
    },
  ];

  for (const def of definitions) {
    // Check if already exists (idempotent)
    const existing = await db
      .selectFrom('record_definitions')
      .select('id')
      .where('name', '=', def.name)
      .executeTakeFirst();

    if (!existing) {
      await db.insertInto('record_definitions').values(def).execute();
    }
  }

  console.log('  ✓ Record definitions seeded');
}
