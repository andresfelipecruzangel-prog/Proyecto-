// ═══════════════════════════════════════════════════════════
//  Servidor local para el Video Ranking Editor
//  - Sirve los archivos estáticos del editor (http://localhost:3000)
//  - GET /api/import?url=<url>  → descarga el video con yt-dlp
//    (TikTok, YouTube, Instagram, etc.) y lo devuelve al navegador
// ═══════════════════════════════════════════════════════════
const express = require('express');
const youtubedl = require('yt-dlp-exec');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

const app = express();

// Archivos estáticos: la raíz "/" abre directamente el editor
app.use(express.static(__dirname, { index: 'video-ranking-editor.html' }));

// ── Importar video desde URL ────────────────────────────────
app.get('/api/import', async (req, res) => {
    const url = (req.query.url || '').trim();

    if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: 'URL vacía o inválida. Debe empezar por http(s)://' });
    }

    const baseName = 'video_' + Date.now();
    const outputTemplate = path.join(DOWNLOADS_DIR, baseName + '.%(ext)s');
    let downloadedFile = null;

    try {
        console.log('[import] Descargando:', url);
        await youtubedl(url, {
            output: outputTemplate,
            // Preferir H.264: Chrome/Edge pueden reproducirlo y dibujarlo en Canvas.
            // TikTok suele ofrecer H.265 como mejor calidad, pero puede verse negro.
            format: 'best[vcodec^=avc1][ext=mp4]/best[vcodec^=h264][ext=mp4]/best[ext=mp4]/best',
            mergeOutputFormat: 'mp4',
            noPlaylist: true,
            noPart: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            extractorArgs: ['tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com']
        });

        // Localizar el archivo generado (la extensión la decide yt-dlp)
        downloadedFile = fs.readdirSync(DOWNLOADS_DIR).find(f => f.startsWith(baseName + '.'));
        if (!downloadedFile) throw new Error('yt-dlp terminó pero no se encontró el archivo descargado.');

        const filePath = path.join(DOWNLOADS_DIR, downloadedFile);
        console.log('[import] OK →', downloadedFile, '(' + (fs.statSync(filePath).size / 1048576).toFixed(1) + ' MB)');

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('X-Video-Filename', encodeURIComponent(downloadedFile));
        res.sendFile(filePath, (err) => {
            if (err) console.error('[import] Error enviando archivo:', err.message);
            fs.unlink(filePath, () => {}); // limpiar siempre el temporal
        });
    } catch (err) {
        console.error('[import] Error:', err.stderr || err.message);
        // Limpiar posibles restos de la descarga fallida
        fs.readdirSync(DOWNLOADS_DIR)
            .filter(f => f.startsWith(baseName + '.'))
            .forEach(f => fs.unlink(path.join(DOWNLOADS_DIR, f), () => {}));

        let msg = 'No se pudo descargar el video.';
        const detail = (err.stderr || err.message || '').toLowerCase();
        if (detail.includes('private') || detail.includes('login')) msg = 'El video es privado o requiere inicio de sesión.';
        else if (detail.includes('unsupported url') || detail.includes('unable to extract')) msg = 'URL no soportada o no se pudo extraer el video.';
        else if (detail.includes('404') || detail.includes('removed') || detail.includes('not available')) msg = 'El video no existe o fue eliminado.';

        res.status(500).json({ error: msg });
    }
});

app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('  Video Ranking Editor listo en:');
    console.log('  → http://localhost:' + PORT);
    console.log('═══════════════════════════════════════════════════');
});
