/**
 * Google Slides Connector
 *
 * Exports BFA project data to Google Slides presentations.
 * Supports:
 * - Project summary slides
 * - Individual project detail slides
 * - Timeline visualization
 * - Budget overview slides
 */

import { GoogleClient, type Presentation, type PresentationRequest, type SlideLayoutReference } from './google-client.js';
import type { BfaProjectExportModel, ExportOptions } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleSlidesConnectorConfig {
    accessToken: string;
}

export interface SlidesExportOptions extends ExportOptions {
    /** Include title slide */
    includeTitleSlide?: boolean;
    /** Include summary slide with all projects */
    includeSummarySlide?: boolean;
    /** Create individual slides for each project */
    includeProjectSlides?: boolean;
    /** Group projects by category */
    groupByCategory?: boolean;
    /** Slide template style */
    template?: 'minimal' | 'detailed' | 'executive';
}

export interface WritePresentationResult {
    presentationId: string;
    presentationUrl: string;
    slidesCreated: number;
    success: boolean;
    error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// EMU (English Metric Units) - Google Slides uses these for positioning
const EMU_PER_POINT = 12700;
const EMU_PER_INCH = 914400;

// Standard slide dimensions (16:9 widescreen)
const SLIDE_WIDTH = 10 * EMU_PER_INCH;
const SLIDE_HEIGHT = 5.625 * EMU_PER_INCH;

// Margins
const MARGIN = 0.5 * EMU_PER_INCH;

// ============================================================================
// CONNECTOR CLASS
// ============================================================================

export class GoogleSlidesConnector {
    private client: GoogleClient;

    constructor(config: GoogleSlidesConnectorConfig) {
        this.client = new GoogleClient({ accessToken: config.accessToken });
    }

    // ========================================================================
    // EXPORT OPERATIONS
    // ========================================================================

    /**
     * Create a new presentation with BFA project data
     */
    async createPresentation(
        title: string,
        projects: BfaProjectExportModel[],
        options: SlidesExportOptions
    ): Promise<WritePresentationResult> {
        try {
            // Create the presentation
            const presentation = await this.client.createPresentation(title);
            const presentationId = presentation.presentationId;
            let slidesCreated = 0;

            // Get the default slide (created automatically)
            const defaultSlideId = presentation.slides[0]?.objectId;

            // Create title slide (replace default slide content)
            if (options.includeTitleSlide !== false && defaultSlideId) {
                await this.createTitleSlide(presentationId, defaultSlideId, title, projects.length);
                slidesCreated++;
            }

            // Create summary slide
            if (options.includeSummarySlide) {
                await this.createSummarySlide(presentationId, projects);
                slidesCreated++;
            }

            // Create project slides
            if (options.includeProjectSlides !== false) {
                if (options.groupByCategory) {
                    // Group by category with section headers
                    const categories = this.groupProjectsByCategory(projects);
                    for (const [category, categoryProjects] of Object.entries(categories)) {
                        // Add category header slide
                        await this.createCategorySlide(presentationId, category);
                        slidesCreated++;

                        // Add project slides
                        for (const project of categoryProjects) {
                            await this.createProjectSlide(presentationId, project, options);
                            slidesCreated++;
                        }
                    }
                } else {
                    // Add all project slides
                    for (const project of projects) {
                        await this.createProjectSlide(presentationId, project, options);
                        slidesCreated++;
                    }
                }
            }

            // Get the presentation URL
            const file = await this.client.getFile(presentationId);

            return {
                presentationId,
                presentationUrl: file.webViewLink ?? `https://docs.google.com/presentation/d/${presentationId}`,
                slidesCreated,
                success: true,
            };
        } catch (error) {
            return {
                presentationId: '',
                presentationUrl: '',
                slidesCreated: 0,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // ========================================================================
    // SLIDE CREATORS
    // ========================================================================

    /**
     * Create/update title slide
     */
    private async createTitleSlide(
        presentationId: string,
        slideId: string,
        title: string,
        projectCount: number
    ): Promise<void> {
        const titleBoxId = `title_box_${Date.now()}`;
        const subtitleBoxId = `subtitle_box_${Date.now()}`;

        const requests: PresentationRequest[] = [
            // Create title text box
            {
                createShape: {
                    objectId: titleBoxId,
                    shapeType: 'TEXT_BOX',
                    elementProperties: {
                        pageObjectId: slideId,
                        size: {
                            width: { magnitude: SLIDE_WIDTH - 2 * MARGIN, unit: 'EMU' },
                            height: { magnitude: 1 * EMU_PER_INCH, unit: 'EMU' },
                        },
                        transform: {
                            scaleX: 1,
                            scaleY: 1,
                            translateX: MARGIN,
                            translateY: 2 * EMU_PER_INCH,
                            unit: 'EMU',
                        },
                    },
                },
            },
            // Add title text
            {
                insertText: {
                    objectId: titleBoxId,
                    text: title,
                },
            },
            // Create subtitle text box
            {
                createShape: {
                    objectId: subtitleBoxId,
                    shapeType: 'TEXT_BOX',
                    elementProperties: {
                        pageObjectId: slideId,
                        size: {
                            width: { magnitude: SLIDE_WIDTH - 2 * MARGIN, unit: 'EMU' },
                            height: { magnitude: 0.5 * EMU_PER_INCH, unit: 'EMU' },
                        },
                        transform: {
                            scaleX: 1,
                            scaleY: 1,
                            translateX: MARGIN,
                            translateY: 3.2 * EMU_PER_INCH,
                            unit: 'EMU',
                        },
                    },
                },
            },
            // Add subtitle text
            {
                insertText: {
                    objectId: subtitleBoxId,
                    text: `${projectCount} Projects | ${new Date().toLocaleDateString()}`,
                },
            },
        ];

        await this.client.batchUpdatePresentation(presentationId, requests);
    }

    /**
     * Create summary slide with project overview
     */
    private async createSummarySlide(
        presentationId: string,
        projects: BfaProjectExportModel[]
    ): Promise<void> {
        // Add new slide
        const slideResult = await this.client.addSlide(presentationId, 'TITLE_AND_BODY');
        const slideId = slideResult.objectId;

        // Create summary content
        const summaryLines = projects.slice(0, 15).map(p =>
            `• ${p.header.clientName}: ${p.header.projectName} (${p.statusBlock.stage ?? 'Unknown'})`
        );

        if (projects.length > 15) {
            summaryLines.push(`... and ${projects.length - 15} more projects`);
        }

        const textBoxId = `summary_content_${Date.now()}`;

        const requests: PresentationRequest[] = [
            {
                createShape: {
                    objectId: textBoxId,
                    shapeType: 'TEXT_BOX',
                    elementProperties: {
                        pageObjectId: slideId,
                        size: {
                            width: { magnitude: SLIDE_WIDTH - 2 * MARGIN, unit: 'EMU' },
                            height: { magnitude: 4 * EMU_PER_INCH, unit: 'EMU' },
                        },
                        transform: {
                            scaleX: 1,
                            scaleY: 1,
                            translateX: MARGIN,
                            translateY: 1 * EMU_PER_INCH,
                            unit: 'EMU',
                        },
                    },
                },
            },
            {
                insertText: {
                    objectId: textBoxId,
                    text: 'Project Summary\n\n' + summaryLines.join('\n'),
                },
            },
        ];

        await this.client.batchUpdatePresentation(presentationId, requests);
    }

    /**
     * Create category header slide
     */
    private async createCategorySlide(
        presentationId: string,
        category: string
    ): Promise<void> {
        const slideResult = await this.client.addSlide(presentationId, 'SECTION_HEADER');
        const slideId = slideResult.objectId;

        const categoryTitles: Record<string, string> = {
            public: 'Public Art Projects',
            corporate: 'Corporate Projects',
            private_corporate: 'Private Corporate Projects',
        };

        const textBoxId = `category_title_${Date.now()}`;

        const requests: PresentationRequest[] = [
            {
                createShape: {
                    objectId: textBoxId,
                    shapeType: 'TEXT_BOX',
                    elementProperties: {
                        pageObjectId: slideId,
                        size: {
                            width: { magnitude: SLIDE_WIDTH - 2 * MARGIN, unit: 'EMU' },
                            height: { magnitude: 1.5 * EMU_PER_INCH, unit: 'EMU' },
                        },
                        transform: {
                            scaleX: 1,
                            scaleY: 1,
                            translateX: MARGIN,
                            translateY: 2 * EMU_PER_INCH,
                            unit: 'EMU',
                        },
                    },
                },
            },
            {
                insertText: {
                    objectId: textBoxId,
                    text: categoryTitles[category] ?? category,
                },
            },
        ];

        await this.client.batchUpdatePresentation(presentationId, requests);
    }

    /**
     * Create individual project slide
     */
    private async createProjectSlide(
        presentationId: string,
        project: BfaProjectExportModel,
        options: SlidesExportOptions
    ): Promise<void> {
        const slideResult = await this.client.addSlide(presentationId, 'BLANK');
        const slideId = slideResult.objectId;

        const requests: PresentationRequest[] = [];
        let yOffset = MARGIN;

        // Title box
        const titleBoxId = `project_title_${Date.now()}`;
        requests.push(
            {
                createShape: {
                    objectId: titleBoxId,
                    shapeType: 'TEXT_BOX',
                    elementProperties: {
                        pageObjectId: slideId,
                        size: {
                            width: { magnitude: SLIDE_WIDTH - 2 * MARGIN, unit: 'EMU' },
                            height: { magnitude: 0.6 * EMU_PER_INCH, unit: 'EMU' },
                        },
                        transform: {
                            scaleX: 1,
                            scaleY: 1,
                            translateX: MARGIN,
                            translateY: yOffset,
                            unit: 'EMU',
                        },
                    },
                },
            },
            {
                insertText: {
                    objectId: titleBoxId,
                    text: `${project.header.clientName}: ${project.header.projectName}`,
                },
            }
        );
        yOffset += 0.8 * EMU_PER_INCH;

        // Subtitle with location and stage
        const subtitleBoxId = `project_subtitle_${Date.now()}`;
        const subtitle = [
            project.header.location,
            project.statusBlock.stage ? `Stage: ${project.statusBlock.stage}` : null,
            project.header.staffInitials.length > 0 ? `(${project.header.staffInitials.join('/')})` : null,
        ].filter(Boolean).join(' | ');

        requests.push(
            {
                createShape: {
                    objectId: subtitleBoxId,
                    shapeType: 'TEXT_BOX',
                    elementProperties: {
                        pageObjectId: slideId,
                        size: {
                            width: { magnitude: SLIDE_WIDTH - 2 * MARGIN, unit: 'EMU' },
                            height: { magnitude: 0.4 * EMU_PER_INCH, unit: 'EMU' },
                        },
                        transform: {
                            scaleX: 1,
                            scaleY: 1,
                            translateX: MARGIN,
                            translateY: yOffset,
                            unit: 'EMU',
                        },
                    },
                },
            },
            {
                insertText: {
                    objectId: subtitleBoxId,
                    text: subtitle,
                },
            }
        );
        yOffset += 0.6 * EMU_PER_INCH;

        // Budget info
        if (options.includeBudgets) {
            const budgetBoxId = `project_budget_${Date.now()}`;
            const budgetLines = [
                project.header.budgets.artwork?.text ? `Artwork: ${project.header.budgets.artwork.text}` : null,
                project.header.budgets.total?.text ? `Total: ${project.header.budgets.total.text}` : null,
                project.header.install.dateText ? `Install: ${project.header.install.dateText}` : null,
            ].filter(Boolean).join(' | ');

            if (budgetLines) {
                requests.push(
                    {
                        createShape: {
                            objectId: budgetBoxId,
                            shapeType: 'TEXT_BOX',
                            elementProperties: {
                                pageObjectId: slideId,
                                size: {
                                    width: { magnitude: SLIDE_WIDTH - 2 * MARGIN, unit: 'EMU' },
                                    height: { magnitude: 0.4 * EMU_PER_INCH, unit: 'EMU' },
                                },
                                transform: {
                                    scaleX: 1,
                                    scaleY: 1,
                                    translateX: MARGIN,
                                    translateY: yOffset,
                                    unit: 'EMU',
                                },
                            },
                        },
                    },
                    {
                        insertText: {
                            objectId: budgetBoxId,
                            text: budgetLines,
                        },
                    }
                );
                yOffset += 0.5 * EMU_PER_INCH;
            }
        }

        // Status info
        if (options.includeStatusNotes && (project.statusBlock.projectStatusText || project.statusBlock.bfaProjectStatusText)) {
            const statusBoxId = `project_status_${Date.now()}`;
            const statusLines = [
                project.statusBlock.projectStatusText ? `Status: ${project.statusBlock.projectStatusText}` : null,
                project.statusBlock.bfaProjectStatusText ? `BFA Status: ${project.statusBlock.bfaProjectStatusText}` : null,
            ].filter(Boolean).join('\n');

            requests.push(
                {
                    createShape: {
                        objectId: statusBoxId,
                        shapeType: 'TEXT_BOX',
                        elementProperties: {
                            pageObjectId: slideId,
                            size: {
                                width: { magnitude: SLIDE_WIDTH - 2 * MARGIN, unit: 'EMU' },
                                height: { magnitude: 0.8 * EMU_PER_INCH, unit: 'EMU' },
                            },
                            transform: {
                                scaleX: 1,
                                scaleY: 1,
                                translateX: MARGIN,
                                translateY: yOffset,
                                unit: 'EMU',
                            },
                        },
                    },
                },
                {
                    insertText: {
                        objectId: statusBoxId,
                        text: statusLines,
                    },
                }
            );
            yOffset += 0.9 * EMU_PER_INCH;
        }

        // Next steps
        const nextSteps = options.includeOnlyOpenNextSteps
            ? project.nextStepsBullets.filter(b => !b.completed)
            : project.nextStepsBullets;

        if (nextSteps.length > 0) {
            const nextStepsBoxId = `project_nextsteps_${Date.now()}`;
            const nextStepsText = 'Next Steps:\n' + nextSteps.slice(0, 5).map(b =>
                `• ${b.text}${b.ownerHint ? ` (${b.ownerHint})` : ''}`
            ).join('\n');

            requests.push(
                {
                    createShape: {
                        objectId: nextStepsBoxId,
                        shapeType: 'TEXT_BOX',
                        elementProperties: {
                            pageObjectId: slideId,
                            size: {
                                width: { magnitude: SLIDE_WIDTH - 2 * MARGIN, unit: 'EMU' },
                                height: { magnitude: 2 * EMU_PER_INCH, unit: 'EMU' },
                            },
                            transform: {
                                scaleX: 1,
                                scaleY: 1,
                                translateX: MARGIN,
                                translateY: yOffset,
                                unit: 'EMU',
                            },
                        },
                    },
                },
                {
                    insertText: {
                        objectId: nextStepsBoxId,
                        text: nextStepsText,
                    },
                }
            );
        }

        await this.client.batchUpdatePresentation(presentationId, requests);
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    /**
     * Group projects by category
     */
    private groupProjectsByCategory(
        projects: BfaProjectExportModel[]
    ): Record<string, BfaProjectExportModel[]> {
        const groups: Record<string, BfaProjectExportModel[]> = {
            public: [],
            corporate: [],
            private_corporate: [],
        };

        for (const project of projects) {
            const category = project.category || 'corporate';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(project);
        }

        // Remove empty categories
        for (const key of Object.keys(groups)) {
            if (groups[key].length === 0) {
                delete groups[key];
            }
        }

        return groups;
    }

    /**
     * List available presentations
     */
    async listPresentations(): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
        const files = await this.client.listPresentations();
        return files.map(f => ({
            id: f.id,
            name: f.name,
            modifiedTime: f.modifiedTime,
        }));
    }

    /**
     * Test connection
     */
    async testConnection(): Promise<{ connected: boolean; error?: string }> {
        return this.client.testConnection();
    }
}

export default GoogleSlidesConnector;
