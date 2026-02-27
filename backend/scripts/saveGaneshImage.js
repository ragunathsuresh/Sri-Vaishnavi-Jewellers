/**
 * Run once: node backend/scripts/saveGaneshImage.js
 * Downloads the Ganesh watermark image to backend/assets/ganesh.png
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const dest = path.join(__dirname, '..', 'assets', 'ganesh.png');
fs.mkdirSync(path.dirname(dest), { recursive: true });

// List of public domain Ganesha image URLs to try in order
const sources = [
    'https://www.pngwing.com/en/free-png-ncapz',
    'https://cdn.pixabay.com/photo/2017/01/31/15/33/ganesha-2025482_640.png',
    'https://openclipart.org/download/247317/ganesha.svg',
];

function download(url, retries) {
    if (retries <= 0) {
        console.log('\n❌ Could not download image automatically.');
        console.log('📌 Please manually copy your Ganesh image to:');
        console.log('   ', dest);
        console.log('   (Supported formats: .png or .jpg)');
        return;
    }
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 SriVaishnaviJewellers/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return download(res.headers.location, retries - 1);
        }
        if (res.statusCode !== 200) {
            console.log(`Skipping ${url} (HTTP ${res.statusCode})`);
            return download(sources[sources.length - retries + 1] || null, retries - 1);
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
            file.close();
            const sz = fs.statSync(dest).size;
            if (sz < 1000) {
                console.log(`File too small (${sz} bytes), likely error page.`);
                fs.unlinkSync(dest);
                return download(sources[sources.length - retries + 1] || null, retries - 1);
            }
            console.log(`✅ Saved to ${dest} (${sz} bytes)`);
        });
    }).on('error', (e) => {
        console.log('Network error:', e.message);
        download(sources[sources.length - retries + 1] || null, retries - 1);
    });
}

if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log(`✅ Image already exists at ${dest}`);
} else {
    download(sources[0], sources.length);
}
