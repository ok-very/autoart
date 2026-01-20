import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

export interface IssueOptions {
    description?: string;
    priority?: 0 | 1 | 2 | 3 | 4; // P0 (highest) to P4 (lowest)
    blockedBy?: number[];
    labels?: string[];
    type?: 'bug' | 'feature' | 'task' | 'epic' | 'chore' | 'context' | 'handoff' | 'learning';
}

export interface HandoffData {
    summary: string;
    incomplete?: string[];
    blockers?: string[];
}

export class AgentMemory {
    private octokit: Octokit;
    private owner: string;
    private repo: string;

    constructor(owner?: string, repo?: string) {
        if (!process.env.GITHUB_TOKEN) {
            throw new Error('GITHUB_TOKEN not found in environment');
        }

        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });

        // Use env vars with fallbacks
        this.owner = owner || process.env.GITHUB_OWNER || 'ok-very';
        this.repo = repo || process.env.GITHUB_MEMORY_REPO || 'agent-memory';
    }

    /**
     * Prefix all titles with [Agent]
     */
    private formatTitle(title: string): string {
        return title.startsWith('[Agent]') ? title : `[Agent] ${title}`;
    }

    // ==================== LABEL MANAGEMENT ====================

    /**
     * Ensure all required labels exist in the repo
     */
    async ensureLabels() {
        const requiredLabels = [
            { name: 'context', color: '7C3AED', description: 'Persistent facts and notes' },
            { name: 'handoff', color: 'F59E0B', description: 'Session summaries' },
            { name: 'learning', color: '10B981', description: 'Lessons learned' },
            { name: 'ready', color: '22C55E', description: 'No blockers, actionable' },
            { name: 'blocked', color: 'EF4444', description: 'Has open dependencies' },
            { name: 'in-progress', color: '3B82F6', description: 'Currently being worked' },
            { name: 'p0', color: 'DC2626', description: 'Critical priority' },
            { name: 'p1', color: 'F97316', description: 'High priority' },
            { name: 'p2', color: 'EAB308', description: 'Medium priority' },
            { name: 'p3', color: '22C55E', description: 'Low priority' },
            { name: 'p4', color: '6B7280', description: 'Backlog' },
            { name: 'feature', color: '8B5CF6', description: 'New feature' },
            { name: 'bug', color: 'EF4444', description: 'Bug fix' },
            { name: 'task', color: '3B82F6', description: 'Task item' },
            { name: 'chore', color: '6B7280', description: 'Maintenance' },
            // Domain tags
            { name: 'autohelper', color: '14B8A6', description: 'AutoHelper backend' },
            { name: 'autoart', color: 'EC4899', description: 'AutoArt frontend' },
            { name: 'ui', color: 'F472B6', description: 'UI/UX related' },
            { name: 'architecture', color: '6366F1', description: 'Architecture decisions' },
            { name: 'workflow', color: '0EA5E9', description: 'Workflow patterns' },
        ];

        console.log('Ensuring labels exist...');

        for (const label of requiredLabels) {
            try {
                await this.octokit.rest.issues.createLabel({
                    owner: this.owner,
                    repo: this.repo,
                    name: label.name,
                    color: label.color,
                    description: label.description,
                });
                console.log(`  ✓ Created label: ${label.name}`);
            } catch (error: unknown) {
                // Label already exists - that's fine
                if ((error as { status?: number }).status === 422) {
                    console.log(`  · Label exists: ${label.name}`);
                } else {
                    throw error;
                }
            }
        }

        console.log('Labels ready!');
    }

    // ==================== CONTEXT NOTES ====================

    /**
     * Store a context note for future retrieval
     */
    async addContext(key: string, value: string, tags: string[] = []) {
        const title = `Context: ${key}`;
        const body = `## Value\n${value}\n\n## Key\n\`${key}\``;

        return this.createIssue(title, {
            description: body,
            labels: ['context', ...tags],
            type: 'context',
        });
    }

    /**
     * Retrieve a context note by key
     */
    async getContext(key: string) {
        try {
            const { data } = await this.octokit.rest.issues.listForRepo({
                owner: this.owner,
                repo: this.repo,
                state: 'open',
                labels: 'context',
                per_page: 100,
            });

            // Find issue with matching key in title (account for [Agent] prefix)
            const issue = data.find(i => i.title.includes(`Context: ${key}`));
            if (!issue) return null;

            // Extract value from body
            const match = issue.body?.match(/## Value\n([\s\S]*?)(?=\n\n## Key|$)/);
            return match ? match[1].trim() : issue.body;
        } catch (error) {
            console.error(`Failed to get context for key '${key}':`, error);
            throw error;
        }
    }

    /**
     * Search context notes
     */
    async searchContext(query: string) {
        try {
            const { data } = await this.octokit.rest.search.issuesAndPullRequests({
                q: `repo:${this.owner}/${this.repo} is:issue label:context ${query}`,
                per_page: 20,
            });

            return data.items;
        } catch (error) {
            console.error('Failed to search context:', error);
            throw error;
        }
    }

    // ==================== SESSION HANDOFF ====================

    /**
     * Create a session handoff summary
     */
    async createHandoff(data: HandoffData) {
        const timestamp = new Date().toISOString();
        const title = `Handoff: ${timestamp.split('T')[0]}`;

        let body = `## Summary\n${data.summary}\n`;

        if (data.incomplete && data.incomplete.length > 0) {
            body += `\n## Incomplete\n${data.incomplete.map(i => `- [ ] ${i}`).join('\n')}\n`;
        }

        if (data.blockers && data.blockers.length > 0) {
            body += `\n## Blockers\n${data.blockers.map(b => `- ⚠️ ${b}`).join('\n')}\n`;
        }

        body += `\n---\n*Created: ${timestamp}*`;

        return this.createIssue(title, {
            description: body,
            labels: ['handoff'],
            type: 'handoff',
        });
    }

    /**
     * Get the latest handoff to resume context
     */
    async getLatestHandoff() {
        try {
            const { data } = await this.octokit.rest.issues.listForRepo({
                owner: this.owner,
                repo: this.repo,
                state: 'open',
                labels: 'handoff',
                sort: 'created',
                direction: 'desc',
                per_page: 1,
            });

            return data[0] || null;
        } catch (error) {
            console.error('Failed to get latest handoff:', error);
            throw error;
        }
    }

    // ==================== LEARNING LOG ====================

    /**
     * Log a lesson learned (mistakes, corrections)
     */
    async logLearning(lesson: string, tags: string[] = []) {
        const timestamp = new Date().toISOString();
        const title = `Learning: ${lesson.slice(0, 50)}${lesson.length > 50 ? '...' : ''}`;

        const body = `## Lesson\n${lesson}\n\n---\n*Logged: ${timestamp}*`;

        return this.createIssue(title, {
            description: body,
            labels: ['learning', ...tags],
            type: 'learning',
        });
    }

    /**
     * Get all learnings, optionally filtered by tag
     */
    async getLearnings(tag?: string) {
        try {
            const labels = tag ? `learning,${tag}` : 'learning';
            const { data } = await this.octokit.rest.issues.listForRepo({
                owner: this.owner,
                repo: this.repo,
                state: 'open',
                labels,
                sort: 'created',
                direction: 'desc',
                per_page: 50,
            });

            return data;
        } catch (error) {
            console.error('Failed to get learnings:', error);
            throw error;
        }
    }

    // ==================== WORK QUEUE ====================

    /**
     * Get ready work - issues with no open blockers
     */
    async getReadyWork(priority?: number) {
        const labels: string[] = ['ready'];

        if (priority !== undefined) {
            labels.push(`p${priority}`);
        }

        try {
            const { data } = await this.octokit.rest.issues.listForRepo({
                owner: this.owner,
                repo: this.repo,
                state: 'open',
                labels: labels.join(','),
                sort: 'created',
                direction: 'asc',
            });

            return data;
        } catch (error) {
            console.error('Failed to fetch ready work:', error);
            throw error;
        }
    }

    /**
     * Create a new issue
     */
    async createIssue(title: string, options: IssueOptions = {}) {
        let body = options.description || '';

        // Add blocked-by section if dependencies exist
        if (options.blockedBy && options.blockedBy.length > 0) {
            body += '\n\n## Blocked By\n';
            body += options.blockedBy.map(num => `- [ ] #${num}`).join('\n');
        }

        // Build labels array
        const labels: string[] = options.labels || [];

        // Add priority label
        if (options.priority !== undefined) {
            labels.push(`p${options.priority}`);
        }

        // Add type label (skip for special types that are already labels)
        const specialTypes = ['context', 'handoff', 'learning'];
        if (options.type && !specialTypes.includes(options.type)) {
            labels.push(options.type);
        }

        // Add ready/blocked label only for work items (not special types)
        if (!['context', 'handoff', 'learning'].includes(options.type || '')) {
            if (!options.blockedBy || options.blockedBy.length === 0) {
                labels.push('ready');
            } else {
                labels.push('blocked');
            }
        }

        try {
            const { data } = await this.octokit.rest.issues.create({
                owner: this.owner,
                repo: this.repo,
                title: this.formatTitle(title),
                body,
                labels,
            });

            console.log(`✓ Created issue #${data.number}: ${title}`);
            return data;
        } catch (error) {
            console.error('Failed to create issue:', error);
            throw error;
        }
    }

    /**
     * Update an existing issue
     */
    async updateIssue(issueNumber: number, updates: {
        title?: string;
        description?: string;
        state?: 'open' | 'closed';
        labels?: string[];
    }) {
        try {
            const { data } = await this.octokit.rest.issues.update({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                title: updates.title ? this.formatTitle(updates.title) : undefined,
                body: updates.description,
                state: updates.state,
                labels: updates.labels,
            });

            console.log(`✓ Updated issue #${issueNumber}`);
            return data;
        } catch (error) {
            console.error(`Failed to update issue #${issueNumber}:`, error);
            throw error;
        }
    }

    /**
     * Close an issue with a reason
     */
    async closeIssue(issueNumber: number, reason: string) {
        try {
            // Add closing comment
            await this.octokit.rest.issues.createComment({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                body: `**Closed**: ${reason}`,
            });

            // Close the issue
            await this.updateIssue(issueNumber, { state: 'closed' });

            console.log(`✓ Closed issue #${issueNumber}: ${reason}`);
        } catch (error) {
            console.error(`Failed to close issue #${issueNumber}:`, error);
            throw error;
        }
    }

    /**
     * Get all issues (for debugging/stats)
     */
    async listAllIssues(state: 'open' | 'closed' | 'all' = 'open') {
        try {
            const { data } = await this.octokit.rest.issues.listForRepo({
                owner: this.owner,
                repo: this.repo,
                state,
                per_page: 100,
            });

            return data;
        } catch (error) {
            console.error('Failed to list issues:', error);
            throw error;
        }
    }
}
