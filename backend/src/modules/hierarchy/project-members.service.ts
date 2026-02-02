import { db } from '../../db/client.js';

export async function listProjectMembers(projectId: string) {
    return db
        .selectFrom('project_members')
        .innerJoin('users', 'users.id', 'project_members.user_id')
        .select([
            'project_members.id',
            'project_members.project_id',
            'project_members.user_id',
            'project_members.role',
            'project_members.assigned_at',
            'project_members.assigned_by',
            'users.name as user_name',
            'users.email as user_email',
            'users.avatar_url as user_avatar_url',
        ])
        .where('project_members.project_id', '=', projectId)
        .orderBy('project_members.assigned_at', 'asc')
        .execute();
}

export async function addProjectMember(
    projectId: string,
    userId: string,
    role: string,
    assignedBy: string | null,
) {
    return db
        .insertInto('project_members')
        .values({
            project_id: projectId,
            user_id: userId,
            role,
            assigned_by: assignedBy,
        })
        .returning(['id', 'project_id', 'user_id', 'role', 'assigned_at', 'assigned_by'])
        .executeTakeFirstOrThrow();
}

export async function removeProjectMember(projectId: string, userId: string) {
    return db
        .deleteFrom('project_members')
        .where('project_id', '=', projectId)
        .where('user_id', '=', userId)
        .returning(['id'])
        .executeTakeFirst();
}

export async function updateMemberRole(projectId: string, userId: string, role: string) {
    return db
        .updateTable('project_members')
        .set({ role })
        .where('project_id', '=', projectId)
        .where('user_id', '=', userId)
        .returning(['id', 'project_id', 'user_id', 'role', 'assigned_at', 'assigned_by'])
        .executeTakeFirst();
}

export async function transferOwnership(projectId: string, fromUserId: string, toUserId: string) {
    // Demote current owner to member
    await db
        .updateTable('project_members')
        .set({ role: 'member' })
        .where('project_id', '=', projectId)
        .where('user_id', '=', fromUserId)
        .where('role', '=', 'owner')
        .execute();

    // Promote target to owner (upsert: add if not already a member)
    const existing = await db
        .selectFrom('project_members')
        .select('id')
        .where('project_id', '=', projectId)
        .where('user_id', '=', toUserId)
        .executeTakeFirst();

    if (existing) {
        await db
            .updateTable('project_members')
            .set({ role: 'owner' })
            .where('project_id', '=', projectId)
            .where('user_id', '=', toUserId)
            .execute();
    } else {
        await db
            .insertInto('project_members')
            .values({
                project_id: projectId,
                user_id: toUserId,
                role: 'owner',
                assigned_by: fromUserId,
            })
            .execute();
    }
}

export async function listUserProjects(userId: string) {
    return db
        .selectFrom('project_members')
        .innerJoin('hierarchy_nodes', 'hierarchy_nodes.id', 'project_members.project_id')
        .select([
            'project_members.project_id',
            'project_members.role',
            'hierarchy_nodes.title as project_title',
        ])
        .where('project_members.user_id', '=', userId)
        .orderBy('hierarchy_nodes.title', 'asc')
        .execute();
}

/**
 * Remove a user from all project memberships.
 * Used during deactivation.
 */
export async function removeUserFromAllProjects(userId: string) {
    await db
        .deleteFrom('project_members')
        .where('user_id', '=', userId)
        .execute();
}

/**
 * Transfer all project ownerships from one user to another.
 * Used during deactivation.
 */
export async function transferAllOwnerships(fromUserId: string, toUserId: string) {
    // Get all projects where fromUser is owner
    const ownerships = await db
        .selectFrom('project_members')
        .select('project_id')
        .where('user_id', '=', fromUserId)
        .where('role', '=', 'owner')
        .execute();

    for (const { project_id } of ownerships) {
        await transferOwnership(project_id, fromUserId, toUserId);
    }
}
