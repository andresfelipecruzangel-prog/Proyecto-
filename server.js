// ═══════════════════════════════════════════════════════════
//  Servidor local para el Video Ranking Editor
//  - Sirve los archivos estáticos del editor (http://localhost:3000)
//  - GET /api/import?url=<url>  → descarga el video con yt-dlp
//    (TikTok, YouTube, Instagram, etc.) y lo devuelve al navegador
//  - POST /api/analyze   → ffprobe: FPS real, VFR, duplicados, PTS
//  - POST /api/normalize → ffmpeg: aterriza CFR base y interpola a 60
//  - POST /api/validate  → ffprobe: veredicto del render final (60 CFR)
// ═══════════════════════════════════════════════════════════
const express = require('express');
const youtubedl = require('yt-dlp-exec');
const { execFile } = require('child_process');
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

// ═══════════════════════════════════════════════════════════
//  Análisis / normalización / validación de FPS (60 CFR)
// ═══════════════════════════════════════════════════════════

// Ejecuta un binario (ffmpeg/ffprobe) y resuelve siempre con stdout+stderr
function runTool(cmd, args, timeoutMs) {
    return new Promise((resolve) => {
        execFile(cmd, args, { timeout: timeoutMs || 300000, maxBuffer: 256 * 1024 * 1024 },
            (err, stdout, stderr) => {
                resolve({ ok: !err, code: err && typeof err.code === 'number' ? err.code : 0, stdout: stdout || '', stderr: stderr || '', err: err || null });
            });
    });
}

const COMMON_RATES = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 90, 119.88, 120];

// Aterriza un fps medido a la tasa común más cercana (tolerancia 2%)
function snapRate(fps) {
    if (!fps || !isFinite(fps) || fps <= 0) return 0;
    for (const r of COMMON_RATES) if (Math.abs(fps - r) <= r * 0.02) return r;
    return Math.round(fps * 100) / 100;
}

function parseRate(str) {
    if (!str || str === '0/0') return 0;
    const parts = String(str).split('/');
    if (parts.length === 2) {
        const n = parseFloat(parts[0]), d = parseFloat(parts[1]);
        return d ? n / d : 0;
    }
    return parseFloat(str) || 0;
}

// ── Análisis profundo de un archivo de video ─────────────────
// Lee los PTS reales frame a frame (no solo metadatos), detecta VFR,
// timestamps no monótonos y frames duplicados (mpdecimate).
async function analyzeVideoFile(filePath, opts) {
    opts = opts || {};
    const report = {
        ok: false, metadataFps: 0, containerFps: 0, realFps: 0,
        isVfr: false, ptsIssues: false, nonMonotonic: false,
        totalFrames: 0, dupFrames: 0, dupRatio: 0, deltaCv: 0,
        width: 0, height: 0, duration: 0,
        hasAudio: false, audioStart: 0, videoStart: 0,
        action: 'unknown', reasons: []
    };

    // 1) Streams (metadatos)
    const probe = await runTool('ffprobe', [
        '-v', 'error',
        '-show_entries', 'stream=index,codec_type,codec_name,width,height,avg_frame_rate,r_frame_rate,nb_frames,duration,start_time',
        '-show_entries', 'format=duration,start_time',
        '-of', 'json', filePath
    ]);
    let info = null;
    try { info = JSON.parse(probe.stdout || '{}'); } catch (e) { /* queda null */ }
    const streams = (info && info.streams) || [];
    const vs = streams.find(s => s.codec_type === 'video') || {};
    const as = streams.find(s => s.codec_type === 'audio') || null;
    report.metadataFps = snapRate(parseRate(vs.avg_frame_rate));
    report.containerFps = snapRate(parseRate(vs.r_frame_rate));
    report.width = vs.width || 0; report.height = vs.height || 0;
    report.duration = parseFloat(vs.duration || (info && info.format && info.format.duration) || 0) || (parseFloat(vs.nb_frames) && report.metadataFps ? vs.nb_frames / report.metadataFps : 0);
    report.videoStart = parseFloat(vs.start_time || 0) || 0;
    report.hasAudio = !!as;
    report.audioStart = as ? (parseFloat(as.start_time || 0) || 0) : 0;

    // 2) PTS reales de cada frame (fuente de la verdad, no metadatos)
    const frames = await runTool('ffprobe', [
        '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'frame=pts_time,best_effort_timestamp_time',
        '-of', 'csv=p=0', filePath
    ], 600000);
    const pts = [];
    for (const line of (frames.stdout || '').split(/\r?\n/)) {
        if (!line.trim()) continue;
        for (const p of line.split(',')) {
            const n = parseFloat(p);
            if (isFinite(n)) { pts.push(n); break; }
        }
    }
    report.totalFrames = pts.length;

    if (pts.length >= 2) {
        const deltas = [];
        for (let i = 1; i < pts.length; i++) {
            const d = pts[i] - pts[i - 1];
            if (d < -1e-9) report.nonMonotonic = true;
            else if (d > 0) deltas.push(d);
        }
        if (report.nonMonotonic) report.ptsIssues = true;
        if (deltas.length) {
            // Histograma de deltas (ms) → cadencia dominante = FPS reales
            const hist = new Map();
            deltas.forEach(d => { const ms = Math.round(d * 1000) || 1; hist.set(ms, (hist.get(ms) || 0) + 1); });
            let modeMs = 0, modeCount = 0;
            for (const [ms, c] of hist) if (c > modeCount) { modeCount = c; modeMs = ms; }
            const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
            const variance = deltas.reduce((a, b) => a + (b - mean) * (b - mean), 0) / deltas.length;
            report.deltaCv = mean > 0 ? Math.sqrt(variance) / mean : 0;
            const maxDelta = deltas.reduce((m, d) => Math.max(m, d), 0);
            report.isVfr = report.deltaCv > 0.08 || (modeMs > 0 && maxDelta > (modeMs / 1000) * 2.5);
            if (modeMs > 0) report.realFps = snapRate(1000 / modeMs);
        }
    }

    // 3) Frames duplicados reales (contenido, no metadatos):
    //    mpdecimate deja pasar solo frames "únicos"; el contador frame=N
    //    del progreso de ffmpeg nos dice cuántos salen.
    if (opts.dupCheck !== false && report.totalFrames > 0) {
        const dup = await runTool('ffmpeg', [
            '-i', filePath, '-an', '-vf', 'mpdecimate', '-f', 'null', '-'
        ], 600000);
        const progress = [...dup.stderr.matchAll(/frame=\s*(\d+)/g)];
        const uniqueFrames = progress.length ? Math.max(...progress.map(m => +m[1])) : 0;
        if (uniqueFrames > 0 && uniqueFrames <= report.totalFrames) {
            report.dupFrames = report.totalFrames - uniqueFrames;
            report.dupRatio = report.dupFrames / report.totalFrames;
        }
    }

    // 4) FPS efectivos tras quitar duplicados (p. ej. "60 falsas": 30 con dups)
    let effectiveFps = report.realFps;
    if (effectiveFps > 0 && report.dupRatio > 0.05) {
        effectiveFps = snapRate(effectiveFps * (1 - report.dupRatio));
    }
    if (effectiveFps > 0) report.realFps = effectiveFps;

    // 5) Recomendación
    report.ok = true;
    if (!report.totalFrames) {
        report.action = 'unknown';
        report.reasons.push('sin frames de video legibles');
    } else if (report.nonMonotonic) {
        report.action = 'normalize';
        report.reasons.push('timestamps no monótonos (PTS roto)');
    } else if (report.realFps >= 59.5 && !report.isVfr && report.dupRatio < 0.05) {
        report.action = 'clean60';
        report.reasons.push('60 fps CFR limpio: no requiere procesado');
    } else {
        report.action = 'normalize';
        if (report.realFps > 0 && report.realFps < 59.5) report.reasons.push(report.realFps + ' fps reales (< 60)');
        if (report.isVfr) report.reasons.push('cadencia irregular (VFR)');
        if (report.dupRatio >= 0.05) report.reasons.push(Math.round(report.dupRatio * 100) + '% de frames duplicados');
    }
    return report;
}

// ── Endpoint: análisis ───────────────────────────────────────
app.post('/api/analyze', express.raw({ type: () => true, limit: '2gb' }), async (req, res) => {
    const tmp = path.join(DOWNLOADS_DIR, 'analyze_' + Date.now() + '.mp4');
    try {
        if (!req.body || !req.body.length) return res.status(400).json({ error: 'Cuerpo vacío: sube el video en el body.' });
        fs.writeFileSync(tmp, req.body);
        console.log('[analyze] analizando', (req.body.length / 1048576).toFixed(1), 'MB...');
        const report = await analyzeVideoFile(tmp, { dupCheck: req.query.dups !== '0' });
        res.json(report);
    } catch (err) {
        console.error('[analyze] Error:', err.message || err);
        res.status(500).json({ error: 'No se pudo analizar el video: ' + (err.message || 'error desconocido') });
    } finally {
        fs.unlink(tmp, () => {});
    }
});

// ── Endpoint: normalización a 60 CFR ─────────────────────────
// Aterriza VFR/timestamps rotos a CFR base y, si el clip tiene < 60 fps,
// interpola con minterpolate (estimación de movimiento) en vez de duplicar.
// Conserva duración y velocidad de reproducción (mismos timestamps).
app.post('/api/normalize', express.raw({ type: () => true, limit: '2gb' }), async (req, res) => {
    const tmpIn = path.join(DOWNLOADS_DIR, 'norm_in_' + Date.now() + '.mp4');
    const tmpOut = path.join(DOWNLOADS_DIR, 'norm_out_' + Date.now() + '.mp4');
    const cleanup = () => { fs.unlink(tmpIn, () => {}); fs.unlink(tmpOut, () => {}); };
    try {
        if (!req.body || !req.body.length) return res.status(400).json({ error: 'Cuerpo vacío.' });

        // Analizar primero y decidir (la base ?base= del cliente puede sobreescribir)
        fs.writeFileSync(tmpIn, req.body);
        let before = await analyzeVideoFile(tmpIn, { dupCheck: req.query.dups !== '0' });
        let baseFps = parseFloat(req.query.base) || before.realFps || before.metadataFps;

        if (before.ok && before.action === 'clean60' && !(parseFloat(req.query.base) > 0 && parseFloat(req.query.base) < 59.5)) {
            // Ya es 60 CFR limpio: no lo reprocesamos (se conservan sus frames)
            const report = { ok: true, action: 'clean60', before, after: before };
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('X-Report', encodeURIComponent(JSON.stringify(report)));
            return res.sendFile(tmpIn, (err) => { if (err) console.error('[normalize] send:', err.message); cleanup(); });
        }

        // Cadena de filtros: aterrizar timestamps si hace falta + minterpolate a 60
        const filters = [];
        const needLand = before.isVfr || before.ptsIssues || baseFps < 59.5;
        if (needLand && baseFps > 0 && baseFps < 59.5) filters.push('fps=' + baseFps);
        if (baseFps < 59.5) {
            filters.push('minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=fdiff');
        } else if (before.isVfr || before.ptsIssues || baseFps >= 59.5) {
            filters.push('fps=60'); // base ~60 con timestamps irregulares → solo aterrizar
        }

        console.log('[normalize] base', baseFps, '→ filtros:', filters.join(',') || '(copia CFR)');
        const args = ['-y', '-i', tmpIn];
        if (filters.length) args.push('-vf', filters.join(','));
        args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
            '-c:a', 'copy', '-movflags', '+faststart', tmpOut);
        const ff = await runTool('ffmpeg', args, 30 * 60 * 1000);
        if (!ff.ok || !fs.existsSync(tmpOut)) {
            throw new Error('ffmpeg falló: ' + (ff.stderr || 'sin salida').split('\n').slice(-3).join(' '));
        }

        // Validar la salida: el informe viaja en la cabecera X-Report
        const after = await analyzeVideoFile(tmpOut, { dupCheck: false });
        const report = { ok: true, action: 'normalized', before, after };
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('X-Report', encodeURIComponent(JSON.stringify(report)));
        console.log('[normalize] OK →', (fs.statSync(tmpOut).size / 1048576).toFixed(1), 'MB');
        res.sendFile(tmpOut, (err) => { if (err) console.error('[normalize] send:', err.message); cleanup(); });
    } catch (err) {
        console.error('[normalize] Error:', err.message || err);
        cleanup();
        res.status(500).json({ error: 'No se pudo normalizar: ' + (err.message || 'error desconocido') });
    }
});

// ── Endpoint: validación del render final ────────────────────
// Verifica: ~60 fps (metadatos + deltas reales), CFR, duración esperada,
// duplicados inesperados y sync A/V.
app.post('/api/validate', express.raw({ type: () => true, limit: '2gb' }), async (req, res) => {
    const tmp = path.join(DOWNLOADS_DIR, 'validate_' + Date.now() + '.mp4');
    try {
        if (!req.body || !req.body.length) return res.status(400).json({ error: 'Cuerpo vacío.' });
        fs.writeFileSync(tmp, req.body);
        const expected = parseFloat(req.query.expected) || 0;
        const r = await analyzeVideoFile(tmp, { dupCheck: true });
        const checks = [];

        const fpsNum = r.metadataFps || parseRate(0);
        checks.push({
            name: '60 fps (metadatos)', pass: fpsNum >= 59.5 && fpsNum <= 60.5,
            detail: fpsNum ? (fpsNum + ' fps') : 'sin stream de video'
        });
        checks.push({
            name: 'CFR (cadencia uniforme)', pass: !r.isVfr && !r.nonMonotonic,
            detail: r.isVfr ? 'deltas irregulares (CV=' + r.deltaCv.toFixed(3) + ')' : (r.nonMonotonic ? 'PTS no monótonos' : 'deltas uniformes')
        });
        if (expected > 0) {
            const diff = Math.abs((r.duration || 0) - expected);
            checks.push({ name: 'Duración', pass: diff <= 0.25, detail: r.duration.toFixed(3) + ' s (esperado ' + expected.toFixed(3) + ' s)' });
        }
        const dupWarn = r.dupRatio > 0.25;
        checks.push({
            name: 'Sin frames duplicados inesperados', pass: !dupWarn,
            detail: r.dupFrames + ' dups (' + (r.dupRatio * 100).toFixed(1) + '%)' + (dupWarn ? '' : ' — dentro de lo esperado (holds/freezes)')
        });
        if (r.hasAudio) {
            const avDrift = Math.abs(r.audioStart - r.videoStart);
            checks.push({ name: 'Sync A/V', pass: avDrift <= 0.1, detail: 'desfase inicial ' + avDrift.toFixed(3) + ' s' });
        }

        const pass = checks.every(c => c.pass);
        res.json({ ok: true, pass, checks, summary: r });
    } catch (err) {
        console.error('[validate] Error:', err.message || err);
        res.status(500).json({ error: 'No se pudo validar: ' + (err.message || 'error desconocido') });
    } finally {
        fs.unlink(tmp, () => {});
    }
});

app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('  Video Ranking Editor listo en:');
    console.log('  → http://localhost:' + PORT);
    console.log('═══════════════════════════════════════════════════');
});
