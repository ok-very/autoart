
import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';

// Config
const BASE_DIR = "../";
const JSON_PATH = path.join(BASE_DIR, "artist_metadata.json");

export async function crawlUrl(url) {
    // Ensure protocol
    if (!url.startsWith('http')) url = 'https://' + url;

    console.log(`Crawling single URL (Puppeteer): ${url}`);

    // 1. Load Metadata
    let artists = [];
    if (fs.existsSync(JSON_PATH)) {
        artists = await fs.readJson(JSON_PATH);
    }

    let scrapedName = "Unknown Artist";
    let scrapedBio = "";
    let scrapedWorks = [];

    // 2. Launch Browser
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // --- STEP A: BIO EXTRACTION ---
        console.log("  Loading home...");
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        let title = await page.title();
        scrapedName = title.split('|')[0].split('-')[0].trim();

        console.log("  Looking for Bio link...");
        const aboutUrl = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.find(a => ['about', 'bio', 'biography', 'cv', 'profile'].includes(a.innerText.toLowerCase().trim()))?.href;
        });

        if (aboutUrl) {
            console.log(`  -> Found About page: ${aboutUrl}`);
            await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        }

        scrapedBio = await page.evaluate(() => {
            // Remove junk
            document.querySelectorAll('script, style, noscript, svg, form, nav, header, footer, iframe, link').forEach(e => e.remove());
            const p = Array.from(document.querySelectorAll('p'));
            const text = p.map(e => e.innerText).join('\n\n');
            return text.length > 200 ? text : document.body.innerText;
        });

        // Clean Bio
        scrapedBio = scrapedBio.split('\n').filter(l => l.length > 40 && !l.includes('{')).join('\n\n');
        console.log(`  -> Bio Length: ${scrapedBio.length}`);


        // --- STEP B: IMAGE EXTRACTION ---
        console.log("  Looking for Work/Gallery link...");
        const workUrl = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            return anchors.find(a => ['work', 'portfolio', 'gallery', 'projects'].includes(a.innerText.toLowerCase().trim()))?.href;
        });

        const targetGallery = workUrl || url; // Fallback to home if no work link
        if (page.url() !== targetGallery) {
            console.log(`  -> Navigating to Gallery: ${targetGallery}`);
            await page.goto(targetGallery, { waitUntil: 'networkidle2', timeout: 30000 });
        }

        console.log("  Extracting images...");
        // Wait a bit for lazy loaded images
        await new Promise(r => setTimeout(r, 2000));
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await new Promise(r => setTimeout(r, 1000));

        scrapedWorks = await page.evaluate(() => {
            const works = [];
            const processedSrcs = new Set();

            // Heuristic: Find images inside known containers or just large imgs
            const imgs = Array.from(document.querySelectorAll('img'));

            imgs.forEach(img => {
                if (img.width < 300 || img.height < 300) return; // Skip small UI elements

                let src = img.src;
                if (img.dataset.src) src = img.dataset.src; // Squarespace/Lazyload often keeps real URL here

                if (!src || !src.startsWith('http')) return;

                if (processedSrcs.has(src)) return;
                processedSrcs.add(src);

                // Try to find a caption nearby
                let caption = "";
                // 1. Closest figcaption
                const fig = img.closest('figure');
                if (fig && fig.querySelector('figcaption')) {
                    caption = fig.querySelector('figcaption').innerText;
                }
                // 2. Sibling text
                if (!caption) {
                    // Check parent's next sibling or similar
                    // This is site specific, basic heuristic here
                }

                works.push({
                    title: img.alt || "Untitled",
                    src: src,
                    caption_text: caption.trim().replace(/\n/g, ' | ')
                });
            });
            return works.slice(0, 15);
        });

        console.log(`  -> Found ${scrapedWorks.length} images.`);

    } catch (err) {
        console.error("Crawl failed:", err.message);
    } finally {
        await browser.close();
    }

    // --- STEP C: DOWNLOAD & SAVE ---
    const safeName = scrapedName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const imageDir = path.join(BASE_DIR, "_extracted_images", safeName);
    await fs.ensureDir(imageDir);

    // Update Metadata Entry
    let artist = artists.find(a => a.contact_info && a.contact_info.includes(url));
    if (!artist) {
        artist = { name: scrapedName, contact_info: `Website: ${url}`, works: [] };
        artists.push(artist);
    }
    artist.bio_web = scrapedBio;
    artist.works = []; // Clear old works to replace

    // Download Loop
    // Use dynamic import for node-fetch or basic https
    // Simplified fetch helper for Node 18+
    console.log(`  Downloading to ${imageDir}...`);

    let downloadCount = 0;
    for (let i = 0; i < scrapedWorks.length; i++) {
        const item = scrapedWorks[i];
        // Guess extension
        let ext = path.extname(item.src).split('?')[0] || '.jpg';
        if (ext.length > 5) ext = '.jpg';

        const filename = `web_image_${i + 1}${ext}`;
        const localPath = path.join(imageDir, filename);

        try {
            const resp = await fetch(item.src);
            if (resp.ok) {
                const buffer = await resp.arrayBuffer();
                await fs.writeFile(localPath, Buffer.from(buffer));

                artist.works.push({
                    title: item.title,
                    src: `_extracted_images/${safeName}/${filename}`, // Relative path for Generator
                    caption_text: item.caption_text,
                    year: ""
                });
                downloadCount++;
                process.stdout.write('.');
            }
        } catch (e) {
            // failed
        }
    }
    console.log(`\nDownloaded ${downloadCount} images.`);

    await fs.writeJson(JSON_PATH, artists, { spaces: 4 });
    console.log("Metadata saved.");
}

// CLI
if (process.argv[1] === import.meta.filename) {
    const arg = process.argv[2];
    if (arg) crawlUrl(arg);
}
