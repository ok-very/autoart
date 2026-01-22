/**
 * Generator Service
 * 
 * Ports AutoCollector's generator.js logic to TypeScript.
 * Formats collected artist data into structured HTML/Markdown for export.
 */

export interface ArtistData {
    name: string;
    bio: string;
    source_url: string;
    region?: string;
    works: WorkItem[];
}

export interface WorkItem {
    title: string;
    src: string;  // Relative path to image
    caption_text: string;
    year?: string;
}

export interface GeneratorOptions {
    format: 'html' | 'markdown';
    includeImages: boolean;
    maxWorks?: number;
}

/**
 * Generate formatted output from artist data
 */
export function generateArtistPage(
    artist: ArtistData,
    options: GeneratorOptions = { format: 'html', includeImages: true }
): string {
    if (options.format === 'markdown') {
        return generateMarkdown(artist, options);
    }
    return generateHtml(artist, options);
}

/**
 * Generate Markdown output
 */
function generateMarkdown(artist: ArtistData, options: GeneratorOptions): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${artist.name}`);
    lines.push('');

    if (artist.region) {
        lines.push(`## ${artist.region}`);
        lines.push('');
    }

    // Bio
    if (artist.bio) {
        const bioLines = artist.bio
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        lines.push(...bioLines);
        lines.push('');
    }

    // Works
    if (options.includeImages && artist.works.length > 0) {
        lines.push('## Works');
        lines.push('');

        const maxWorks = options.maxWorks || artist.works.length;
        const works = artist.works.slice(0, maxWorks);

        for (const work of works) {
            lines.push(`### ${work.title}`);
            if (work.year) {
                lines.push(`*${work.year}*`);
            }
            lines.push('');
            lines.push(`![${work.title}](${work.src})`);
            if (work.caption_text) {
                lines.push('');
                lines.push(`*${work.caption_text}*`);
            }
            lines.push('');
        }
    }

    // Source
    lines.push('---');
    lines.push(`*Source: [${artist.source_url}](${artist.source_url})*`);

    return lines.join('\n');
}

/**
 * Generate HTML output
 */
function generateHtml(artist: ArtistData, options: GeneratorOptions): string {
    const escapedName = escapeHtml(artist.name);
    const escapedRegion = artist.region ? escapeHtml(artist.region) : '';

    // Bio paragraphs
    const bioHtml = artist.bio
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<p>${escapeHtml(line)}</p>`)
        .join('\n');

    // Works gallery
    let worksHtml = '';
    if (options.includeImages && artist.works.length > 0) {
        const maxWorks = options.maxWorks || artist.works.length;
        const works = artist.works.slice(0, maxWorks);

        const workItems = works.map(work => {
            const caption = work.caption_text
                ? `<figcaption>${escapeHtml(work.caption_text)}</figcaption>`
                : '';
            const year = work.year ? `<span class="year">${escapeHtml(work.year)}</span>` : '';

            return `
        <figure class="work-item">
            <img src="${escapeHtml(work.src)}" alt="${escapeHtml(work.title)}" loading="lazy" />
            <div class="work-info">
                <h3>${escapeHtml(work.title)}</h3>
                ${year}
                ${caption}
            </div>
        </figure>`;
        }).join('\n');

        worksHtml = `
    <section class="works">
        <h2>Works</h2>
        <div class="gallery">
            ${workItems}
        </div>
    </section>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedName}</title>
    <style>
        :root {
            --primary: #1a1a2e;
            --secondary: #16213e;
            --accent: #0f3460;
            --text: #e8e8e8;
            --muted: #a0a0a0;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: var(--primary);
            color: var(--text);
            line-height: 1.6;
            padding: 2rem;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        header { margin-bottom: 2rem; }
        h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .region { color: var(--muted); font-size: 1.2rem; }
        .bio { margin-bottom: 2rem; }
        .bio p { margin-bottom: 1rem; }
        .works h2 { margin-bottom: 1rem; }
        .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
        }
        .work-item {
            background: var(--secondary);
            border-radius: 8px;
            overflow: hidden;
        }
        .work-item img {
            width: 100%;
            height: 250px;
            object-fit: cover;
        }
        .work-info { padding: 1rem; }
        .work-info h3 { font-size: 1rem; margin-bottom: 0.25rem; }
        .work-info .year { color: var(--muted); font-size: 0.875rem; }
        figcaption { color: var(--muted); font-size: 0.875rem; margin-top: 0.5rem; }
        footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--accent); color: var(--muted); font-size: 0.875rem; }
        footer a { color: var(--text); }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>${escapedName}</h1>
            ${escapedRegion ? `<p class="region">${escapedRegion}</p>` : ''}
        </header>
        
        <section class="bio">
            ${bioHtml}
        </section>
        
        ${worksHtml}
        
        <footer>
            <p>Source: <a href="${escapeHtml(artist.source_url)}" target="_blank">${escapeHtml(artist.source_url)}</a></p>
        </footer>
    </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export default {
    generateArtistPage,
};
