/**
 * Hierarchy Service Tests
 *
 * Tests for critical algorithmic operations:
 * - deepCloneNode: Tree cloning with ID remapping
 * - moveNode: Circular reference prevention, root_project_id cascade
 */

import { sql } from 'kysely';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { db } from '../../../db/client.js';
import {
  cleanupTestData,
  generateTestPrefix,
  createTestProject,
  createTestRecord,
} from '../../../test/setup.js';
import * as hierarchyService from '../hierarchy.service.js';

describe('hierarchy.service', () => {
  let testPrefix: string;

  beforeAll(async () => {
    // Verify database connection
    await db.selectFrom('hierarchy_nodes').select('id').limit(1).execute();
  });

  beforeEach(() => {
    testPrefix = generateTestPrefix();
  });

  afterAll(async () => {
    // Clean up any remaining test data
    await cleanupTestData(db, '__test_');
  });

  describe('deepCloneNode', () => {
    it('should clone a project with all descendants', async () => {
      // Arrange: Create a full hierarchy
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      // Act: Clone the project
      const clonedProject = await hierarchyService.deepCloneNode({
        sourceNodeId: fixtures.projectId,
      });

      // Assert: Cloned project exists and has different ID
      expect(clonedProject.id).not.toBe(fixtures.projectId);
      expect(clonedProject.type).toBe('project');
      expect(clonedProject.title).toBe(`${testPrefix}_project`);

      // Verify all descendants were cloned
      const clonedTree = await hierarchyService.getProjectTree(clonedProject.id);
      expect(clonedTree.length).toBe(5); // project, process, stage, subprocess, task

      // Verify IDs are all new (no duplicates)
      const originalIds = [
        fixtures.projectId,
        fixtures.processId,
        fixtures.stageId,
        fixtures.subprocessId,
        fixtures.taskId,
      ];
      const clonedIds = clonedTree.map((n) => n.id);
      for (const clonedId of clonedIds) {
        expect(originalIds).not.toContain(clonedId);
      }

      // Verify parent relationships are preserved
      const clonedProcess = clonedTree.find((n) => n.type === 'process');
      expect(clonedProcess?.parent_id).toBe(clonedProject.id);

      const clonedStage = clonedTree.find((n) => n.type === 'stage');
      expect(clonedStage?.parent_id).toBe(clonedProcess?.id);

      // Verify root_project_id is updated to new project
      for (const node of clonedTree) {
        expect(node.root_project_id).toBe(clonedProject.id);
      }

      // Cleanup
      await db.deleteFrom('hierarchy_nodes').where('id', '=', clonedProject.id).execute();
      await cleanupTestData(db, testPrefix);
    });

    it('should clone a subtree under a new parent', async () => {
      // Arrange: Create two projects - one source, one target
      const sourceFixtures = await createTestProject(db, `${testPrefix}_src`, { withChildren: true });
      const targetFixtures = await createTestProject(db, `${testPrefix}_tgt`, { withChildren: true });

      // Act: Clone the source stage under target stage's subprocess
      const clonedStage = await hierarchyService.deepCloneNode({
        sourceNodeId: sourceFixtures.stageId!,
        targetParentId: targetFixtures.processId!,
      });

      // Assert: Cloned stage has new parent
      expect(clonedStage.parent_id).toBe(targetFixtures.processId);
      expect(clonedStage.root_project_id).toBe(targetFixtures.projectId);
      expect(clonedStage.type).toBe('stage');

      // Verify descendants have updated root_project_id
      const descendants = await sql<{ id: string; root_project_id: string | null }>`
        WITH RECURSIVE tree AS (
          SELECT id, root_project_id FROM hierarchy_nodes WHERE id = ${clonedStage.id}
          UNION ALL
          SELECT h.id, h.root_project_id FROM hierarchy_nodes h
          INNER JOIN tree t ON h.parent_id = t.id
        )
        SELECT id, root_project_id FROM tree
      `.execute(db);

      for (const node of descendants.rows) {
        expect(node.root_project_id).toBe(targetFixtures.projectId);
      }

      // Cleanup
      await cleanupTestData(db, `${testPrefix}_src`);
      await cleanupTestData(db, `${testPrefix}_tgt`);
    });

    it('should clone task references along with tasks', async () => {
      // Arrange: Create hierarchy with task and reference
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });
      const { recordId } = await createTestRecord(db, testPrefix);

      // Create a reference from task to record
      await db
        .insertInto('task_references')
        .values({
          task_id: fixtures.taskId!,
          source_record_id: recordId,
          target_field_key: 'field1',
          mode: 'dynamic',
        })
        .execute();

      // Act: Clone the project
      const clonedProject = await hierarchyService.deepCloneNode({
        sourceNodeId: fixtures.projectId,
      });

      // Get cloned task
      const clonedTree = await hierarchyService.getProjectTree(clonedProject.id);
      const clonedTask = clonedTree.find((n) => n.type === 'task');
      expect(clonedTask).toBeDefined();

      // Assert: Reference was cloned
      const clonedRefs = await db
        .selectFrom('task_references')
        .selectAll()
        .where('task_id', '=', clonedTask!.id)
        .execute();

      expect(clonedRefs.length).toBe(1);
      expect(clonedRefs[0].source_record_id).toBe(recordId);
      expect(clonedRefs[0].target_field_key).toBe('field1');
      expect(clonedRefs[0].mode).toBe('dynamic');

      // Cleanup
      await db.deleteFrom('hierarchy_nodes').where('id', '=', clonedProject.id).execute();
      await cleanupTestData(db, testPrefix);
    });

    it('should support depth filtering', async () => {
      // Arrange: Create full hierarchy
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      // Act: Clone with depth=stage (project, process, stage only)
      const clonedProject = await hierarchyService.deepCloneNode({
        sourceNodeId: fixtures.projectId,
        depth: 'stage',
      });

      // Assert: Only project, process, and stage were cloned
      const clonedTree = await hierarchyService.getProjectTree(clonedProject.id);
      const types = clonedTree.map((n) => n.type);

      expect(types).toContain('project');
      expect(types).toContain('process');
      expect(types).toContain('stage');
      expect(types).not.toContain('subprocess');
      expect(types).not.toContain('task');

      // Cleanup
      await db.deleteFrom('hierarchy_nodes').where('id', '=', clonedProject.id).execute();
      await cleanupTestData(db, testPrefix);
    });

    it('should apply title override to cloned root', async () => {
      // Arrange
      const fixtures = await createTestProject(db, testPrefix, { withChildren: false });

      // Act: Clone with title override
      const clonedProject = await hierarchyService.deepCloneNode({
        sourceNodeId: fixtures.projectId,
        overrides: { title: 'Custom Cloned Title' },
      });

      // Assert
      expect(clonedProject.title).toBe('Custom Cloned Title');

      // Cleanup
      await db.deleteFrom('hierarchy_nodes').where('id', '=', clonedProject.id).execute();
      await cleanupTestData(db, testPrefix);
    });
  });

  describe('moveNode', () => {
    it('should move a node to a new parent', async () => {
      // Arrange: Create two processes under project
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      const process2 = await db
        .insertInto('hierarchy_nodes')
        .values({
          parent_id: fixtures.projectId,
          root_project_id: fixtures.projectId,
          type: 'process',
          title: `${testPrefix}_process2`,
          metadata: '{}',
          position: 1,
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();

      // Get the original stage
      const originalStage = await hierarchyService.getNodeById(fixtures.stageId!);
      expect(originalStage?.parent_id).toBe(fixtures.processId);

      // Act: Move stage to process2
      const movedStage = await hierarchyService.moveNode(fixtures.stageId!, {
        newParentId: process2.id,
      });

      // Assert
      expect(movedStage.parent_id).toBe(process2.id);
      expect(movedStage.root_project_id).toBe(fixtures.projectId);

      // Cleanup
      await cleanupTestData(db, testPrefix);
    });

    it('should update root_project_id for all descendants when moving across projects', async () => {
      // Arrange: Create two projects
      const project1 = await createTestProject(db, `${testPrefix}_p1`, { withChildren: true });
      const project2 = await createTestProject(db, `${testPrefix}_p2`, { withChildren: true });

      // Act: Move stage from project1's process to project2's process
      const movedStage = await hierarchyService.moveNode(project1.stageId!, {
        newParentId: project2.processId!,
      });

      // Assert: Stage and all descendants have updated root_project_id
      expect(movedStage.root_project_id).toBe(project2.projectId);

      const descendants = await sql<{ id: string; root_project_id: string | null }>`
        WITH RECURSIVE tree AS (
          SELECT id, root_project_id FROM hierarchy_nodes WHERE id = ${movedStage.id}
          UNION ALL
          SELECT h.id, h.root_project_id FROM hierarchy_nodes h
          INNER JOIN tree t ON h.parent_id = t.id
        )
        SELECT id, root_project_id FROM tree
      `.execute(db);

      for (const node of descendants.rows) {
        expect(node.root_project_id).toBe(project2.projectId);
      }

      // Cleanup
      await cleanupTestData(db, `${testPrefix}_p1`);
      await cleanupTestData(db, `${testPrefix}_p2`);
    });

    it('should prevent circular reference (moving node under its own descendant)', async () => {
      // Arrange
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      // Act & Assert: Try to move process under its descendant task
      await expect(
        hierarchyService.moveNode(fixtures.processId!, {
          newParentId: fixtures.taskId!,
        })
      ).rejects.toThrow(); // Should throw ValidationError about invalid parent type or circular ref

      // Cleanup
      await cleanupTestData(db, testPrefix);
    });

    it('should validate hierarchy rules (type compatibility)', async () => {
      // Arrange
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      // Act & Assert: Try to move stage directly under project (should fail - stage needs process parent)
      await expect(
        hierarchyService.moveNode(fixtures.stageId!, {
          newParentId: fixtures.projectId,
        })
      ).rejects.toThrow('Cannot move stage under project');

      // Cleanup
      await cleanupTestData(db, testPrefix);
    });

    it('should prevent moving a non-project to null parent', async () => {
      // Arrange
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      // Act & Assert: Try to move process to root (null parent)
      await expect(
        hierarchyService.moveNode(fixtures.processId!, {
          newParentId: null as unknown as string,
        })
      ).rejects.toThrow('must have a parent');

      // Cleanup
      await cleanupTestData(db, testPrefix);
    });

    it('should update position correctly', async () => {
      // Arrange: Create two stages under same process
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      const stage2 = await db
        .insertInto('hierarchy_nodes')
        .values({
          parent_id: fixtures.processId!,
          root_project_id: fixtures.projectId,
          type: 'stage',
          title: `${testPrefix}_stage2`,
          metadata: '{}',
          position: 1,
        })
        .returning(['id', 'position'])
        .executeTakeFirstOrThrow();

      // Verify initial positions
      const originalStage = await hierarchyService.getNodeById(fixtures.stageId!);
      expect(originalStage?.position).toBe(0);
      expect(stage2.position).toBe(1);

      // Act: Move first stage with new position
      const movedStage = await hierarchyService.moveNode(fixtures.stageId!, {
        newParentId: fixtures.processId!,
        position: 5,
      });

      // Assert
      expect(movedStage.position).toBe(5);

      // Cleanup
      await cleanupTestData(db, testPrefix);
    });
  });

  describe('getProjectTree', () => {
    it('should return entire project tree', async () => {
      // Arrange
      const fixtures = await createTestProject(db, testPrefix, { withChildren: true });

      // Act
      const tree = await hierarchyService.getProjectTree(fixtures.projectId);

      // Assert
      expect(tree.length).toBe(5);
      expect(tree.map((n) => n.type).sort()).toEqual([
        'process',
        'project',
        'stage',
        'subprocess',
        'task',
      ]);

      // Cleanup
      await cleanupTestData(db, testPrefix);
    });

    it('should throw NotFoundError for non-existent project', async () => {
      await expect(
        hierarchyService.getProjectTree('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('not found');
    });
  });
});
