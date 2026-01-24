
import fs from 'fs-extra';
import path from 'path';

// Config
const BASE_DIR = "../";
const JSON_PATH = path.join(BASE_DIR, "artist_metadata.json");
const CSS_PATH = path.join(BASE_DIR, "resources", "tearsheet.css");
const JS_PATH = path.join(BASE_DIR, "resources", "tearsheet.js");
const OUTPUT_DIR = path.join(BASE_DIR, "generated_tearsheets");

async function generate() {
    console.log("Starting Node.js Tearsheet Generator...");

    // 1. Load Resources
    if (!fs.existsSync(JSON_PATH)) {
        console.error("Error: artist_metadata.json not found.");
        return;
    }
    const artists = await fs.readJson(JSON_PATH);
    const cssContent = await fs.readFile(CSS_PATH, 'utf-8');
    const jsContent = await fs.readFile(JS_PATH, 'utf-8');

    // 2. Ensure Output Dir
    await fs.ensureDir(OUTPUT_DIR);

    // 3. Process each artist
    let count = 0;
    for (const artist of artists) {
        const html = generateArtistHtml(artist, cssContent, jsContent);

        const safeName = (artist.name || "Unknown")
            .replace(/[^a-z0-9\s-_]/gi, '')
            .trim();

        const outPath = path.join(OUTPUT_DIR, `${safeName}.html`);
        await fs.writeFile(outPath, html);
        count++;
    }

    console.log(`Success! Generated ${count} HTML files in ${OUTPUT_DIR}`);
}

function generateArtistHtml(artist, css, js) {
    const name = artist.name || "Unknown Artist";

    // Bio Priority: Web > PDF
    let bio = artist.bio_web || artist.bio || "";
    if (bio === "Bio not found.") bio = "";

    // Simple Bio Formatting (Split by newline -> <p>)
    const bioHtml = bio
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<p>${line}</p>`)
        .join('');

    // Contact Info Parsing
    const contactInfo = artist.contact_info || "";
    const contacts = contactInfo.split('|').map(c => c.trim()).filter(c => c);
    const line1 = contacts[0] || "Email";
    const line2 = contacts[1] || "Website";
    const line3 = ""; // Placeholder

    // Process Works / Captions
    let worksHtml = "";
    const works = artist.works || [];

    for (const work of works) {
        let src = work.src || "";
        // Adjust path to be relative to generated_tearsheets (../)
        src = "../" + src.replace(/\\/g, "/");

        const title = work.title || "Untitled";
        const rawCap = work.caption_text || "";

        // Smart Caption Logic (Regex port from Python)
        // 1. Year
        const yearMatch = rawCap.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? yearMatch[0] : (work.year || "");

        // 2. Dimensions
        const dimMatch = rawCap.match(/(\d+(\.\d+)?\s*(cm|in|mm|ft|")\s*[xX]\s*\d+(\.\d+)?\s*(cm|in|mm|ft|")?)/);
        const dimensions = dimMatch ? dimMatch[0] : "";

        // 3. Medium (Heuristic cleaning)
        let medium = rawCap;
        if (year) medium = medium.replace(year, "");
        if (dimensions) medium = medium.replace(dimensions, "");
        if (title && medium.toLowerCase().includes(title.toLowerCase())) {
            medium = medium.replace(new RegExp(escapeRegExp(title), 'gi'), "");
        }
        // Clean punctuation
        medium = medium.replace(/^[,.\s]+|[,.\s]+$/g, '');

        const metaParts = [];
        if (medium && medium.length < 50) metaParts.push(medium);
        if (dimensions) metaParts.push(dimensions);
        if (year) metaParts.push(year);

        const finalCaption = metaParts.join(" | ");

        worksHtml += `
            <figure class="artwork-item">
                <div class="image-wrapper">
                    <img src="${src}" alt="${title}">
                </div>
                <figcaption class="artwork-caption" contenteditable="true">
                    <span class="artwork-title">${title}</span><br>
                    <p style="font-size:8pt; margin-top:4px; color:#666;">${finalCaption}</p>
                </figcaption>
            </figure>
        `;
    }

    // HTML Template
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Artist Tearsheet - ${name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Carlito:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
    <style>
        ${css}
    </style>
</head>
<body>

    <div class="tearsheet-container">
        <!-- Header -->
        <header class="header-section">
            <div class="artist-identity">
                <h1 class="artist-name" contenteditable="true">${name}</h1>
                <h2 class="artist-region" contenteditable="true">${artist.region || ""}</h2>
            </div>
            <div class="contact-info" contenteditable="true">
                <p>${line1}</p>
                <p>${line2}</p>
                <p>${line3}</p>
            </div>
        </header>

        <!-- Bio -->
        <section class="bio-section" style="position: relative;">
            <div class="bio-text" contenteditable="true">
                ${bioHtml}
            </div>
        </section>

        <!-- Gallery -->
        <main class="gallery-grid">
            ${worksHtml}
        </main>
    </div>

    <!-- Sidebar injected by JS -->
    
    <style id="page-style">
        @page { size: 14in 8.5in; margin: 0.5in; }
    </style>
    
    <!-- Inlined Interactive JS -->
    <script>
        ${js}
    </script>
</body>
</html>`;
}

// Utility to escape string for Regex
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

generate();
