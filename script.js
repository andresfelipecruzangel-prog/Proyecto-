// ═══════════════════════════════════════════════════════════
// ████  CONSTANTS & GLOBAL STATE  ████
// ═══════════════════════════════════════════════════════════
const EXPORT_W = 1080;
const EXPORT_H = 1920;
const PREVIEW_W = 405;
const PREVIEW_H = 720;
const SCALE = PREVIEW_W / EXPORT_W;
const FPS = 60; // Cadencia de exportación: igual que la preview (dibuja en cada rAF)

// ═══════════════════════════════════════════════════════════
// ████  FUENTES ADICIONALES  ████
// ═══════════════════════════════════════════════════════════
const EXTRA_FONT_GROUPS = [
    { label: 'Popular & General Purpose', fonts: [
        { v: "'Lemon Milk'",  t: 'Lemon Milk' },
        { v: 'Bangers',        t: 'Bangers' },
        { v: "'Komika Axis'", t: 'Komika Axis' },
        { v: "'Integral CF'", t: 'Integral CF' },
        { v: "'Fast Hand'",  t: 'Fast Hand' },
        { v: 'Chopstick',     t: 'Chopstick' },
        { v: 'Cartoonist',    t: 'Cartoonist' },
        { v: 'Bouncy',        t: 'Bouncy' }
    ]},
    { label: 'Standard & Utility', fonts: [
        { v: "'American Captain'",      t: 'American Captain' },
        { v: 'Freshman',                t: 'Freshman' },
        { v: "'Bebas Neue'",            t: 'Bebas Neue' },
        { v: 'Heavitas',                t: 'Heavitas' },
        { v: "'Doctor G'",              t: 'Doctor G' },
        { v: 'Adelia',                  t: 'Adelia' },
        { v: "'Night Machine'",         t: 'Night Machine' },
        { v: "'28 Days Later'",         t: '28 Days Later' },
        { v: 'Amston',                  t: 'Amston' },
        { v: "'Avenir Next'",          t: 'Avenir Next' },
        { v: 'Malvie',                  t: 'Malvie' },
        { v: 'Hunters',                 t: 'Hunters' },
        { v: "'Billion Dreams'",       t: 'Billion Dreams' },
        { v: "'Beyond The Mountains'", t: 'Beyond The Mountains' },
        { v: 'Coolvetica',              t: 'Coolvetica' },
        { v: 'Metropolis',              t: 'Metropolis' },
        { v: 'Okta',                    t: 'Okta' },
        { v: 'Rubik',                   t: 'Rubik' },
        { v: "'Work Sans'",            t: 'Work Sans' },
        { v: 'Philosopher',             t: 'Philosopher' },
        { v: 'Prata',                   t: 'Prata' },
        { v: 'Vogue',                   t: 'Vogue' }
    ]}
];

// Lista plana valor→texto para selects dinámicos (VO, freeze, título por línea)
const EXTRA_FONTS_FLAT = EXTRA_FONT_GROUPS.flatMap(g => g.fonts);

function appendExtraFonts(sel, currentValue) {
    if (!sel) return;
    if (sel.dataset.extraFonts === '1') {
        if (currentValue) try { sel.value = currentValue; } catch(e) {}
        return;
    }
    sel.dataset.extraFonts = '1';
    EXTRA_FONT_GROUPS.forEach(g => {
        const og = document.createElement('optgroup');
        og.label = g.label;
        g.fonts.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.v; opt.textContent = f.t;
            og.appendChild(opt);
        });
        sel.appendChild(og);
    });
    if (currentValue) try { sel.value = currentValue; } catch(e) {}
}

// Poblar los selects estáticos del HTML con las nuevas fuentes (antes de syncUIFromState)
['titleFont','introCapFont','numFont','numTextFont','scrHeadlineFont','scrEqFont','outroCapFont'].forEach(id => {
    appendExtraFonts(document.getElementById(id));
});

// Reúne las familias de fuente realmente usadas en el proyecto y espera a que carguen
async function preloadUsedFonts() {
    try {
        const used = new Set();
        const push = (f) => { if (f && typeof f === 'string') used.add(f); };
        push(state.title.font);
        (state.title.lineFonts || []).forEach(push);
        push(state.numbers.font);
        push(state.numbers.textFont);
        push(state.intro && state.intro.captionFont);
        push(state.outro && state.outro.captionFont);
        if (state.screenTexts) {
            push(state.screenTexts.headline && state.screenTexts.headline.font);
            push(state.screenTexts.endQuestion && state.screenTexts.endQuestion.font);
        }
        state.clips.forEach(c => {
            if (c.vo && c.vo.capFont) push(c.vo.capFont);
            (c.freezes || []).forEach(ff => push(ff.font));
        });
        // Solo cargar las que estén registradas como @font-face / Google (evita descargar las no usadas)
        const known = EXTRA_FONTS_FLAT.map(f => f.v);
        await Promise.all([...used].filter(f => known.includes(f)).map(f =>
            document.fonts.load(`16px ${f}`)
        ));
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch(e) { console.warn('preloadUsedFonts', e); }
}


// Polyfill: roundRect for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = [r, r, r, r];
        this.moveTo(x + r[0], y);
        this.lineTo(x + w - r[1], y);
        this.quadraticCurveTo(x + w, y, x + w, y + r[1]);
        this.lineTo(x + w, y + h - r[2]);
        this.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
        this.lineTo(x + r[3], y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r[3]);
        this.lineTo(x, y + r[0]);
        this.quadraticCurveTo(x, y, x + r[0], y);
    };
}

// Lista base de malas palabras en inglés (editable desde la UI; separadas por comas)
const DEFAULT_CENSOR_WORDS = [
    'ass', 'asshole', 'arse', 'arsehole', 'bastard', 'bitch', 'bollocks', 'bugger',
    'bullshit', 'cock', 'crap', 'cunt', 'damn', 'damned', 'dick', 'dickhead',
    'douche', 'douchebag', 'dumbass', 'fag', 'faggot', 'fuck', 'fucked', 'fucker',
    'fuckin', 'fucking', 'goddamn', 'goddamned', 'jackass', 'motherfucker',
    'motherfucking', 'nigga', 'nigger', 'piss', 'pissed', 'prick', 'pussy',
    'shit', 'shits', 'shitty', 'slut', 'twat', 'wanker', 'whore'
];

let state = {
    title: {
        lines: ['Top 5 [Mejores](#FFD700)', 'Teléfonos [2024](#FFD700)'],
        font: "'Segoe UI', Arial, sans-serif",
        textColor: '#FFFFFF',
        fontSize: 64
    },
    clips: [],
    numbers: {
        font: "'Segoe UI', Arial, sans-serif",
        fontSize: 44,
        showCircle: true,
        color: '#FFD700',
        showOutline: false,
        outlineIntensity: 50,
        textSize: 22,
        textFont: "'Segoe UI', Arial, sans-serif",
        showTextOutline: false,
        textOutlineIntensity: 50
    },
    captionStyle: { color: '#FFFFFF', fontSize: 36, bgColor: '#000000', bgOpacity: 0.6 },
    barTop: { color: '#FFD700', height: 0, style: 'solid', blur: 20, overlay: 40 },
    barBottom: { color: '#FFD700', height: 14, style: 'solid', blur: 20, overlay: 40 },
    layout: {
        titlePos: [
            { x: 540, y: 150 },
            { x: 540, y: 240 }
        ],
        numberPos: { x: 82, y: 960 }
    },
    intro: {
        enabled: false,
        duration: 5,
        blurAmount: 20,
        overlayOpacity: 0.4,
        bgClipId: null,
        bgMuted: true,
        audioUrl: '',
        captions: [],
        captionsEnabled: true,
        captionFont: "'Segoe UI', sans-serif",
        captionColor: '#FFFFFF',
        captionFontSize: 36,
        captionPos: { x: 0.5, y: 0.85 },
        captionBgEnabled: true,
        captionLanguage: 'english',
        captionShowOutline: false,
        captionOutlineIntensity: 50
    },
    audioTracks: [],
    freezeIdCounter: 0,
    voiceoversEnabled: true,
    soundDesign: {
        bassHit:       { enabled: false, volume: 0.8, fileName: '' },
        transitionSfx: { enabled: false, volume: 0.8, fileName: '' },
        stingReveal:   { enabled: false, volume: 0.9, fileName: '' }
    },
    screenTexts: {
        headline: {
            enabled: false, text: '', durationSec: 3,
            font: "'Segoe UI', Arial, sans-serif", color: '#FFFFFF', fontSize: 80,
            showOutline: true, outlineIntensity: 40,
            pos: { x: 0.5, y: 0.18 }
        },
        endQuestion: {
            enabled: false, text: '', lastSecs: 4,
            font: "'Segoe UI', Arial, sans-serif", color: '#FFFFFF', fontSize: 60,
            showOutline: true, outlineIntensity: 40,
            pos: { x: 0.5, y: 0.30 }
        }
    },
    outro: {
        enabled: false,
        durationSec: 5,
        ctaText: '¡Suscríbete para más tops!',
        bgColor: '#101018',
        textColor: '#FFFFFF',
        fontSize: 72,
        pos: { x: 0.5, y: 0.45 },
        bgClipId: '',
        bgBlur: 20,
        bgOverlay: 40,
        voiceFileName: '',
        captions: [],
        captionsEnabled: true,
        captionFont: "'Segoe UI', sans-serif",
        captionColor: '#FFFFFF',
        captionFontSize: 36,
        captionPos: { x: 0.5, y: 0.78 },
        captionLanguage: 'spanish'
    },
    shortsOverlay: {
        enabled: false,
        opacity: 0.5,
        visible: true
    },
    censor: {
        enabled: false,
        bleepFileName: '',
        bleepVolume: 0.9,
        words: DEFAULT_CENSOR_WORDS.slice()
    },
    timelineScaleDuration: 0
};

let currentClipIndex = 0;
let isPlaying = false;
let isExporting = false;
let isPreparingClip = false;
let clipIdCounter = 0;
let audioTrackIdCounter = 0;
let blurBarIdCounter = 0;
let freezeIdCounter = 0;
let isInIntro = false;
let introStartTime = 0;
let introAudioEl = null;

// ─── Style engine runtime ───
let isInOutro = false;
let outroStartTime = 0;
let outroVoiceEl = null;
let sfxEls = {};              // kind -> Audio element ('bass' | 'transition' | 'sting')
let bleepEl = null;           // Audio del beep de censura (archivo importado por el usuario)
let bleepActiveKey = null;    // clave de la marca que está sonando ahora (evita re-disparos)
let censorMarkSeq = 0;        // contador para ids de marcas de censura
const sfxKeys = { bass: 'sfx_bass', transition: 'sfx_transition', sting: 'sfx_sting' };
let freezeRuntime = {};       // freezeId -> { startedAt, done }
let sfxFired = { bassIdx: -1, transIdx: -1, stingIdx: -1 };
// Plantilla de posiciones individuales de los números (índice -> {x,y} o null)
// Se guarda en el proyecto y en los presets para que los clips nuevos hereden
// una posición óptima en lugar del centro.
let numberPosTemplate = [];

// Bounding boxes for canvas hit-testing
let titleBBoxes = []; // bounding box por línea de título

// Migración desde proyectos antiguos (line1/line2 + title1Pos/title2Pos) al formato de N líneas
function migrateTitleState() {
    if (!Array.isArray(state.title.lines)) {
        state.title.lines = [state.title.line1 ?? '', state.title.line2 ?? ''];
        delete state.title.line1;
        delete state.title.line2;
    }
    if (!Array.isArray(state.layout.titlePos)) {
        state.layout.titlePos = [];
        if (state.layout.title1Pos) state.layout.titlePos[0] = state.layout.title1Pos;
        if (state.layout.title2Pos) state.layout.titlePos[1] = state.layout.title2Pos;
        delete state.layout.title1Pos;
        delete state.layout.title2Pos;
    }
    ensureTitlePositions();
}
function ensureTitlePositions() {
    while (state.layout.titlePos.length < state.title.lines.length) {
        const last = state.layout.titlePos[state.layout.titlePos.length - 1] || { x: 540, y: 60 };
        state.layout.titlePos.push({ x: last.x, y: last.y + 90 });
    }
    state.layout.titlePos.length = Math.max(state.title.lines.length, 0);
    if (state.layout.titlePos.length === 0) state.layout.titlePos.push({ x: 540, y: 150 });
    if (!Array.isArray(state.title.lineFonts)) state.title.lineFonts = [];
    if (!Array.isArray(state.title.lineSizes)) state.title.lineSizes = [];
    while (state.title.lineFonts.length < state.title.lines.length) state.title.lineFonts.push('');
    while (state.title.lineSizes.length < state.title.lines.length) state.title.lineSizes.push(null);
    state.title.lineFonts.length = state.title.lines.length;
    state.title.lineSizes.length = state.title.lines.length;
}
function getTitlePos(i) {
    ensureTitlePositions();
    return state.layout.titlePos[i] || state.layout.titlePos[0];
}
function getTitleLineFont(i) {
    ensureTitlePositions();
    return state.title.lineFonts[i] || state.title.font;
}
function getTitleLineSize(i) {
    ensureTitlePositions();
    const s = state.title.lineSizes[i];
    return (typeof s === 'number' && s > 0) ? s : state.title.fontSize;
}
function hitTitleIndex(mx, my) {
    for (let i = 0; i < titleBBoxes.length; i++) {
        if (hitTest(mx, my, titleBBoxes[i])) return i;
    }
    return -1;
}
let numberBBox = null;
let numberBBoxes = []; // individual number hit boxes
let introCaptionBBox = null;
let blurBarBBoxes = []; // individual blur bar hit boxes
let headlineBBox = null;
let endQuestionBBox = null;
let outroCaptionBBox = null;
let voCaptionBBox = null;
let clipCaptionsBBox = null;
let freezeTextBBoxes = [];

let dragging = null; // 'title1' | 'title2' | 'number' | 'video' | 'introCaption' | 'blurBar' | 'freezeText_N' | 'headline' | 'endQuestion' | 'outroCaption' | 'voCaption' | 'clipCaption' | null
let dragOffset = { x: 0, y: 0 };
let dragStartPan = { x: 0, y: 0 };

// Canvas references
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const clipsList = document.getElementById('clipsList');
const videoContainer = document.getElementById('videoContainer');

// Timeline Pro references
const tlScroll = document.getElementById('tlScroll');
const tlInner = document.getElementById('tlInner');
const tlRulerCanvas = document.getElementById('tlRuler');
const tlPlayheadEl = document.getElementById('tlPlayhead');
const trackVideoEl = document.getElementById('trackVideo');
const trackAudioEl = document.getElementById('trackAudio');
const trackFxEl = document.getElementById('trackFx');
let tlPxPerSec = 24;                 // zoom: píxeles por segundo
let tlSelection = null;              // {type:'clip'|'audio'|'vo', id}
let isDraggingTimeline = false;      // arrastrando playhead
let activeTrimDrag = null;           // recorte en curso
let tlDrag = null;                   // arrastre unificado de bloques

// ═══════════════════════════════════════════════════════════
// ████  PERSISTENCE (IndexedDB)  ████
// ═══════════════════════════════════════════════════════════
const DB_NAME = 'VideoRankingEditorDB';
const DB_VERSION = 1;
const STORE_STATE = 'state';
const STORE_VIDEOS = 'videos';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
            if (!db.objectStoreNames.contains(STORE_VIDEOS)) db.createObjectStore(STORE_VIDEOS);
        };
    });
}

async function putItem(storeName, key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function getItem(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function deleteItem(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function clearStore(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function getAllKeys(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAllKeys();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveProject() {
    if (isExporting) return;
    try {
        // Save serializable state (without file blobs and video elements)
        const stateToSave = {
            title: state.title,
            numbers: state.numbers,
            captionStyle: state.captionStyle,
            barTop: state.barTop,
            barBottom: state.barBottom,
            layout: state.layout,
            shortsOverlay: state.shortsOverlay,
            censor: (function(c){ const x = { ...c }; delete x._file; return x; })(state.censor),
            timelineScaleDuration: state.timelineScaleDuration,
            currentClipIndex,
            clipIdCounter,
            audioTrackIdCounter,
            blurBarIdCounter,
            intro: {
                enabled: state.intro.enabled,
                duration: state.intro.duration,
                blurAmount: state.intro.blurAmount,
                overlayOpacity: state.intro.overlayOpacity,
                bgClipId: state.intro.bgClipId,
                bgMuted: state.intro.bgMuted !== false,
                audioUrl: state.intro.audioUrl,
                captions: state.intro.captions,
                captionsEnabled: state.intro.captionsEnabled,
                captionFont: state.intro.captionFont,
                captionColor: state.intro.captionColor,
                captionFontSize: state.intro.captionFontSize,
                captionPos: state.intro.captionPos,
                captionBgEnabled: state.intro.captionBgEnabled,
                captionLanguage: state.intro.captionLanguage,
                captionShowOutline: state.intro.captionShowOutline,
                captionOutlineIntensity: state.intro.captionOutlineIntensity
            },
            clips: state.clips.map(c => ({
                id: c.id,
                trimStart: c.trimStart,
                trimEnd: c.trimEnd,
                duration: c.duration,
                percentage: c.percentage,
                captions: c.captions,
                captionsEnabled: c.captionsEnabled,
                numberText: c.numberText,
                numberColor: c.numberColor,
                numberVisible: c.numberVisible !== false,
                rankingPosition: c.rankingPosition,
                numberPos: c.numberPos,
                timelineStart: c.timelineStart,
                panX: c.panX,
                panY: c.panY,
                volume: c.volume,
                blurBars: c.blurBars || [],
                freezes: c.freezes || [],
                censorMarks: c.censorMarks || [],
                captionPos: c.captionPos || null,
                vo: c.vo ? {
                    enabled: c.vo.enabled,
                    text: c.vo.text,
                    offset: c.vo.offset,
                    fileName: c.vo.fileName,
                    captions: c.vo.captions || [],
                    capPos: c.vo.capPos,
                    capFont: c.vo.capFont,
                    capSize: c.vo.capSize,
                    capColor: c.vo.capColor,
                    capBgEnabled: c.vo.capBgEnabled,
                    capOutlineEnabled: c.vo.capOutlineEnabled,
                    capOutlineColor: c.vo.capOutlineColor,
                    capOutlineIntensity: c.vo.capOutlineIntensity,
                    capWords: c.vo.capWords,
                    censorMarks: c.vo.censorMarks || [],
                    hasAudio: !!c.vo._file
                } : null,
                fileName: c.file ? c.file.name : '',
                fileType: c.file ? c.file.type : '',
                hasVideo: !!c.file
            })),
            audioTracks: state.audioTracks.map(t => ({
                id: t.id,
                name: t.name,
                duration: t.duration,
                timelineStart: t.timelineStart,
                trimStart: t.trimStart,
                trimEnd: t.trimEnd,
                volume: t.volume
            })),
            audioTrackIdCounter,
            freezeIdCounter,
            numberPositionsTemplate: JSON.parse(JSON.stringify(numberPosTemplate)),
            voiceoversEnabled: state.voiceoversEnabled,
            soundDesign: {
                bassHit: (function(c){ const x = { ...c }; delete x._file; return x; })(state.soundDesign.bassHit),
                transitionSfx: (function(c){ const x = { ...c }; delete x._file; return x; })(state.soundDesign.transitionSfx),
                stingReveal: (function(c){ const x = { ...c }; delete x._file; return x; })(state.soundDesign.stingReveal)
            },
            screenTexts: {
                headline: JSON.parse(JSON.stringify(state.screenTexts.headline)),
                endQuestion: JSON.parse(JSON.stringify(state.screenTexts.endQuestion))
            },
            outro: (function(o){ const c = JSON.parse(JSON.stringify(o)); delete c._voiceFile; return c; })(state.outro),
        };
        await putItem(STORE_STATE, 'project', stateToSave);

        // Save each video file as ArrayBuffer
        for (const clip of state.clips) {
            if (clip.file) {
                const buffer = await clip.file.arrayBuffer();
                await putItem(STORE_VIDEOS, clip.id, { name: clip.file.name, type: clip.file.type, buffer });
            }
        }

        // Save intro audio file
        if (state.intro._audioFile) {
            const buffer = await state.intro._audioFile.arrayBuffer();
            await putItem(STORE_VIDEOS, 'intro_audio', { name: state.intro._audioFile.name, type: state.intro._audioFile.type, buffer });
        }

        // Save audio track files
        for (const track of state.audioTracks) {
            if (track.file) {
                const buffer = await track.file.arrayBuffer();
                await putItem(STORE_VIDEOS, track.id, { name: track.file.name, type: track.file.type, buffer });
            }
        }

        // Save sound design SFX files
        for (const kind of Object.keys(sfxKeys)) {
            const cfg = state.soundDesign[kind === 'bass' ? 'bassHit' : kind === 'transition' ? 'transitionSfx' : 'stingReveal'];
            if (cfg._file) {
                const buffer = await cfg._file.arrayBuffer();
                await putItem(STORE_VIDEOS, sfxKeys[kind], { name: cfg._file.name, type: cfg._file.type, buffer });
            }
        }

        // Save censor bleep file
        if (state.censor._file) {
            const buffer = await state.censor._file.arrayBuffer();
            await putItem(STORE_VIDEOS, 'censor_bleep', { name: state.censor._file.name, type: state.censor._file.type, buffer });
        }

        // Save outro voice file
        if (state.outro._voiceFile) {
            const buffer = await state.outro._voiceFile.arrayBuffer();
            await putItem(STORE_VIDEOS, 'outro_voice', { name: state.outro._voiceFile.name, type: state.outro._voiceFile.type, buffer });
        }

        // Save per-clip voiceover audio files
        for (const clip of state.clips) {
            if (clip.vo && clip.vo._file) {
                const buffer = await clip.vo._file.arrayBuffer();
                await putItem(STORE_VIDEOS, 'vo_' + clip.id, { name: clip.vo._file.name, type: clip.vo._file.type, buffer });
            }
        }
        console.log('Proyecto guardado');
    } catch (e) {
        console.error('Error guardando proyecto:', e);
    }
}

async function loadProject() {
    try {
        const saved = await getItem(STORE_STATE, 'project');
        if (!saved) return false;

        // Restore state
        state.title = saved.title || state.title;
        state.numbers = saved.numbers || state.numbers;
        state.captionStyle = saved.captionStyle || state.captionStyle;
        state.barTop = Object.assign({ color: '#FFD700', height: 0, style: 'solid', blur: 20, overlay: 40 }, saved.barTop || {});
        state.barBottom = Object.assign({ color: '#FFD700', height: 14, style: 'solid', blur: 20, overlay: 40 }, saved.barBottom || {});
        blurBarIdCounter = saved.blurBarIdCounter || 0;
        state.layout = saved.layout || state.layout;
        state.shortsOverlay = Object.assign({ enabled:false, opacity:0.5, visible:true }, saved.shortsOverlay || {});
        state.censor = Object.assign({
            enabled: false, bleepFileName: '', bleepVolume: 0.9,
            words: DEFAULT_CENSOR_WORDS.slice()
        }, saved.censor || {});
        state.censor._file = null;
        if (saved.intro) {
            state.intro.enabled = saved.intro.enabled ?? false;
            state.intro.duration = saved.intro.duration ?? 5;
            state.intro.blurAmount = saved.intro.blurAmount ?? 20;
            state.intro.overlayOpacity = saved.intro.overlayOpacity ?? 0.4;
            state.intro.bgClipId = saved.intro.bgClipId || null;
            state.intro.bgMuted = saved.intro.bgMuted !== false;
            state.intro.audioUrl = saved.intro.audioUrl || '';
            state.intro.captions = saved.intro.captions || [];
            state.intro.captionsEnabled = saved.intro.captionsEnabled !== false;
            state.intro.captionFont = saved.intro.captionFont || "'Segoe UI', sans-serif";
            state.intro.captionColor = saved.intro.captionColor || '#FFFFFF';
            state.intro.captionFontSize = saved.intro.captionFontSize ?? 36;
            state.intro.captionPos = saved.intro.captionPos || { x: 0.5, y: 0.85 };
            state.intro.captionBgEnabled = saved.intro.captionBgEnabled !== false;
            state.intro.captionLanguage = saved.intro.captionLanguage || 'english';
            state.intro.captionShowOutline = saved.intro.captionShowOutline === true;
            state.intro.captionOutlineIntensity = saved.intro.captionOutlineIntensity ?? 50;
        }
        state.timelineScaleDuration = saved.timelineScaleDuration || 0;
        currentClipIndex = saved.currentClipIndex || 0;
        clipIdCounter = saved.clipIdCounter || 0;
        audioTrackIdCounter = saved.audioTrackIdCounter || 0;
        freezeIdCounter = saved.freezeIdCounter || state.freezeIdCounter || 0;
        numberPosTemplate = Array.isArray(saved.numberPositionsTemplate) ? saved.numberPositionsTemplate : [];
        state.voiceoversEnabled = saved.voiceoversEnabled !== false;
        if (saved.soundDesign) {
            state.soundDesign.bassHit = Object.assign(state.soundDesign.bassHit, saved.soundDesign.bassHit);
            state.soundDesign.transitionSfx = Object.assign(state.soundDesign.transitionSfx, saved.soundDesign.transitionSfx);
            state.soundDesign.stingReveal = Object.assign(state.soundDesign.stingReveal, saved.soundDesign.stingReveal);
            delete state.soundDesign.bassHit._file; delete state.soundDesign.transitionSfx._file; delete state.soundDesign.stingReveal._file;
        }
        if (saved.screenTexts) {
            state.screenTexts.headline = Object.assign(state.screenTexts.headline, saved.screenTexts.headline);
            state.screenTexts.endQuestion = Object.assign(state.screenTexts.endQuestion, saved.screenTexts.endQuestion);
        }
        if (saved.outro) {
            const voiceFileRef = state.outro._voiceFile;
            state.outro = Object.assign(state.outro, saved.outro);
            state.outro._voiceFile = null;
            state.outro.captions = saved.outro.captions || [];
        }

        // Restore clips and their videos
        state.clips = [];
        for (const savedClip of (saved.clips || [])) {
            const clip = {
                id: savedClip.id,
                file: null,
                videoEl: null,
                url: '',
                trimStart: savedClip.trimStart || 0,
                trimEnd: savedClip.trimEnd || 0,
                duration: savedClip.duration || 0,
                percentage: savedClip.percentage || '',
                captions: savedClip.captions || [],
                captionsEnabled: savedClip.captionsEnabled !== false,
                captionPos: savedClip.captionPos || null,
                numberText: savedClip.numberText || '',
                numberVisible: savedClip.numberVisible !== false,
                numberColor: savedClip.numberColor || '',
                rankingPosition: savedClip.rankingPosition || '',
                numberPos: savedClip.numberPos || null,
                timelineStart: Number.isFinite(savedClip.timelineStart) ? savedClip.timelineStart : null,
                panX: savedClip.panX || 0,
                panY: savedClip.panY || 0,
                volume: savedClip.volume ?? 1.0,
                blurBars: savedClip.blurBars || [],
                freezes: savedClip.freezes || [],
                censorMarks: savedClip.censorMarks || [],
                vo: null
            };

            if (savedClip.vo) {
                clip.vo = {
                    enabled: savedClip.vo.enabled !== false,
                    text: savedClip.vo.text || '',
                    offset: savedClip.vo.offset || 0,
                    fileName: savedClip.vo.fileName || '',
                    captions: savedClip.vo.captions || [],
                    capPos: savedClip.vo.capPos || { x: 0.5, y: 0.62 },
                    capFont: savedClip.vo.capFont || "'Segoe UI', sans-serif",
                    capSize: savedClip.vo.capSize ?? 40,
                    capColor: savedClip.vo.capColor || '#FFFFFF',
                    capBgEnabled: savedClip.vo.capBgEnabled !== false,
                    capOutlineEnabled: savedClip.vo.capOutlineEnabled === true,
                    capOutlineColor: savedClip.vo.capOutlineColor || '#000000',
                    capOutlineIntensity: savedClip.vo.capOutlineIntensity ?? 40,
                    capWords: savedClip.vo.capWords ?? 3,
                    censorMarks: savedClip.vo.censorMarks || [],
                    _file: null,
                    audioEl: null
                };
                if (savedClip.vo.hasAudio) {
                    const savedVo = await getItem(STORE_VIDEOS, 'vo_' + savedClip.id);
                    if (savedVo && savedVo.buffer) {
                        const blob = new Blob([savedVo.buffer], { type: savedVo.type || 'audio/mpeg' });
                        clip.vo._file = new File([blob], savedVo.name || 'vo.mp3', { type: savedVo.type || 'audio/mpeg' });
                        attachVoAudioEl(clip);
                    }
                }
            }

            if (savedClip.hasVideo) {
                const savedVideo = await getItem(STORE_VIDEOS, savedClip.id);
                if (savedVideo && savedVideo.buffer) {
                    const blob = new Blob([savedVideo.buffer], { type: savedVideo.type || 'video/mp4' });
                    clip.file = new File([blob], savedVideo.name || 'video.mp4', { type: savedVideo.type || 'video/mp4' });
                    clip.url = URL.createObjectURL(clip.file);
                    const video = document.createElement('video');
                    video.preload = 'auto'; video.muted = true; video.playsInline = true; video.src = clip.url;
                    videoContainer.appendChild(video);
                    clip.videoEl = video;
                    video.addEventListener('loadedmetadata', () => {
                        clip.duration = isFinite(video.duration) ? video.duration : 0;
                        if (clip.trimEnd === 0 && clip.duration > 0) clip.trimEnd = Math.round(video.duration * 100) / 100;
                        renderClipsList();
                        drawFrame();
                    });
                }
            }
            state.clips.push(clip);
        }

        // Migración: versiones antiguas horneaban '#FFD700' en cada clip, bloqueando el color global.
        // Si TODOS los clips tienen el valor por defecto, limpiarlo para que mande state.numbers.color.
        if (state.clips.length > 0 && state.clips.every(c => c.numberColor === '#FFD700')) {
            state.clips.forEach(c => { c.numberColor = ''; });
        }
        repackTimelineClips();

        // Restore intro audio file
        if (state.intro.audioUrl) {
            const savedAudio = await getItem(STORE_VIDEOS, 'intro_audio');
            if (savedAudio && savedAudio.buffer) {
                const blob = new Blob([savedAudio.buffer], { type: savedAudio.type || 'audio/mpeg' });
                const file = new File([blob], savedAudio.name || 'intro_audio.mp3', { type: savedAudio.type || 'audio/mpeg' });
                state.intro._audioFile = file;
                introAudioEl = new Audio(URL.createObjectURL(file));
                introAudioEl.muted = true;
                introAudioEl.preload = 'auto';
            }
        }

        // Restore audio tracks
        state.audioTracks = [];
        for (const savedTrack of (saved.audioTracks || [])) {
            const track = {
                id: savedTrack.id,
                file: null,
                url: '',
                audioEl: null,
                name: savedTrack.name || 'audio',
                duration: savedTrack.duration || 0,
                timelineStart: savedTrack.timelineStart || 0,
                trimStart: savedTrack.trimStart || 0,
                trimEnd: savedTrack.trimEnd || 0,
                volume: savedTrack.volume ?? 1.0
            };
            const savedAudioFile = await getItem(STORE_VIDEOS, savedTrack.id);
            if (savedAudioFile && savedAudioFile.buffer) {
                const blob = new Blob([savedAudioFile.buffer], { type: savedAudioFile.type || 'audio/mpeg' });
                track.file = new File([blob], savedAudioFile.name || 'audio.mp3', { type: savedAudioFile.type || 'audio/mpeg' });
                track.url = URL.createObjectURL(track.file);
                const audio = new Audio(track.url);
                audio.preload = 'auto';
                audio.muted = true;
                videoContainer.appendChild(audio);
                track.audioEl = audio;
                audio.addEventListener('loadedmetadata', () => {
                    if (track.duration === 0) track.duration = audio.duration;
                    if (track.trimEnd === 0) track.trimEnd = audio.duration;
                    renderAudioTracks();
                });
            }
            state.audioTracks.push(track);
        }

        // Restore SFX files
        for (const kind of Object.keys(sfxKeys)) {
            const cfg = state.soundDesign[kind === 'bass' ? 'bassHit' : kind === 'transition' ? 'transitionSfx' : 'stingReveal'];
            const savedSfx = await getItem(STORE_VIDEOS, sfxKeys[kind]);
            if (savedSfx && savedSfx.buffer) {
                const blob = new Blob([savedSfx.buffer], { type: savedSfx.type || 'audio/mpeg' });
                cfg._file = new File([blob], savedSfx.name || kind + '.mp3', { type: savedSfx.type || 'audio/mpeg' });
                attachSfxEl(kind);
            }
        }

        // Restore censor bleep file
        if (state.censor.bleepFileName) {
            const savedBleep = await getItem(STORE_VIDEOS, 'censor_bleep');
            if (savedBleep && savedBleep.buffer) {
                const blob = new Blob([savedBleep.buffer], { type: savedBleep.type || 'audio/mpeg' });
                state.censor._file = new File([blob], savedBleep.name || 'bleep.mp3', { type: savedBleep.type || 'audio/mpeg' });
                attachBleepEl();
            }
        }

        // Restore clip thumbnails
        for (const clip of state.clips) {
            try {
                const savedThumbs = await getItem(STORE_VIDEOS, 'thumbs_' + clip.id);
                if (savedThumbs && savedThumbs.img) clip.thumbs = [savedThumbs.img];
            } catch (err) {}
        }

        // Restore outro voice
        if (state.outro.voiceFileName) {
            const savedOutroVoice = await getItem(STORE_VIDEOS, 'outro_voice');
            if (savedOutroVoice && savedOutroVoice.buffer) {
                const blob = new Blob([savedOutroVoice.buffer], { type: savedOutroVoice.type || 'audio/mpeg' });
                state.outro._voiceFile = new File([blob], savedOutroVoice.name || 'outro_voice.mp3', { type: savedOutroVoice.type || 'audio/mpeg' });
                attachOutroVoiceEl();
            }
        }
        return true;
    } catch (e) {
        console.error('Error cargando proyecto:', e);
        return false;
    }
}

async function clearProject() {
    try {
        // Solo borra el proyecto actual; los presets se conservan siempre
        // (solo se eliminan si el usuario los borra uno a uno desde su sección)
        await deleteItem(STORE_STATE, 'project');
        await clearStore(STORE_VIDEOS);
        location.reload();
    } catch (e) {
        console.error('Error borrando proyecto:', e);
    }
}

let autoSaveTimeout = null;
function scheduleAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(saveProject, 1500);
}

// ████ PRESETS ████

const PRESET_PREFIX = 'preset:';

async function savePreset(name) {
    if (!name || !name.trim()) return;
    name = name.trim();
    try {
        const presetData = {
            title: state.title,
            numbers: state.numbers,
            captionStyle: state.captionStyle,
            barTop: state.barTop,
            barBottom: state.barBottom,
            blurBars: (state.clips[currentClipIndex] && state.clips[currentClipIndex].blurBars) ? JSON.parse(JSON.stringify(state.clips[currentClipIndex].blurBars)) : [],
            layout: state.layout,
            intro: {
                enabled: state.intro.enabled,
                duration: state.intro.duration,
                blurAmount: state.intro.blurAmount,
                overlayOpacity: state.intro.overlayOpacity,
                captions: state.intro.captions,
                captionsEnabled: state.intro.captionsEnabled,
                captionFont: state.intro.captionFont,
                captionColor: state.intro.captionColor,
                captionFontSize: state.intro.captionFontSize,
                captionPos: state.intro.captionPos,
                captionBgEnabled: state.intro.captionBgEnabled,
                captionLanguage: state.intro.captionLanguage,
                captionShowOutline: state.intro.captionShowOutline,
                captionOutlineIntensity: state.intro.captionOutlineIntensity
            },
            voiceoversEnabled: state.voiceoversEnabled,
            numberPositions: state.clips.map(c => c.numberPos ? { x: c.numberPos.x, y: c.numberPos.y } : null),
            screenTexts: JSON.parse(JSON.stringify(state.screenTexts)),
            outro: (function(o){ const c = JSON.parse(JSON.stringify(o)); delete c._voiceFile; c.voiceFileName=''; return c; })(state.outro),
            savedAt: Date.now()
        };
        await putItem(STORE_STATE, PRESET_PREFIX + name, presetData);
        renderPresetsList();
        console.log('Preset guardado:', name);
    } catch (e) {
        console.error('Error guardando preset:', e);
    }
}

function savePresetFromInput() {
    const input = document.getElementById('presetNameInput');
    if (!input) return;
    const name = input.value;
    if (!name || !name.trim()) return;
    savePreset(name);
    input.value = '';
}

async function loadPreset(name) {
    try {
        const preset = await getItem(STORE_STATE, PRESET_PREFIX + name);
        if (!preset) return;

        state.title = preset.title || state.title;
        state.numbers = preset.numbers || state.numbers;
        state.captionStyle = preset.captionStyle || state.captionStyle;
        state.barTop = Object.assign({ color: '#FFD700', height: 0, style: 'solid', blur: 20, overlay: 40 }, preset.barTop || {});
        state.barBottom = Object.assign({ color: '#FFD700', height: 14, style: 'solid', blur: 20, overlay: 40 }, preset.barBottom || {});
        // Apply preset blur bars to the currently selected clip (deep copy + new IDs)
        if (preset.blurBars && state.clips[currentClipIndex]) {
            const clip = state.clips[currentClipIndex];
            if (!clip.blurBars) clip.blurBars = [];
            clip.blurBars = preset.blurBars.map(b => ({ ...b, id: blurBarIdCounter++ }));
        }
        state.layout = preset.layout || state.layout;
        if (preset.intro) {
            state.intro.enabled = preset.intro.enabled ?? false;
            state.intro.duration = preset.intro.duration ?? 5;
            state.intro.blurAmount = preset.intro.blurAmount ?? 20;
            state.intro.overlayOpacity = preset.intro.overlayOpacity ?? 0.4;
            state.intro.captions = preset.intro.captions || [];
            state.intro.captionsEnabled = preset.intro.captionsEnabled !== false;
            state.intro.captionFont = preset.intro.captionFont || "'Segoe UI', sans-serif";
            state.intro.captionColor = preset.intro.captionColor || '#FFFFFF';
            state.intro.captionFontSize = preset.intro.captionFontSize ?? 36;
            state.intro.captionPos = preset.intro.captionPos || { x: 0.5, y: 0.85 };
            state.intro.captionBgEnabled = preset.intro.captionBgEnabled !== false;
            state.intro.captionLanguage = preset.intro.captionLanguage || 'english';
            state.intro.captionShowOutline = preset.intro.captionShowOutline === true;
            state.intro.captionOutlineIntensity = preset.intro.captionOutlineIntensity ?? 50;
        }
        state.voiceoversEnabled = preset.voiceoversEnabled !== false;
        if (Array.isArray(preset.numberPositions)) {
            // Guarda la plantilla para clips futuros y aplícala a los clips actuales
            numberPosTemplate = preset.numberPositions.map(p => p ? { x: p.x, y: p.y } : null);
            state.clips.forEach((clip, i) => {
                if (numberPosTemplate[i]) clip.numberPos = { ...numberPosTemplate[i] };
            });
        }
        if (preset.screenTexts) {
            state.screenTexts.headline = Object.assign(state.screenTexts.headline, preset.screenTexts.headline);
            state.screenTexts.endQuestion = Object.assign(state.screenTexts.endQuestion, preset.screenTexts.endQuestion);
        }
        if (preset.outro) {
            const restoredVoice = state.outro._voiceFile;
            const restoredEl = outroVoiceEl;
            state.outro = Object.assign(state.outro, preset.outro);
            state.outro._voiceFile = null;
            outroVoiceEl = null;
            if (restoredEl && state.outro.voiceFileName) { state.outro._voiceFile = restoredVoice; outroVoiceEl = restoredEl; }
        }

        syncUIFromState();
        drawFrame();
        console.log('Preset cargado:', name);
    } catch (e) {
        console.error('Error cargando preset:', e);
    }
}

async function deletePreset(name) {
    try {
        await deleteItem(STORE_STATE, PRESET_PREFIX + name);
        renderPresetsList();
        console.log('Preset eliminado:', name);
    } catch (e) {
        console.error('Error eliminando preset:', e);
    }
}

async function renderPresetsList() {
    const container = document.getElementById('presetsList');
    if (!container) return;
    try {
        const keys = await getAllKeys(STORE_STATE);
        const presetKeys = keys.filter(k => typeof k === 'string' && k.startsWith(PRESET_PREFIX));
        if (presetKeys.length === 0) {
            container.innerHTML = '<p class="hint" style="margin:0;color:#6a6a8a">No hay presets guardados.</p>';
            return;
        }
        const items = presetKeys.map(key => {
            const name = key.substring(PRESET_PREFIX.length);
            const safeName = name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            return '<div class="preset-item">' +
                '<span class="preset-name" title="' + safeName + '">' + escapeHtml(name) + '</span>' +
                '<button class="btn btn-sm btn-primary" onclick="loadPreset(\'' + safeName + '\')" title="Cargar preset">Cargar</button>' +
                '<button class="btn btn-sm btn-danger" onclick="deletePreset(\'' + safeName + '\')" title="Eliminar preset">🗑</button>' +
            '</div>';
        });
        container.innerHTML = items.join('');
    } catch (e) {
        console.error('Error listando presets:', e);
    }
}

// ═══════════════════════════════════════════════════════════
// ████  UTILITIES  ████
// ═══════════════════════════════════════════════════════════
function generateId() { return 'clip_' + (++clipIdCounter) + '_' + Date.now(); }

function parseColorText(text) {
    const segments = [];
    let lastIdx = 0;

    // Quick alternative parser to avoid regex escapes issues in the tool
    let currentIdx = 0;
    while (true) {
        let startBracket = text.indexOf('[', currentIdx);
        if (startBracket === -1) break;
        let endBracket = text.indexOf(']', startBracket);
        if (endBracket === -1) break;
        let startParen = text.indexOf('(', endBracket);
        if (startParen !== endBracket + 1) { currentIdx = startBracket + 1; continue; }
        let endParen = text.indexOf(')', startParen);
        if (endParen === -1) break;

        // found a match
        if (startBracket > lastIdx) {
            segments.push({ text: text.substring(lastIdx, startBracket), color: null });
        }
        segments.push({
            text: text.substring(startBracket + 1, endBracket),
            color: text.substring(startParen + 1, endParen)
        });
        lastIdx = endParen + 1;
        currentIdx = lastIdx;
    }

    if(lastIdx < text.length) {
        segments.push({ text: text.substring(lastIdx), color: null });
    }
    return segments.length > 0 ? segments : [{ text: text, color: null }];
}

function formatTime(s) {
    if (!isFinite(s) || isNaN(s)) s = 0;
    const m = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function hexToRgba(hex, alpha) {
    if(hex.length === 4) { hex = '#' + hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]; }
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
}

// ═══════════════════════════════════════════════════════════
// ████  CANVAS RENDERING  ████
// ═══════════════════════════════════════════════════════════
// Rect del video dibujado en el preview (unidades del canvas de preview).
// Sirve para marcar los bordes de la imagen y ver qué zona del 9:16
// queda como franja negra al mover el clip.
function getVideoDrawRect(clip) {
    const v = clip && clip.videoEl;
    if (!v || !v.videoWidth || !v.videoHeight) return null;
    const videoRatio = v.videoWidth / v.videoHeight;
    const targetRatio = PREVIEW_W / PREVIEW_H;
    let sw, sh;
    if (videoRatio > targetRatio) { sh = PREVIEW_H; sw = PREVIEW_H * videoRatio; }
    else { sw = PREVIEW_W; sh = PREVIEW_W / videoRatio; }
    const panX = (clip.panX || 0) * SCALE;
    const panY = (clip.panY || 0) * SCALE;
    return {
        x: (PREVIEW_W - sw) / 2 + panX,
        y: (PREVIEW_H - sh) / 2 + panY,
        w: sw, h: sh
    };
}

function drawVideoCover(c, clip, dx, dy, dw, dh, s) {
    if (!clip || !clip.videoEl || clip.videoEl.readyState < 2) return;
    const video = clip.videoEl;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;

    c.save();
    c.beginPath();
    c.rect(dx, dy, dw, dh);
    c.clip();

    const videoRatio = vw / vh;
    const targetRatio = dw / dh;
    let sw = dw, sh = dh;

    if (videoRatio > targetRatio) {
        sh = dh;
        sw = dh * videoRatio;
    } else {
        sw = dw;
        sh = dw / videoRatio;
    }

    const panX = (clip.panX || 0) * s;
    const panY = (clip.panY || 0) * s;
    let x = dx + (dw - sw) / 2 + panX;
    let y = dy + (dh - sh) / 2 + panY;

    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(video, x, y, sw, sh);
    c.restore();
}

// Ajuste "contain": muestra el video COMPLETO sin recortar nada.
// Si el ratio del video no es exactamente 9:16, deja bandas negras en el lado sobrante.
// Devuelve true si dibujó el video (false si el clip aún no tiene frame disponible).
function drawVideoContain(c, clip, dx, dy, dw, dh, s) {
    if (!clip || !clip.videoEl || clip.videoEl.readyState < 2) return false;
    const video = clip.videoEl;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return false;

    c.save();
    c.beginPath();
    c.rect(dx, dy, dw, dh);
    c.clip();

    const videoRatio = vw / vh;
    const targetRatio = dw / dh;
    let sw = dw, sh = dh;

    if (videoRatio > targetRatio) {
        sh = dh;
        sw = dh * videoRatio;
    } else {
        sw = dw;
        sh = dw / videoRatio;
    }

    const panX = (clip.panX || 0) * s;
    const panY = (clip.panY || 0) * s;
    const x = dx + (dw - sw) / 2 + panX;
    const y = dy + (dh - sh) / 2 + panY;

    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(video, x, y, sw, sh);
    c.restore();
    return true;
}

// ─── Retención de frame para transiciones del export ───
// Copia el frame actual del canvas de export: si el siguiente clip tarda en
// estar listo, se muestra este en su lugar (en vez de congelar el timeline
// mientras el audio sigue avanzando → desincronización percibida).
let exportHoldCanvas = null;
function captureExportHold() {
    if (!exportCanvas) return;
    if (!exportHoldCanvas) exportHoldCanvas = document.createElement('canvas');
    if (exportHoldCanvas.width !== exportCanvas.width || exportHoldCanvas.height !== exportCanvas.height) {
        exportHoldCanvas.width = exportCanvas.width;
        exportHoldCanvas.height = exportCanvas.height;
    }
    exportHoldCanvas.getContext('2d').drawImage(exportCanvas, 0, 0);
}

function drawTitleLine(c, text, pos, font, fs, defaultColor, s) {
    if(!text.trim()) return null;
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${fs}px ${font}`;

    const segments = parseColorText(text);
    let totalW = 0;
    segments.forEach(seg => { totalW += c.measureText(seg.text).width; });

    let cx = pos.x * s;
    let cy = pos.y * s;
    let drawX = cx - totalW / 2;

    segments.forEach(seg => {
        c.fillStyle = seg.color || defaultColor;
        c.shadowColor = 'rgba(0,0,0,0.8)';
        c.shadowBlur = 8 * s;
        c.shadowOffsetY = 2 * s;
        const w = c.measureText(seg.text).width;
        c.fillText(seg.text, drawX + w/2, cy);
        drawX += w;
    });
    c.restore();

    const pad = 15;
    return { x: cx - totalW / 2 - pad, y: cy - fs/2 - pad, w: totalW + pad*2, h: fs + pad*2 };
}

function drawNumbers(c, s) {
    const total = state.clips.length;
    if (total === 0) return null;

    const n = state.numbers;
    const fs = n.fontSize * s;
    const baseCx = state.layout.numberPos.x * s;
    const baseCy = state.layout.numberPos.y * s;

    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    const spacing = fs * 1.6;
    const totalH = total * spacing;
    const startY = baseCy - totalH / 2 + spacing / 2;
    const circleR = fs * 0.6;

    numberBBoxes = [];

    for (let i = 0; i < total; i++) {
        const clip = state.clips[i];
        if (clip.numberVisible === false) continue;
        let cx = baseCx;
        let cy = startY + i * spacing;
        if (clip.numberPos) {
            cx = clip.numberPos.x * s;
            cy = clip.numberPos.y * s;
        }

        const isActive = (i === currentClipIndex);
        const col = clip.numberColor || n.color || '#FFFFFF';
        const activeScale = isActive ? 1.25 : 1;
        const activeCircleR = circleR * activeScale;
        const activeFs = fs * (isActive ? 1.15 : 1);
        const posNumber = (clip.rankingPosition || String(i + 1)) + '.';

        // Draw circle
        if (n.showCircle !== false) {
            c.beginPath();
            c.arc(cx, cy, activeCircleR, 0, Math.PI * 2);
            if (isActive) {
                c.fillStyle = col;
                c.fill();
                c.strokeStyle = '#fff';
                c.lineWidth = 3 * s;
                c.stroke();
            } else {
                c.fillStyle = 'rgba(0,0,0,0.5)';
                c.fill();
                c.strokeStyle = col;
                c.lineWidth = 2 * s;
                c.stroke();
            }
        }

        // Draw position number in circle
        c.font = `bold ${activeFs}px ${n.font}`;
        // Borde visual REAL del número: el glifo ("5.", "1.") tiene ancho distinto al círculo
        const _txtW = c.measureText(posNumber).width;
        const _visLeft = (n.showCircle !== false) ? (cx - activeCircleR) : (cx - _txtW / 2);
        c.shadowColor = 'transparent';
        c.shadowBlur = 0;
        if (n.showOutline) {
            const outlineWidth = (n.outlineIntensity / 100) * activeFs * 0.4;
            c.strokeStyle = '#000';
            c.lineWidth = outlineWidth;
            c.lineJoin = 'round';
            c.strokeText(posNumber, cx, cy + 1 * s);
        }
        c.fillStyle = (isActive && n.showCircle !== false) ? '#000' : col;
        c.shadowColor = 'rgba(0,0,0,0.5)';
        c.shadowBlur = 4 * s;
        c.fillText(posNumber, cx, cy + 1 * s);

        // Draw numberText label (persists once revealed)
        const showLabel = isPlaying ? (i <= currentClipIndex) : true;
        if (showLabel && clip.numberText && clip.numberText !== posNumber) {
            const labelFs = (n.textSize || 22) * s;
            c.font = `bold ${labelFs}px ${n.textFont || n.font}`;
            c.shadowColor = 'transparent';
            c.shadowBlur = 0;
            c.textAlign = 'left';
            if (n.showTextOutline) {
                const outlineW = (n.textOutlineIntensity / 100) * labelFs * 0.4;
                c.strokeStyle = '#000';
                c.lineWidth = outlineW;
                c.lineJoin = 'round';
                c.strokeText(clip.numberText, cx + activeCircleR + 8 * s, cy + 1 * s);
            }
            c.fillStyle = '#fff';
            c.shadowColor = 'rgba(0,0,0,0.8)';
            c.shadowBlur = 6 * s;
            c.fillText(clip.numberText, cx + activeCircleR + 8 * s, cy + 1 * s);
            c.textAlign = 'center';
        }

        // Store individual hit box
        numberBBoxes.push({
            index: i,
            x: cx - activeCircleR,
            y: cy - activeCircleR,
            w: activeCircleR * 2,
            h: activeCircleR * 2,
            cx: cx,
            cy: cy,
            left: _visLeft
        });
    }
    c.restore();

    // Global bbox for moving all numbers together
    const pad = 12;
    return { x: baseCx - circleR - pad, y: startY - circleR - pad, w: circleR*2 + pad*2, h: totalH + pad*2 };
}

function drawCaptions(c, s) {
    clipCaptionsBBox = null;
    if (state.clips.length === 0) return;
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.captionsEnabled || !clip.captions || clip.captions.length === 0 || !clip.videoEl) return;

    const relTime = clip.videoEl.currentTime - clip.trimStart;
    const active = clip.captions.filter(cap => relTime >= cap.from && relTime <= cap.to && cap.text.trim().length > 0);
    if (active.length === 0) return;

    const cs = state.captionStyle;
    const fs = cs.fontSize * s;
    const barBottomH = state.barBottom.height * s;
    const padding = 12 * s;
    const lineH = fs * 1.3;

    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.font = `bold ${fs}px 'Segoe UI', sans-serif`;

    const cW = c.canvas.width;
    const cH = c.canvas.height;
    const pos = clip.captionPos || null;
    const centerX = pos ? pos.x * cW : cW / 2;
    let yBottom = pos ? pos.y * cH : cH - barBottomH - 30 * s;

    clipCaptionsBBox = null;
    let bbMinX = Infinity, bbMinY = Infinity, bbMaxX = -Infinity, bbMaxY = -Infinity;

    // Draw from bottom to up
    for (let i = active.length - 1; i >= 0; i--) {
        const text = active[i].text;
        const textW = c.measureText(text).width;
        const boxW = textW + padding * 2;
        const boxH = lineH + padding;
        const boxX = centerX - boxW / 2;
        const boxY = yBottom - boxH;

        bbMinX = Math.min(bbMinX, boxX);
        bbMinY = Math.min(bbMinY, boxY);
        bbMaxX = Math.max(bbMaxX, boxX + boxW);
        bbMaxY = Math.max(bbMaxY, yBottom);

        c.fillStyle = hexToRgba(cs.bgColor, cs.bgOpacity);
        c.beginPath();
        c.roundRect(boxX, boxY, boxW, boxH, 8 * s);
        c.fill();

        c.fillStyle = cs.color;
        c.shadowColor = 'rgba(0,0,0,0.8)';
        c.shadowBlur = 4 * s;
        c.fillText(text, centerX, boxY + padding / 2);

        yBottom = boxY - 8 * s;
    }
    clipCaptionsBBox = { x: bbMinX, y: bbMinY, w: bbMaxX - bbMinX, h: bbMaxY - bbMinY };
    c.restore();
}

function getIntroBgClip() {
    const id = state.intro && state.intro.bgClipId;
    if (id) {
        const c = state.clips.find(cl => cl.id === id && cl.videoEl && cl.videoEl.readyState >= 2);
        if (c) return c;
    }
    // fallback: primer clip con video listo
    return state.clips.find(cl => cl.videoEl && cl.videoEl.readyState >= 2) || null;
}

function drawIntroFrame(c, s) {
    const intro = state.intro;
    const cW = c.canvas.width;
    const cH = c.canvas.height;

    // Black background
    c.fillStyle = '#000';
    c.fillRect(0, 0, cW, cH);

    // Video de fondo elegido, reproduciéndose durante la intro
    const bgClip = getIntroBgClip();
    if (bgClip) {
        c.save();
        c.filter = `blur(${intro.blurAmount * s}px)`;
        drawVideoCover(c, bgClip, 0, 0, cW, cH, s);
        c.filter = 'none';
        c.restore();
    }

    // Dark overlay for readability
    if (intro.overlayOpacity > 0) {
        c.fillStyle = `rgba(0,0,0,${intro.overlayOpacity})`;
        c.fillRect(0, 0, cW, cH);
    }

    // Intro captions
    drawIntroCaptions(c, s);
}

function drawIntroCaptions(c, s) {
    const intro = state.intro;
    introCaptionBBox = null;
    if (!intro.captionsEnabled || !intro.captions || intro.captions.length === 0) return;

    const elapsed = getIntroElapsedTime();
    const active = intro.captions.filter(cap => elapsed >= cap.from && elapsed <= cap.to && cap.text.trim().length > 0);
    if (active.length === 0) return;

    const fs = intro.captionFontSize * s;
    const padding = 12 * s;
    const lineH = fs * 1.3;

    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${fs}px ${intro.captionFont}`;

    const cW = c.canvas.width;
    const cH = c.canvas.height;
    const centerX = (intro.captionPos?.x ?? 0.5) * cW;
    const centerY = (intro.captionPos?.y ?? 0.85) * cH;
    let yBottom = centerY;

    for (let i = active.length - 1; i >= 0; i--) {
        const text = active[i].text;
        const textW = c.measureText(text).width;
        const boxW = textW + padding * 2;
        const boxH = lineH + padding;
        const boxX = centerX - boxW / 2;
        const boxY = yBottom - boxH;

        if (intro.captionBgEnabled !== false) {
            c.fillStyle = 'rgba(0,0,0,0.5)';
            c.beginPath();
            c.roundRect(boxX, boxY, boxW, boxH, 8 * s);
            c.fill();
        }

        c.fillStyle = intro.captionColor;
        c.shadowColor = 'rgba(0,0,0,0.8)';
        c.shadowBlur = (intro.captionBgEnabled !== false ? 4 : 8) * s;

        if (intro.captionShowOutline) {
            const outlineW = (intro.captionOutlineIntensity / 100) * fs * 0.4;
            c.lineJoin = 'round';
            c.lineWidth = Math.max(1, outlineW);
            c.strokeStyle = '#000000';
            c.shadowBlur = 0;
            c.strokeText(text, centerX, boxY + boxH / 2);
            c.shadowBlur = (intro.captionBgEnabled !== false ? 4 : 8) * s;
        }

        c.fillText(text, centerX, boxY + boxH / 2);

        if (i === 0) introCaptionBBox = { x: boxX, y: boxY, w: boxW, h: boxH };
        yBottom = boxY - 8 * s;
    }
    c.restore();
}

function drawIntroCaptionPreview(c, s) {
    const intro = state.intro;
    introCaptionBBox = null;
    if (!intro.enabled || !intro.captionsEnabled || !intro.captions || intro.captions.length === 0) return;

    const previewText = intro.captions.find(cap => cap.text.trim().length > 0);
    if (!previewText) return;
    const text = previewText.text.trim();

    const fs = intro.captionFontSize * s;
    const padding = 12 * s;
    const lineH = fs * 1.3;

    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${fs}px ${intro.captionFont}`;

    const cW = c.canvas.width;
    const cH = c.canvas.height;
    const centerX = (intro.captionPos?.x ?? 0.5) * cW;
    const centerY = (intro.captionPos?.y ?? 0.85) * cH;
    const textW = c.measureText(text).width;
    const boxW = textW + padding * 2;
    const boxH = lineH + padding;
    const boxX = centerX - boxW / 2;
    const boxY = centerY - boxH / 2;

    if (intro.captionBgEnabled !== false) {
        c.fillStyle = 'rgba(0,0,0,0.5)';
        c.beginPath();
        c.roundRect(boxX, boxY, boxW, boxH, 8 * s);
        c.fill();
    }

    c.fillStyle = intro.captionColor;
    c.shadowColor = 'rgba(0,0,0,0.8)';
    c.shadowBlur = (intro.captionBgEnabled !== false ? 4 : 8) * s;

    if (intro.captionShowOutline) {
        const outlineW = (intro.captionOutlineIntensity / 100) * fs * 0.4;
        c.lineJoin = 'round';
        c.lineWidth = Math.max(1, outlineW);
        c.strokeStyle = '#000000';
        c.shadowBlur = 0;
        c.strokeText(text, centerX, centerY);
        c.shadowBlur = (intro.captionBgEnabled !== false ? 4 : 8) * s;
    }

    c.fillText(text, centerX, centerY);
    introCaptionBBox = { x: boxX, y: boxY, w: boxW, h: boxH };
    c.restore();
}

// ═══════════════════════════════════════════════════════════
// ████  STYLE ENGINE RENDERING (Freezes · Textos · Outro) ████
// ═══════════════════════════════════════════════════════════
function wrapTextLines(c, text, maxWidth) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (c.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = w;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function drawTextBlockCentered(c, text, posNorm, opts) {
    const { font, fontSize, color, showOutline, outlineIntensity, s, maxWidth } = opts;
    const cW = c.canvas.width;
    const cH = c.canvas.height;
    const fs = fontSize * s;
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${fs}px ${font}`;
    const lines = wrapTextLines(c, text, maxWidth || cW * 0.9);
    const lineH = fs * 1.15;
    const cx = posNorm.x * cW;
    const cy = posNorm.y * cH;
    const totalH = lines.length * lineH;

    if (opts.bgEnabled) {
        let maxW = 0;
        lines.forEach(l => { maxW = Math.max(maxW, c.measureText(l).width); });
        const padX = 18 * s, padY = 12 * s;
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.beginPath();
        c.roundRect(cx - maxW / 2 - padX, cy - totalH / 2 - padY, maxW + padX * 2, totalH + padY * 2, 10 * s);
        c.fill();
    }

    lines.forEach((l, i) => {
        const ly = cy - totalH / 2 + lineH * (i + 0.5);
        if (showOutline) {
            const ow = Math.max(1, (outlineIntensity / 100) * fs * 0.35);
            c.lineJoin = 'round';
            c.lineWidth = ow;
            c.strokeStyle = '#000000';
            c.strokeText(l, cx, ly);
        }
        c.fillStyle = color;
        c.shadowColor = 'rgba(0,0,0,0.75)';
        c.shadowBlur = 6 * s;
        c.fillText(l, cx, ly);
        c.shadowBlur = 0;
    });
    c.restore();

    let maxW = 0;
    lines.forEach(l => { maxW = Math.max(maxW, c.measureText(l).width); });
    return { x: cx - maxW / 2, y: cy - totalH / 2, w: maxW, h: totalH };
}

function getActiveFreeze() {
    // Freeze activo ahora mismo (reproducción/exportación)
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.freezes || !clip.videoEl) return null;
    for (const ff of clip.freezes) {
        const st = freezeRuntime[ff.id];
        if (!st || st.done) continue;
        const elapsedMs = performance.now() - st.startedAt;
        if (elapsedMs < ff.dur * 1000) return ff;
    }
    return null;
}

function drawFreezeOverlays(c, s) {
    freezeTextBBoxes = [];
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.freezes || clip.freezes.length === 0) return;

    const active = getActiveFreeze();
    if (active) {
        drawTextBlockCentered(c, active.text || ' ', { x: active.posX ?? 0.5, y: active.posY ?? 0.3 }, {
            font: active.font, fontSize: active.fontSize, color: active.color,
            showOutline: active.showOutline, outlineIntensity: active.outlineIntensity,
            bgEnabled: active.bgEnabled, s
        });
        return;
    }

    // Vista estática (sin reproducción): muestra los textos para poder arrastrarlos
    if (isPlaying || isExporting) return;
    clip.freezes.forEach((ff, i) => {
        if (!ff.text || !ff.text.trim()) return;
        const bbox = drawTextBlockCentered(c, ff.text, { x: ff.posX ?? 0.5, y: ff.posY ?? 0.3 }, {
            font: ff.font, fontSize: ff.fontSize, color: ff.color,
            showOutline: ff.showOutline, outlineIntensity: ff.outlineIntensity,
            bgEnabled: false, s
        });
        bbox.alpha = 0.85;
        freezeTextBBoxes.push({ index: i, id: ff.id, ...bbox });
    });
}

function drawScreenTexts(c, s) {
    headlineBBox = null;
    endQuestionBBox = null;
    const st = state.screenTexts;
    const elapsed = getElapsedTime();
    const total = getTotalDuration();

    if (st.headline.enabled && st.headline.text.trim()) {
        const startAt = getIntroOffset();
        if (!isPlaying && !isExporting) {
            // preview estático
            headlineBBox = drawTextBlockCentered(c, st.headline.text, st.headline.pos, { ...st.headline, s });
        } else if (elapsed >= startAt && elapsed < startAt + st.headline.durationSec) {
            headlineBBox = drawTextBlockCentered(c, st.headline.text, st.headline.pos, { ...st.headline, s });
        }
    }
    if (st.endQuestion.enabled && st.endQuestion.text.trim()) {
        if (!isPlaying && !isExporting) {
            endQuestionBBox = drawTextBlockCentered(c, st.endQuestion.text, st.endQuestion.pos, { ...st.endQuestion, s });
        } else if (elapsed >= total - st.endQuestion.lastSecs) {
            endQuestionBBox = drawTextBlockCentered(c, st.endQuestion.text, st.endQuestion.pos, { ...st.endQuestion, s });
        }
    }
}

function getVoStartTime(clip) {
    const start = Number.isFinite(clip.timelineStart) ? clip.timelineStart : 0;
    return getIntroOffset() + start + ((clip.vo && clip.vo.offset) || 0) / 1000;
}

function getVoCaptionStyle(vo) {
    return {
        font: vo.capFont || "'Segoe UI', sans-serif",
        fontSize: vo.capSize ?? 40,
        color: vo.capColor || '#FFFFFF',
        bg: vo.capBgEnabled !== false,
        ol: vo.capOutlineEnabled === true,
        olColor: vo.capOutlineColor || '#000000',
        olInt: vo.capOutlineIntensity ?? 40,
        words: Math.max(1, vo.capWords ?? 3)
    };
}

// Agrupa las captions en bloques de N palabras conservando los tiempos
function groupVoCaptions(vo) {
    const maxWords = Math.max(1, vo.capWords ?? 3);
    const caps = (vo.captions || []).filter(cp => cp.text && cp.text.trim());
    const wordCount = t => t.trim().split(/\s+/).length;
    const groups = [];
    let cur = null;
    for (const cp of caps) {
        if (!cur) { cur = { text: cp.text.trim(), from: cp.from, to: cp.to, words: wordCount(cp.text) }; continue; }
        if (cur.words + wordCount(cp.text) <= maxWords) {
            cur.text += ' ' + cp.text.trim();
            cur.to = cp.to;
            cur.words += wordCount(cp.text);
        } else {
            groups.push(cur);
            cur = { text: cp.text.trim(), from: cp.from, to: cp.to, words: wordCount(cp.text) };
        }
    }
    if (cur) groups.push(cur);
    return groups;
}

function drawVoCaptions(c, s) {
    voCaptionBBox = null;
    if (!state.voiceoversEnabled || isInOutro || isInIntro) return;
    const elapsed = getElapsedTime();
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.vo || clip.vo.enabled === false) return;
    const vo = clip.vo;
    if (!vo.captions || vo.captions.length === 0) return;

    const st = getVoCaptionStyle(vo);
    const groups = groupVoCaptions(vo);
    const local = elapsed - getVoStartTime(clip);

    let active;
    if (!isPlaying && !isExporting && !isInOutro) {
        // Vista estática: muestra el primer bloque para poder arrastrarlo
        active = groups.length ? [groups[0]] : [];
    } else {
        active = groups.filter(g => local >= g.from && local <= g.to);
    }
    if (active.length === 0) return;

    const fs = st.fontSize * s;
    const padding = 12 * s;
    const lineH = fs * 1.3;
    const cW = c.canvas.width;
    const cH = c.canvas.height;
    const centerX = ((vo.capPos && vo.capPos.x) ?? 0.5) * cW;
    let yBottom = ((vo.capPos && vo.capPos.y) ?? 0.62) * cH;

    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `bold ${fs}px ${st.font}`;
    for (let i = active.length - 1; i >= 0; i--) {
        const text = active[i].text;
        const textW = c.measureText(text).width;
        const boxW = textW + padding * 2;
        const boxH = lineH + padding;
        const boxX = centerX - boxW / 2;
        const boxY = yBottom - boxH;

        if (st.bg) {
            c.fillStyle = 'rgba(0,0,0,0.5)';
            c.beginPath();
            c.roundRect(boxX, boxY, boxW, boxH, 8 * s);
            c.fill();
        }

        if (st.ol) {
            const ow = Math.max(1, (st.olInt / 100) * fs * 0.4);
            c.lineJoin = 'round';
            c.lineWidth = ow;
            c.strokeStyle = st.olColor;
            c.strokeText(text, centerX, boxY + boxH / 2);
        }
        c.fillStyle = st.color;
        c.shadowColor = st.bg ? 'transparent' : 'rgba(0,0,0,0.8)';
        c.shadowBlur = st.bg ? 0 : 6 * s;
        c.fillText(text, centerX, boxY + boxH / 2);
        c.shadowBlur = 0;

        if (i === 0) voCaptionBBox = { x: boxX, y: boxY, w: boxW, h: boxH };
        yBottom = boxY - 8 * s;
    }
    c.restore();
}

function drawOutroFrame(c, s) {
    const o = state.outro;
    const cW = c.canvas.width;
    const cH = c.canvas.height;
    c.fillStyle = o.bgColor || '#101018';
    c.fillRect(0, 0, cW, cH);
    drawOutroBackground(c, s);
    drawOutroContent(c, s);
}

// Fondo del outro: clip elegido por el usuario desenfocado + capa de oscuridad
function drawOutroBackground(c, s) {
    const o = state.outro;
    if (!o.bgClipId) return;
    const bgClip = state.clips.find(cl => cl.id === o.bgClipId);
    if (!bgClip || !bgClip.videoEl || bgClip.videoEl.readyState < 2) return;
    const cW = c.canvas.width;
    const cH = c.canvas.height;
    c.save();
    c.filter = `blur(${Math.max(1, (o.bgBlur ?? 20) * s)}px)`;
    drawVideoCover(c, bgClip, 0, 0, cW, cH, s);
    c.filter = 'none';
    c.restore();
    const ov = clamp(o.bgOverlay ?? 40, 0, 100) / 100;
    if (ov > 0) {
        c.fillStyle = `rgba(0,0,0,${ov})`;
        c.fillRect(0, 0, cW, cH);
    }
}

// Dibuja el CTA y las captions del outro (activo durante reproducción, preview si no)
function drawOutroContent(c, s) {
    const o = state.outro;
    const cW = c.canvas.width;
    const cH = c.canvas.height;

    const elapsed = getOutroElapsedTime();
    const staticPreview = !isPlaying && !isExporting;

    outroCaptionBBox = null;
    if (o.ctaText && o.ctaText.trim()) {
        drawTextBlockCentered(c, o.ctaText, o.pos || { x: 0.5, y: 0.45 }, {
            font: "'Segoe UI', Arial, sans-serif",
            fontSize: o.fontSize, color: o.textColor,
            showOutline: false, outlineIntensity: 0, s
        });
    }

    let active = [];
    if (!staticPreview) {
        active = (o.captions || []).filter(cap => elapsed >= cap.from && elapsed <= cap.to && cap.text.trim().length > 0);
    } else {
        const preview = (o.captions || []).find(cap => cap.text.trim());
        if (preview) active = [preview];
    }

    if (o.captionsEnabled !== false && active.length > 0) {
        const fs = (o.captionFontSize || 36) * s;
        const padding = 12 * s;
        const lineH = fs * 1.3;
        const centerX = ((o.captionPos && o.captionPos.x) ?? 0.5) * cW;
        let yBottom = ((o.captionPos && o.captionPos.y) ?? 0.78) * cH;
        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `bold ${fs}px ${o.captionFont || "'Segoe UI', sans-serif"}`;
        for (let i = active.length - 1; i >= 0; i--) {
            const text = active[i].text;
            const textW = c.measureText(text).width;
            const boxW = textW + padding * 2;
            const boxH = lineH + padding;
            const boxX = centerX - boxW / 2;
            const boxY = yBottom - boxH;
            c.fillStyle = 'rgba(0,0,0,0.5)';
            c.beginPath();
            c.roundRect(boxX, boxY, boxW, boxH, 8 * s);
            c.fill();
            c.fillStyle = o.captionColor || '#FFFFFF';
            c.shadowColor = 'rgba(0,0,0,0.8)';
            c.shadowBlur = 6 * s;
            c.fillText(text, centerX, boxY + boxH / 2);
            if (i === 0) outroCaptionBBox = { x: boxX, y: boxY, w: boxW, h: boxH };
            yBottom = boxY - 8 * s;
        }
        c.restore();
    }
}

function drawStyleBar(c, bar, y, w, h, s) {
    if (h <= 0) return;
    const cW = c.canvas.width;
    const clip = state.clips[currentClipIndex];
    const canBlur = bar.style === 'blur' && clip && clip.videoEl && clip.videoEl.readyState >= 2;

    c.save();
    c.beginPath();
    c.rect(0, y, w, h);
    c.clip();
    if (canBlur) {
        c.filter = `blur(${Math.max(1, (bar.blur ?? 20) * s)}px)`;
        drawVideoCover(c, clip, 0, 0, cW, c.canvas.height, s);
        c.filter = 'none';
        const ov = clamp(bar.overlay ?? 40, 0, 100) / 100;
        if (ov > 0) {
            c.fillStyle = `rgba(0,0,0,${ov})`;
            c.fillRect(0, y, w, h);
        }
    } else {
        c.fillStyle = bar.color || '#FFD700';
        c.fillRect(0, y, w, h);
    }
    c.restore();
}

function drawBarsAndPercentage(c, s) {
    drawStyleBar(c, state.barTop, 0, c.canvas.width, state.barTop.height * s, s);
    const bH = state.barBottom.height * s;
    drawStyleBar(c, state.barBottom, c.canvas.height - bH, c.canvas.width, bH, s);

    // Percentage
    const clip = state.clips[currentClipIndex];
    if (clip && clip.percentage) {
        c.save();
        c.textAlign = 'right'; c.textBaseline = 'bottom';
        c.font = `bold ${48 * s}px 'Segoe UI', Arial`;
        c.fillStyle = '#FFFFFF';
        c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 6 * s;
        c.fillText(clip.percentage + '%', c.canvas.width - 20 * s, c.canvas.height - bH - 16 * s);
        c.restore();
    }
}


const blurBarScratch = document.createElement('canvas');
const BLURBAR_DOWN = 4; // factor de downscale para renderizar las blur bars

function drawBlurBars(c, s) {
    blurBarBBoxes = [];
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.videoEl || clip.videoEl.readyState < 2) return;
    const bars = clip.blurBars;
    if (!bars || bars.length === 0) return;

    const cW = c.canvas.width;
    const cH = c.canvas.height;

    for (const bar of bars) {
        const bx = bar.x * s;
        const by = bar.y * s;
        const bw = Math.max(1, bar.w * s);
        const bh = Math.max(1, bar.h * s);

        // Renderizar el blur a 1/4 de escala y re-escalar al blit: sobre una región
        // borrosa el resultado es visualmente idéntico, a ~1/16 del costo por frame
        // (clave para no dropear frames durante la exportación a 1080×1920).
        const tw = Math.max(1, Math.round(bw / BLURBAR_DOWN));
        const th = Math.max(1, Math.round(bh / BLURBAR_DOWN));
        if (blurBarScratch.width !== tw || blurBarScratch.height !== th) {
            blurBarScratch.width = tw;
            blurBarScratch.height = th;
        }
        const tctx = blurBarScratch.getContext('2d');
        tctx.clearRect(0, 0, tw, th);
        tctx.save();
        tctx.beginPath();
        tctx.rect(0, 0, tw, th);
        tctx.clip();
        tctx.filter = `blur(${(Math.max(1, bar.blur) * s) / BLURBAR_DOWN}px)`;
        drawVideoCover(tctx, clip, -bx / BLURBAR_DOWN, -by / BLURBAR_DOWN, cW / BLURBAR_DOWN, cH / BLURBAR_DOWN, s / BLURBAR_DOWN);
        tctx.filter = 'none';
        tctx.restore();

        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.drawImage(blurBarScratch, 0, 0, tw, th, bx, by, bw, bh);

        blurBarBBoxes.push({ id: bar.id, x: bx, y: by, w: bw, h: bh });
    }
}

// ─── Overlay guía de la interfaz de YouTube Shorts (solo preview) ───
// Zonas definidas en espacio export 1080×1920, escaladas por s.
const SHORTS_ZONES = [
    { x: 20,  y: 40,  w: 180, h: 80,  label: 'Logo / Back' },
    { x: 820, y: 120, w: 240, h: 170, label: 'Avatar + Canal + Suscribirse' },
    { x: 880, y: 880, w: 180, h: 620, label: 'Like · Dislike · Comentar · Compartir · Remix · Más' },
    { x: 30,  y: 1530,w: 760, h: 300, label: 'Título / Descripción' },
    { x: 900, y: 1740,w: 150, h: 110, label: 'Pista de audio' },
    { x: 980, y: 820, w: 60,  h: 280, label: 'Nav Shorts' }
];
const SHORTS_SAFE_ZONE = { x: 40, y: 280, w: 780, h: 1220 };

function drawShortsOverlay(c, s) {
    const o = state.shortsOverlay || {};
    const opacity = Math.max(0, Math.min(1, o.opacity ?? 0.5));
    if (opacity <= 0) return;

    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const fs = Math.max(9, 16 * s);

    // Área segura
    c.setLineDash([10 * s, 6 * s]);
    c.strokeStyle = 'rgba(80, 220, 120, 0.7)';
    c.lineWidth = 2 * s;
    c.fillStyle = 'rgba(80, 220, 120, 0.06)';
    c.fillRect(SHORTS_SAFE_ZONE.x * s, SHORTS_SAFE_ZONE.y * s, SHORTS_SAFE_ZONE.w * s, SHORTS_SAFE_ZONE.h * s);
    c.strokeRect(SHORTS_SAFE_ZONE.x * s, SHORTS_SAFE_ZONE.y * s, SHORTS_SAFE_ZONE.w * s, SHORTS_SAFE_ZONE.h * s);

    // Zonas de la interfaz
    c.setLineDash([6 * s, 4 * s]);
    c.lineWidth = 2 * s;
    c.font = `bold ${fs}px 'Segoe UI', sans-serif`;
    for (const z of SHORTS_ZONES) {
        const x = z.x * s, y = z.y * s, w = z.w * s, h = z.h * s;
        c.fillStyle = `rgba(0,0,0,${opacity})`;
        c.fillRect(x, y, w, h);
        c.strokeStyle = 'rgba(255,255,255,0.7)';
        c.strokeRect(x, y, w, h);
        // Etiqueta
        c.fillStyle = 'rgba(255,255,255,0.92)';
        c.shadowColor = 'rgba(0,0,0,0.8)';
        c.shadowBlur = 4 * s;
        c.fillText(z.label, x + w / 2, y + h / 2, w - 8 * s);
        c.shadowBlur = 0;
    }

    // Leyenda
    c.setLineDash([]);
    c.font = `bold ${Math.max(10, 18 * s)}px 'Segoe UI', sans-serif`;
    c.fillStyle = 'rgba(255, 220, 80, 0.95)';
    c.shadowColor = 'rgba(0,0,0,0.9)';
    c.shadowBlur = 6 * s;
    c.fillText('Vista previa de zona segura — no se exporta', (EXPORT_W / 2) * s, (EXPORT_H - 12) * s);
    c.restore();
}

// Marca en el preview los bordes del video que quedan DENTRO del encuadre 9:16:
// así se ve exactamente qué zona del frame quedará como franja negra al mover
// el clip. Solo es una guía del preview (no se exporta).
function drawVideoEdgeGuides(c) {
    const clip = state.clips[currentClipIndex];
    const r = getVideoDrawRect(clip);
    if (!r) return;
    c.save();
    c.setLineDash([8, 6]);
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(255, 90, 90, 0.9)';
    c.fillStyle = 'rgba(255, 120, 120, 0.95)';
    c.font = 'bold 10px Segoe UI, sans-serif';
    c.shadowColor = 'rgba(0,0,0,0.8)';
    c.shadowBlur = 3;
    if (r.x > 0.5) {
        const ex = Math.round(r.x) + 0.5;
        c.beginPath(); c.moveTo(ex, 0); c.lineTo(ex, PREVIEW_H); c.stroke();
        c.fillText('◄ video (franja negra a la izquierda)', ex + 6, PREVIEW_H / 2);
    }
    if (r.x + r.w < PREVIEW_W - 0.5) {
        const ex = Math.round(r.x + r.w) - 0.5;
        c.beginPath(); c.moveTo(ex, 0); c.lineTo(ex, PREVIEW_H); c.stroke();
        c.fillText('video ► (franja negra a la derecha)', Math.max(6, ex - 180), PREVIEW_H / 2);
    }
    if (r.y > 0.5) {
        const ey = Math.round(r.y) + 0.5;
        c.beginPath(); c.moveTo(0, ey); c.lineTo(PREVIEW_W, ey); c.stroke();
        c.fillText('▲ video (franja negra arriba)', 6, ey - 6);
    }
    if (r.y + r.h < PREVIEW_H - 0.5) {
        const ey = Math.round(r.y + r.h) - 0.5;
        c.beginPath(); c.moveTo(0, ey); c.lineTo(PREVIEW_W, ey); c.stroke();
        c.fillText('video ▼ (franja negra abajo)', 6, ey + 14);
    }
    c.restore();
}

function drawFrame() {
    if (isInIntro) {
        drawIntroFrame(ctx, SCALE);
        return;
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

    const clip = state.clips[currentClipIndex];
    if (clip) drawVideoContain(ctx, clip, 0, 0, PREVIEW_W, PREVIEW_H, SCALE);

    drawBlurBars(ctx, SCALE);
    drawBarsAndPercentage(ctx, SCALE);

    // Save bboxes only during preview
    titleBBoxes = [];
    state.title.lines.forEach((line, i) => {
        titleBBoxes[i] = drawTitleLine(ctx, line, getTitlePos(i), getTitleLineFont(i), getTitleLineSize(i) * SCALE, state.title.textColor, SCALE);
    });
    numberBBox = drawNumbers(ctx, SCALE);

    drawCaptions(ctx, SCALE);

    // Preview intro caption position when intro is enabled but not playing
    if (state.intro.enabled && !isPlaying && !isExporting) {
        drawIntroCaptionPreview(ctx, SCALE);
    }

    // Style engine overlays
    if (isInOutro) {
        drawOutroFrame(ctx, SCALE);
        return;
    }
    drawFreezeOverlays(ctx, SCALE);
    drawScreenTexts(ctx, SCALE);
    drawVoCaptions(ctx, SCALE);

    // Guía de bordes del video: siempre visible en el preview (no se exporta)
    if (!isPlaying && !isExporting) drawVideoEdgeGuides(ctx);

    // Outro: solo se dibuja cuando el cabezal está en su tramo final
    const outroStartAt = getIntroOffset() + getClipsEnd();
    if (state.outro.enabled && !isPlaying && !isExporting && getElapsedTime() >= outroStartAt - 0.05) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
        drawOutroBackground(ctx, SCALE);
        drawOutroContent(ctx, SCALE);
    }

    // Líneas guía de alineación (durante arrastre cerca del nivel/columna de otro elemento)
    if ((canvasGuideY !== null || canvasGuideX !== null) && dragging) {
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1;
        if (canvasGuideY !== null) {
            ctx.strokeStyle = canvasGuideYMode === 'spacing' ? '#4dd2ff' : '#ff4dd2';
            ctx.shadowColor = canvasGuideYMode === 'spacing' ? 'rgba(77,210,255,0.8)' : 'rgba(255,77,210,0.8)';
            ctx.shadowBlur = 4;
            const gy = Math.round(canvasGuideY) + 0.5;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(PREVIEW_W, gy);
            ctx.stroke();
        }
        if (canvasGuideX !== null) {
            ctx.strokeStyle = '#ff4dd2';
            ctx.shadowColor = 'rgba(255,77,210,0.8)';
            ctx.shadowBlur = 4;
            const gx = Math.round(canvasGuideX) + 0.5;
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, PREVIEW_H);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Drag outlines
    if (dragging) {
        ctx.save();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(90,90,255,0.8)'; ctx.lineWidth = 2;
        const drawOutline = (bbox) => { if(bbox) ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h); };
        if (dragging && dragging.startsWith('title_')) {
            const ti = parseInt(dragging.split('_')[1]);
            drawOutline(titleBBoxes[ti]);
        }
        if (dragging === 'number') drawOutline(numberBBox);
        if (dragging === 'introCaption') drawOutline(introCaptionBBox);
        if (dragging === 'headline') drawOutline(headlineBBox);
        if (dragging === 'endQuestion') drawOutline(endQuestionBBox);
        if (dragging === 'outroCaption') drawOutline(outroCaptionBBox);
        if (dragging === 'voCaption') drawOutline(voCaptionBBox);
        if (dragging === 'clipCaption') drawOutline(clipCaptionsBBox);
        if (dragging.startsWith('freezeText_')) {
            const idx = parseInt(dragging.split('_')[1]);
            const fb = freezeTextBBoxes.find(b => b.index === idx);
            drawOutline(fb);
        }
        if (dragging === 'blurBar') blurBarBBoxes.forEach(b => drawOutline(b));
        ctx.restore();
    }

    // YouTube Shorts overlay — guía visual solo para preview (no se exporta)
    if (!isExporting && state.shortsOverlay && state.shortsOverlay.enabled && state.shortsOverlay.visible) {
        drawShortsOverlay(ctx, SCALE);
    }
}

// ═══════════════════════════════════════════════════════════
// ████  DRAG & DROP CANVAS  ████
// ═══════════════════════════════════════════════════════════
function hitTest(x, y, bbox) {
    if (!bbox) return false;
    return x >= bbox.x && x <= bbox.x + bbox.w && y >= bbox.y && y <= bbox.y + bbox.h;
}

function hitTestNumber(x, y) {
    // Devuelve el número MÁS CERCANO al clic dentro de su área de influencia
    // (radio del círculo + tolerancia), para que el punto de interacción coincida
    // exactamente con donde se dibuja cada número.
    let best = -1, bestD = Infinity;
    for (const b of numberBBoxes) {
        const r = Math.max(b.w, b.h) / 2 + 8; // tolerancia extra en px de canvas
        const dx = x - b.cx, dy = y - b.cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= r && d < bestD) { bestD = d; best = b.index; }
    }
    return best;
}

function hitTestBlurBar(x, y) {
    for (let i = blurBarBBoxes.length - 1; i >= 0; i--) {
        const b = blurBarBBoxes[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            return b.id;
        }
    }
    return -1;
}

function hitTestFreezeText(x, y) {
    for (let i = freezeTextBBoxes.length - 1; i >= 0; i--) {
        const b = freezeTextBBoxes[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
}

// Convierte coordenadas de ratón a píxeles internos del canvas,
// tolerando cualquier diferencia entre tamaño mostrado y resolución interna
function canvasMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? canvas.width / rect.width : 1;
    const sy = rect.height > 0 ? canvas.height / rect.height : 1;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
}

// ─── Guías de alineación (líneas guía al pasar cerca del nivel de otro elemento) ───
let canvasGuideY = null;      // línea guía horizontal (nivel Y) durante un arrastre
let canvasGuideX = null;      // línea guía vertical (columna X)
let canvasGuideYMode = 'level'; // 'level' = mismo nivel · 'spacing' = iguala distancia

function guideCandidates(excludeKey) {
    const cands = [];
    numberBBoxes.forEach(b => { const k = 'number_' + b.index; if (k !== excludeKey) cands.push({ key: k, y: b.cy }); });
    titleBBoxes.forEach((b, i) => { if (b && excludeKey !== 'title_' + i) cands.push({ key: 'title_' + i, y: b.y + b.h / 2 }); });
    if (introCaptionBBox && excludeKey !== 'introCaption') cands.push({ key: 'introCaption', y: introCaptionBBox.y + introCaptionBBox.h / 2 });
    if (headlineBBox && excludeKey !== 'headline') cands.push({ key: 'headline', y: headlineBBox.y + headlineBBox.h / 2 });
    if (endQuestionBBox && excludeKey !== 'endQuestion') cands.push({ key: 'endQuestion', y: endQuestionBBox.y + endQuestionBBox.h / 2 });
    if (outroCaptionBBox && excludeKey !== 'outroCaption') cands.push({ key: 'outroCaption', y: outroCaptionBBox.y + outroCaptionBBox.h / 2 });
    if (voCaptionBBox && excludeKey !== 'voCaption') cands.push({ key: 'voCaption', y: voCaptionBBox.y + voCaptionBBox.h / 2 });
    if (clipCaptionsBBox && excludeKey !== 'clipCaption') cands.push({ key: 'clipCaption', y: clipCaptionsBBox.y + clipCaptionsBBox.h / 2 });
    freezeTextBBoxes.forEach(b => { const k = 'freeze_' + b.id; if (k !== excludeKey) cands.push({ key: k, y: b.y + b.h / 2 }); });
    return cands;
}

// Ajusta la Y del elemento arrastrado al nivel del elemento más cercano (si está a <8px)
// o IGUALA LA DISTANCIA vertical entre los dos números más cercanos (<12px).
// Devuelve la Y ajustada en píxeles de canvas.
function snapGuideY(rawCanvasY, excludeKey) {
    if (!dragging) { canvasGuideY = null; return rawCanvasY; }
    // 1) Mismo nivel
    const cands = guideCandidates(excludeKey);
    let best = null, bestD = 8;
    for (const c of cands) {
        const d = Math.abs(c.y - rawCanvasY);
        if (d <= bestD) { bestD = d; best = c; }
    }
    if (best) { canvasGuideY = best.y; canvasGuideYMode = 'level'; return best.y; }

    // 2) Igualar espaciado vertical: usa UNA SOLA distancia — la del par de números
    // más cercano al elemento arrastrado (el número vivo más próximo y su vecino inmediato)
    const nums = numberBBoxes
        .filter(b => ('number_' + b.index) !== excludeKey)
        .map(b => b.cy)
        .sort((a, b) => a - b);
    if (nums.length >= 2) {
        // Número vivo más cercano a la posición actual del arrastre
        let ni = 0, nD = Infinity;
        for (let i = 0; i < nums.length; i++) {
            const d = Math.abs(nums[i] - rawCanvasY);
            if (d < nD) { nD = d; ni = i; }
        }
        // Hueco adyacente más pequeño de ese número (con el vecino de arriba o de abajo)
        const gaps = [];
        if (ni > 0) gaps.push(nums[ni] - nums[ni - 1]);
        if (ni < nums.length - 1) gaps.push(nums[ni + 1] - nums[ni]);
        const g = Math.min.apply(null, gaps.filter(x => x > 6));
        if (g && isFinite(g)) {
            let sp = null, spD = 12;
            for (const cand of [nums[ni] + g, nums[ni] - g]) {
                if (cand < 0 || cand > PREVIEW_H) continue;
                const diff = Math.abs(cand - rawCanvasY);
                if (diff <= spD) { spD = diff; sp = { y: cand }; }
            }
            if (sp) { canvasGuideY = sp.y; canvasGuideYMode = 'spacing'; return sp.y; }
        }
    }

    canvasGuideY = null;
    return rawCanvasY;
}

// ─── Guías verticales (misma columna X) ───
function guideCandidatesX(excludeKey) {
    const cands = [];
    // Los números se guían por su BORDE IZQUIERDO VISUAL (el glifo real, no solo el círculo)
    numberBBoxes.forEach(b => { const k = 'number_' + b.index; if (k !== excludeKey) cands.push({ key: k, x: (b.left !== undefined ? b.left : b.x) }); });
    titleBBoxes.forEach((b, i) => { if (b && excludeKey !== 'title_' + i) cands.push({ key: 'title_' + i, x: b.x + b.w / 2 }); });
    if (introCaptionBBox && excludeKey !== 'introCaption') cands.push({ key: 'introCaption', x: introCaptionBBox.x + introCaptionBBox.w / 2 });
    if (headlineBBox && excludeKey !== 'headline') cands.push({ key: 'headline', x: headlineBBox.x + headlineBBox.w / 2 });
    if (endQuestionBBox && excludeKey !== 'endQuestion') cands.push({ key: 'endQuestion', x: endQuestionBBox.x + endQuestionBBox.w / 2 });
    if (outroCaptionBBox && excludeKey !== 'outroCaption') cands.push({ key: 'outroCaption', x: outroCaptionBBox.x + outroCaptionBBox.w / 2 });
    if (voCaptionBBox && excludeKey !== 'voCaption') cands.push({ key: 'voCaption', x: voCaptionBBox.x + voCaptionBBox.w / 2 });
    if (clipCaptionsBBox && excludeKey !== 'clipCaption') cands.push({ key: 'clipCaption', x: clipCaptionsBBox.x + clipCaptionsBBox.w / 2 });
    freezeTextBBoxes.forEach(b => { const k = 'freeze_' + b.id; if (k !== excludeKey) cands.push({ key: k, x: b.x + b.w / 2 }); });
    return cands;
}

function snapGuideX(rawCanvasX, excludeKey) {
    if (!dragging) { canvasGuideX = null; return rawCanvasX; }
    const cands = guideCandidatesX(excludeKey);
    let best = null, bestD = 8;
    for (const c of cands) {
        const d = Math.abs(c.x - rawCanvasX);
        if (d <= bestD) { bestD = d; best = c; }
    }
    if (best) { canvasGuideX = best.x; return best.x; }
    canvasGuideX = null;
    return rawCanvasX;
}

canvas.addEventListener('mousedown', (e) => {
    if (isPlaying || isExporting) return;
    const pos = canvasMousePos(e);
    const mx = pos.x, my = pos.y;

    if (hitTest(mx, my, introCaptionBBox)) {
        dragging = 'introCaption';
        const cx = (state.intro.captionPos?.x ?? 0.5) * PREVIEW_W;
        const cy = (state.intro.captionPos?.y ?? 0.85) * PREVIEW_H;
        dragOffset = { x: mx - cx, y: my - cy };
    } else if (hitTest(mx, my, headlineBBox)) {
        dragging = 'headline';
        dragOffset = { x: mx - state.screenTexts.headline.pos.x * PREVIEW_W, y: my - state.screenTexts.headline.pos.y * PREVIEW_H };
    } else if (hitTest(mx, my, endQuestionBBox)) {
        dragging = 'endQuestion';
        dragOffset = { x: mx - state.screenTexts.endQuestion.pos.x * PREVIEW_W, y: my - state.screenTexts.endQuestion.pos.y * PREVIEW_H };
    } else if (hitTest(mx, my, outroCaptionBBox)) {
        dragging = 'outroCaption';
        const cx = ((state.outro.captionPos && state.outro.captionPos.x) ?? 0.5) * PREVIEW_W;
        const cy = ((state.outro.captionPos && state.outro.captionPos.y) ?? 0.78) * PREVIEW_H;
        dragOffset = { x: mx - cx, y: my - cy };
    } else if (hitTest(mx, my, voCaptionBBox) && state.clips[currentClipIndex] && state.clips[currentClipIndex].vo) {
        dragging = 'voCaption';
        const cp = state.clips[currentClipIndex].vo.capPos || { x: 0.5, y: 0.62 };
        dragOffset = { x: mx - cp.x * PREVIEW_W, y: my - cp.y * PREVIEW_H };
    } else if (hitTest(mx, my, clipCaptionsBBox)) {
        const clip = state.clips[currentClipIndex];
        if (!clip.captionPos) {
            const defY = PREVIEW_H - state.barBottom.height * SCALE - 30 * SCALE;
            clip.captionPos = { x: 0.5, y: defY / PREVIEW_H };
        }
        dragging = 'clipCaption';
        dragOffset = { x: mx - clip.captionPos.x * PREVIEW_W, y: my - clip.captionPos.y * PREVIEW_H };
    } else if (hitTestFreezeText(mx, my) !== null) {
        const fb = hitTestFreezeText(mx, my);
        dragging = 'freezeText_' + fb.index;
        dragOffset = { x: mx - fb.x, y: my - fb.y, hh: fb.h / 2 || 0, hw: fb.w / 2 || 0 };
    } else if (hitTestBlurBar(mx, my) !== -1) {
        const barId = hitTestBlurBar(mx, my);
        const clip = state.clips[currentClipIndex];
        const bar = clip && clip.blurBars ? clip.blurBars.find(b => b.id === barId) : null;
        if (bar) {
            dragging = 'blurBar';
            dragOffset = { x: mx - bar.x * SCALE, y: my - bar.y * SCALE, id: barId };
        }
    } else if (hitTitleIndex(mx, my) !== -1) {
        const ti = hitTitleIndex(mx, my);
        dragging = 'title_' + ti;
        const p = getTitlePos(ti);
        dragOffset = { x: mx - p.x * SCALE, y: my - p.y * SCALE };
    } else {
        const numIdx = hitTestNumber(mx, my);
        if (numIdx !== -1) {
            const clip = state.clips[numIdx];
            // If no individual position, initialize from global position for this index
            if (!clip.numberPos) {
                const total = state.clips.length;
                const fs = state.numbers.fontSize * SCALE;
                const spacing = fs * 1.6;
                const totalH = total * spacing;
                const startY = state.layout.numberPos.y * SCALE - totalH / 2 + spacing / 2;
                clip.numberPos = {
                    x: state.layout.numberPos.x,
                    y: (startY + numIdx * spacing) / SCALE
                };
            }
            dragging = 'number_' + numIdx;
            dragOffset = { x: mx - clip.numberPos.x * SCALE, y: my - clip.numberPos.y * SCALE };
        } else if (hitTest(mx, my, numberBBox)) {
            dragging = 'number';
            dragOffset = { x: mx - state.layout.numberPos.x * SCALE, y: my - state.layout.numberPos.y * SCALE };
        } else if (state.clips.length > 0) {
            // Pan video
            dragging = 'video';
            dragOffset = { x: mx, y: my };
            const clip = state.clips[currentClipIndex];
            dragStartPan = { x: clip.panX || 0, y: clip.panY || 0 };
        }
    }
    if(dragging) canvas.style.cursor = 'grabbing';
});

canvas.addEventListener('mousemove', (e) => {
    const pos = canvasMousePos(e);
    const mx = pos.x, my = pos.y;

    if (dragging) {
        if (dragging === 'introCaption') {
            const cy = snapGuideY(my - dragOffset.y, 'introCaption');
            const cx = snapGuideX(mx - dragOffset.x, 'introCaption');
            state.intro.captionPos = {
                x: Math.max(0, Math.min(1, cx / PREVIEW_W)),
                y: Math.max(0, Math.min(1, cy / PREVIEW_H))
            };
        } else if (dragging === 'headline') {
            const cy = snapGuideY(my - dragOffset.y, 'headline');
            const cx = snapGuideX(mx - dragOffset.x, 'headline');
            state.screenTexts.headline.pos = {
                x: Math.max(0, Math.min(1, cx / PREVIEW_W)),
                y: Math.max(0, Math.min(1, cy / PREVIEW_H))
            };
        } else if (dragging === 'endQuestion') {
            const cy = snapGuideY(my - dragOffset.y, 'endQuestion');
            const cx = snapGuideX(mx - dragOffset.x, 'endQuestion');
            state.screenTexts.endQuestion.pos = {
                x: Math.max(0, Math.min(1, cx / PREVIEW_W)),
                y: Math.max(0, Math.min(1, cy / PREVIEW_H))
            };
        } else if (dragging === 'outroCaption') {
            const cy = snapGuideY(my - dragOffset.y, 'outroCaption');
            const cx = snapGuideX(mx - dragOffset.x, 'outroCaption');
            state.outro.captionPos = {
                x: Math.max(0, Math.min(1, cx / PREVIEW_W)),
                y: Math.max(0, Math.min(1, cy / PREVIEW_H))
            };
        } else if (dragging === 'voCaption') {
            const clip = state.clips[currentClipIndex];
            if (clip && clip.vo) {
                const cy = snapGuideY(my - dragOffset.y, 'voCaption');
                const cx = snapGuideX(mx - dragOffset.x, 'voCaption');
                ensureVo(clip).capPos = {
                    x: Math.max(0, Math.min(1, cx / PREVIEW_W)),
                    y: Math.max(0, Math.min(1, cy / PREVIEW_H))
                };
            }
        } else if (dragging === 'clipCaption') {
            const clip = state.clips[currentClipIndex];
            if (clip) {
                const cy = snapGuideY(my - dragOffset.y, 'clipCaption');
                const cx = snapGuideX(mx - dragOffset.x, 'clipCaption');
                clip.captionPos = {
                    x: Math.max(0, Math.min(1, cx / PREVIEW_W)),
                    y: Math.max(0, Math.min(1, cy / PREVIEW_H))
                };
            }
        } else if (dragging.startsWith('freezeText_')) {
            const idx = parseInt(dragging.split('_')[1]);
            const clip = state.clips[currentClipIndex];
            const ff = clip && clip.freezes ? clip.freezes[idx] : null;
            if (ff) {
                // posX/posY son el CENTRO del texto; compensar el agarre por el borde superior-izquierdo
                const cy = snapGuideY((my - dragOffset.y) + (dragOffset.hh || 0), dragging);
                const cx = snapGuideX((mx - dragOffset.x) + (dragOffset.hw || 0), dragging);
                ff.posX = Math.max(0, Math.min(1, cx / PREVIEW_W));
                ff.posY = Math.max(0, Math.min(1, cy / PREVIEW_H));
            }
        } else if (dragging === 'blurBar') {
            const clip = state.clips[currentClipIndex];
            const bar = clip && clip.blurBars ? clip.blurBars.find(b => b.id === dragOffset.id) : null;
            if (bar) {
                bar.x = Math.max(0, Math.min(EXPORT_W - bar.w, (mx - dragOffset.x) / SCALE));
                bar.y = Math.max(0, Math.min(EXPORT_H - bar.h, (my - dragOffset.y) / SCALE));
                const xInput = document.getElementById('bbInput_x_' + bar.id);
                const yInput = document.getElementById('bbInput_y_' + bar.id);
                const xSpan = document.getElementById('bbVal_x_' + bar.id);
                const ySpan = document.getElementById('bbVal_y_' + bar.id);
                if (xInput) xInput.value = Math.round(bar.x);
                if (yInput) yInput.value = Math.round(bar.y);
                if (xSpan) xSpan.textContent = Math.round(bar.x);
                if (ySpan) ySpan.textContent = Math.round(bar.y);
            }
        } else if (dragging === 'video') {
            let dx = (mx - dragOffset.x) / SCALE;
            let dy = (my - dragOffset.y) / SCALE;
            state.clips[currentClipIndex].panX = dragStartPan.x + dx;
            state.clips[currentClipIndex].panY = dragStartPan.y + dy;
        } else if (dragging.startsWith('number_')) {
            const idx = parseInt(dragging.split('_')[1]);
            const clip = state.clips[idx];
            const cy = snapGuideY(my - dragOffset.y, dragging);
            // La guía vertical se referencia al BORDE IZQUIERDO VISUAL del número (glifo real)
            const me = numberBBoxes.find(b => b.index === idx);
            const refOff = me ? ((me.left !== undefined ? me.left : me.x) - me.cx) : 0;
            const cxRef = snapGuideX((mx - dragOffset.x) + refOff, dragging);
            clip.numberPos = {
                x: (cxRef - refOff) / SCALE,
                y: cy / SCALE
            };
            numberPosTemplate[idx] = { ...clip.numberPos };
        } else {
            const cx = snapGuideX(mx - dragOffset.x, dragging);
            const newY = snapGuideY(my - dragOffset.y, dragging) / SCALE;
            if (dragging.startsWith('title_')) {
                const ti = parseInt(dragging.split('_')[1]);
                state.layout.titlePos[ti] = { x: cx / SCALE, y: newY };
            }
            if (dragging === 'number') state.layout.numberPos = { x: cx / SCALE, y: newY };
        }
        drawFrame();
    } else {
        if (hitTest(mx, my, introCaptionBBox) || hitTitleIndex(mx, my) !== -1 || hitTestNumber(mx, my) !== -1 || hitTest(mx, my, numberBBox) || hitTestBlurBar(mx, my) !== -1 || hitTest(mx, my, clipCaptionsBBox) || hitTest(mx, my, voCaptionBBox) || hitTest(mx, my, outroCaptionBBox)) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
    }
});

canvas.addEventListener('mouseup', () => {
    if (dragging) scheduleAutoSave();
    dragging = null;
    canvasGuideY = null;
    canvasGuideX = null;
    canvas.style.cursor = 'default';
});
canvas.addEventListener('mouseleave', () => {
    if (dragging) scheduleAutoSave();
    dragging = null;
    canvasGuideY = null;
    canvasGuideX = null;
    canvas.style.cursor = 'default';
});

// ═══════════════════════════════════════════════════════════
// ████  PLAYBACK & LOOP  ████
// ═══════════════════════════════════════════════════════════
function renderLoop() {
    // Durante la exportación no se dibuja el preview (el overlay lo tapa):
    // todo el presupuesto de GPU/CPU va al canvas de export para no dropear frames.
    if (!isExporting) drawFrame();
    if (isPlaying && !isExporting) updatePlaybackState();
    if (isExporting && exportCtx) tickExportFrame();   // cadencia fija de FPS + requestFrame
    if (!isDraggingTimeline) updateTimelineUI();
    requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

function getClipTrimDuration(clip) {
    return Math.max(0, (clip.trimEnd || 0) - (clip.trimStart || 0));
}

function getIntroOffset() {
    return state.intro.enabled ? state.intro.duration : 0;
}

function getOutroOffset() {
    return (state.outro && state.outro.enabled) ? (state.outro.durationSec || 0) : 0;
}

function getOutroElapsedTime() {
    if (!isInOutro) return 0;
    return (performance.now() - outroStartTime) / 1000;
}

function getClipsEnd() {
    return state.clips.reduce((max, clip) => {
        const start = Number.isFinite(clip.timelineStart) ? clip.timelineStart : 0;
        return Math.max(max, start + getClipTrimDuration(clip));
    }, 0);
}

function getIntroElapsedTime() {
    if (!isInIntro) return 0;
    return (performance.now() - introStartTime) / 1000;
}

function getTotalDuration() {
    return getIntroOffset() + getClipsEnd() + getOutroOffset();
}

function getTimelineScaleDuration() {
    const clipsEnd = getClipsEnd();
    const audioEnd = state.audioTracks.reduce((max, t) => {
        const dur = Math.max(0, (t.trimEnd || 0) - (t.trimStart || 0));
        return Math.max(max, (t.timelineStart || 0) + dur);
    }, 0);
    const total = getIntroOffset() + Math.max(clipsEnd, audioEnd) + getOutroOffset();
    state.timelineScaleDuration = Math.max(state.timelineScaleDuration || 0, total);
    return state.timelineScaleDuration;
}

function getElapsedTime() {
    if (isInIntro) return getIntroElapsedTime();
    if (isInOutro) {
        return getIntroOffset() + getClipsEnd() + getOutroElapsedTime();
    }
    const c = state.clips[currentClipIndex];
    if (!c) return getIntroOffset();
    const start = Number.isFinite(c.timelineStart) ? c.timelineStart : 0;
    if (c.videoEl) return getIntroOffset() + start + Math.max(0, c.videoEl.currentTime - c.trimStart);
    return getIntroOffset() + start;
}

function updateTimeDisplay() {
    const el = document.getElementById('timeDisplay');
    if (el) el.textContent = formatTime(getElapsedTime()) + ' / ' + formatTime(getTotalDuration());
}

// ─── TIMELINE ───
function updateTimelineUI() {
    if (!tlPlayheadEl || !tlInner) return;
    const x = getElapsedTime() * tlPxPerSec;
    tlPlayheadEl.style.left = x + 'px';
    if (isPlaying && !isExporting && !isDraggingTimeline && tlScroll) {
        const sl = tlScroll.scrollLeft, w = tlScroll.clientWidth;
        if (x < sl + 10 || x > sl + w - 40) tlScroll.scrollLeft = Math.max(0, x - w * 0.6);
    }
}

function renderTimelineClips() {
    if (!trackVideoEl) return;
    applyTlSize();
    trackVideoEl.innerHTML = '';
    const total = getTimelineScaleDuration();
    if (total <= 0) { drawRuler(); return; }

    // Intro segment
    const introOffset = getIntroOffset();
    if (introOffset > 0) {
        addTlStaticSeg(trackVideoEl, 0, introOffset, '🎬 Intro', 'Introducción · ' + formatTime(introOffset), () => seekToTime(0), false);
    }

    state.clips.forEach((clip, index) => {
        const start = introOffset + absClipStart(index);
        const duration = getClipTrimDuration(clip);
        // Clip sin video cargado: bloque visible, punteado y siempre encima
        // para que se pueda agarrar y mover aunque coincida en X con otro bloque.
        const isEmpty = !clip.file || duration <= 0;
        const sel = tlSelection && tlSelection.type === 'clip' && tlSelection.id === clip.id;
        const block = document.createElement('div');
        block.className = 'tl-block tl-vblock' + (sel ? ' selected' : '') + (index === currentClipIndex && !sel ? ' current' : '') + (isEmpty ? ' tl-empty' : '');
        block.dataset.clipId = clip.id;
        block.style.left = (start * tlPxPerSec) + 'px';
        block.style.width = (isEmpty ? Math.max(duration * tlPxPerSec, 30) : Math.max(duration * tlPxPerSec, 4)) + 'px';
        if (clip.thumbs && clip.thumbs.length && !isEmpty) {
            block.style.backgroundImage = 'url(' + clip.thumbs[0] + ')';
            block.style.backgroundSize = 'auto 100%';
            block.style.backgroundRepeat = 'repeat-x';
        }
        block.title = 'Clip ' + (index + 1) + ' · ' + (isEmpty ? 'sin video' : formatTime(duration)) + (clip.file ? ' · ' + clip.file.name : '');

        const label = document.createElement('span');
        label.className = 'tl-blabel';
        label.textContent = (clip.rankingPosition ? '#' + clip.rankingPosition + ' ' : '') + (clip.numberText || ('Clip ' + (index + 1))) + (isEmpty ? ' · sin video' : ' · ' + formatTime(duration));
        block.appendChild(label);

        block.addEventListener('pointerdown', e => onTlBlockDown(e, { type: 'clip', id: clip.id }));
        if (sel) {
            const ti = document.createElement('div');
            ti.className = 'trim-handle trim-in';
            ti.title = 'Recortar inicio: ' + formatTime(clip.trimStart);
            ti.addEventListener('pointerdown', e => startTrimDrag(e, { kind: 'clip', id: clip.id }, 'in'));
            const to = document.createElement('div');
            to.className = 'trim-handle trim-out';
            to.title = 'Recortar fin: ' + formatTime(clip.trimEnd);
            to.addEventListener('pointerdown', e => startTrimDrag(e, { kind: 'clip', id: clip.id }, 'out'));
            block.append(ti, to);
        }
        trackVideoEl.appendChild(block);
    });

    // Outro segment
    const outroDur = getOutroOffset();
    if (outroDur > 0) {
        const st = getIntroOffset() + getClipsEnd();
        addTlStaticSeg(trackVideoEl, st, outroDur, '🔔 Outro', 'Outro · ' + formatTime(outroDur), () => seekToTime(st), true);
    }
    ensureAllClipThumbs();
    drawRuler();
}

function updateTrimPreview(clip) {
    if (!clip.videoEl) return;
    clip.videoEl.currentTime = clip.trimStart;
    drawFrame();
    updateTimeDisplay();
    updateTimelineUI();
}

function startTrimDrag(event, target, edge) {
    if (isPlaying || isExporting) return;
    event.preventDefault();
    event.stopPropagation();
    const drag = { kind: target.kind, id: target.id, edge, pointerId: event.pointerId, startX: event.clientX, pixelsPerSecond: tlPxPerSec };
    if (target.kind === 'clip') {
        const clip = state.clips.find(c => c.id === target.id);
        if (!clip) return;
        currentClipIndex = state.clips.indexOf(clip);
        drag.startTimelineStart = clip.timelineStart || 0;
        drag.startTrimStart = clip.trimStart;
        drag.startTrimEnd = clip.trimEnd;
    } else if (target.kind === 'audio') {
        const track = state.audioTracks.find(t => t.id === target.id);
        if (!track) return;
        tlSelection = { type: 'audio', id: track.id };
        drag.origTrimStart = track.trimStart;
        drag.origTrimEnd = track.trimEnd;
        drag.origStart = track.timelineStart || 0;
    } else {
        return;
    }
    activeTrimDrag = drag;
    document.body.classList.add('trimming-clip');
    event.currentTarget.setPointerCapture?.(event.pointerId);
}

function updateTrimDrag(event) {
    if (!activeTrimDrag || event.pointerId !== activeTrimDrag.pointerId) return;
    const drag = activeTrimDrag;
    const delta = (event.clientX - drag.startX) / drag.pixelsPerSecond;

    if (drag.kind === 'clip') {
        const clip = state.clips.find(c => c.id === drag.id);
        if (!clip) return;
        const minDuration = 0.5;

        if (drag.edge === 'in') {
            // El borde IZQUIERDO sigue al cursor: trimStart y timelineStart aumentan juntos,
            // el borde derecho queda fijo. Se deja un hueco temporal que el repack cierra al soltar.
            const nextStart = clamp(drag.startTrimStart + delta, 0, drag.startTrimEnd - minDuration);
            const appliedDelta = nextStart - drag.startTrimStart;
            clip.trimStart = nextStart;
            clip.timelineStart = Math.max(0, drag.startTimelineStart + appliedDelta);
        } else {
            clip.trimEnd = clamp(drag.startTrimEnd + delta, drag.startTrimStart + minDuration, clip.duration || 9999);
            repackTimelineClips();
        }

        // Actualizar solo el estilo del bloque sin reconstruir el DOM
        const idx = state.clips.indexOf(clip);
        const blockEl = trackVideoEl && trackVideoEl.querySelector('[data-clip-id="' + drag.id + '"]');
        if (blockEl) {
            blockEl.style.left = ((getIntroOffset() + absClipStart(idx)) * tlPxPerSec) + 'px';
            blockEl.style.width = Math.max(getClipTrimDuration(clip) * tlPxPerSec, 4) + 'px';
        }
        if (drag.edge === 'in') {
            // Los bloques siguientes NO se mueven durante el drag: se ve el hueco temporal
            if (clip.videoEl && !isPlaying) { clip.videoEl.currentTime = clip.trimStart; drawFrame(); }
        } else {
            // Al recortar el final sí reposicionamos los siguientes (se acercan)
            state.clips.forEach((c, i) => {
                if (c.id === drag.id) return;
                const el = trackVideoEl && trackVideoEl.querySelector('[data-clip-id="' + c.id + '"]');
                if (el) el.style.left = ((getIntroOffset() + absClipStart(i)) * tlPxPerSec) + 'px';
            });
        }
        updateTimeDisplay();
        updateTrimDurationLabel(clip);
    } else if (drag.kind === 'audio') {
        const track = state.audioTracks.find(t => t.id === drag.id);
        if (!track) return;
        if (drag.edge === 'in') {
            const nt = clamp(drag.origTrimStart + delta, 0, drag.origTrimEnd - 0.05);
            track.timelineStart = Math.max(0, drag.origStart + (nt - drag.origTrimStart));
            track.trimStart = nt;
        } else {
            track.trimEnd = clamp(drag.origTrimEnd + delta, track.trimStart + 0.05, track.duration || 9999);
        }
        // Actualizar solo el estilo del bloque sin reconstruir el DOM
        const blockEl = trackAudioEl && trackAudioEl.querySelector('[data-track-id="' + drag.id + '"]');
        if (blockEl) {
            blockEl.style.left = ((track.timelineStart || 0) * tlPxPerSec) + 'px';
            const dur = Math.max(0, (track.trimEnd || 0) - (track.trimStart || 0)) || track.duration || 1;
            blockEl.style.width = Math.max(dur * tlPxPerSec, 5) + 'px';
        }
    }
}

function finishTrimDrag() {
    if (!activeTrimDrag) return;
    activeTrimDrag = null;
    document.body.classList.remove('trimming-clip');
    // Cerrar el hueco temporal dejado por el trim-in (timeline secuencial)
    repackTimelineClips();
    scheduleAutoSave();
    renderClipsList();
}

function updateTrimDurationLabel(clip) {
    const block = trackVideoEl ? trackVideoEl.querySelector('[data-clip-id="' + clip.id + '"]') : null;
    if (block) {
        const label = block.querySelector('.tl-blabel');
        if (label) {
            const idx = state.clips.indexOf(clip);
            label.textContent = (clip.rankingPosition ? '#' + clip.rankingPosition + ' ' : '') + (clip.numberText || ('Clip ' + (idx + 1))) + ' · ' + formatTime(getClipTrimDuration(clip));
        }
    }
    const cardLabel = document.querySelector('[data-duration-clip="' + clip.id + '"]');
    if (cardLabel) {
        const fileName = clip.file ? clip.file.name : 'Sin video';
        cardLabel.textContent = 'Clip ' + (state.clips.indexOf(clip) + 1) + ' - ' + fileName + ' (' + formatTime(getClipTrimDuration(clip)) + ')';
    }
}

// (listeners unificados más abajo)

function seekToTime(targetTime) {
    const total = getTimelineScaleDuration();
    targetTime = clamp(targetTime, 0, total);

    // Pause & mute all videos first
    state.clips.forEach(c => { if(c.videoEl) { c.videoEl.pause(); c.videoEl.muted = true; } });
    pauseAllAudioTracks();
    pauseAllStyleAudio();
    stopOutroPhase();
    resetStyleEngineState();
    if (introAudioEl) { introAudioEl.pause(); introAudioEl.muted = true; }
    isInIntro = false;

    const introOffset = getIntroOffset();

    if (targetTime < introOffset) {
        // Seeked into intro region — show first clip frame
        currentClipIndex = 0;
        const clip = state.clips[0];
        if (clip && clip.videoEl) clip.videoEl.currentTime = clip.trimStart;
        updateTimeDisplay();
        updateTimelineUI();
        renderClipsList();
        return;
    }

    const clipTime = targetTime - introOffset;
    let targetIndex = state.clips.length - 1;
    let offsetInClip = 0;
    for (let i = 0; i < state.clips.length; i++) {
        const clip = state.clips[i];
        const start = Number.isFinite(clip.timelineStart) ? clip.timelineStart : 0;
        const end = start + getClipTrimDuration(clip);
        if (clipTime <= end) {
            targetIndex = i;
            offsetInClip = Math.max(0, clipTime - start);
            break;
        }
    }

    currentClipIndex = targetIndex;
    const clip = state.clips[currentClipIndex];
    if (clip && clip.videoEl) {
        clip.videoEl.currentTime = clamp(clip.trimStart + offsetInClip, clip.trimStart, clip.trimEnd);
    }

    updateTimeDisplay();
    updateTimelineUI();
    renderClipsList(); // update selected clip and timeline segments
}

function getTimeFromTimelineX(clientX) {
    if (!tlInner) return 0;
    const rect = tlInner.getBoundingClientRect();
    return clamp((clientX - rect.left) / tlPxPerSec, 0, getTimelineScaleDuration());
}

function handleTimelineSeek(e) {
    if (isExporting || state.clips.length === 0) return;
    seekToTime(getTimeFromTimelineX(e.clientX));
}

if (tlInner) tlInner.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tl-block, .trim-handle, .caption-del, .tl-delbtn, .tl-ph-cap')) return;
    if (isExporting || state.clips.length === 0) return;
    e.preventDefault();
    isDraggingTimeline = true;
    handleTimelineSeek(e);
});

// Playhead: arrastrar solo desde el triángulo superior (cap)
if (tlPlayheadEl) {
    const cap = tlPlayheadEl.querySelector('.tl-ph-cap');
    if (cap) cap.addEventListener('pointerdown', (e) => {
        if (isExporting || state.clips.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        isDraggingTimeline = true;
        handleTimelineSeek(e);
    });
}

if (tlRulerCanvas) tlRulerCanvas.addEventListener('pointerdown', (e) => {
    if (isExporting || state.clips.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    isDraggingTimeline = true;
    const rect = tlScroll.getBoundingClientRect();
    seekToTime(clamp((e.clientX - rect.left + tlScroll.scrollLeft) / tlPxPerSec, 0, getTimelineScaleDuration()));
});

// ─── Arrastre unificado de bloques ───
document.addEventListener('pointermove', (e) => {
    if (activeTrimDrag) { updateTrimDrag(e); return; }
    if (tlDrag) { updateTlDrag(e); return; }
    if (isDraggingTimeline) {
        e.preventDefault();
        handleTimelineSeek(e);
    }
});

document.addEventListener('pointerup', (e) => {
    if (activeTrimDrag) { finishTrimDrag(); return; }
    if (tlDrag) { endTlDrag(e); return; }
    if (isDraggingTimeline) {
        isDraggingTimeline = false;
        // If it was playing, resume from new position
        if (isPlaying && !isExporting) playCurrentClip();
    }
});

// ═══════════════════════════════════════════════════════════
// ████  TIMELINE PRO: zoom · regla · miniaturas · FX · split ████
// ═══════════════════════════════════════════════════════════
function addTlStaticSeg(track, left, width, label, title, onClick, isOutro) {
    const seg = document.createElement('div');
    seg.className = 'tl-block tl-static' + (isOutro ? ' tl-outroseg' : '');
    seg.style.left = (left * tlPxPerSec) + 'px';
    seg.style.width = Math.max(width * tlPxPerSec, 6) + 'px';
    seg.title = title;
    const lbl = document.createElement('span');
    lbl.className = 'tl-blabel';
    lbl.style.position = 'static';
    lbl.textContent = label;
    seg.appendChild(lbl);
    seg.addEventListener('pointerdown', e => { e.stopPropagation(); onClick(); });
    track.appendChild(seg);
}

function setZoom(pps) {
    pps = clamp(pps, 6, 240);
    const rangeInput = document.getElementById('tlZoomRange');
    if (!tlScroll) { tlPxPerSec = pps; refreshTL(); return; }
    const rect = tlScroll.getBoundingClientRect();
    const anchorTime = (tlScroll.scrollLeft + rect.width / 2) / tlPxPerSec;
    tlPxPerSec = pps;
    refreshTL();
    tlScroll.scrollLeft = Math.max(0, anchorTime * tlPxPerSec - rect.width / 2);
    if (rangeInput) rangeInput.value = Math.round(tlPxPerSec);
}

function zoomTimeline(factor) { setZoom(Math.round(tlPxPerSec * factor)); }

function fitZoomTimeline() {
    if (!tlScroll) return;
    const rect = tlScroll.getBoundingClientRect();
    setZoom(clamp((rect.width - 20) / Math.max(getTotalDuration(), 0.5), 6, 240));
    tlScroll.scrollLeft = 0;
}

function refreshTL() {
    syncTlWidths();
    renderTimelineClips();
    renderAudioTracks();
    updateTimelineUI();
}

function syncTlWidths() {
    applyTlSize();
    drawRuler();
}

// Actualiza el ancho del inner y la variable CSS del grid según el zoom actual
function tlTotalDuration() { return Math.max(getTimelineScaleDuration(), 0.5); }
function tlContentWidth() { return Math.max(tlTotalDuration() * tlPxPerSec + 60, tlScroll ? tlScroll.clientWidth : 300); }
function absClipStart(i) { const c = state.clips[i]; return Number.isFinite(c && c.timelineStart) ? c.timelineStart : 0; }
function applyTlSize() {
    if (!tlInner) return;
    tlInner.style.width = tlContentWidth() + 'px';
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
    let st = steps[steps.length - 1];
    for (const s of steps) { if (s * tlPxPerSec >= 70) { st = s; break; } }
    tlInner.style.setProperty('--tl-grid', (st * tlPxPerSec));
}

function drawRuler() {
    if (!tlRulerCanvas || !tlScroll) return;
    const dpr = window.devicePixelRatio || 1;
    let w = tlRulerCanvas.clientWidth || (tlScroll.clientWidth || 300);
    if (w < 2) w = 300;
    const h = 20;
    tlRulerCanvas.width = Math.max(1, Math.round(w * dpr));
    tlRulerCanvas.height = Math.round(h * dpr);
    const c = tlRulerCanvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#101022';
    c.fillRect(0, 0, w, h);
    const scrollLeft = tlScroll.scrollLeft;
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
    let step = steps[steps.length - 1];
    for (const s of steps) { if (s * tlPxPerSec >= 70) { step = s; break; } }
    const sub = step / 5;
    c.strokeStyle = '#3a3a5a';
    c.fillStyle = '#8888aa';
    c.font = '9px Segoe UI, sans-serif';
    c.textBaseline = 'top';
    c.lineWidth = 1;
    let t = Math.floor(scrollLeft / tlPxPerSec / sub) * sub;
    t = Math.round(t * 1000) / 1000;
    for (; t * tlPxPerSec <= scrollLeft + w; t += sub) {
        const x = Math.round(t * tlPxPerSec - scrollLeft) + 0.5;
        const isMajor = Math.abs(t / step - Math.round(t / step)) < 1e-6;
        c.beginPath();
        c.moveTo(x, isMajor ? 7 : 13);
        c.lineTo(x, h);
        c.stroke();
        if (isMajor) c.fillText(formatTime(t), x + 3, 2);
    }
}

// Snap a playhead/bordes de clips/audios y segundos
function snapTime(t, exclude) {
    const candidates = [0, getElapsedTime()];
    state.clips.forEach((c, i) => { candidates.push(getIntroOffset() + absClipStart(i), getIntroOffset() + absClipStart(i) + getClipTrimDuration(c)); });
    state.audioTracks.forEach(tr => { candidates.push(tr.timelineStart || 0, (tr.timelineStart || 0) + (tr.trimEnd - tr.trimStart)); });
    let best = t, bestD = 8 / tlPxPerSec;
    for (const cand of candidates) {
        if (exclude !== undefined && Math.abs(cand - exclude) < 1e-6) continue;
        const d = Math.abs(cand - t);
        if (d < bestD) { bestD = d; best = cand; }
    }
    return best;
}

// ─── Selección y arrastre de bloques ───
function selectTlElement(type, id) {
    tlSelection = { type, id };
    if (type === 'clip') {
        const idx = state.clips.findIndex(c => c.id === id);
        if (idx !== -1 && !isPlaying) { currentClipIndex = idx; renderBlurBarsList(); }
    } else if (type === 'audio') {
        // solo selección visual
    }
    renderTimelineClips();
    renderAudioTracks();
}

function onTlBlockDown(e, target) {
    if (isExporting) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    // Selección visual SIN reconstruir el DOM
    tlSelection = { type: target.type, id: target.id };
    if (target.type === 'clip') {
        const idx = state.clips.findIndex(c => c.id === target.id);
        if (idx !== -1 && !isPlaying) { currentClipIndex = idx; renderBlurBarsList(); }
    }
    updateTlSelectionVisuals();

    const drag = { type: target.type, id: target.id, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
    if (target.type === 'clip') drag.index = state.clips.findIndex(c => c.id === target.id);
    else if (target.type === 'audio') { const tr = state.audioTracks.find(t => t.id === target.id); drag.origStart = tr ? tr.timelineStart : 0; }
    else if (target.type === 'vo') { const clip = state.clips.find(c => c.id === target.id); drag.origOffset = clip && clip.vo ? (clip.vo.offset || 0) : 0; }
    tlDrag = drag;
    // Capturar puntero en el bloque (no en un hijo) para recibir moves incluso fuera
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (err) {}
}

// Actualiza solo las clases CSS de selección sin reconstruir el DOM
function updateTlSelectionVisuals() {
    document.querySelectorAll('.tl-block.selected').forEach(b => b.classList.remove('selected'));
    if (!tlSelection) return;
    let sel = null;
    if (tlSelection.type === 'clip') sel = trackVideoEl && trackVideoEl.querySelector('[data-clip-id="' + tlSelection.id + '"]');
    else if (tlSelection.type === 'audio') sel = trackAudioEl && trackAudioEl.querySelector('[data-track-id="' + tlSelection.id + '"]');
    else if (tlSelection.type === 'vo') sel = trackFxEl && trackFxEl.querySelector('[data-vo-id="' + tlSelection.id + '"]');
    if (sel) sel.classList.add('selected');
}

function ensureVoKey(clip) { return clip.id; }

function updateTlDrag(e) {
    if (!tlDrag) return;
    const dx = e.clientX - tlDrag.startX;
    if (!tlDrag.moved && Math.abs(dx) < 6) return;
    if (!tlDrag.moved) { tlDrag.moved = true; }

    if (tlDrag.type === 'clip') {
        // Reordenar por arrastre horizontal
        tlDrag.dropIndex = computeDropIndex(e.clientX, tlDrag.index);
        showDropIndicator(tlDrag.dropIndex);
        const el = trackVideoEl.querySelector('[data-clip-id="' + tlDrag.id + '"]');
        if (el) el.style.transform = 'translateX(' + dx + 'px)';
    } else if (tlDrag.type === 'audio') {
        const tr = state.audioTracks.find(t => t.id === tlDrag.id);
        if (!tr) return;
        let nt = snapTime(Math.max(0, tlDrag.origStart + dx / tlPxPerSec), tr.timelineStart || 0);
        tr.timelineStart = nt;
        const el = trackAudioEl ? trackAudioEl.querySelector('[data-track-id="' + tlDrag.id + '"]') : null;
        if (el) el.style.left = (nt * tlPxPerSec) + 'px';
    } else if (tlDrag.type === 'vo') {
        const clip = state.clips.find(c => c.vo && c.id === tlDrag.id);
        if (!clip) return;
        const idx = state.clips.indexOf(clip);
        const minMs = 0;
        const maxMs = Math.max(0, (getClipTrimDuration(clip)) * 1000);
        let off = clamp(tlDrag.origOffset + dx / tlPxPerSec * 1000, minMs, maxMs);
        clip.vo.offset = Math.round(off);
        const el = trackFxEl ? trackFxEl.querySelector('[data-vo-id="' + clip.id + '"]') : null;
        if (el) el.style.left = ((getIntroOffset() + absClipStart(idx) + clip.vo.offset / 1000) * tlPxPerSec) + 'px';
    }
}

function computeDropIndex(clientX, draggedIndex) {
    if (!trackVideoEl) return draggedIndex;
    const px = clientX - trackVideoEl.getBoundingClientRect().left;
    let x = getIntroOffset() * tlPxPerSec;
    let insert = 0; // posición de inserción entre los demás clips
    for (let i = 0; i < state.clips.length; i++) {
        if (i === draggedIndex) continue;
        const w = getClipTrimDuration(state.clips[i]) * tlPxPerSec;
        if (px >= x + w / 2) insert++;
        x += w;
    }
    return clamp(insert, 0, state.clips.length - 1);
}

let dropIndicatorEl = null;
function showDropIndicator(index) {
    if (!trackVideoEl) return;
    if (!dropIndicatorEl) { dropIndicatorEl = document.createElement('div'); dropIndicatorEl.className = 'drop-indicator'; trackVideoEl.appendChild(dropIndicatorEl); }
    let x = getIntroOffset() * tlPxPerSec;
    for (let i = 0; i < index && i < state.clips.length; i++) x += getClipTrimDuration(state.clips[i]) * tlPxPerSec;
    dropIndicatorEl.style.left = x + 'px';
    dropIndicatorEl.style.display = 'block';
}
function hideDropIndicator() {
    if (dropIndicatorEl) { dropIndicatorEl.remove(); dropIndicatorEl = null; }
}

function endTlDrag(e) {
    const drag = tlDrag;
    tlDrag = null;
    hideDropIndicator();
    if (!drag) return;

    if (drag.type === 'clip' && drag.moved) {
        // Limpiar transform visual
        const el = trackVideoEl && trackVideoEl.querySelector('[data-clip-id="' + drag.id + '"]');
        if (el) el.style.transform = '';
        const insert = typeof drag.dropIndex === 'number' ? drag.dropIndex : null;
        if (insert !== null && insert !== drag.index && drag.index >= 0) {
            const [moved] = state.clips.splice(drag.index, 1);
            state.clips.splice(clamp(insert, 0, state.clips.length), 0, moved);
            repackTimelineClips();
            currentClipIndex = state.clips.indexOf(moved);
            renderClipsList();
            scheduleAutoSave();
        } else {
            renderTimelineClips();
        }
    } else if (drag.type === 'audio' && drag.moved) {
        const tr = state.audioTracks.find(t => t.id === drag.id);
        if (tr) { tr.timelineStart = snapTime(Math.max(0, tr.timelineStart), tr.timelineStart); }
        renderAudioTracks();
        scheduleAutoSave();
    } else if (drag.type === 'vo' && drag.moved) {
        renderClipsList();
        scheduleAutoSave();
    } else if (!drag.moved) {
        // Clic simple sin arrastre
        if (drag.type === 'clip') seekToTime(getIntroOffset() + absClipStart(state.clips.findIndex(c => c.id === drag.id)));
    }
    // Re-render completo para mostrar trim handles de la selección
    renderTimelineClips();
    renderAudioTracks();
    // Liberar pointer capture
    try { e.target.releasePointerCapture?.(e.pointerId); } catch (err) {}
}

// ─── Miniaturas de video (tira de frames) ───
function ensureAllClipThumbs() {
    state.clips.forEach(c => { if (!c.thumbs) ensureClipThumbs(c); });
}

function seekVideoOnce(v, t) {
    return new Promise(resolve => {
        let done = false;
        const fin = () => { if (!done) { done = true; v.onseeked = null; resolve(); } };
        v.onseeked = fin;
        try { v.currentTime = t; } catch (err) { fin(); }
        setTimeout(fin, 3000);
    });
}

async function ensureClipThumbs(clip) {
    if (clip.thumbs || !clip.url || clip._thumbsLoading) return;
    clip._thumbsLoading = true;
    try {
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.crossOrigin = 'anonymous';
        v.src = clip.url;
        // Esperar a que el video tenga datos suficientes para dibujar (no solo metadata)
        await new Promise((res) => {
            if (v.readyState >= 2) return res();
            v.addEventListener('canplay', res, { once: true });
            v.addEventListener('error', res, { once: true });
            setTimeout(res, 6000);
        });
        if (!v.videoWidth || !v.videoHeight) {
            // Forzar carga con play() + pause() inmediato
            try { await v.play(); v.pause(); } catch (err) {}
            await new Promise(r => setTimeout(r, 300));
        }
        if (!v.videoWidth || !v.videoHeight) { clip._thumbsLoading = false; return; }

        const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : (clip.duration || 1);
        const n = 4, cw = 36, ch = 64;
        const strip = document.createElement('canvas');
        strip.width = cw * n; strip.height = ch;
        const sc = strip.getContext('2d');
        let captured = 0;
        for (let k = 0; k < n; k++) {
            const tt = clamp((dur * (k + 0.5)) / n, 0, Math.max(0, dur - 0.05));
            await seekVideoOnce(v, tt);
            if (!v.videoWidth || !v.videoHeight) continue;
            const vw = v.videoWidth, vh = v.videoHeight;
            const targetRatio = cw / ch;
            let sw = vw, sh = vh;
            if (vw / vh > targetRatio) sw = vh * targetRatio; else sh = vw / targetRatio;
            sc.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, k * cw, 0, cw, ch);
            captured++;
        }
        if (captured === 0) { clip._thumbsLoading = false; return; }
        clip.thumbs = [strip.toDataURL('image/jpeg', 0.55)];
        putItem(STORE_VIDEOS, 'thumbs_' + clip.id, { img: clip.thumbs[0] }).catch(() => {});
        renderTimelineClips();
    } catch (err) {
        // silencioso
    } finally {
        clip._thumbsLoading = false;
    }
}

// ─── Pista FX: voz en off · freezes · SFX · voz del outro ───
function renderFxTrack() {
    if (!trackFxEl) return;
    trackFxEl.innerHTML = '';
    const introOffset = getIntroOffset();
    const sd = state.soundDesign;
    const lastIdx = state.clips.length - 1;

    // Voz en off por clip (arrastrable → ajusta offset)
    state.clips.forEach((clip, i) => {
        const vo = clip.vo;
        if (!vo || vo.enabled === false) return;
        if (!vo.fileName && !vo.text) return;
        const start = introOffset + absClipStart(i) + (vo.offset || 0) / 1000;
        const dur = Math.min(vo.duration || Math.max(1, (vo.text || '').split(/\s+/).filter(Boolean).length * 0.35), Math.max(getClipTrimDuration(clip), 1));
        const sel = tlSelection && tlSelection.type === 'vo' && tlSelection.id === clip.id;
        const b = document.createElement('div');
        b.className = 'tl-block tl-fblock' + (sel ? ' selected' : '');
        b.dataset.voId = clip.id;
        b.style.left = (start * tlPxPerSec) + 'px';
        b.style.width = Math.max(dur * tlPxPerSec, 8) + 'px';
        b.title = '🎙️ Voz en off clip ' + (i + 1) + (vo.text ? ': "' + vo.text + '"' : '') + ' — arrastra para ajustar el offset';
        b.textContent = '🎙️ ' + (i + 1);
        b.addEventListener('pointerdown', e => onTlBlockDown(e, { type: 'vo', id: clip.id }));
        trackFxEl.appendChild(b);
    });

    // Bandas de freeze frame
    state.clips.forEach((clip, i) => {
        (clip.freezes || []).forEach(ff => {
            const band = document.createElement('div');
            band.className = 'tl-freeze-band';
            band.style.left = ((introOffset + absClipStart(i) + ff.t) * tlPxPerSec) + 'px';
            band.style.width = Math.max(ff.dur * tlPxPerSec, 3) + 'px';
            band.title = '❄ Freeze: "' + (ff.text || '') + '" (' + ff.dur.toFixed(1) + 's en t=' + ff.t.toFixed(1) + 's)';
            trackFxEl.appendChild(band);
        });
    });

    // Marcadores SFX
    function addMark(time, cls, letter, title) {
        const m = document.createElement('div');
        m.className = 'tl-sfx-mark ' + cls;
        m.style.left = (time * tlPxPerSec) + 'px';
        m.title = title;
        m.innerHTML = '<span>' + letter + '</span>';
        trackFxEl.appendChild(m);
    }
    if (sd.bassHit && sd.bassHit.enabled) {
        state.clips.forEach((clip, i) => {
            const dur = getClipTrimDuration(clip);
            if (dur > 1) addMark(introOffset + absClipStart(i) + dur - 0.4, 'tl-sfx-bass', 'B', 'Golpe de bajos · final del clip ' + (i + 1));
        });
    }
    if (sd.transitionSfx && sd.transitionSfx.enabled) {
        for (let i = 1; i < state.clips.length; i++) {
            addMark(introOffset + absClipStart(i), 'tl-sfx-trans', 'T', 'SFX de transición · corte ' + i + '→' + (i + 1));
        }
    }
    if (sd.stingReveal && sd.stingReveal.enabled && lastIdx > 0) {
        addMark(introOffset + absClipStart(lastIdx), 'tl-sfx-sting', 'S', 'Sting · revelación #1');
    }

    // Voz del outro
    if (state.outro.enabled && state.outro.voiceFileName) {
        const st = introOffset + getClipsEnd();
        const b = document.createElement('div');
        b.className = 'tl-block tl-fblock';
        b.style.left = (st * tlPxPerSec) + 'px';
        b.style.width = Math.max((state.outro.durationSec || 5) * tlPxPerSec, 10) + 'px';
        b.title = '🔔 Voz del outro: ' + state.outro.voiceFileName;
        b.textContent = '🔔 voz outro';
        trackFxEl.appendChild(b);
    }
}

// ─── Dividir y eliminar desde el timeline ───
function splitSelectedTl() {
    if (isExporting || isPlaying) return;
    if (!tlSelection) return alert('Selecciona un bloque del timeline primero.');
    const t = getElapsedTime();

    if (tlSelection.type === 'clip') {
        const idx = state.clips.findIndex(c => c.id === tlSelection.id);
        if (idx === -1) return;
        const src = state.clips[idx];
        const rel = t - getIntroOffset() - absClipStart(idx);
        const dur = getClipTrimDuration(src);
        if (rel < 0.15 || rel > dur - 0.15) return alert('Coloca el playhead dentro del clip seleccionado para dividirlo.');

        const nc = {
            id: generateId(), file: src.file, videoEl: null, url: '',
            trimStart: src.trimStart + rel, trimEnd: src.trimEnd, duration: src.duration,
            percentage: '',
            captions: src.captions.filter(cp => cp.from >= rel).map(cp => ({ text: cp.text, from: Math.round((cp.from - rel) * 10) / 10, to: Math.round((cp.to - rel) * 10) / 10 })),
            captionsEnabled: src.captionsEnabled,
            numberText: '', numberColor: src.numberColor, rankingPosition: src.rankingPosition,
            numberPos: null, timelineStart: 0,
            panX: src.panX, panY: src.panY, volume: src.volume,
            blurBars: [], freezes: [], vo: null
        };
        // Elemento de video independiente para la parte derecha
        if (src.url) {
            const v = document.createElement('video');
            v.preload = 'auto'; v.muted = true; v.playsInline = true; v.src = src.url;
            videoContainer.appendChild(v);
            nc.videoEl = v;
            v.addEventListener('loadedmetadata', () => {
                nc.duration = v.duration;
                nc.trimEnd = Math.min(nc.trimEnd, v.duration);
                repackTimelineClips();
                renderClipsList();
            });
        }
        // El clip izquierdo conserva lo anterior al corte
        src.trimEnd = src.trimStart + rel;
        src.captions = src.captions.filter(cp => cp.to <= rel).map(cp => cp);

        state.clips.splice(idx + 1, 0, nc);
        repackTimelineClips();
        tlSelection = { type: 'clip', id: nc.id };
        renderClipsList();
        scheduleAutoSave();
    } else if (tlSelection.type === 'audio') {
        const idx = state.audioTracks.findIndex(tr => tr.id === tlSelection.id);
        if (idx === -1) return;
        const src = state.audioTracks[idx];
        const localCut = t - (src.timelineStart || 0);
        const avail = (src.trimEnd - src.trimStart);
        if (localCut < 0.05 || localCut > avail - 0.05) return alert('Coloca el playhead sobre el audio seleccionado para dividirlo.');

        const right = {
            id: 'aud_' + (++audioTrackIdCounter) + '_' + Date.now(),
            file: src.file, url: src.url, audioEl: null,
            name: src.name + ' (2)', duration: src.duration,
            timelineStart: (src.timelineStart || 0) + localCut,
            trimStart: src.trimStart + localCut, trimEnd: src.trimEnd,
            volume: src.volume
        };
        const audio = new Audio(right.url);
        audio.preload = 'auto'; audio.muted = true;
        videoContainer.appendChild(audio);
        right.audioEl = audio;
        audio.addEventListener('loadedmetadata', () => { if (right.duration === 0) right.duration = audio.duration; });

        src.trimEnd = src.trimStart + localCut;
        state.audioTracks.splice(idx + 1, 0, right);
        tlSelection = { type: 'audio', id: right.id };
        renderAudioTracks();
        renderTimelineClips();
        scheduleAutoSave();
    }
}

function deleteSelectedTl() {
    if (isExporting || !tlSelection) return;
    if (tlSelection.type === 'clip') removeClip(tlSelection.id);
    else if (tlSelection.type === 'audio') removeAudioTrack(tlSelection.id);
    tlSelection = null;
    renderTimelineClips();
    renderAudioTracks();
}

document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (isExporting) return;
    if (e.key === 's' || e.key === 'S') splitSelectedTl();
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelectedTl(); }
});

// ─── STYLE ENGINE: freezes · SFX · voz en off · outro ───
function resetStyleEngineState() {
    freezeRuntime = {};
    sfxFired = { bassIdx: -1, transIdx: -1, stingIdx: -1 };
    stopBleep();
}

function attachVoAudioEl(clip) {
    if (!clip.vo || !clip.vo._file) return;
    if (clip.vo.audioEl) { clip.vo.audioEl.pause(); clip.vo.audioEl.remove(); }
    const audio = new Audio(URL.createObjectURL(clip.vo._file));
    audio.preload = 'auto';
    audio.muted = true;
    videoContainer.appendChild(audio);
    clip.vo.audioEl = audio;
    audio.addEventListener('loadedmetadata', () => { clip.vo.duration = audio.duration; });
}

function attachSfxEl(kind) {
    const cfg = kind === 'bass' ? state.soundDesign.bassHit : kind === 'transition' ? state.soundDesign.transitionSfx : state.soundDesign.stingReveal;
    if (!cfg._file) return;
    if (sfxEls[kind]) { sfxEls[kind].pause(); sfxEls[kind].remove(); }
    const el = new Audio(URL.createObjectURL(cfg._file));
    el.preload = 'auto';
    el.muted = true;
    videoContainer.appendChild(el);
    sfxEls[kind] = el;
}

function attachOutroVoiceEl() {
    if (!state.outro._voiceFile) return;
    if (outroVoiceEl) { outroVoiceEl.pause(); outroVoiceEl.remove(); }
    outroVoiceEl = new Audio(URL.createObjectURL(state.outro._voiceFile));
    outroVoiceEl.preload = 'auto';
    outroVoiceEl.muted = true;
    videoContainer.appendChild(outroVoiceEl);
}

function playSfx(kind) {
    const el = sfxEls[kind];
    if (!el) return;
    const cfg = kind === 'bass' ? state.soundDesign.bassHit : kind === 'transition' ? state.soundDesign.transitionSfx : state.soundDesign.stingReveal;
    try { el.currentTime = 0; } catch(e) {}
    el.muted = false;
    el.volume = cfg.volume ?? 0.8;
    el.play().catch(() => {});
}

// ═══════════════════════════════════════════════════════════
// ████  CENSURA DE MALAS PALABRAS (inglés)  ████
// Silencia la fuente dentro de cada marca no excluida y dispara
// el beep importado por el usuario. Las marcas están en segundos
// ABSOLUTOS del archivo (video o voz), igual que currentTime.
// ═══════════════════════════════════════════════════════════
function attachBleepEl() {
    if (!state.censor._file) return;
    if (bleepEl) { bleepEl.pause(); bleepEl.remove(); }
    bleepEl = new Audio(URL.createObjectURL(state.censor._file));
    bleepEl.preload = 'auto';
    bleepEl.muted = true;
    videoContainer.appendChild(bleepEl);
}

function normalizeCensorWord(w) {
    return String(w || '').toLowerCase().replace(/[^a-z0-9']/g, '').replace(/'/g, '');
}

function getCensorWordSet() {
    const set = new Set();
    (state.censor.words || []).forEach(w => { const n = normalizeCensorWord(w); if (n) set.add(n); });
    return set;
}

function activeCensorMark(marks, t) {
    if (!marks || !marks.length) return null;
    for (const m of marks) {
        if (m.excluded) continue;
        if (t >= m.from && t < m.to) return m;
    }
    return null;
}

function stopBleep() {
    if (bleepEl && !bleepEl.paused) bleepEl.pause();
    if (bleepEl) bleepEl.loop = false;
    bleepActiveKey = null;
}

function startBleep(key, remainingSec) {
    if (!bleepEl || !state.censor._file) return;
    if (bleepActiveKey === key && !bleepEl.paused) return;
    bleepActiveKey = key;
    try { bleepEl.currentTime = 0; } catch(e) {}
    bleepEl.muted = false;
    bleepEl.volume = state.censor.bleepVolume ?? 0.9;
    // Si la palabra dura más que el beep, se repite en loop hasta salir de la marca
    bleepEl.loop = (isFinite(bleepEl.duration) && bleepEl.duration > 0 && bleepEl.duration < remainingSec);
    bleepEl.play().catch(() => {});
}

// Devuelve el volumen original de un elemento que la censura silenció
function restoreCensorVolumes(clip) {
    if (!clip) return;
    if (clip.videoEl && clip.videoEl._censorMuted) {
        clip.videoEl._censorMuted = false;
        clip.videoEl.volume = clip.volume ?? 1.0;
    }
    if (clip.vo && clip.vo.audioEl && clip.vo.audioEl._censorMuted) {
        clip.vo.audioEl._censorMuted = false;
        clip.vo.audioEl.volume = 1.0;
    }
}

// Tick del motor: se llama en cada frame de preview y de export
function tickCensorEngine() {
    const clip = state.clips[currentClipIndex];
    if (!state.censor.enabled || !clip) { restoreCensorVolumes(clip); stopBleep(); return; }

    let anyActive = false;

    // Audio del video del clip
    if (clip.videoEl && !clip.videoEl.paused) {
        const m = activeCensorMark(clip.censorMarks, clip.videoEl.currentTime);
        if (m) {
            clip.videoEl.volume = 0;
            clip.videoEl._censorMuted = true;
            startBleep('v_' + clip.id + '_' + m.id, Math.max(0.05, m.to - clip.videoEl.currentTime));
            anyActive = true;
        } else if (clip.videoEl._censorMuted) {
            clip.videoEl._censorMuted = false;
            clip.videoEl.volume = clip.volume ?? 1.0;
        }
    }

    // Voz en off del clip
    const vo = clip.vo;
    if (vo && vo.audioEl && !vo.audioEl.paused) {
        const m = activeCensorMark(vo.censorMarks, vo.audioEl.currentTime);
        if (m) {
            vo.audioEl.volume = 0;
            vo.audioEl._censorMuted = true;
            startBleep('vo_' + clip.id + '_' + m.id, Math.max(0.05, m.to - vo.audioEl.currentTime));
            anyActive = true;
        } else if (vo.audioEl._censorMuted) {
            vo.audioEl._censorMuted = false;
            vo.audioEl.volume = 1.0;
        }
    }

    if (!anyActive) stopBleep();
}

function pauseAllStyleAudio() {
    state.clips.forEach(c => { if (c.vo && c.vo.audioEl && !c.vo.audioEl.paused) c.vo.audioEl.pause(); });
    Object.values(sfxEls).forEach(el => { if (el && !el.paused) el.pause(); });
    if (bleepEl && !bleepEl.paused) { bleepEl.pause(); bleepEl.muted = true; }
    bleepActiveKey = null;
    if (outroVoiceEl && !outroVoiceEl.paused) { outroVoiceEl.pause(); outroVoiceEl.muted = true; }
}

function tickStyleEngine() {
    if (!isPlaying) return;
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.videoEl) return;

    // ── Freeze frames ──
    if (clip.freezes && clip.freezes.length) {
        const rel = clip.videoEl.currentTime - clip.trimStart;
        for (const ff of clip.freezes) {
            let st = freezeRuntime[ff.id];
            if ((!st || st.done) && rel >= ff.t) {
                freezeRuntime[ff.id] = { startedAt: performance.now(), done: false };
                try { clip.videoEl.pause(); } catch(e) {}
                st = freezeRuntime[ff.id];
            }
            if (st && !st.done && (performance.now() - st.startedAt) >= ff.dur * 1000) {
                st.done = true;
                clip.videoEl.play().catch(() => {});
            }
        }
    }

    // ── Sound design ──
    const sd = state.soundDesign;
    const lastIdx = state.clips.length - 1;
    if (sd.transitionSfx.enabled && currentClipIndex !== sfxFired.transIdx) {
        const prev = sfxFired.transIdx;
        sfxFired.transIdx = currentClipIndex;
        if (prev !== -1 && currentClipIndex > 0) playSfx('transition');
    }
    if (sd.stingReveal.enabled && lastIdx > 0 && currentClipIndex === lastIdx && sfxFired.stingIdx !== lastIdx) {
        sfxFired.stingIdx = lastIdx;
        playSfx('sting');
    }
    if (sd.bassHit.enabled) {
        const trimDur = getClipTrimDuration(clip);
        const rel = clip.videoEl.currentTime - clip.trimStart;
        if (trimDur > 1 && rel >= trimDur - 0.8 && sfxFired.bassIdx !== currentClipIndex) {
            sfxFired.bassIdx = currentClipIndex;
            playSfx('bass');
        }
    }
}

function syncVoiceovers(elapsed) {
    if (!state.voiceoversEnabled || (!isPlaying && !isExporting)) return;
    state.clips.forEach(clip => {
        const vo = clip.vo;
        if (!vo || !vo.audioEl) return;
        if (vo.enabled === false) { if (!vo.audioEl.paused) vo.audioEl.pause(); return; }
        const start = getVoStartTime(clip);
        const local = elapsed - start;
        if (local < 0 || local >= (vo.duration || Infinity)) {
            if (!vo.audioEl.paused) vo.audioEl.pause();
            return;
        }
        if (vo.audioEl.paused) {
            if (Math.abs(vo.audioEl.currentTime - local) > 0.25) { try { vo.audioEl.currentTime = local; } catch(e) {} }
            vo.audioEl.muted = false;
            vo.audioEl.volume = 1.0;
            vo.audioEl.play().catch(() => {});
        } else if (Math.abs(vo.audioEl.currentTime - local) > 0.5) {
            try { vo.audioEl.currentTime = local; } catch(e) {}
        }
    });
}

function startOutroPhase() {
    isInOutro = true;
    outroStartTime = performance.now();
    if (outroVoiceEl) {
        try { outroVoiceEl.currentTime = 0; } catch(e) {}
        outroVoiceEl.muted = false;
        outroVoiceEl.volume = 1.0;
        outroVoiceEl.play().catch(() => {});
    }
}

function stopOutroPhase() {
    isInOutro = false;
    if (outroVoiceEl) { outroVoiceEl.pause(); outroVoiceEl.muted = true; }
}

// Pre-carga el clip siguiente: seek a su trimStart justo antes de la transición,
// así el cambio de clip no congeló frames esperando seek+buffer (export y preview).
function preloadNextClip() {
    const cur = state.clips[currentClipIndex];
    const next = state.clips[currentClipIndex + 1];
    if (!cur || !cur.videoEl || !next || !next.videoEl || next._preloaded) return;
    const remaining = (cur.trimEnd || 0) - cur.videoEl.currentTime;
    if (remaining > 0.5 || cur.videoEl.paused) return;
    next._preloaded = true;
    const seekToStart = () => {
        try { if (next.videoEl.currentTime !== next.trimStart) next.videoEl.currentTime = next.trimStart; } catch(e) {}
    };
    if (next.videoEl.readyState >= 1) seekToStart();
    else next.videoEl.addEventListener('loadedmetadata', seekToStart, { once: true });
}

async function playCurrentClip() {
    if (currentClipIndex >= state.clips.length) {
        if (isExporting) { isPlaying = false; stopExportRecording(); }
        else stopPlayback();
        return;
    }
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.videoEl) return;

    clip._starting = true;
    try {
        // Wait for video to be ready (without forcing a reload)
        if (clip.videoEl.readyState < 2) {
            await new Promise((resolve) => {
                const onReady = () => { clip.videoEl.removeEventListener('canplay', onReady); resolve(); };
                clip.videoEl.addEventListener('canplay', onReady);
                setTimeout(() => { clip.videoEl.removeEventListener('canplay', onReady); resolve(); }, 5000);
            });
        }

        // Set to trim start (siempre que esté fuera de la ventana o venga de un seek decorativo del intro)
        if (clip._introSeek || clip.videoEl.currentTime < clip.trimStart || clip.videoEl.currentTime >= clip.trimEnd) {
            clip._introSeek = false;
            clip.videoEl.currentTime = clip.trimStart;
        }

        try { await clip.videoEl.play(); }
        catch (e) {
            await new Promise(r => setTimeout(r, 200));
            try { await clip.videoEl.play(); } catch(e2) {}
        }

        // Unmute active clip, mute all others
        clip.videoEl.muted = false;
        clip.videoEl.volume = (clip.volume ?? 1.0);
        state.clips.forEach(c => {
            if (c.videoEl && c !== clip) { c.videoEl.muted = true; }
        });
    } finally {
        clip._starting = false;
    }
}

function updatePlaybackState() {
    if (isInIntro) {
        updateTimeDisplay();
        const elapsed = getIntroElapsedTime();
        syncAudioPlayback(elapsed);
        if (elapsed >= state.intro.duration) {
            isInIntro = false;
            stopIntroBgClip();
            if (introAudioEl) { introAudioEl.pause(); introAudioEl.muted = true; }
            currentClipIndex = 0;
            playCurrentClip();
        }
        return;
    }
    if (isInOutro) {
        updateTimeDisplay();
        if (getOutroElapsedTime() >= state.outro.durationSec) stopPlayback();
        return;
    }
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.videoEl) return stopPlayback();
    updateTimeDisplay();
    const elapsed = getElapsedTime();
    syncAudioPlayback(elapsed);
    tickStyleEngine();
    syncVoiceovers(elapsed);
    tickCensorEngine();
    preloadNextClip();
    if (!clip._starting && !clip.videoEl.seeking && (clip.videoEl.ended || clip.videoEl.currentTime >= clip.trimEnd)) {
        clip.videoEl.muted = true;
        clip.videoEl.pause();
        // Aparcar el clip en su inicio para que el próximo replay no se salte ninguna parte
        try { clip.videoEl.currentTime = clip.trimStart; } catch(e) {}
        currentClipIndex++;
        if (currentClipIndex < state.clips.length) playCurrentClip();
        else if (getOutroOffset() > 0) startOutroPhase();
        else stopPlayback();
    }
}

function startIntro() {
    isInIntro = true;
    introStartTime = performance.now();

    // Reproducir el video de fondo elegido desde su inicio durante la intro
    const bgClip = getIntroBgClip();
    if (bgClip && bgClip.videoEl) {
        try {
            bgClip.videoEl.currentTime = bgClip.trimStart || 0;
        } catch(e) {}
        bgClip.videoEl.muted = state.intro.bgMuted !== false;
        bgClip.videoEl.volume = (bgClip.volume ?? 1.0);
        bgClip.videoEl.play().catch(() => {});
        // Marcar para que playCurrentClip lo rebobine a trimStart antes de reproducirlo
        bgClip._introSeek = true;
    }

    // Play intro audio if available
    if (introAudioEl) {
        introAudioEl.currentTime = 0;
        introAudioEl.muted = false;
        introAudioEl.volume = 1.0;
        introAudioEl.play().catch(() => {});
    }
}

function stopIntroBgClip() {
    const bgClip = getIntroBgClip();
    if (bgClip && bgClip.videoEl) {
        try { bgClip.videoEl.pause(); } catch(e) {}
        bgClip.videoEl.muted = true;
    }
}

function togglePlay() {
    if (isExporting || state.clips.length === 0) return;
    if (isPlaying) {
        isPlaying = false; document.getElementById('btnPlay').textContent = '▶ Play';
        if (isInIntro) { isInIntro = false; if (introAudioEl) { introAudioEl.pause(); introAudioEl.muted = true; } }
        stopOutroPhase();
        pauseAllStyleAudio();
        state.clips.forEach(c => { if(c.videoEl) { c.videoEl.pause(); c.videoEl.muted = true; } });
        pauseAllAudioTracks();
    } else {
        if (currentClipIndex >= state.clips.length) currentClipIndex = 0;
        resetStyleEngineState();
        isPlaying = true; document.getElementById('btnPlay').textContent = '⏸ Pausa';
        if (state.intro.enabled && currentClipIndex === 0 && !isInIntro) {
            startIntro();
        } else {
            playCurrentClip();
        }
    }
}

function stopPlayback() {
    isPlaying = false; document.getElementById('btnPlay').textContent = '▶ Play';
    isInIntro = false;
    stopOutroPhase();
    pauseAllStyleAudio();
    resetStyleEngineState();
    if (introAudioEl) { introAudioEl.pause(); introAudioEl.muted = true; }
    pauseAllAudioTracks();
    state.clips.forEach(c => { if(c.videoEl) { c.videoEl.pause(); c.videoEl.muted = true; c.videoEl.currentTime = c.trimStart; }});
    currentClipIndex = 0; updateTimeDisplay();
}

// ═══════════════════════════════════════════════════════════
// ████  EXPORT  ████
// ═══════════════════════════════════════════════════════════
let exportRecorder, exportChunks, exportCanvas, exportCtx;
let exportAudioCtx = null;   // shared AudioContext (sources are permanent per element)
let exportAudioDest = null;  // recording destination for the current export

function drawExportFrame() {
    if (isInIntro) {
        drawIntroFrame(exportCtx, 1);
        updateExportProgress();
        return true;
    }
    if (isInOutro) {
        drawOutroFrame(exportCtx, 1);
        updateExportProgress();
        return true;
    }
    exportCtx.fillStyle = '#000'; exportCtx.fillRect(0, 0, EXPORT_W, EXPORT_H);
    const clip = state.clips[currentClipIndex];
    // Dibujar el video del clip actual aunque esté en preparación: si aún no
    // tiene frame, se retiene el último (hold) para no congelar el timeline
    // mientras el audio avanza. Esto mantiene el video y el audio en sync.
    const drew = clip ? drawVideoContain(exportCtx, clip, 0, 0, EXPORT_W, EXPORT_H, 1) : false;
    if (!drew && exportHoldCanvas) exportCtx.drawImage(exportHoldCanvas, 0, 0);
    drawBlurBars(exportCtx, 1);
    drawBarsAndPercentage(exportCtx, 1);
    state.title.lines.forEach((line, i) => {
        drawTitleLine(exportCtx, line, getTitlePos(i), getTitleLineFont(i), getTitleLineSize(i), state.title.textColor, 1);
    });
    drawNumbers(exportCtx, 1);
    drawCaptions(exportCtx, 1);
    drawFreezeOverlays(exportCtx, 1);
    drawScreenTexts(exportCtx, 1);
    drawVoCaptions(exportCtx, 1);
    updateExportProgress();
    return true;
}

// ─── Captura de frames determinista (ruta MediaRecorder) ───
let exportVideoTrack = null;   // track manual (requestFrame) si está disponible
let exportStreamEl = null;     // stream (requestFrame legacy en algunos navegadores)
let exportKeepAlive = null;    // intervalo de respaldo si la pestaña se oculta
let exportLastDraw = -1e9;     // marca de tiempo del último frame dibujado

function pushExportFrame() {
    if (exportVideoTrack && typeof exportVideoTrack.requestFrame === 'function') exportVideoTrack.requestFrame();
    else if (exportStreamEl && typeof exportStreamEl.requestFrame === 'function') exportStreamEl.requestFrame();
}

// ═══════════════════════════════════════════════════════════
// ████  EXPORT WEBCODECS (calidad superior)  ████
// ═══════════════════════════════════════════════════════════
// MediaRecorder encodea en tiempo real con codificadores por software en modo
// "rapidez" (sacrifica calidad para no quedarse atrás). Con WebCodecs se usa el
// encoder H.264 por hardware cuando existe, en modo calidad, con timestamps CFR
// exactos (60 fps constantes) y audio AAC/Opus capturado vía AudioWorklet.
let wcExport = null;   // estado del export WebCodecs activo (null = ruta MediaRecorder)

function webCodecsSupported() {
    return !!(window.VideoEncoder && window.AudioEncoder && window.Mp4Muxer && window.AudioWorkletNode);
}

// Worklet que captura el PCM mezclado del grafo de audio del export.
// No envía nada hasta recibir el comando 'start'. Cada buffer viaja con su
// tiempo ABSOLUTO del AudioContext (currentTime); el hilo principal lo mapea
// al reloj del video (performance.now) vía getOutputTimestamp → mismo reloj
// para las dos pistas, sin deriva ni sesgo de arranque.
const PCM_TAP_WORKLET = `
class PCMTapProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._armed = false;
        this.port.onmessage = (e) => { if (e.data && e.data.cmd === 'start') this._armed = true; };
    }
    process(inputs) {
        if (!this._armed) return true;
        const input = inputs[0];
        if (input && input[0] && input[0].length) {
            const left = new Float32Array(input[0]);
            const right = new Float32Array(input[1] || input[0]);
            this.port.postMessage({ ctx: currentTime, left, right }, [left.buffer, right.buffer]);
        }
        return true;
    }
}
registerProcessor('pcm-tap', PCMTapProcessor);`;

let pcmWorkletPromise = null;
function ensurePcmWorklet() {
    if (!pcmWorkletPromise) {
        const url = URL.createObjectURL(new Blob([PCM_TAP_WORKLET], { type: 'application/javascript' }));
        pcmWorkletPromise = exportAudioCtx.audioWorklet.addModule(url)
            .catch(e => { pcmWorkletPromise = null; throw e; })
            .finally(() => URL.revokeObjectURL(url));
    }
    return pcmWorkletPromise;
}

// Prepara encoders + muxer del export WebCodecs. Devuelve el objeto de estado
// o lanza un error (el llamador caerá a la ruta MediaRecorder).
async function setupWebCodecsExport(srcNodes) {
    if (!webCodecsSupported() || !exportAudioCtx) throw new Error('WebCodecs o AudioContext no disponibles');

    // ── Video: H.264 (preferir hardware), candidatos de profile/level ──
    // latencyMode 'realtime': sin B-frames ni lookahead → la cola del encoder
    // refleja sobrecarga REAL (en hardware se mantiene ~0, así la cadencia de
    // 60 fps nunca se degrada sin motivo). Con 24 Mbps fijo, la calidad por
    // frame de un encoder hardware sigue siendo excelente.
    const vCandidates = ['avc1.640034', 'avc1.640033', 'avc1.4d0034', 'avc1.640028'];
    let vCfg = null;
    for (const codec of vCandidates) {
        for (const hw of ['prefer-hardware', 'no-preference']) {
            const cfg = {
                codec, width: EXPORT_W, height: EXPORT_H,
                bitrate: 24000000, framerate: FPS,
                latencyMode: 'realtime', hardwareAcceleration: hw,
                avc: { format: 'avc' }
            };
            try {
                const s = await VideoEncoder.isConfigSupported(cfg);
                if (s && s.supported) { vCfg = cfg; break; }
            } catch (e) { /* probar siguiente */ }
        }
        if (vCfg) break;
    }
    if (!vCfg) throw new Error('Sin encoder H.264 disponible');

    // ── Audio: AAC si se puede (compatibilidad total), si no Opus (48 kHz) ──
    const sr = exportAudioCtx.sampleRate;
    let aCfg = null;
    if (srcNodes.length) {
        const aCands = [{ codec: 'mp4a.40.2', bitrate: 192000, sampleRate: sr, numberOfChannels: 2 }];
        if (sr === 48000) aCands.push({ codec: 'opus', bitrate: 192000, sampleRate: sr, numberOfChannels: 2 });
        for (const c of aCands) {
            try { const s = await AudioEncoder.isConfigSupported(c); if (s && s.supported) { aCfg = c; break; } } catch (e) { /* siguiente */ }
        }
        if (!aCfg) throw new Error('Sin encoder de audio disponible');
    }

    // ── Tap PCM conectado a todas las fuentes del export ──
    await ensurePcmWorklet();
    const tap = new AudioWorkletNode(exportAudioCtx, 'pcm-tap', { numberOfInputs: 1, numberOfOutputs: 0 });
    srcNodes.forEach(n => { try { n.connect(tap); } catch (e) { /* fuente ya desconectada */ } });

    // ── Muxer MP4 ──
    const target = new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({
        target,
        video: { codec: 'avc', width: EXPORT_W, height: EXPORT_H, frameRate: FPS },
        audio: aCfg ? { codec: aCfg.codec === 'mp4a.40.2' ? 'aac' : 'opus', numberOfChannels: 2, sampleRate: aCfg.sampleRate } : undefined,
        firstTimestampBehavior: 'cross-track-offset',
        fastStart: 'in-memory'
    });

    const venc = new VideoEncoder({
        output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { console.error('mux video:', e); } },
        error: e => console.error('VideoEncoder:', e)
    });
    venc.configure(vCfg);

    let aenc = null;
    if (aCfg) {
        aenc = new AudioEncoder({
            output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { console.error('mux audio:', e); } },
            error: e => console.error('AudioEncoder:', e)
        });
        aenc.configure(aCfg);
        // Anclaje del reloj de audio por LLEGADA del mensaje: el quantum d.ctx se
        // renderizó en el instante en que llega su mensaje (±1-2ms de IPC). Se
        // re-ancla periódicamente para cancelar cualquier deriva entre el reloj
        // del AudioContext y performance.now (el mismo del video).
        // NOTA: no usar getOutputTimestamp(): incluye la latencia de salida y en
        // algunos entornos devuelve valores congelados → sesgo de decenas de ms.
        let arrivalMap = null;
        tap.port.onmessage = (ev) => {
            const w = wcExport;
            if (!w || !w.recording || w.stopped) return;
            const d = ev.data;
            if (!d || d.ctx == null) return;
            const nowP = performance.now();
            if (!arrivalMap || d.ctx - arrivalMap.ctx > 0.25) arrivalMap = { ctx: d.ctx, perf: nowP };
            const tMs = arrivalMap.perf + (d.ctx - arrivalMap.ctx) * 1000 - w.t0;
            if (tMs < 0) return;   // audio anterior al arranque de la grabación
            const n = d.left.length;
            const inter = new Float32Array(n * 2);
            for (let i = 0; i < n; i++) { inter[2 * i] = d.left[i]; inter[2 * i + 1] = d.right[i]; }
            try {
                const ad = new AudioData({
                    format: 'f32', sampleRate: aCfg.sampleRate,
                    numberOfFrames: n, numberOfChannels: 2,
                    timestamp: Math.round(tMs * 1000), data: inter
                });
                aenc.encode(ad);
                ad.close();
            } catch (e) { console.error('AudioData/encode:', e); }
        };
    }

    // recording: false hasta que startWebCodecsRecording() fije el t0 — evita que
    // tickExportFrame encod-e frames con timestamps arbitrarios durante la preparación
    return { tap, venc, aenc, muxer, target, t0: 0, vidFrame: 0, recording: false, stopped: false, finalizing: false, cancelled: false, fellBack: false, noFallback: !!window.__wcNoFallback };
}

// Arranca la grabación WebCodecs: arma el tap de audio y fija el t0 compartido
function startWebCodecsRecording() {
    if (!wcExport) return;
    wcExport.tap.port.postMessage({ cmd: 'start' });
    wcExport.t0 = performance.now();
    wcExport.recording = true;   // a partir de aquí se pueden encodar frames
}

// Encoda el estado actual del canvas de export como frame #idx (CFR exacto)
function encodeWcFrame(idx) {
    const w = wcExport;
    if (!w || w.stopped) return;
    try {
        const vf = new VideoFrame(exportCanvas, { timestamp: Math.round(idx * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
        w.venc.encode(vf, { keyFrame: idx % (FPS * 2) === 0 });
        vf.close();
    } catch (e) { console.error('encode frame:', e); }
}

async function finalizeWebCodecsExport() {
    const w = wcExport;
    if (!w || w.finalizing) return;
    w.finalizing = true;
    w.stopped = true;
    try {
        // Encodar los frames que falten hasta el instante de corte
        const target = Math.floor((performance.now() - w.t0) * FPS / 1000);
        while (w.vidFrame <= target) { encodeWcFrame(w.vidFrame); w.vidFrame++; }
        await w.venc.flush();
        if (w.aenc) await w.aenc.flush();
        w.muxer.finalize();
        if (!w.cancelled) {
            const blob = new Blob([w.target.buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'ranking_video.mp4';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            // Validación automática 60 CFR (frames codificados / 60 = segundos)
            validateExportedFile(blob, w.vidFrame / FPS);
        }
    } catch (e) {
        console.error('Finalizando export WebCodecs:', e);
        if (!w.cancelled) alert('Hubo un problema al finalizar el video exportado.');
    }
    finishExport();
}

// Finaliza la grabación sea cual sea la ruta activa
function stopExportRecording() {
    if (wcExport) finalizeWebCodecsExport();   // async por dentro; no bloquea el loop
    else exportRecorder?.stop();
}

// Reintenta el export con la ruta MediaRecorder (cuando el encoder WebCodecs
// no sostiene la cadencia: p. ej. sin codificación H.264 por hardware)
let forceRecorderExport = false;
async function fallbackToRecorderExport() {
    console.warn('Encoder WebCodecs no sostiene la cadencia: cambiando a MediaRecorder.');
    const txt = document.getElementById('exportProgressText');
    if (txt) txt.textContent = 'Reiniciando con el codificador del navegador...';
    if (wcExport) { wcExport.cancelled = true; wcExport.stopped = true; }
    finishExport();                       // limpieza total del intento (sin descargar nada)
    forceRecorderExport = true;
    try { await startExport(); }
    catch (e) { console.error('Reintento de export:', e); }
    forceRecorderExport = false;
}

// Dibuja y encoda/push-ea frames según la ruta activa.
// · WebCodecs: CFR exacto — encoda TODOS los frames (step=1 siempre) para
//   garantizar 60 fps constantes sin saltos. Si el encoder se atrasa, se
//   duplica el contenido actual del canvas en cada frame faltante (misma
//   imagen → transición suave idéntica a la preview). Solo se pausa si la
//   cola está completamente saturada; en cuanto hay hueco se rellena.
// · MediaRecorder: cadencia fija de FPS + requestFrame manual.
function tickExportFrame() {
    if (!isExporting || !exportCtx) return;
    const now = performance.now();
    if (wcExport) {
        const w = wcExport;
        if (!w.recording) return;   // aún preparando el primer clip: no encodar
        // Cola completamente saturada: esperar sin avanzar para no crashear el encoder.
        // En hardware esto prácticamente nunca ocurre (cola ~0-3).
        if (w.venc.encodeQueueSize > 60) return;
        // Al arrancar: si la cola se dispara rápido, caer a MediaRecorder (1 vez)
        if (w.venc.encodeQueueSize > 40 && now - w.t0 < 3000 && !w.noFallback && !w.fellBack) {
            w.fellBack = true;
            fallbackToRecorderExport();
            return;
        }
        const target = Math.floor((now - w.t0) * FPS / 1000);
        if (target < w.vidFrame) return;
        drawExportFrame();   // refresca el canvas (transiciones: hold del frame anterior si el nuevo no está listo)
        // Encodar TODOS los frames faltantes uno a uno (step=1 siempre) para
        // que el video tenga exactamente 60 fps. Si el rAF se perdió algún
        // beat, el canvas ya tiene el contenido más reciente y se duplica
        // → suavidad idéntica a la preview.
        const maxBurst = 8;   // limitar ráfagas por tick para no bloquear el hilo
        let encoded = 0;
        while (w.vidFrame <= target && encoded < maxBurst) {
            if (w.venc.encodeQueueSize > 60) break;
            encodeWcFrame(w.vidFrame);
            w.vidFrame++;
            encoded++;
        }
        return;
    }
    const frameMs = 1000 / FPS;
    if (now - exportLastDraw < frameMs - 1.5) return;   // aún no toca el siguiente frame
    exportLastDraw = now;
    if (drawExportFrame()) pushExportFrame();
}

async function startExport() {
    if (state.clips.length === 0) return alert('Agrega al menos un clip.');
    if (!checkFpsBeforeExport()) return;   // aviso si hay clips sin normalizar a 60 CFR
    stopPlayback();
    // Asegurar que todas las fuentes usadas estén cargadas antes de capturar frames
    await preloadUsedFonts();
    isExporting = true; exportChunks = [];
    exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_W; exportCanvas.height = EXPORT_H;
    exportCtx = exportCanvas.getContext('2d');

    // ─── AUDIO CAPTURE ───
    // Route each clip's audio into a recording destination (not to speakers).
    // MediaElementAudioSourceNode can only be created ONCE per element, so we cache it.
    exportAudioDest = null;
    const exportSrcNodes = [];   // fuentes conectadas (para ruta WebCodecs: también al tap PCM)
    const connectSrc = (node) => {
        try { node.disconnect(); } catch(e) {}
        node.connect(exportAudioDest);
        exportSrcNodes.push(node);
    };
    try {
        if (!exportAudioCtx) {
            // 48 kHz: lo exigen Opus y AAC sin remuestreo en la ruta WebCodecs
            try { exportAudioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 }); }
            catch (e) { exportAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        }
        await exportAudioCtx.resume();
        exportAudioDest = exportAudioCtx.createMediaStreamDestination();
        state.clips.forEach(c => {
            if (!c.videoEl) return;
            if (!c.audioSourceNode) {
                c.audioSourceNode = exportAudioCtx.createMediaElementSource(c.videoEl);
            }
            connectSrc(c.audioSourceNode);
            c.videoEl.muted = false;
            c.videoEl.volume = (c.volume ?? 1.0);
        });
        // Route intro audio element too
        if (introAudioEl) {
            if (!introAudioEl._audioSourceNode) {
                introAudioEl._audioSourceNode = exportAudioCtx.createMediaElementSource(introAudioEl);
            }
            connectSrc(introAudioEl._audioSourceNode);
            introAudioEl.muted = false;
        }
        // Route audio tracks too
        state.audioTracks.forEach(t => {
            if (!t.audioEl) return;
            if (!t.audioSourceNode) {
                t.audioSourceNode = exportAudioCtx.createMediaElementSource(t.audioEl);
            }
            connectSrc(t.audioSourceNode);
            t.audioEl.muted = false;
        });
        // Route voiceovers, SFX and outro voice
        state.clips.forEach(c => {
            if (!c.vo || !c.vo.audioEl) return;
            if (!c.vo.audioSourceNode) {
                c.vo.audioSourceNode = exportAudioCtx.createMediaElementSource(c.vo.audioEl);
            }
            connectSrc(c.vo.audioSourceNode);
        });
        Object.values(sfxEls).forEach(el => {
            if (!el) return;
            if (!el._audioSourceNode) el._audioSourceNode = exportAudioCtx.createMediaElementSource(el);
            connectSrc(el._audioSourceNode);
        });
        // Route censor bleep too
        if (bleepEl) {
            if (!bleepEl._audioSourceNode) bleepEl._audioSourceNode = exportAudioCtx.createMediaElementSource(bleepEl);
            connectSrc(bleepEl._audioSourceNode);
        }
        if (outroVoiceEl) {
            if (!outroVoiceEl._audioSourceNode) outroVoiceEl._audioSourceNode = exportAudioCtx.createMediaElementSource(outroVoiceEl);
            connectSrc(outroVoiceEl._audioSourceNode);
        }
    } catch (e) {
        console.error('Audio capture setup failed, exporting without audio:', e);
        exportAudioDest = null;
    }

    // ─── RUTA DE EXPORTACIÓN ───
    // 1ª opción: WebCodecs (H.264 por hardware, CFR 60fps, máxima calidad).
    // Si no está disponible o el formato es WebM: ruta clásica MediaRecorder.
    const fmt = document.getElementById('exportFormat').value;
    wcExport = null;
    if (fmt === 'mp4' && !forceRecorderExport) {
        try { wcExport = await setupWebCodecsExport(exportSrcNodes); }
        catch (e) { console.warn('Export WebCodecs no disponible, usando MediaRecorder:', e); wcExport = null; }
    }

    let mime = null, ext = 'webm', videoBps = 24000000; // bitrate ×2 para 60fps
    if (!wcExport) {
        // Selección de codec MediaRecorder: preferir H.264 (calidad/compatibilidad)
        if (fmt === 'mp4') {
            const mp4Candidates = [
                'video/mp4;codecs=avc1.640032,mp4a.40.2', // High profile L5.0
                'video/mp4;codecs=avc1.640028,mp4a.40.2', // High profile L4.0
                'video/mp4;codecs=avc1.4d0032,mp4a.40.2', // Main profile
                'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // Baseline profile
                'video/mp4'
            ];
            mime = mp4Candidates.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || null;
            if (mime) { ext = 'mp4'; }
        }
        if (!mime) {
            mime = (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm');
            ext = 'webm';
        }

        // ─── CAPTURA DE VIDEO (modo manual si el navegador lo soporta) ───
        // captureStream(0) + requestFrame(): cada frame dibujado se envía exactamente
        // una vez (sin muestreo del navegador que duplica/pierde frames bajo carga).
        let stream = exportCanvas.captureStream(0);
        exportStreamEl = stream;
        exportVideoTrack = stream.getVideoTracks()[0] || null;
        const canManual = (exportVideoTrack && typeof exportVideoTrack.requestFrame === 'function')
            || (stream && typeof stream.requestFrame === 'function');
        if (!canManual) {
            // Fallback: muestreo automático a FPS (comportamiento anterior)
            stream = exportCanvas.captureStream(FPS);
            exportStreamEl = stream;
            exportVideoTrack = null;
        }
        if (exportAudioDest) {
            exportAudioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        }
        exportRecorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: videoBps, audioBitsPerSecond: 192000 });
        exportRecorder.ondataavailable = e => { if (e.data.size) exportChunks.push(e.data); };
        exportRecorder.onstop = () => {
            const blob = new Blob(exportChunks, { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'ranking_video.' + ext;
            a.click(); URL.revokeObjectURL(url);
            validateExportedFile(blob, getTotalDuration());
            finishExport();
        };
    }

    document.getElementById('exportOverlay').classList.remove('hidden');
    currentClipIndex = 0; isPlaying = true;
    stopOutroPhase();
    resetStyleEngineState();

    // Ensure first video is ready before starting recorder
    const clip = state.clips[0];
    if (clip && clip.videoEl && clip.videoEl.readyState < 2) {
        await new Promise((resolve) => {
            const onReady = () => { clip.videoEl.removeEventListener('canplay', onReady); resolve(); };
            clip.videoEl.addEventListener('canplay', onReady);
            setTimeout(() => { clip.videoEl.removeEventListener('canplay', onReady); resolve(); }, 5000);
        });
    }

    // Preparar el primer clip antes de empezar a grabar (evita segundos negros al inicio)
    isPreparingClip = true;
    if (state.intro.enabled) {
        startIntro();
        isPreparingClip = false;
    } else {
        await playCurrentClip();
        isPreparingClip = false;
    }

    // Esperar un frame extra para que el video tenga un frame listo
    await new Promise(r => requestAnimationFrame(r));

    // Esperar a que el primer clip esté AVANZANDO de verdad: play() puede resolver
    // antes de que el decoder entregue el primer frame → si no, los primeros
    // frames del export salen congelados en el frame inicial del clip.
    if (!state.intro.enabled) {
        const fc = state.clips[0];
        if (fc && fc.videoEl && !fc.videoEl.paused) {
            const waitStart = performance.now();
            while (fc.videoEl.currentTime <= (fc.trimStart || 0) && performance.now() - waitStart < 400) {
                await new Promise(r => requestAnimationFrame(r));
            }
        }
    }

    // Arrancar la grabación según la ruta activa
    if (wcExport) {
        startWebCodecsRecording();
    } else {
        exportLastDraw = -1e9;
        exportRecorder.start(100);
    }
    // Keep-alive: mantiene el track de video vivo si la pestaña se oculta (rAF se pausa).
    // El intervalo coincide con la cadencia de frames para no perder beats.
    exportKeepAlive = setInterval(() => {
        if (isExporting && document.hidden) tickExportFrame();
    }, Math.floor(1000 / FPS));
}

// ¿La grabación ya está en marcha? (no confundir con la preparación inicial)
function exportRecordingActive() {
    return wcExport ? wcExport.recording : !!exportRecorder;
}

function updateExportProgress() {
    // Música y voces se mantienen en sync TAMBIÉN durante la preparación del
    // siguiente clip (si no, cada transición las deja atrás → desincronización).
    // En la preparación inicial aún no graba: no adelantar el audio.
    const elapsedNow = getElapsedTime();
    const tot = getTotalDuration();
    const pct = tot > 0 ? Math.min(100, (elapsedNow / tot) * 100) : 0;
    document.getElementById('exportProgress').style.width = pct + '%';
    document.getElementById('exportProgressText').textContent = Math.round(pct) + '%';
    if (exportRecordingActive()) {
        syncExportAudioTracks(elapsedNow);
        syncVoiceovers(elapsedNow);
    }

    if (isPreparingClip) return;   // no avanzar la máquina de estados durante la preparación

    // Handle intro phase
    if (isInIntro) {
        const elapsed = getIntroElapsedTime();
        if (elapsed >= state.intro.duration) {
            captureExportHold();   // retener el último frame del intro
            isInIntro = false;
            stopIntroBgClip();
            if (introAudioEl) introAudioEl.pause();
            currentClipIndex = 0;
            isPreparingClip = true;
            playCurrentClip().then(() => { isPreparingClip = false; });
        }
        return;
    }

    // Handle outro phase
    if (isInOutro) {
        if (getOutroElapsedTime() >= state.outro.durationSec) {
            isPlaying = false;
            stopExportRecording();
        }
        return;
    }

    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.videoEl) { isPlaying = false; stopExportRecording(); return; }

    // Style engine: freezes + SFX + voiceovers
    tickStyleEngine();
    tickCensorEngine();
    preloadNextClip();

    // Check if current clip has ended (ended covers rounding issues with trimEnd)
    if (clip.videoEl.ended || clip.videoEl.currentTime >= clip.trimEnd) {
        captureExportHold();   // retener el último frame del clip antes de cambiar
        clip.videoEl.pause();
        currentClipIndex++;
        if (currentClipIndex < state.clips.length) {
            // Preparar el siguiente clip antes de seguir grabando (sin frames negros)
            isPreparingClip = true;
            playCurrentClip().then(() => { isPreparingClip = false; });
        } else if (getOutroOffset() > 0) {
            startOutroPhase();
        } else {
            isPlaying = false;
            stopExportRecording();
        }
    }
}

function syncExportAudioTracks(elapsed) {
    state.audioTracks.forEach(track => {
        if (!track.audioEl) return;
        const localTime = elapsed - track.timelineStart;
        if (localTime < 0) {
            if (!track.audioEl.paused) track.audioEl.pause();
            return;
        }
        const trackLocalPos = track.trimStart + localTime;
        if (trackLocalPos >= track.trimEnd) {
            if (!track.audioEl.paused) track.audioEl.pause();
            return;
        }
        if (track.audioEl.paused) {
            if (Math.abs(track.audioEl.currentTime - trackLocalPos) > 0.2) {
                try { track.audioEl.currentTime = trackLocalPos; } catch(e) {}
            }
            track.audioEl.play().catch(() => {});
        }
        if (Math.abs(track.audioEl.currentTime - trackLocalPos) > 0.4) {
            try { track.audioEl.currentTime = trackLocalPos; } catch(e) {}
        }
    });
}
function cancelExport() {
    if (wcExport) { wcExport.cancelled = true; stopExportRecording(); }
    else { exportRecorder?.stop(); finishExport(); }
}
function finishExport() {
    isExporting = false; isPlaying = false; isPreparingClip = false; exportRecorder = null; exportCtx = null;
    if (exportKeepAlive) { clearInterval(exportKeepAlive); exportKeepAlive = null; }
    exportVideoTrack = null; exportStreamEl = null; exportLastDraw = -1e9;
    if (wcExport) {
        // Cerrar encoders y tap PCM de la ruta WebCodecs
        try { if (wcExport.venc.state !== 'closed') wcExport.venc.close(); } catch(e) {}
        try { if (wcExport.aenc && wcExport.aenc.state !== 'closed') wcExport.aenc.close(); } catch(e) {}
        try { wcExport.tap.port.onmessage = null; wcExport.tap.disconnect(); } catch(e) {}
        wcExport = null;
    }
    isInIntro = false;
    stopOutroPhase();
    // Detach audio routing and mute elements again (preview stays silent as before)
    exportAudioDest = null;
    state.clips.forEach(c => {
        if (c.audioSourceNode) { try { c.audioSourceNode.disconnect(); } catch(e) {} }
        if (c.videoEl) c.videoEl.muted = true;
        if (c.vo && c.vo.audioSourceNode) { try { c.vo.audioSourceNode.disconnect(); } catch(e) {} }
        if (c.vo && c.vo.audioEl) c.vo.audioEl.muted = true;
    });
    Object.values(sfxEls).forEach(el => { if (el) { try { el._audioSourceNode?.disconnect(); } catch(e) {} el.muted = true; } });
    if (bleepEl) { try { bleepEl._audioSourceNode?.disconnect(); } catch(e) {} bleepEl.muted = true; }
    stopBleep();
    if (outroVoiceEl) { try { outroVoiceEl._audioSourceNode?.disconnect(); } catch(e) {} outroVoiceEl.muted = true; }
    if (introAudioEl) { try { introAudioEl._audioSourceNode?.disconnect(); } catch(e) {} introAudioEl.muted = true; }
    state.audioTracks.forEach(t => {
        if (t.audioSourceNode) { try { t.audioSourceNode.disconnect(); } catch(e) {} }
        if (t.audioEl) t.audioEl.muted = true;
    });
    document.getElementById('exportOverlay').classList.add('hidden');
    stopPlayback();
}

// ─── Diálogos Importar / Exportar (barra superior derecha) ───
// Actualiza el hint del diálogo de exportación según formato y soporte
function updateExportFormatHint() {
    const sel = document.getElementById('exportFormat');
    const hint = document.getElementById('exportFormatHint');
    if (!sel || !hint) return;
    const wc = webCodecsSupported();
    if (!wc) {
        hint.textContent = 'Este navegador no soporta WebCodecs: se usará el codificador integrado (MediaRecorder), que puede descartar fotogramas bajo carga.';
        return;
    }
    if (sel.value === 'webm') {
        hint.textContent = '⚠️ WebM usa el codificador integrado (MediaRecorder): puede descartar fotogramas y sentirse menos fluido. Para máxima fluidez elige MP4.';
    } else {
        hint.textContent = '✨ MP4 con WebCodecs: codificación H.264 por hardware, 60 fps constantes y máxima calidad. Recomendado.';
    }
}
function openExportDialog() {
    const sel = document.getElementById('exportFormat');
    // WebCodecs disponible: preseleccionar MP4 para la ruta de máxima calidad/fluidez
    if (sel && webCodecsSupported()) sel.value = 'mp4';
    if (sel) sel.onchange = updateExportFormatHint;
    updateExportFormatHint();
    document.getElementById('exportDialog').classList.remove('hidden');
}
function closeExportDialog() { document.getElementById('exportDialog').classList.add('hidden'); }
function openImportDialog() {
    document.getElementById('importDialog').classList.remove('hidden');
    const s = document.getElementById('importDialogStatus'); if (s) s.textContent = '';
}
function closeImportDialog() { document.getElementById('importDialog').classList.add('hidden'); }

async function importFromDialog() {
    const urlInput = document.getElementById('importUrlInput');
    const status = document.getElementById('importDialogStatus');
    const url = (urlInput.value || '').trim();
    if (!url) { status.style.color = '#ff8888'; status.textContent = 'Pega una URL primero.'; return; }
    if (window.location.protocol === 'file:' || window.location.port !== '3000') {
        status.style.color = '#ff8888';
        status.textContent = 'Abre el editor desde http://localhost:3000 (npm start).';
        return;
    }
    status.style.color = ''; status.textContent = '⏳ Descargando video...';
    try {
        const res = await fetch('/api/import?url=' + encodeURIComponent(url));
        if (!res.ok) throw new Error('Error del servidor (HTTP ' + res.status + ')');
        const blob = await res.blob();
        if (!blob.type.startsWith('video/') || blob.size === 0) throw new Error('La respuesta no es un video válido.');
        const file = new File([blob], 'video_import_' + Date.now() + '.mp4', { type: blob.type });
        // Crear el clip SOLO cuando el video ya se descargó y validó,
        // para no dejar clips vacíos (bloque de 4px) si falla la importación.
        const clipId = addClip();
        handleFileUpload(clipId, file);
        urlInput.value = '';
        status.style.color = '#7cfc90'; status.textContent = '✅ Video importado correctamente.';
        setTimeout(closeImportDialog, 900);
    } catch (err) {
        status.style.color = '#ff8888';
        status.textContent = (err instanceof TypeError) ? 'No se pudo conectar. Ejecuta npm start.' : ('❌ ' + err.message);
    }
}

// ═══════════════════════════════════════════════════════════
// ████  CLIP MANAGEMENT & UI  ████
// ═══════════════════════════════════════════════════════════
// Posición óptima para un clip nuevo según la plantilla del preset/proyecto.
// Si el índice excede la plantilla, extrapola con el espaciado de los dos últimos números.
function getTemplateNumberPos(index) {
    if (numberPosTemplate[index]) return { ...numberPosTemplate[index] };
    const known = numberPosTemplate.filter(Boolean);
    if (known.length >= 2) {
        const a = known[known.length - 2];
        const b = known[known.length - 1];
        const spacing = b.y - a.y;
        return { x: b.x, y: Math.max(60, Math.round((b.y + spacing) * 100) / 100) };
    }
    return null;
}

function addClip() {
    const num = state.clips.length + 1;
    const clip = {
            id: generateId(), file: null, videoEl: null, url: '',
        trimStart: 0, trimEnd: 0, duration: 0, percentage: '',
        captions: [], captionsEnabled: true,
        numberText: '', numberColor: '', rankingPosition: '',
        numberVisible: true,
            numberPos: getTemplateNumberPos(state.clips.length), // posición óptima desde plantilla
            timelineStart: state.clips.reduce((max, c) => Math.max(max, (c.timelineStart || 0) + getClipTrimDuration(c)), 0),
            panX: 0, panY: 0,
            volume: 1.0,
            fpsReport: null,
            fpsNormalized: false,
            blurBars: []
    };
    state.clips.push(clip);
    renderClipsList();
    scheduleAutoSave();
    return clip.id;
}

function handleOSFileUpload(file) {
    const id = addClip();
    handleFileUpload(id, file);
}

function handleFileUpload(clipId, file) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    if (clip.url && clip.url.startsWith('blob:')) URL.revokeObjectURL(clip.url);
    if (clip.videoEl) clip.videoEl.remove();

    clip.file = file; clip.url = URL.createObjectURL(file);
    clip.audioSourceNode = null; // new element: audio node must be re-created at next export
    // Nuevo archivo → invalidar cualquier informe de FPS anterior
    clip.fpsReport = null;
    clip.fpsNormalized = false;
    // Invalidar miniaturas del video anterior para que se regeneren con el nuevo
    clip.thumbs = null;
    clip._thumbsLoading = false;
    // Las marcas de censura son tiempos de ESTE archivo: al cambiar el video dejan de valer
    clip.censorMarks = [];
    deleteItem(STORE_VIDEOS, 'thumbs_' + clipId).catch(() => {});

    const video = document.createElement('video');
    video.preload = 'auto'; video.muted = true; video.playsInline = true; video.src = clip.url;
    videoContainer.appendChild(video);
    clip.videoEl = video;

    video.addEventListener('loadedmetadata', () => {
        clip.duration = isFinite(video.duration) ? video.duration : 0;
        clip.trimEnd = clip.duration > 0 ? Math.min(Math.round(clip.duration * 100) / 100, clip.duration) : 0;
        repackTimelineClips();
        renderClipsList();
        ensureClipThumbs(clip);
        scheduleAutoSave();
    });

    // Video que el navegador no puede decodificar (p. ej. H.265 de TikTok):
    // sin esto el clip quedaba con duration 0 → bloque de 4px tapado por el siguiente.
    video.addEventListener('error', () => {
        if (!clip.file) return;
        alert('El video "' + (clip.file.name || '') + '" no se puede reproducir en este navegador (códec no compatible, p. ej. H.265). Se quitó del clip; importa otro formato o archivo.');
        if (clip.url && clip.url.startsWith('blob:')) URL.revokeObjectURL(clip.url);
        clip.file = null; clip.url = ''; clip.videoEl = null;
        clip.duration = 0; clip.trimStart = 0; clip.trimEnd = 0;
        clip.censorMarks = [];
        video.remove();
        repackTimelineClips();
        renderClipsList();
        scheduleAutoSave();
    });
}

// IMPORT FROM URL INTO AN EXISTING CLIP (TikTok / YouTube / Instagram)
async function importUrlToClip(clipId) {
    const input = document.getElementById('url_' + clipId);
    const status = document.getElementById('urlStatus_' + clipId);
    const btn = document.getElementById('urlBtn_' + clipId);
    const url = input.value.trim();

    if (!url) {
        status.style.color = '#ff8888';
        status.textContent = 'Pega una URL primero.';
        return;
    }

    if (window.location.protocol === 'file:' || window.location.port !== '3000') {
        status.style.color = '#ff8888';
        status.textContent = 'Abre el editor desde http://localhost:3000 ejecutando npm start; no uses Live Server ni doble clic.';
        return;
    }

    btn.disabled = true;
    status.style.color = '';
    status.textContent = '⏳ Descargando video... (puede tardar unos segundos)';

    try {
        const res = await fetch('/api/import?url=' + encodeURIComponent(url));
        if (!res.ok) {
            let msg;
            try {
                const data = await res.json();
                msg = data.error;
            } catch (e) {
                msg = null;
            }
            if (res.status === 404) {
                msg = 'El editor no está conectado al servidor local. Abre http://localhost:3000 después de ejecutar npm start.';
            }
            throw new Error(msg || 'Error del servidor (HTTP ' + res.status + ')');
        }

        const blob = await res.blob();
        if (!blob.type.startsWith('video/') || blob.size === 0) {
            throw new Error('La respuesta del servidor no es un video válido.');
        }

        const file = new File([blob], 'video_import_' + Date.now() + '.mp4', { type: blob.type });
        handleFileUpload(clipId, file);
        input.value = '';
        status.style.color = '#7cfc90';
        status.textContent = '✅ Video cargado en este clip.';
    } catch (err) {
        status.style.color = '#ff8888';
        if (err instanceof TypeError) {
            status.textContent = 'No se pudo conectar. Ejecuta npm start y abre http://localhost:3000.';
        } else {
            status.textContent = '❌ ' + err.message;
        }
    } finally {
        btn.disabled = false;
    }
}

// ═══════════════════════════════════════════════════════════
//  ANÁLISIS Y NORMALIZACIÓN DE FPS (el proyecto exporta a 60 CFR)
//  · /api/analyze   → FPS reales por PTS, VFR y duplicados (ffprobe)
//  · /api/normalize → aterrizar CFR + minterpolate a 60 (ffmpeg)
//  · /api/validate  → veredicto del render final tras exportar
// ═══════════════════════════════════════════════════════════

function fpsApiAvailable() {
    return window.location.protocol !== 'file:' && window.location.port === '3000';
}

function summarizeFpsReport(r, normalized) {
    if (!r) return '';
    if (normalized || (r.action === 'clean60'))
        return '✅ ' + (r.realFps || 60) + ' fps CFR ' + (normalized ? '(normalizado)' : 'limpio');
    const bits = [];
    if (r.realFps) bits.push(r.realFps + ' fps reales');
    if (r.isVfr || r.ptsIssues) bits.push('VFR/timestamps irregulares');
    if (r.dupRatio > 0.05) bits.push(Math.round(r.dupRatio * 100) + '% duplicados');
    return '⚠️ ' + (bits.length ? bits.join(' · ') : 'revision necesaria') + ' → normalizar';
}

function setFpsStatus(clipId, text, isErr) {
    const el = document.getElementById('fpsStatus_' + clipId);
    if (el) { el.textContent = text; el.style.color = isErr ? '#ff8888' : ''; }
}

async function analyzeClipFps(clipId, silent) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip || !clip.file) { if (!silent) alert('Este clip no tiene video.'); return null; }
    if (!fpsApiAvailable()) { if (!silent) alert('Abre el editor desde http://localhost:3000 (npm start).'); return null; }
    setFpsStatus(clipId, '⏳ Analizando con ffprobe...');
    try {
        const res = await fetch('/api/analyze', { method: 'POST', body: clip.file });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'HTTP ' + res.status);
        }
        clip.fpsReport = await res.json();
        clip.fpsNormalized = false;
        setFpsStatus(clipId, summarizeFpsReport(clip.fpsReport, false));
        scheduleAutoSave();
        return clip.fpsReport;
    } catch (e) {
        setFpsStatus(clipId, '❌ ' + e.message, true);
        return null;
    }
}

// Sustituye el archivo del clip por la versión normalizada (60 CFR) conservando
// trims, censuras y demás metadatos (la duración/timing no cambia).
function applyNormalizedVideo(clip, blob, report) {
    const baseName = (clip.file && clip.file.name ? clip.file.name : 'clip').replace(/\.[^.]*$/, '');
    const newFile = new File([blob], baseName + '_60fps.mp4', { type: 'video/mp4' });
    if (clip.url && clip.url.startsWith('blob:')) URL.revokeObjectURL(clip.url);
    if (clip.videoEl) clip.videoEl.remove();
    clip.file = newFile; clip.url = URL.createObjectURL(newFile);
    clip.audioSourceNode = null;
    clip.thumbs = null; clip._thumbsLoading = false;
    const video = document.createElement('video');
    video.preload = 'auto'; video.muted = true; video.playsInline = true; video.src = clip.url;
    videoContainer.appendChild(video);
    clip.videoEl = video;
    video.addEventListener('loadedmetadata', () => {
        clip.duration = isFinite(video.duration) ? video.duration : clip.duration;
        clip.trimEnd = Math.min(clip.trimEnd || clip.duration, clip.duration);
        repackTimelineClips();
        renderClipsList();
        ensureClipThumbs(clip);
        scheduleAutoSave();
    });
    clip.fpsNormalized = true;
    if (report && report.after) clip.fpsReport = report.after;
}

async function normalizeClipFps(clipId) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip || !clip.file) { alert('Este clip no tiene video.'); return; }
    if (!fpsApiAvailable()) { alert('Abre el editor desde http://localhost:3000 (npm start).'); return; }
    if (!clip.fpsReport) await analyzeClipFps(clipId, true);
    if (clip.fpsReport && clip.fpsReport.action === 'clean60') {
        setFpsStatus(clipId, '✅ Ya es 60 CFR: no se reprocesa.');
        return;
    }
    setFpsStatus(clipId, '⏳ Normalizando a 60 CFR (interpolación)... puede tardar.');
    try {
        const base = clip.fpsReport && clip.fpsReport.realFps ? clip.fpsReport.realFps : '';
        const res = await fetch('/api/normalize?base=' + base, { method: 'POST', body: clip.file });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'HTTP ' + res.status);
        }
        const blob = await res.blob();
        let report = null;
        const hdr = res.headers.get('X-Report');
        if (hdr) { try { report = JSON.parse(decodeURIComponent(hdr)); } catch (e) { /* cabecera opcional */ } }
        applyNormalizedVideo(clip, blob, report);
        setFpsStatus(clipId, '✅ Normalizado a 60 CFR' + (report && report.after && report.after.realFps ? ' (' + report.after.realFps + ' fps, cadencia uniforme)' : ''));
        scheduleAutoSave();
    } catch (e) {
        setFpsStatus(clipId, '❌ ' + e.message, true);
    }
}

async function analyzeAllClips() {
    if (!state.clips.length) return alert('No hay clips.');
    for (const c of state.clips) { if (c.file) await analyzeClipFps(c.id, true); }
    renderClipsList();
}

async function normalizeAllClips() {
    const targets = state.clips.filter(c => c.file && !(c.fpsReport && c.fpsReport.action === 'clean60' && c.fpsNormalized));
    if (!targets.length) return alert('No hay clips pendientes de normalizar.');
    for (const c of targets) await normalizeClipFps(c.id);
    renderClipsList();
}

// Advertencia suave al exportar con clips sin normalizar
function checkFpsBeforeExport() {
    const pending = state.clips.filter(c =>
        c.file && c.fpsReport && c.fpsReport.action !== 'clean60' && !c.fpsNormalized
    );
    if (!pending.length) return true;
    return confirm(
        pending.length + ' clip(s) no están a 60 FPS constantes (según el análisis).\n' +
        'El export seguirá siendo 60 FPS CFR, pero su movimiento puede ir con tirones (frames duplicados irregulares).\n\n' +
        'Pulsa "📈 Normalizar a 60 FPS" en la pestaña Media para interpolarlos.\n\n' +
        '¿Exportar de todos modos?'
    );
}

// Validación automática del archivo final (POST /api/validate)
async function validateExportedFile(blob, expectedSeconds) {
    if (!fpsApiAvailable() || !blob || !blob.size) return;
    try {
        const q = expectedSeconds ? '?expected=' + expectedSeconds.toFixed(3) : '';
        const res = await fetch('/api/validate' + q, { method: 'POST', body: blob });
        if (!res.ok) { console.warn('Validación del render: HTTP ' + res.status); return; }
        showValidationReport(await res.json());
    } catch (e) { console.warn('Validación del render:', e); }
}

function showValidationReport(report) {
    const old = document.getElementById('fpsValidationPanel');
    if (old) old.remove();
    const checks = report.checks || [];
    const div = document.createElement('div');
    div.id = 'fpsValidationPanel';
    div.className = 'fps-validation-panel';
    div.innerHTML =
        '<div class="fvp-header"><b>' + (report.pass ? '✅ Render validado: 60 FPS CFR' : '⚠️ Validación del render') + '</b>' +
        '<button class="fvp-close" title="Cerrar" onclick="this.closest(\'.fps-validation-panel\').remove()">✕</button></div>' +
        '<ul>' + checks.map(c =>
            '<li>' + (c.pass ? '✅' : '❌') + ' <b>' + c.name + '</b>' + (c.detail ? ' — ' + c.detail : '') + '</li>'
        ).join('') + '</ul>';
    document.body.appendChild(div);
}

function updateClipField(id, field, value) {
    const clip = state.clips.find(c => c.id === id);
    if(!clip) return;

    if(field === 'trimStart' || field === 'trimEnd') {
        let v = parseFloat(value) || 0;
        if(field==='trimStart') clip.trimStart = clamp(v, 0, clip.trimEnd - 0.1);
        if(field==='trimEnd') clip.trimEnd = clamp(v, clip.trimStart + 0.1, clip.duration || 9999);
        if(clip.videoEl && !isPlaying) clip.videoEl.currentTime = clip[field];
    } else if (field === 'captionsEnabled') {
        clip[field] = value;
    } else {
        clip[field] = value;
    }
    scheduleAutoSave();
}

function removeClip(id) {
    const idx = state.clips.findIndex(c => c.id === id);
    if(idx===-1) return;
    const c = state.clips[idx];
    if(c.url) URL.revokeObjectURL(c.url);
    if(c.videoEl) c.videoEl.remove();
    if(c.vo && c.vo.audioEl) { c.vo.audioEl.pause(); c.vo.audioEl.remove(); }
    if(tlSelection && tlSelection.type === 'clip' && tlSelection.id === id) tlSelection = null;
    state.clips.splice(idx, 1);
    if(currentClipIndex >= state.clips.length) currentClipIndex = Math.max(0, state.clips.length-1);
    repackTimelineClips();
    renderClipsList();
    renderBlurBarsList();
    scheduleAutoSave();
}
function moveClip(id, dir) {
    const idx = state.clips.findIndex(c => c.id === id);
    if(idx===-1 || idx+dir<0 || idx+dir>=state.clips.length) return;
    const temp = state.clips[idx]; state.clips[idx] = state.clips[idx+dir]; state.clips[idx+dir] = temp;
    repackTimelineClips();
    renderClipsList();
    scheduleAutoSave();
}

function repackTimelineClips() {
    let cursor = 0;
    state.clips.forEach(clip => {
        clip.timelineStart = cursor;
        cursor += getClipTrimDuration(clip);
    });
}

// CAPTIONS
function addCaption(id) {
    const clip = state.clips.find(c=>c.id===id);
    if(clip) { clip.captions.push({text:'',from:0,to:2}); renderClipsList(); scheduleAutoSave(); }
}
function remCaption(id, idx) {
    const clip = state.clips.find(c=>c.id===id);
    if(clip) { clip.captions.splice(idx,1); renderClipsList(); scheduleAutoSave(); }
}
function updateCap(id, idx, field, val) {
    const c = state.clips.find(c=>c.id===id); if(!c || !c.captions[idx]) return;
    c.captions[idx][field] = field==='text'? val : parseFloat(val)||0;
    scheduleAutoSave();
}

function selectClip(idx) {
    if(isPlaying) return; currentClipIndex = idx;
    const c = state.clips[idx];
    if(c) tlSelection = { type: 'clip', id: c.id };
    if(c && c.videoEl && c.videoEl.readyState>=2) c.videoEl.currentTime = c.trimStart;
    renderTimelineClips();
    renderAudioTracks();
    updateTimeDisplay();
    renderBlurBarsList();
}

function renderClipsList() {
    let html = '';
    state.clips.forEach((clip, idx) => {
        const isSel = idx === currentClipIndex;
        const durT = clip.duration ? '(' + formatTime(clip.duration) + ')' : '';
        const borderStyle = isSel ? 'border-color:#5a5aff;' : '';
        const fileName = clip.file ? clip.file.name : 'Sin video';
        const checkedAttr = clip.captionsEnabled ? 'checked' : '';

        let captionsHtml = '';
        clip.captions.forEach((cap, ci) => {
            const escapedText = escapeHtml(cap.text);
            captionsHtml += '<div class="caption-row">' +
                '<input type="text" value="' + escapedText + '" placeholder="Texto" oninput="updateCap(\'' + clip.id + '\',' + ci + ',\'text\',this.value)" onclick="event.stopPropagation()">' +
                '<input type="number" value="' + cap.from + '" step="0.1" title="Desde(s)" onchange="updateCap(\'' + clip.id + '\',' + ci + ',\'from\',this.value)" onclick="event.stopPropagation()">' +
                '<input type="number" value="' + cap.to + '" step="0.1" title="Hasta(s)" onchange="updateCap(\'' + clip.id + '\',' + ci + ',\'to\',this.value)" onclick="event.stopPropagation()">' +
                '<button class="caption-del" onclick="event.stopPropagation();remCaption(\'' + clip.id + '\',' + ci + ')">✕</button>' +
            '</div>';
        });

        // Voiceover UI
        const vo = clip.vo || {};
        const voWords = (vo.text || '').trim() ? (vo.text || '').trim().split(/\s+/).length : 0;
        const voWordsColor = voWords > 8 ? '#ff6666' : '#7cfc90';
        let voCapsHtml = '';
        (vo.captions || []).forEach((cap, ci) => {
            voCapsHtml += '<div class="caption-row">' +
                '<input type="text" value="' + escapeHtml(cap.text) + '" placeholder="Texto" oninput="updateVoCap(\'' + clip.id + '\',' + ci + ',\'text\',this.value)" onclick="event.stopPropagation()">' +
                '<input type="number" value="' + cap.from + '" step="0.1" title="Desde(s)" onchange="updateVoCap(\'' + clip.id + '\',' + ci + ',\'from\',this.value)" onclick="event.stopPropagation()">' +
                '<input type="number" value="' + cap.to + '" step="0.1" title="Hasta(s)" onchange="updateVoCap(\'' + clip.id + '\',' + ci + ',\'to\',this.value)" onclick="event.stopPropagation()">' +
                '<button class="caption-del" onclick="event.stopPropagation();remVoCap(\'' + clip.id + '\',' + ci + ')">✕</button>' +
            '</div>';
        });
        const voHtml = '<div class="captions-section">' +
            '<div class="captions-header">' +
                '<label style="display:flex;align-items:center;gap:4px;cursor:pointer" onclick="event.stopPropagation()">' +
                    '<input type="checkbox" ' + (vo.enabled !== false ? 'checked' : '') + ' onchange="updateVoField(\'' + clip.id + '\',\'enabled\',this.checked)"> 🎙️ Voz en off' +
                '</label>' +
                '<button class="btn btn-sm" onclick="event.stopPropagation();generateVoAI(\'' + clip.id + '\')" title="Generar captions de la voz con IA">🪄 IA</button>' +
            '</div>' +
            '<input type="text" value="' + escapeHtml(vo.text || '') + '" placeholder="Frase corta (máx 8 palabras)" style="width:100%" oninput="updateVoField(\'' + clip.id + '\',\'text\',this.value)" onclick="event.stopPropagation()">' +
            '<span id="vowc_' + clip.id + '" style="font-size:10px;color:' + voWordsColor + '">' + voWords + '/8 palabras</span>' +
            '<div class="form-row" style="margin-top:4px">' +
                '<label>Voz</label>' +
                '<input type="file" accept="audio/*" id="vofile_' + clip.id + '" style="display:none" onchange="handleVoUpload(\'' + clip.id + '\', this.files[0])">' +
                '<button class="btn btn-sm" onclick="event.stopPropagation();document.getElementById(\'vofile_' + clip.id + '\').click()">📁 Importar voz</button>' +
                '<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();removeVoAudio(\'' + clip.id + '\')">✕</button>' +
            '</div>' +
            '<p class="hint" id="voname_' + clip.id + '" style="margin:0">' + (vo.fileName ? '🎵 ' + escapeHtml(vo.fileName) : '') + '</p>' +
            '<div class="form-row">' +
                '<label title="Ajuste fino de sincronización (ms)">Offset</label>' +
                '<input type="number" value="' + (vo.offset || 0) + '" step="50" style="width:60px" onchange="updateVoField(\'' + clip.id + '\',\'offset\',this.value)" onclick="event.stopPropagation()"> ms' +
            '</div>' +
            '<p class="hint" style="margin:6px 0 2px"><b>Estilo de las captions:</b></p>' +
            '<div class="form-row">' +
                '<label>Copiar de</label>' +
                '<select id="vocpsrc_' + clip.id + '" style="flex:1;min-width:0" onclick="event.stopPropagation()">' +
                    state.clips.map(function(sc, si) {
                        const hasVo = sc.vo && sc.vo.enabled !== false;
                        const lbl = '#' + (si + 1) + (sc.numberText ? ' ' + sc.numberText : (sc.rankingPosition ? ' #' + sc.rankingPosition : ''));
                        return '<option value="' + sc.id + '"' + (sc.id === clip.id ? ' selected' : '') + '>' + (hasVo ? '' : '(sin vo) ') + escapeHtml(lbl) + '</option>';
                    }).join('') +
                '</select>' +
                '<button class="btn btn-sm" title="Copia el estilo del clip elegido (fuente, tamaño, color, fondo, outline, palabras, posición) y lo aplica a TODOS los clips" onclick="event.stopPropagation();copyClipCaptionStyleToVo(\'' + clip.id + '\')">⧉ A todos</button>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Palabras</label>' +
                '<select onchange="updateVoField(\'' + clip.id + '\',\'capWords\',this.value)" onclick="event.stopPropagation()">' +
                    [1, 2, 3, 4, 5, 6].map(n => '<option value="' + n + '"' + ((vo.capWords ?? 3) === n ? ' selected' : '') + '>' + n + ' a la vez</option>').join('') +
                '</select>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Fuente</label>' +
                '<select class="vo-cap-font" data-capfont="' + (vo.capFont || '') + '" onchange="updateVoField(\'' + clip.id + '\',\'capFont\',this.value)" onclick="event.stopPropagation()">' +
                    ["'Segoe UI', sans-serif", "Arial, sans-serif", "Verdana, sans-serif", "Impact, sans-serif", "'Comic Sans MS', cursive", "Georgia, serif"].map(f => '<option value="' + f + '"' + ((vo.capFont || "'Segoe UI', sans-serif") === f ? ' selected' : '') + '>' + f.split(',')[0].replace(/'/g, '') + '</option>').join('') +
                '</select>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Tamaño</label>' +
                '<input type="range" min="16" max="120" value="' + (vo.capSize ?? 40) + '" oninput="updateVoField(\'' + clip.id + '\',\'capSize\',this.value)" onclick="event.stopPropagation()">' +
                '<span class="range-value" id="vocapsize_' + clip.id + '">' + (vo.capSize ?? 40) + '</span>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Color texto</label>' +
                '<input type="color" value="' + (vo.capColor || '#FFFFFF') + '" oninput="updateVoField(\'' + clip.id + '\',\'capColor\',this.value)" onclick="event.stopPropagation()">' +
                '<label style="min-width:50px">Fondo</label>' +
                '<input type="checkbox" ' + (vo.capBgEnabled !== false ? 'checked' : '') + ' onchange="updateVoField(\'' + clip.id + '\',\'capBgEnabled\',this.checked)" onclick="event.stopPropagation()">' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Outline</label>' +
                '<input type="checkbox" ' + (vo.capOutlineEnabled === true ? 'checked' : '') + ' onchange="updateVoField(\'' + clip.id + '\',\'capOutlineEnabled\',this.checked)" onclick="event.stopPropagation()">' +
                '<label style="min-width:40px">Color</label>' +
                '<input type="color" value="' + (vo.capOutlineColor || '#000000') + '" oninput="updateVoField(\'' + clip.id + '\',\'capOutlineColor\',this.value)" onclick="event.stopPropagation()">' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Intensidad</label>' +
                '<input type="range" min="0" max="100" value="' + (vo.capOutlineIntensity ?? 40) + '" oninput="updateVoField(\'' + clip.id + '\',\'capOutlineIntensity\',this.value)" onclick="event.stopPropagation()">' +
                '<span class="range-value" id="vocapolint_' + clip.id + '">' + (vo.capOutlineIntensity ?? 40) + '</span>' +
            '</div>' +
            voCapsHtml +
            '<button class="btn btn-sm" onclick="event.stopPropagation();addVoCap(\'' + clip.id + '\')">+ Fila caption</button>' +
            '<p class="hint" style="margin:2px 0 0">Arrastra la caption en el canvas para posicionarla.</p>' +
        '</div>';

        // ── Censura de malas palabras: detección IA + marcas por fuente ──
        const censorSrcs = [];
        if (clip.file || (clip.censorMarks && clip.censorMarks.length)) {
            censorSrcs.push({ src: 'video', label: 'Video', marks: clip.censorMarks || [], canDetect: !!clip.file });
        }
        if (clip.vo) {
            censorSrcs.push({ src: 'vo', label: 'Voz en off', marks: clip.vo.censorMarks || [], canDetect: !!clip.vo._file });
        }
        let censorHtml = '';
        if (censorSrcs.length) {
            let censorInner = '';
            censorSrcs.forEach(cs => {
                let markRows = '';
                cs.marks.forEach(m => {
                    markRows += '<div class="caption-row">' +
                        '<span style="flex:1;font-size:11px;color:' + (m.excluded ? '#6a6a8a' : '#ff9a6a') + '">' +
                            escapeHtml(m.word) + ' · ' + m.from.toFixed(1) + 's–' + m.to.toFixed(1) + 's' + (m.excluded ? ' (excluida)' : '') +
                        '</span>' +
                        '<button class="btn btn-sm" style="' + (m.excluded ? '' : 'background:#402030;') + '" onclick="event.stopPropagation();toggleCensorMark(\'' + clip.id + '\',\'' + cs.src + '\',\'' + m.id + '\')" title="' + (m.excluded ? 'Volver a censurar esta palabra' : 'Omitir la censura de esta palabra (falso positivo)') + '">' + (m.excluded ? 'Censurar' : 'Excluir') + '</button>' +
                        '<button class="caption-del" onclick="event.stopPropagation();removeCensorMark(\'' + clip.id + '\',\'' + cs.src + '\',\'' + m.id + '\')">✕</button>' +
                    '</div>';
                });
                censorInner += '<div class="captions-header" style="margin-top:4px">' +
                        '<span style="font-size:11px;font-weight:600;color:#ff9a6a;text-transform:uppercase">🤬 ' + cs.label + ' (' + cs.marks.length + ')</span>' +
                        (cs.canDetect ? '<button class="btn btn-sm" onclick="event.stopPropagation();detectCensor(\'' + clip.id + '\',\'' + cs.src + '\')" title="Detectar malas palabras en inglés con IA local (tarda un poco)">🪄 Detectar</button>' : '') +
                    '</div>' +
                    markRows +
                    '<div class="caption-row">' +
                        '<input type="number" id="cmFrom_' + cs.src + '_' + clip.id + '" step="0.1" placeholder="0.0" style="width:52px" title="Segundo inicial (tiempo del archivo)" onclick="event.stopPropagation()">' +
                        '<span style="font-size:10px;color:#6a6a8a">a</span>' +
                        '<input type="number" id="cmTo_' + cs.src + '_' + clip.id + '" step="0.1" placeholder="0.5" style="width:52px" title="Segundo final (tiempo del archivo)" onclick="event.stopPropagation()">' +
                        '<button class="btn btn-sm" onclick="event.stopPropagation();addCensorMarkManual(\'' + clip.id + '\',\'' + cs.src + '\')" title="Añadir marca de censura manual">+ Manual</button>' +
                    '</div>';
            });
            censorHtml = '<div class="captions-section" style="margin-top:6px">' + censorInner + '</div>';
        }

        html += '<div class="clip-card" style="' + borderStyle + '" onclick="selectClip(' + idx + ')">' +
            '<div class="clip-card-header">' +
                '<span class="clip-filename" data-duration-clip="' + clip.id + '" style="font-weight:bold; font-size:12px">Clip ' + (idx+1) + ' - ' + fileName + ' ' + durT + '</span>' +
                '<div class="clip-actions">' +
                    '<button onclick="event.stopPropagation();moveClip(\'' + clip.id + '\',-1)">▲</button>' +
                    '<button onclick="event.stopPropagation();moveClip(\'' + clip.id + '\',1)">▼</button>' +
                    '<button onclick="event.stopPropagation();removeClip(\'' + clip.id + '\')" style="color:#ff6666">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="clip-card-body">' +
                '<div class="clip-upload-area">' +
                    '<input type="file" accept="video/*" id="file_' + clip.id + '" onchange="handleFileUpload(\'' + clip.id + '\', this.files[0])">' +
                    '<button class="btn btn-sm" onclick="event.stopPropagation();document.getElementById(\'file_' + clip.id + '\').click()">📁 ' + (clip.file ? 'Cambiar video' : 'Subir video') + '</button>' +
                '</div>' +
                '<div class="clip-url-area">' +
                    '<input type="text" id="url_' + clip.id + '" placeholder="Pega URL de TikTok..." onclick="event.stopPropagation()" onkeydown="if(event.key===\'Enter\'){event.stopPropagation();importUrlToClip(\'' + clip.id + '\')}" />' +
                    '<button class="btn btn-sm" id="urlBtn_' + clip.id + '" onclick="event.stopPropagation();importUrlToClip(\'' + clip.id + '\')">📥 URL</button>' +
                '</div>' +
                '<p class="hint clip-url-status" id="urlStatus_' + clip.id + '"></p>' +
                '<div class="clip-fps-row" onclick="event.stopPropagation()">' +
                    '<button class="btn btn-sm fps-btn" title="Analizar FPS reales, VFR y duplicados (ffprobe)" onclick="analyzeClipFps(\'' + clip.id + '\')">🔬</button>' +
                    '<button class="btn btn-sm fps-btn" title="Normalizar a 60 FPS con interpolación de movimiento" onclick="normalizeClipFps(\'' + clip.id + '\')">📈</button>' +
                    '<span class="fps-status" id="fpsStatus_' + clip.id + '">' + summarizeFpsReport(clip.fpsReport, clip.fpsNormalized) + '</span>' +
                '</div>' +
                '<div class="clip-trim-row">' +
                    '<label>Trim</label>' +
                    '<input type="number" value="' + clip.trimStart + '" step="0.1" title="Inicio" onchange="updateClipField(\'' + clip.id + '\',\'trimStart\',this.value)" onclick="event.stopPropagation()"> a ' +
                    '<input type="number" value="' + clip.trimEnd + '" step="0.1" title="Fin" onchange="updateClipField(\'' + clip.id + '\',\'trimEnd\',this.value)" onclick="event.stopPropagation()">' +
                '</div>' +
                '<div class="clip-volume-row">' +
                    '<label>🔊</label>' +
                    '<input type="range" min="0" max="100" value="' + Math.round((clip.volume ?? 1.0) * 100) + '" title="Volumen" oninput="updateClipVolume(\'' + clip.id + '\', this.value)" onclick="event.stopPropagation()">' +
                    '<span class="range-value">' + Math.round((clip.volume ?? 1.0) * 100) + '%</span>' +
                '</div>' +
                '<div class="form-row">' +
                    '<label>Ranking</label>' +
                    '<label style="display:flex;align-items:center;gap:4px;cursor:pointer" onclick="event.stopPropagation()" title="Mostrar u ocultar el número de este clip">' +
                        '<input type="checkbox" ' + (clip.numberVisible !== false ? 'checked' : '') + ' onchange="updateClipField(\'' + clip.id + '\',\'numberVisible\',this.checked)">#' +
                    '</label>' +
                    '<input type="number" value="' + clip.rankingPosition + '" placeholder="' + (idx+1) + '" style="width:45px;flex:none" title="Número del ranking (vacío = automático)" oninput="updateClipField(\'' + clip.id + '\',\'rankingPosition\',this.value)" onclick="event.stopPropagation()">' +
                    '<input type="text" value="' + clip.numberText + '" placeholder="Texto (ej: never again)" style="flex:1" oninput="updateClipField(\'' + clip.id + '\',\'numberText\',this.value)" onclick="event.stopPropagation()">' +
                    '<span style="flex:1"></span>' +
                    '<input type="text" value="' + clip.percentage + '" placeholder="ej: 99" style="width:50px;flex:none" title="Porcentaje" oninput="updateClipField(\'' + clip.id + '\',\'percentage\',this.value)" onclick="event.stopPropagation()"> %' +
                '</div>' +
                '<div class="form-row">' +
                    '<label>Color Nº</label>' +
                    '<input type="color" value="' + (clip.numberColor || state.numbers.color || '#FFD700') + '" title="Color del número de ESTE clip (anula el global)" oninput="updateClipField(\'' + clip.id + '\',\'numberColor\',this.value)" onclick="event.stopPropagation()">' +
                    '<button class="btn btn-sm" type="button" title="Volver al color global" onclick="event.stopPropagation();updateClipField(\'' + clip.id + '\',\'numberColor\',\'\');renderClipsList();">↺ Global</button>' +
                    '<span style="flex:1"></span>' +
                '</div>' +
                '<div class="captions-section">' +
                    '<div class="captions-header">' +
                        '<label style="display:flex;align-items:center;gap:4px;cursor:pointer" onclick="event.stopPropagation()">' +
                            '<input type="checkbox" ' + checkedAttr + ' onchange="updateClipField(\'' + clip.id + '\',\'captionsEnabled\',this.checked)"> Captions' +
                        '</label>' +
                        '<div>' +
                            '<button class="btn btn-sm" onclick="event.stopPropagation();generateAI(\'' + clip.id + '\')" title="Requiere audio y descargar modelo local">🪄 IA</button>' +
                            '<button class="btn btn-sm" onclick="event.stopPropagation();addCaption(\'' + clip.id + '\')">+ Fila</button>' +
                        '</div>' +
                    '</div>' +
                    captionsHtml +
                    voHtml +
                '</div>' +
                censorHtml +
            '</div>' +
        '</div>';
    });
    clipsList.innerHTML = html;
    clipsList.querySelectorAll('.vo-cap-font').forEach(sel => appendExtraFonts(sel, sel.dataset.capfont || null));
    refreshIntroBgClipSelect();
    renderTimelineClips();
    renderAudioTracks();
    refreshOutroBgClipSelect();
}
function escapeHtml(t) { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }

// ═══════════════════════════════════════════════════════════
// ████  AI TRANSCRIPTION (WHISPER)  ████
// ═══════════════════════════════════════════════════════════
let aiWorker = null;
let aiWorkerReady = false;
let aiTargetMode = null;   // 'intro' | 'clip' | 'vo' | 'outro' | 'censor'
let aiTargetClipId = null;
let aiTargetSub = null;    // detección de censura: 'video' | 'vo'

async function extractAudio(file) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, 16000);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer; source.connect(offlineCtx.destination); source.start();
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
}

function generateIntroAI() { startAITranscription('intro', null); }
function generateAI(clipId) { startAITranscription('clip', clipId); }
function generateVoAI(clipId) { startAITranscription('vo', clipId); }
function generateOutroAI() { startAITranscription('outro', null); }

function startAITranscription(mode, clipId) {
    if (mode === 'intro') {
        if (!state.intro._audioFile) return alert('Debes subir un archivo de audio para el intro primero.');
    } else if (mode === 'outro') {
        if (!state.outro._voiceFile) return alert('Importa la voz del outro primero.');
    } else if (mode === 'vo') {
        const c = state.clips.find(x => x.id === clipId);
        if (!c || !c.vo || !c.vo._file) return alert('Importa el audio de la voz en off de este clip primero.');
    } else if (mode === 'censor') {
        const c = state.clips.find(x => x.id === clipId);
        if (!c) return;
        if (aiTargetSub === 'vo') {
            if (!c.vo || !c.vo._file) return alert('Importa el audio de la voz en off de este clip primero.');
        } else if (!c.file) {
            return alert('Debes subir un archivo de video primero.');
        }
    } else {
        const c = state.clips.find(x => x.id === clipId);
        if (!c || !c.file) return alert('Debes subir un archivo de video primero.');
    }
    aiTargetMode = mode;
    aiTargetClipId = clipId || null;
    document.getElementById('aiOverlay').classList.remove('hidden');
    document.getElementById('aiStatusText').textContent = 'Iniciando...';
    document.getElementById('aiProgress').style.width = '0%';

    if (!aiWorker) {
        // Blob worker approach to use ES Modules without external files
        const workerCode = "import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';\n" +
            "env.allowLocalModels = false;\n" +
            "let transcriber = null;\n" +
            "self.onmessage = async (e) => {\n" +
            "    if (e.data.type === 'load') {\n" +
            "        self.postMessage({ status: 'progress', text: 'Descargando motor IA (Whisper) la primera vez... (~150MB)', pct: 5 });\n" +
            "        try {\n" +
            "            transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {\n" +
            "                progress_callback: (x) => {\n" +
            "                    if(x.status === 'downloading') {\n" +
            "                        self.postMessage({ status: 'progress', text: 'Descargando ' + x.file + '...', pct: 10 + (x.progress||0)*0.8 });\n" +
            "                    }\n" +
            "                }\n" +
            "            });\n" +
            "            self.postMessage({ status: 'loaded' });\n" +
            "        } catch(err) { self.postMessage({ status: 'error', error: err.message }); }\n" +
            "    } else if (e.data.type === 'transcribe') {\n" +
            "        try {\n" +
            "            const ts = e.data.wordLevel ? 'word' : true;\n" +
            "            const out = await transcriber(e.data.audio, {\n" +
            "                chunk_length_s: 30, stride_length_s: 5, return_timestamps: ts, language: e.data.language || 'spanish', task: 'transcribe'\n" +
            "            });\n" +
            "            self.postMessage({ status: 'result', chunks: out.chunks });\n" +
            "        } catch(err) { self.postMessage({ status: 'error', error: err.message }); }\n" +
            "    }\n" +
            "};";

        const blob = new Blob([workerCode], {type: 'application/javascript'});
        aiWorker = new Worker(URL.createObjectURL(blob), {type: 'module'});

        aiWorker.onmessage = (e) => {
            const data = e.data;
            if(data.status === 'progress') {
                document.getElementById('aiStatusText').textContent = data.text;
                if(data.pct) document.getElementById('aiProgress').style.width = data.pct + '%';
            } else if(data.status === 'loaded') {
                aiWorkerReady = true;
                runAITranscription();
            } else if(data.status === 'result') {
                applyAICaptions(data.chunks);
            } else if(data.status === 'error') {
                alert('Error en IA: ' + data.error);
                document.getElementById('aiOverlay').classList.add('hidden');
            }
        };
        aiWorker.postMessage({ type: 'load' });
    } else if (aiWorkerReady) {
        runAITranscription();
    }
}

function getAIFileForMode() {
    if (aiTargetMode === 'intro') return state.intro._audioFile;
    if (aiTargetMode === 'outro') return state.outro._voiceFile;
    const clip = state.clips.find(c => c.id === aiTargetClipId);
    if (!clip) return null;
    if (aiTargetMode === 'vo') return (clip.vo && clip.vo._file) || null;
    if (aiTargetMode === 'censor') return aiTargetSub === 'vo' ? (clip.vo && clip.vo._file) || null : clip.file;
    return clip.file;
}

async function runAITranscription() {
    const file = getAIFileForMode();
    if (!file) {
        document.getElementById('aiOverlay').classList.add('hidden');
        return;
    }
    try {
        document.getElementById('aiStatusText').textContent = 'Extrayendo audio...';
        document.getElementById('aiProgress').style.width = '10%';
        const float32Audio = await extractAudio(file);
        document.getElementById('aiStatusText').textContent = 'Transcribiendo con Inteligencia Artificial... (Esto puede tardar un poco)';
        document.getElementById('aiProgress').style.width = '50%';
        // Simulate progress bar while waiting
        let p = 50; const iv = setInterval(()=>{ p+=2; if(p<95) document.getElementById('aiProgress').style.width=p+'%'; else clearInterval(iv); }, 1000);
        const wordLevel = (aiTargetMode === 'intro' || aiTargetMode === 'vo' || aiTargetMode === 'censor');
        // La censura busca malas palabras en INGLÉS siempre (lista editable en la sección 🤬)
        const lang = aiTargetMode === 'censor' ? 'english'
            : aiTargetMode === 'outro'
            ? (state.outro.captionLanguage || 'spanish')
            : (state.intro.captionLanguage || 'english');
        aiWorker.postMessage({ type: 'transcribe', audio: float32Audio, wordLevel, language: lang });
    } catch(e) {
        alert('Error procesando audio: ' + e);
        document.getElementById('aiOverlay').classList.add('hidden');
    }
}

function applyAICaptions(chunks) {
    const mapChunk = ch => ({
        text: ch.text.trim(),
        from: Math.round(ch.timestamp[0]*10)/10,
        to: ch.timestamp[1] === null ? Math.round((ch.timestamp[0]+2)*10)/10 : Math.round(ch.timestamp[1]*10)/10
    });

    if (aiTargetMode === 'censor') {
        applyCensorDetection(chunks);
        aiTargetMode = null;
        aiTargetClipId = null;
        aiTargetSub = null;
        document.getElementById('aiOverlay').classList.add('hidden');
        return;
    }

    if (aiTargetMode === 'intro') {
        state.intro.captions = chunks.map(mapChunk);
        state.intro.captionsEnabled = true;
        renderIntroCaptions();
    } else if (aiTargetMode === 'clip') {
        const clip = state.clips.find(c => c.id === aiTargetClipId);
        if (clip) {
            clip.captions = chunks.map(ch => ({
                text: ch.text.trim(),
                from: Math.round(ch.timestamp[0]*10)/10,
                to: ch.timestamp[1] === null ? Math.round((ch.timestamp[0]+3)*10)/10 : Math.round(ch.timestamp[1]*10)/10
            }));
            clip.captionsEnabled = true;
        }
        renderClipsList();
    } else if (aiTargetMode === 'vo') {
        const clip = state.clips.find(c => c.id === aiTargetClipId);
        if (clip && clip.vo) {
            clip.vo.captions = chunks.map(mapChunk);
        }
        renderClipsList();
    } else if (aiTargetMode === 'outro') {
        state.outro.captions = chunks.map(mapChunk);
        renderOutroCaptions();
    }
    aiTargetMode = null;
    aiTargetClipId = null;
    document.getElementById('aiOverlay').classList.add('hidden');
}

// Detección de malas palabras: convierte los chunks palabra a palabra de Whisper
// en marcas de censura [{id, word, from, to, excluded}] sobre el audio del clip.
function applyCensorDetection(chunks) {
    const clip = state.clips.find(c => c.id === aiTargetClipId);
    if (!clip) return;
    const wordSet = getCensorWordSet();
    const srcLabel = aiTargetSub === 'vo' ? 'voz en off' : 'video';

    const detected = [];
    (chunks || []).forEach(ch => {
        const w = normalizeCensorWord(ch && ch.text);
        const ts = ch && ch.timestamp;
        const from = ts ? ts[0] : null;
        let to = ts ? ts[1] : null;
        if (to === null || to === undefined) to = (Number.isFinite(from) ? from + 0.6 : null);
        if (w && wordSet.has(w) && Number.isFinite(from) && Number.isFinite(to) && to > from) {
            detected.push({
                id: 'cm' + (++censorMarkSeq) + '_' + Date.now(),
                word: w,
                from: Math.round(from * 100) / 100,
                to: Math.round(to * 100) / 100,
                excluded: false
            });
        }
    });

    // Fusionar marcas solapadas o casi contiguas (frase censurable seguida)
    const merged = [];
    detected.sort((a, b) => a.from - b.from).forEach(m => {
        const last = merged[merged.length - 1];
        if (last && m.from - last.to < 0.08) {
            last.to = Math.max(last.to, m.to);
            last.word += ' ' + m.word;
        } else {
            merged.push(m);
        }
    });

    // Conservar "excluded" de marcas equivalentes ya presentes (falsos positivos marcados antes)
    const prev = aiTargetSub === 'vo' ? (clip.vo && clip.vo.censorMarks) : clip.censorMarks;
    if (merged.length && prev && prev.length) {
        merged.forEach(m => {
            const match = prev.find(p => p.excluded && p.word === m.word && Math.abs(p.from - m.from) < 0.4);
            if (match) m.excluded = true;
        });
    }

    if (aiTargetSub === 'vo') ensureVo(clip).censorMarks = merged;
    else clip.censorMarks = merged;

    renderClipsList();
    scheduleAutoSave();
    alert(merged.length === 0
        ? 'No se detectaron malas palabras en el audio del ' + srcLabel + '.'
        : 'Se detectaron ' + merged.length + ' marca(s) de censura en el ' + srcLabel + '.\nRevisa la lista 🤬 del clip: puedes excluir falsos positivos o ajustar marcas manuales.');
}

// ═══════════════════════════════════════════════════════════
// ████  OS DRAG & DROP & UI UPDATES  ████
// ═══════════════════════════════════════════════════════════
document.body.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('drag-over-body'); });
document.body.addEventListener('dragleave', e => { e.preventDefault(); if(!e.clientX && !e.clientY) document.body.classList.remove('drag-over-body'); });
document.body.addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('drag-over-body');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    files.forEach(f => handleOSFileUpload(f));
});

function updateTitle() {
    state.title.font = document.getElementById('titleFont').value;
    const lineInputs = document.querySelectorAll('#titleLinesContainer .title-line-input');
    if (lineInputs.length > 0) {
        state.title.lines = Array.from(lineInputs).map(inp => inp.value);
    }
    const fontSelects = document.querySelectorAll('#titleLinesContainer .title-line-font');
    if (fontSelects.length > 0) {
        state.title.lineFonts = Array.from(fontSelects).map(sel => sel.value || '');
    }
    const sizeRanges = document.querySelectorAll('#titleLinesContainer .title-line-size');
    if (sizeRanges.length > 0) {
        state.title.lineSizes = Array.from(sizeRanges).map(r => {
            const v = parseInt(r.value);
            return Number.isFinite(v) ? v : null;
        });
    }
    ensureTitlePositions();
    state.title.textColor = document.getElementById('titleTextColor').value;
    state.title.fontSize = parseInt(document.getElementById('titleFontSize').value);
    document.getElementById('titleFontSizeVal').textContent = state.title.fontSize;
    scheduleAutoSave();
    drawFrame();
}

const TITLE_FONT_OPTIONS = [
    { v: "'Segoe UI', Arial, sans-serif", t: 'Segoe UI' },
    { v: 'Arial, sans-serif', t: 'Arial' },
    { v: 'Verdana, sans-serif', t: 'Verdana' },
    { v: 'Impact, sans-serif', t: 'Impact' },
    { v: "'Comic Sans MS', cursive", t: 'Comic Sans' },
    { v: "'Courier New', monospace", t: 'Courier New' },
    { v: 'Georgia, serif', t: 'Georgia' }
].concat(EXTRA_FONTS_FLAT);

function renderTitleLineInputs() {
    const container = document.getElementById('titleLinesContainer');
    container.innerHTML = '';
    state.title.lines.forEach((line, i) => {
        // Fila 1: texto de la línea + botón eliminar
        const rowText = document.createElement('div');
        rowText.className = 'form-row';
        const label = document.createElement('label');
        label.textContent = 'Línea ' + (i + 1);
        const input = document.createElement('input');
        input.type = 'text';
        input.value = line;
        input.className = 'title-line-input';
        input.style.flex = '1';
        input.style.minWidth = '0';
        input.addEventListener('input', updateTitle);
        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = '✕';
        del.title = 'Eliminar línea';
        del.style.marginLeft = '6px';
        del.addEventListener('click', () => removeTitleLine(i));
        rowText.appendChild(label);
        rowText.appendChild(input);
        rowText.appendChild(del);

        // Fila 2: fuente + tamaño por línea
        const rowStyle = document.createElement('div');
        rowStyle.className = 'form-row';
        const fontLabel = document.createElement('label');
        fontLabel.textContent = 'Fuente';
        const fontSel = document.createElement('select');
        fontSel.className = 'title-line-font';
        fontSel.title = 'Fuente de esta línea (vacío = global)';
        fontSel.style.flex = '0 0 auto';
        const optDef = document.createElement('option');
        optDef.value = ''; optDef.textContent = 'Global';
        fontSel.appendChild(optDef);
        TITLE_FONT_OPTIONS.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.v; opt.textContent = o.t;
            fontSel.appendChild(opt);
        });
        fontSel.value = state.title.lineFonts[i] || '';
        fontSel.addEventListener('change', updateTitle);

        const sizeLabel = document.createElement('label');
        sizeLabel.textContent = 'Tam.';
        sizeLabel.style.textAlign = 'right';
        const sizeRange = document.createElement('input');
        sizeRange.type = 'range';
        sizeRange.min = '24'; sizeRange.max = '160';
        sizeRange.className = 'title-line-size';
        sizeRange.style.flex = '1';
        sizeRange.style.minWidth = '60px';
        const curSize = (typeof state.title.lineSizes[i] === 'number' && state.title.lineSizes[i] > 0)
            ? state.title.lineSizes[i] : state.title.fontSize;
        sizeRange.value = String(curSize);
        sizeRange.title = 'Tamaño de esta línea';
        const sizeVal = document.createElement('span');
        sizeVal.className = 'range-value';
        sizeVal.textContent = curSize;
        sizeVal.style.minWidth = '32px';
        sizeVal.style.textAlign = 'right';
        const syncVal = () => { sizeVal.textContent = sizeRange.value; };
        sizeRange.addEventListener('input', syncVal);
        sizeRange.addEventListener('input', updateTitle);

        rowStyle.appendChild(fontLabel);
        rowStyle.appendChild(fontSel);
        rowStyle.appendChild(sizeLabel);
        rowStyle.appendChild(sizeRange);
        rowStyle.appendChild(sizeVal);

        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.gap = '4px';
        wrap.style.marginBottom = '6px';
        wrap.appendChild(rowText);
        wrap.appendChild(rowStyle);
        container.appendChild(wrap);
    });
}

function addTitleLine() {
    state.title.lines.push('');
    if (!Array.isArray(state.title.lineFonts)) state.title.lineFonts = [];
    if (!Array.isArray(state.title.lineSizes)) state.title.lineSizes = [];
    state.title.lineFonts.push('');
    state.title.lineSizes.push(null);
    ensureTitlePositions();
    renderTitleLineInputs();
    scheduleAutoSave();
    drawFrame();
}

function removeTitleLine(i) {
    if (state.title.lines.length <= 1) return;
    state.title.lines.splice(i, 1);
    state.layout.titlePos.splice(i, 1);
    if (Array.isArray(state.title.lineFonts)) state.title.lineFonts.splice(i, 1);
    if (Array.isArray(state.title.lineSizes)) state.title.lineSizes.splice(i, 1);
    renderTitleLineInputs();
    scheduleAutoSave();
    drawFrame();
}

function updateNumbers() {
    state.numbers.font = document.getElementById('numFont').value;
    state.numbers.fontSize = parseInt(document.getElementById('numFontSize').value);
    state.numbers.showCircle = document.getElementById('numShowCircle').checked;
    state.numbers.color = document.getElementById('numColor').value;
    state.numbers.showOutline = document.getElementById('numShowOutline').checked;
    state.numbers.outlineIntensity = parseInt(document.getElementById('numOutlineIntensity').value);
    state.numbers.textSize = parseInt(document.getElementById('numTextSize').value);
    state.numbers.textFont = document.getElementById('numTextFont').value;
    state.numbers.showTextOutline = document.getElementById('numShowTextOutline').checked;
    state.numbers.textOutlineIntensity = parseInt(document.getElementById('numTextOutlineIntensity').value);
    document.getElementById('numFontSizeVal').textContent = state.numbers.fontSize;
    document.getElementById('numOutlineIntensityVal').textContent = state.numbers.outlineIntensity;
    document.getElementById('numTextSizeVal').textContent = state.numbers.textSize;
    document.getElementById('numTextOutlineIntensityVal').textContent = state.numbers.textOutlineIntensity;
    scheduleAutoSave();
}
function updateBars() {
    state.barTop.color = document.getElementById('barTopColor').value;
    state.barTop.height = parseInt(document.getElementById('barTopHeight').value);
    state.barTop.style = document.getElementById('barTopStyle').value;
    state.barTop.blur = parseInt(document.getElementById('barTopBlur').value);
    state.barTop.overlay = parseInt(document.getElementById('barTopOverlay').value);
    state.barBottom.color = document.getElementById('barBottomColor').value;
    state.barBottom.height = parseInt(document.getElementById('barBottomHeight').value);
    state.barBottom.style = document.getElementById('barBottomStyle').value;
    state.barBottom.blur = parseInt(document.getElementById('barBottomBlur').value);
    state.barBottom.overlay = parseInt(document.getElementById('barBottomOverlay').value);
    document.getElementById('barTopBlurVal').textContent = state.barTop.blur;
    document.getElementById('barTopOverlayVal').textContent = document.getElementById('barTopOverlay').value + '%';
    document.getElementById('barBottomBlurVal').textContent = state.barBottom.blur;
    document.getElementById('barBottomOverlayVal').textContent = document.getElementById('barBottomOverlay').value + '%';
    scheduleAutoSave();
}

// ═══════════════════════════════════════════════════════════
// ████  BLUR BARS UI  ████
// ═══════════════════════════════════════════════════════════
function getCurrentBlurBars() {
    const clip = state.clips[currentClipIndex];
    if (!clip) return null;
    if (!clip.blurBars) clip.blurBars = [];
    return clip.blurBars;
}

function addBlurBar() {
    if (state.clips.length === 0) return;
    const bar = {
        id: blurBarIdCounter++,
        x: 290,
        y: 880,
        w: 500,
        h: 150,
        blur: 20
    };
    getCurrentBlurBars().push(bar);
    renderBlurBarsList();
    scheduleAutoSave();
}

function removeBlurBar(id) {
    const bars = getCurrentBlurBars();
    if (!bars) return;
    const idx = bars.findIndex(b => b.id === id);
    if (idx !== -1) bars.splice(idx, 1);
    renderBlurBarsList();
    scheduleAutoSave();
}

function updateBlurBar(id, field, val) {
    const bars = getCurrentBlurBars();
    if (!bars) return;
    const bar = bars.find(b => b.id === id);
    if (!bar) return;
    bar[field] = parseFloat(val) || 0;
    const valSpan = document.getElementById('bbVal_' + field + '_' + id);
    if (valSpan) valSpan.textContent = Math.round(bar[field]);
    scheduleAutoSave();
}

function renderBlurBarsList() {
    const container = document.getElementById('blurBarsList');
    if (!container) return;
    const clip = state.clips[currentClipIndex];
    if (!clip) { container.innerHTML = '<p class="hint">Selecciona un clip para editar sus barras borrosas.</p>'; return; }
    if (!clip.blurBars) clip.blurBars = [];
    let html = '';
    if (clip.blurBars.length === 0) {
        html = '<p class="hint">Este clip no tiene barras borrosas. Pulsa ＋ para añadir una.</p>';
    }
    clip.blurBars.forEach((bar, i) => {
        html += '<div class="blur-bar-card">' +
            '<div class="blur-bar-header">' +
                '<span class="blur-bar-title">Barra ' + (i + 1) + '</span>' +
                '<button class="caption-del" title="Eliminar" onclick="removeBlurBar(' + bar.id + ')">✕</button>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Ancho</label>' +
                '<input type="range" min="20" max="1080" value="' + bar.w + '" oninput="updateBlurBar(' + bar.id + ',\'w\',this.value)" onclick="event.stopPropagation()">' +
                '<span class="range-value" id="bbVal_w_' + bar.id + '">' + Math.round(bar.w) + '</span>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Alto</label>' +
                '<input type="range" min="20" max="1920" value="' + bar.h + '" oninput="updateBlurBar(' + bar.id + ',\'h\',this.value)" onclick="event.stopPropagation()">' +
                '<span class="range-value" id="bbVal_h_' + bar.id + '">' + Math.round(bar.h) + '</span>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Blur</label>' +
                '<input type="range" min="1" max="60" value="' + bar.blur + '" oninput="updateBlurBar(' + bar.id + ',\'blur\',this.value)" onclick="event.stopPropagation()">' +
                '<span class="range-value" id="bbVal_blur_' + bar.id + '">' + Math.round(bar.blur) + '</span>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Pos X</label>' +
                '<input type="range" id="bbInput_x_' + bar.id + '" min="0" max="1080" value="' + bar.x + '" oninput="updateBlurBar(' + bar.id + ',\'x\',this.value)" onclick="event.stopPropagation()">' +
                '<span class="range-value" id="bbVal_x_' + bar.id + '">' + Math.round(bar.x) + '</span>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Pos Y</label>' +
                '<input type="range" id="bbInput_y_' + bar.id + '" min="0" max="1920" value="' + bar.y + '" oninput="updateBlurBar(' + bar.id + ',\'y\',this.value)" onclick="event.stopPropagation()">' +
                '<span class="range-value" id="bbVal_y_' + bar.id + '">' + Math.round(bar.y) + '</span>' +
            '</div>' +
        '</div>';
    });
    container.innerHTML = html;
}

function updateCaptionStyle() {
    state.captionStyle.color = document.getElementById('capColor').value;
    state.captionStyle.bgColor = document.getElementById('capBgColor').value;
    state.captionStyle.bgOpacity = parseInt(document.getElementById('capBgOpacity').value)/100;
    state.captionStyle.fontSize = parseInt(document.getElementById('capFontSize').value);
    document.getElementById('capBgOpacityVal').textContent = document.getElementById('capBgOpacity').value+'%';
    document.getElementById('capFontSizeVal').textContent = state.captionStyle.fontSize;
    scheduleAutoSave();
}
// ═══════════════════════════════════════════════════════════
// ████  INTRO UI  ████
// ═══════════════════════════════════════════════════════════
function updateClipVolume(clipId, val) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    clip.volume = Math.max(0, Math.min(1, parseInt(val) / 100));
    // Also apply to video element in real time
    if (clip.videoEl) clip.videoEl.volume = clip.volume;
    // Update the displayed percentage text next to the slider
    const card = document.querySelector('.clip-card[onclick*="' + clipId + '"]');
    if (card) {
        const span = card.querySelector('.clip-volume-row .range-value');
        if (span) span.textContent = val + '%';
    }
    scheduleAutoSave();
}

function updateShortsOverlay() {
    if (!state.shortsOverlay) state.shortsOverlay = { enabled:false, opacity:0.5, visible:true };
    state.shortsOverlay.enabled = document.getElementById('shortsOverlayEnabled').checked;
    state.shortsOverlay.opacity = parseInt(document.getElementById('shortsOverlayOpacity').value) / 100;
    document.getElementById('shortsOverlayOpacityVal').textContent = document.getElementById('shortsOverlayOpacity').value + '%';
    scheduleAutoSave();
    drawFrame();
}

function toggleShortsHide() {
    if (!state.shortsOverlay) state.shortsOverlay = { enabled:false, opacity:0.5, visible:true };
    state.shortsOverlay.visible = !state.shortsOverlay.visible;
    const btn = document.getElementById('shortsOverlayHideBtn');
    if (btn) btn.textContent = state.shortsOverlay.visible ? 'Ocultar' : 'Mostrar';
    drawFrame();
}

function updateIntro() {
    state.intro.enabled = document.getElementById('introEnabled').checked;
    state.intro.duration = parseInt(document.getElementById('introDuration').value);
    state.intro.blurAmount = parseInt(document.getElementById('introBlur').value);
    state.intro.overlayOpacity = parseInt(document.getElementById('introOverlay').value) / 100;
    state.intro.bgClipId = document.getElementById('introBgClip').value || null;
    state.intro.bgMuted = document.getElementById('introBgMuted').checked;
    state.intro.captionsEnabled = document.getElementById('introCaptionsEnabled').checked;
    state.intro.captionBgEnabled = document.getElementById('introCapBg').checked;
    state.intro.captionFont = document.getElementById('introCapFont').value;
    state.intro.captionLanguage = document.getElementById('introCapLang').value;
    state.intro.captionColor = document.getElementById('introCapColor').value;
    state.intro.captionFontSize = parseInt(document.getElementById('introCapSize').value);
    state.intro.captionShowOutline = document.getElementById('introCapOutline').checked;
    state.intro.captionOutlineIntensity = parseInt(document.getElementById('introCapOutlineInt').value);
    document.getElementById('introDurationVal').textContent = state.intro.duration;
    document.getElementById('introBlurVal').textContent = state.intro.blurAmount;
    document.getElementById('introOverlayVal').textContent = document.getElementById('introOverlay').value + '%';
    document.getElementById('introCapSizeVal').textContent = state.intro.captionFontSize;
    document.getElementById('introCapOutlineIntVal').textContent = state.intro.captionOutlineIntensity;
    scheduleAutoSave();
}

function refreshIntroBgClipSelect() {
    const sel = document.getElementById('introBgClip');
    if (!sel) return;
    const cur = state.intro.bgClipId || '';
    let html = '<option value="">Automático (primer clip)</option>';
    state.clips.forEach((c, i) => {
        const label = '#' + (i + 1) + (c.numberText ? ' ' + c.numberText : (c.rankingPosition ? ' #' + c.rankingPosition : ''));
        html += '<option value="' + c.id + '"' + (cur === c.id ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    });
    sel.innerHTML = html;
    if (cur && state.clips.find(c => c.id === cur)) sel.value = cur;
}

function handleIntroAudio(file) {    if (!file) return;
    if (introAudioEl) { introAudioEl.pause(); introAudioEl.src = ''; }
    introAudioEl = new Audio(URL.createObjectURL(file));
    introAudioEl.muted = true; // muted by default for preview; unmuted during export via Web Audio
    introAudioEl.preload = 'auto';
    state.intro.audioUrl = file.name;
    state.intro._audioFile = file;
    document.getElementById('introAudioName').textContent = '🎵 ' + file.name;
    document.getElementById('introAudioRemove').style.display = '';
    scheduleAutoSave();
}

function removeIntroAudio() {
    if (introAudioEl) { introAudioEl.pause(); introAudioEl.src = ''; introAudioEl = null; }
    state.intro.audioUrl = '';
    state.intro._audioFile = null;
    document.getElementById('introAudioName').textContent = '';
    document.getElementById('introAudioRemove').style.display = 'none';
    document.getElementById('introAudioFile').value = '';
    scheduleAutoSave();
}

function addIntroCaption() {
    state.intro.captions.push({ text: '', from: 0, to: 2 });
    renderIntroCaptions();
    scheduleAutoSave();
}

function remIntroCaption(idx) {
    state.intro.captions.splice(idx, 1);
    renderIntroCaptions();
    scheduleAutoSave();
}

function updateIntroCap(idx, field, val) {
    if (!state.intro.captions[idx]) return;
    state.intro.captions[idx][field] = field === 'text' ? val : parseFloat(val) || 0;
    scheduleAutoSave();
}

function renderIntroCaptions() {
    const container = document.getElementById('introCaptionsList');
    if (!container) return;
    let html = '';
    state.intro.captions.forEach((cap, ci) => {
        const escapedText = escapeHtml(cap.text);
        html += '<div class="caption-row">' +
            '<input type="text" value="' + escapedText + '" placeholder="Texto" oninput="updateIntroCap(' + ci + ',\'text\',this.value)" onclick="event.stopPropagation()">' +
            '<input type="number" value="' + cap.from + '" step="0.1" title="Desde(s)" onchange="updateIntroCap(' + ci + ',\'from\',this.value)" onclick="event.stopPropagation()">' +
            '<input type="number" value="' + cap.to + '" step="0.1" title="Hasta(s)" onchange="updateIntroCap(' + ci + ',\'to\',this.value)" onclick="event.stopPropagation()">' +
            '<button class="caption-del" onclick="event.stopPropagation();remIntroCaption(' + ci + ')">✕</button>' +
        '</div>';
    });
    container.innerHTML = html;
}

function syncIntroUI() {
    document.getElementById('introEnabled').checked = state.intro.enabled === true;
    document.getElementById('introDuration').value = state.intro.duration ?? 5;
    document.getElementById('introDurationVal').textContent = state.intro.duration ?? 5;
    document.getElementById('introBlur').value = state.intro.blurAmount ?? 20;
    document.getElementById('introBlurVal').textContent = state.intro.blurAmount ?? 20;
    document.getElementById('introOverlay').value = Math.round((state.intro.overlayOpacity ?? 0.4) * 100);
    document.getElementById('introOverlayVal').textContent = Math.round((state.intro.overlayOpacity ?? 0.4) * 100) + '%';
    refreshIntroBgClipSelect();
    document.getElementById('introBgMuted').checked = state.intro.bgMuted !== false;
    document.getElementById('introCaptionsEnabled').checked = state.intro.captionsEnabled !== false;
    document.getElementById('introCapBg').checked = state.intro.captionBgEnabled !== false;
    document.getElementById('introCapFont').value = state.intro.captionFont || "'Segoe UI', sans-serif";
    document.getElementById('introCapLang').value = state.intro.captionLanguage || 'english';
    document.getElementById('introCapColor').value = state.intro.captionColor || '#FFFFFF';
    document.getElementById('introCapSize').value = state.intro.captionFontSize ?? 36;
    document.getElementById('introCapSizeVal').textContent = state.intro.captionFontSize ?? 36;
    document.getElementById('introCapOutline').checked = state.intro.captionShowOutline === true;
    document.getElementById('introCapOutlineInt').value = state.intro.captionOutlineIntensity ?? 50;
    document.getElementById('introCapOutlineIntVal').textContent = state.intro.captionOutlineIntensity ?? 50;
    if (state.intro.audioUrl) {
        document.getElementById('introAudioName').textContent = '🎵 ' + state.intro.audioUrl;
        document.getElementById('introAudioRemove').style.display = '';
    }
    renderIntroCaptions();
}

// ═══════════════════════════════════════════════════════════
// ████  STYLE ENGINE UI  ████
// ═══════════════════════════════════════════════════════════

// ─── VOZ EN OFF ───
function ensureVo(clip) {
    if (!clip.vo) clip.vo = { enabled: true, text: '', offset: 0, fileName: '', captions: [], censorMarks: [], _file: null, audioEl: null, duration: 0 };
    const vo = clip.vo;
    if (!Array.isArray(vo.censorMarks)) vo.censorMarks = [];
    if (!vo.capPos) vo.capPos = { x: 0.5, y: 0.62 };
    if (!vo.capFont) vo.capFont = "'Segoe UI', sans-serif";
    if (vo.capSize === undefined) vo.capSize = 40;
    if (!vo.capColor) vo.capColor = '#FFFFFF';
    if (vo.capBgEnabled === undefined) vo.capBgEnabled = true;
    if (vo.capOutlineEnabled === undefined) vo.capOutlineEnabled = false;
    if (!vo.capOutlineColor) vo.capOutlineColor = '#000000';
    if (vo.capOutlineIntensity === undefined) vo.capOutlineIntensity = 40;
    if (vo.capWords === undefined) vo.capWords = 3;
    return vo;
}
function updateVoiceoversEnabled(v) {
    state.voiceoversEnabled = v === true || v === 'true';
    if (!state.voiceoversEnabled) pauseAllStyleAudio();
    scheduleAutoSave();
}
// Copia el estilo/configuración/posición de las captions del clip origen y las aplica GLOBALMENTE a todos los clips
function copyClipCaptionStyleToVo(clipId) {
    const sel = document.getElementById('vocpsrc_' + clipId);
    const srcId = sel ? sel.value : null;
    const src = srcId ? state.clips.find(c => c.id === srcId) : null;
    if (!src) { alert('Selecciona un clip de origen válido.'); return; }

    // Recolectar el estilo del clip origen (preferir VO, fallback a captionStyle global + captionPos del clip)
    const srcVo = src.vo || {};
    const cs = state.captionStyle || {};
    const style = {
        capFont:             srcVo.capFont             || "'Segoe UI', sans-serif",
        capSize:             srcVo.capSize             ?? cs.fontSize ?? 40,
        capColor:            srcVo.capColor            || cs.color    || '#FFFFFF',
        capBgEnabled:        srcVo.capBgEnabled !== undefined ? srcVo.capBgEnabled : true,
        capOutlineEnabled:   srcVo.capOutlineEnabled === true,
        capOutlineColor:     srcVo.capOutlineColor     || '#000000',
        capOutlineIntensity: srcVo.capOutlineIntensity ?? 40,
        capWords:            srcVo.capWords            ?? 3,
        capPos:              srcVo.capPos ? { x: srcVo.capPos.x, y: srcVo.capPos.y }
                            : (src.captionPos ? { x: src.captionPos.x, y: src.captionPos.y }
                            : { x: 0.5, y: 0.62 })
    };

    // Aplicar a TODOS los clips' VO
    state.clips.forEach(c => {
        const vo = ensureVo(c);
        vo.capFont = style.capFont;
        vo.capSize = style.capSize;
        vo.capColor = style.capColor;
        vo.capBgEnabled = style.capBgEnabled;
        vo.capOutlineEnabled = style.capOutlineEnabled;
        vo.capOutlineColor = style.capOutlineColor;
        vo.capOutlineIntensity = style.capOutlineIntensity;
        vo.capWords = style.capWords;
        vo.capPos = { x: style.capPos.x, y: style.capPos.y };
    });

    // Sincronizar también el estilo global de captions de clip
    state.captionStyle.color = style.capColor;
    state.captionStyle.fontSize = style.capSize;
    state.captionStyle.bgOpacity = style.capBgEnabled ? 0.6 : 0;

    // Sincronizar la posición de las captions de todos los clips
    state.clips.forEach(c => {
        c.captionPos = { x: style.capPos.x, y: style.capPos.y };
    });

    scheduleAutoSave();
    renderClipsList();
    drawFrame();
}

function updateVoField(clipId, f, v) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    const vo = ensureVo(clip);
    const numericFields = ['offset', 'capSize', 'capOutlineIntensity', 'capWords'];
    if (numericFields.includes(f)) vo[f] = parseFloat(v) || 0;
    else vo[f] = v;
    if (f === 'capSize') {
        const span = document.getElementById('vocapsize_' + clipId);
        if (span) span.textContent = vo.capSize;
    }
    if (f === 'capOutlineIntensity') {
        const span = document.getElementById('vocapolint_' + clipId);
        if (span) span.textContent = vo.capOutlineIntensity;
    }
    if (f === 'text') {
        const words = (v || '').trim() ? v.trim().split(/\s+/).length : 0;
        const span = document.getElementById('vowc_' + clipId);
        if (span) {
            span.textContent = words + '/8 palabras';
            span.style.color = words > 8 ? '#ff6666' : '#7cfc90';
        }
    }
    drawFrame();
    scheduleAutoSave();
}
function handleVoUpload(clipId, file) {
    if (!file) return;
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    const vo = ensureVo(clip);
    vo._file = file;
    vo.fileName = file.name;
    attachVoAudioEl(clip);
    const nameEl = document.getElementById('voname_' + clipId);
    if (nameEl) nameEl.textContent = '🎵 ' + file.name;
    const input = document.getElementById('vofile_' + clipId);
    if (input) input.value = '';
    scheduleAutoSave();
}
function removeVoAudio(clipId) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip || !clip.vo) return;
    if (clip.vo.audioEl) { clip.vo.audioEl.pause(); clip.vo.audioEl.remove(); }
    clip.vo.audioEl = null;
    clip.vo._file = null;
    clip.vo.fileName = '';
    clip.vo.duration = 0;
    clip.vo.censorMarks = []; // las marcas eran tiempos de ese audio
    const nameEl = document.getElementById('voname_' + clipId);
    if (nameEl) nameEl.textContent = '';
    const input = document.getElementById('vofile_' + clipId);
    if (input) input.value = '';
    scheduleAutoSave();
}
function addVoCap(clipId) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    ensureVo(clip).captions.push({ text: '', from: 0, to: 2 });
    renderClipsList();
    scheduleAutoSave();
}
function remVoCap(clipId, idx) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip || !clip.vo || !clip.vo.captions[idx]) return;
    clip.vo.captions.splice(idx, 1);
    renderClipsList();
    scheduleAutoSave();
}
function updateVoCap(clipId, idx, field, val) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip || !clip.vo || !clip.vo.captions[idx]) return;
    clip.vo.captions[idx][field] = field === 'text' ? val : parseFloat(val) || 0;
    scheduleAutoSave();
}

// ─── MOMENTO CLAVE / FREEZE FRAMES ───
function addFreeze() {
    const clip = state.clips[currentClipIndex];
    if (!clip) return alert('Selecciona o crea un clip primero.');
    if (!clip.freezes) clip.freezes = [];
    clip.freezes.push({
        id: ++freezeIdCounter,
        t: 1,
        dur: 1.5,
        text: '#2 es el MÁS LOCO',
        font: "'Segoe UI', Arial, sans-serif",
        color: '#FFD700',
        fontSize: 90,
        showOutline: true,
        outlineIntensity: 50,
        bgEnabled: false,
        posX: 0.5,
        posY: 0.3
    });
    renderFreezesList();
    drawFrame();
    scheduleAutoSave();
    renderFxTrack();
}
function removeFreeze(fid) {
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.freezes) return;
    clip.freezes = clip.freezes.filter(f => f.id !== fid);
    delete freezeRuntime[fid];
    renderFreezesList();
    drawFrame();
    scheduleAutoSave();
    renderFxTrack();
}
function markFreezeTime(fid) {
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.freezes) return;
    const ff = clip.freezes.find(f => f.id === fid);
    if (!ff) return;
    let rel = 1;
    if (clip.videoEl && clip.videoEl.readyState >= 2) {
        rel = Math.max(0, Math.round((clip.videoEl.currentTime - clip.trimStart) * 100) / 100);
    } else {
        alert('Reproduce o selecciona el clip para usar su tiempo actual.');
        return;
    }
    ff.t = rel;
    renderFreezesList();
    scheduleAutoSave();
    renderFxTrack();
}
function updateFreezeField(fid, f, v) {
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.freezes) return;
    const ff = clip.freezes.find(f2 => f2.id === fid);
    if (!ff) return;
    if (typeof v === 'boolean' || typeof v === 'string' && isNaN(parseFloat(v))) ff[f] = v;
    else ff[f] = parseFloat(v) || 0;
    const span = document.getElementById('fzVal_' + f + '_' + fid);
    if (span) span.textContent = ff[f];
    drawFrame();
    scheduleAutoSave();
}
function renderFreezesList() {
    const container = document.getElementById('freezesList');
    if (!container) return;
    const clip = state.clips[currentClipIndex];
    if (!clip) { container.innerHTML = '<p class="hint">Selecciona un clip para añadir momentos clave.</p>'; return; }
    if (!clip.freezes) clip.freezes = [];
    if (clip.freezes.length === 0) {
        container.innerHTML = '<p class="hint">Este clip no tiene momentos clave. Pulsa ＋ para añadir uno.</p>';
        return;
    }
    const fonts = ["'Segoe UI', Arial, sans-serif", "Arial, sans-serif", "Verdana, sans-serif", "Impact, sans-serif", "'Comic Sans MS', cursive", "Georgia, serif"];
    let html = '';
    clip.freezes.forEach((ff, i) => {
        const fontOpts = fonts.map(f => '<option value="' + f + '"' + (ff.font === f ? ' selected' : '') + '>' + f.split(',')[0].replace(/'/g, '') + '</option>').join('');
        html += '<div class="blur-bar-card">' +
            '<div class="blur-bar-header">' +
                '<span class="blur-bar-title">❄ Freeze ' + (i + 1) + '</span>' +
                '<button class="caption-del" title="Eliminar" onclick="removeFreeze(' + ff.id + ')">✕</button>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Momento(s)</label>' +
                '<input type="number" value="' + ff.t + '" step="0.1" min="0" onchange="updateFreezeField(' + ff.id + ',\'t\',this.value)">' +
                '<button class="btn btn-sm" onclick="markFreezeTime(' + ff.id + ')" title="Usar la posición actual del video">⏱ Ahora</button>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Duración</label>' +
                '<input type="range" min="0.5" max="5" step="0.1" value="' + ff.dur + '" oninput="updateFreezeField(' + ff.id + ',\'dur\',this.value)">' +
                '<span class="range-value" id="fzVal_dur_' + ff.id + '">' + ff.dur + '</span>' +
            '</div>' +
            '<input type="text" value="' + escapeHtml(ff.text || '') + '" placeholder="#2 es el MÁS LOCO" style="width:100%" oninput="updateFreezeField(' + ff.id + ',\'text\',this.value)">' +
            '<div class="form-row" style="margin-top:4px">' +
                '<label>Fuente</label><select class="freeze-font" data-font="' + (ff.font || '') + '" onchange="updateFreezeField(' + ff.id + ',\'font\',this.value)">' + fontOpts + '</select>' +
                '<label style="min-width:40px">Color</label>' +
                '<input type="color" value="' + (ff.color || '#FFFFFF') + '" oninput="updateFreezeField(' + ff.id + ',\'color\',this.value)">' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Tamaño</label>' +
                '<input type="range" min="30" max="200" value="' + (ff.fontSize || 90) + '" oninput="updateFreezeField(' + ff.id + ',\'fontSize\',this.value)">' +
                '<span class="range-value" id="fzVal_fontSize_' + ff.id + '">' + (ff.fontSize || 90) + '</span>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Outline</label>' +
                '<input type="checkbox" ' + (ff.showOutline ? 'checked' : '') + ' onchange="updateFreezeField(' + ff.id + ',\'showOutline\',this.checked)">' +
                '<label style="min-width:50px">Fondo</label>' +
                '<input type="checkbox" ' + (ff.bgEnabled ? 'checked' : '') + ' onchange="updateFreezeField(' + ff.id + ',\'bgEnabled\',this.checked)">' +
            '</div>' +
            '<p class="hint" style="margin:0">Arrastra el texto en el canvas para posicionarlo.</p>' +
        '</div>';
    });
    container.innerHTML = html;
    container.querySelectorAll('.freeze-font').forEach(sel => appendExtraFonts(sel, sel.dataset.font || null));
}

// ─── DISEÑO DE SONIDO ───
const SFX_KIND_MAP = { bass: 'bassHit', transition: 'transitionSfx', sting: 'stingReveal' };
function updateSoundDesign() {
    ['bass', 'transition', 'sting'].forEach(kind => {
        const cfg = state.soundDesign[SFX_KIND_MAP[kind]];
        const chk = document.getElementById('sfx_' + kind + '_enable');
        const vol = document.getElementById('sfx_' + kind + '_vol');
        if (chk) cfg.enabled = chk.checked;
        if (vol) cfg.volume = parseInt(vol.value) / 100;
        const volVal = document.getElementById('sfx_' + kind + '_volval');
        if (volVal && vol) volVal.textContent = vol.value + '%';
    });
    scheduleAutoSave();
    renderFxTrack();
}
function handleSfxFile(kind, file) {
    if (!file) return;
    const cfg = state.soundDesign[SFX_KIND_MAP[kind]];
    cfg._file = file;
    cfg.fileName = file.name;
    attachSfxEl(kind);
    const nameEl = document.getElementById('sfx_' + kind + '_name');
    if (nameEl) nameEl.textContent = '🎵 ' + file.name;
    const rm = document.getElementById('sfx_' + kind + '_rm');
    if (rm) rm.style.display = '';
    const input = document.getElementById('sfx_' + kind + '_file');
    if (input) input.value = '';
    scheduleAutoSave();
}
function removeSfxFile(kind) {
    const cfg = state.soundDesign[SFX_KIND_MAP[kind]];
    cfg._file = null;
    cfg.fileName = '';
    if (sfxEls[kind]) { sfxEls[kind].pause(); sfxEls[kind].remove(); sfxEls[kind] = null; }
    const nameEl = document.getElementById('sfx_' + kind + '_name');
    if (nameEl) nameEl.textContent = '';
    const rm = document.getElementById('sfx_' + kind + '_rm');
    if (rm) rm.style.display = 'none';
    const input = document.getElementById('sfx_' + kind + '_file');
    if (input) input.value = '';
    scheduleAutoSave();
}

// ─── CENSURA DE MALAS PALABRAS (UI) ───
function updateCensor() {
    const c = state.censor;
    c.enabled = document.getElementById('censorEnabled').checked;
    c.bleepVolume = parseInt(document.getElementById('censorBleepVol').value) / 100;
    document.getElementById('censorBleepVolVal').textContent = Math.round(c.bleepVolume * 100) + '%';
    if (bleepEl && !bleepEl.paused) bleepEl.volume = c.bleepVolume;
    if (!c.enabled) { restoreCensorVolumes(state.clips[currentClipIndex]); stopBleep(); }
    scheduleAutoSave();
}

function updateCensorWords(v) {
    state.censor.words = String(v || '').split(',').map(s => s.trim()).filter(Boolean);
    scheduleAutoSave();
}

function handleBleepFile(file) {
    if (!file) return;
    state.censor._file = file;
    state.censor.bleepFileName = file.name;
    attachBleepEl();
    const nameEl = document.getElementById('censorBleepName');
    if (nameEl) nameEl.textContent = '🎵 ' + file.name;
    const rm = document.getElementById('censorBleepRemove');
    if (rm) rm.style.display = '';
    const input = document.getElementById('censorBleepFile');
    if (input) input.value = '';
    renderAudioMixer();
    scheduleAutoSave();
}

function removeBleepFile() {
    state.censor._file = null;
    state.censor.bleepFileName = '';
    if (bleepEl) { bleepEl.pause(); bleepEl.remove(); bleepEl = null; }
    bleepActiveKey = null;
    const nameEl = document.getElementById('censorBleepName');
    if (nameEl) nameEl.textContent = '';
    const rm = document.getElementById('censorBleepRemove');
    if (rm) rm.style.display = 'none';
    const input = document.getElementById('censorBleepFile');
    if (input) input.value = '';
    renderAudioMixer();
    scheduleAutoSave();
}

// Lanza la detección IA sobre el audio del clip ('video') o su voz en off ('vo')
function detectCensor(clipId, sub) {
    aiTargetSub = sub;
    startAITranscription('censor', clipId);
}

function getCensorMarks(clip, src) {
    return src === 'vo' ? (clip.vo ? clip.vo.censorMarks : []) : (clip.censorMarks || []);
}

function setCensorMarks(clip, src, marks) {
    if (src === 'vo') ensureVo(clip).censorMarks = marks;
    else clip.censorMarks = marks;
}

// Excluir / volver a censurar una palabra detectada (falsos positivos)
function toggleCensorMark(clipId, src, markId) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    const m = getCensorMarks(clip, src).find(x => x.id === markId);
    if (m) m.excluded = !m.excluded;
    renderClipsList();
    scheduleAutoSave();
}

function removeCensorMark(clipId, src, markId) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    setCensorMarks(clip, src, getCensorMarks(clip, src).filter(x => x.id !== markId));
    renderClipsList();
    scheduleAutoSave();
}

// Marca manual (por si la IA falla): segundos absolutos del archivo de audio/video
function addCensorMarkManual(clipId, src) {
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    const fromEl = document.getElementById('cmFrom_' + src + '_' + clipId);
    const toEl = document.getElementById('cmTo_' + src + '_' + clipId);
    const from = Math.max(0, parseFloat(fromEl && fromEl.value) || 0);
    let to = parseFloat(toEl && toEl.value) || 0;
    if (!Number.isFinite(to) || to <= from) to = from + 0.5;
    const marks = getCensorMarks(clip, src).slice();
    marks.push({ id: 'cm' + (++censorMarkSeq) + '_' + Date.now(), word: 'manual', from, to, excluded: false });
    setCensorMarks(clip, src, marks);
    renderClipsList();
    scheduleAutoSave();
}

// ─── TEXTOS EN PANTALLA ───
function updateScreenTexts() {
    const h = state.screenTexts.headline;
    const q = state.screenTexts.endQuestion;
    h.enabled = document.getElementById('scrHeadlineEnabled').checked;
    h.text = document.getElementById('scrHeadlineText').value;
    h.durationSec = parseInt(document.getElementById('scrHeadlineDur').value);
    h.font = document.getElementById('scrHeadlineFont').value;
    h.fontSize = parseInt(document.getElementById('scrHeadlineSize').value);
    h.color = document.getElementById('scrHeadlineColor').value;
    h.showOutline = document.getElementById('scrHeadlineOutline').checked;
    q.enabled = document.getElementById('scrEqEnabled').checked;
    q.text = document.getElementById('scrEqText').value;
    q.lastSecs = parseInt(document.getElementById('scrEqLast').value);
    q.font = document.getElementById('scrEqFont').value;
    q.fontSize = parseInt(document.getElementById('scrEqSize').value);
    q.color = document.getElementById('scrEqColor').value;
    q.showOutline = document.getElementById('scrEqOutline').checked;
    document.getElementById('scrHeadlineDurVal').textContent = h.durationSec + 's';
    document.getElementById('scrHeadlineSizeVal').textContent = h.fontSize;
    document.getElementById('scrEqLastVal').textContent = q.lastSecs + 's';
    document.getElementById('scrEqSizeVal').textContent = q.fontSize;
    drawFrame();
    scheduleAutoSave();
}

// ─── OUTRO ───
function updateOutro() {
    const o = state.outro;
    o.enabled = document.getElementById('outroEnabled').checked;
    o.durationSec = parseInt(document.getElementById('outroDur').value);
    o.ctaText = document.getElementById('outroCta').value;
    o.bgColor = document.getElementById('outroBg').value;
    o.textColor = document.getElementById('outroTextColor').value;
    o.fontSize = parseInt(document.getElementById('outroFontSize').value);
    o.bgClipId = document.getElementById('outroBgClip').value;
    o.bgBlur = parseInt(document.getElementById('outroBgBlur').value);
    o.bgOverlay = parseInt(document.getElementById('outroBgOverlay').value);
    o.captionsEnabled = document.getElementById('outroCapEnabled').checked;
    o.captionFont = document.getElementById('outroCapFont').value;
    o.captionLanguage = document.getElementById('outroCapLang').value;
    o.captionColor = document.getElementById('outroCapColor').value;
    o.captionFontSize = parseInt(document.getElementById('outroCapSize').value);
    document.getElementById('outroDurVal').textContent = o.durationSec + 's';
    document.getElementById('outroFontSizeVal').textContent = o.fontSize;
    document.getElementById('outroBgBlurVal').textContent = o.bgBlur;
    document.getElementById('outroBgOverlayVal').textContent = document.getElementById('outroBgOverlay').value + '%';
    document.getElementById('outroCapSizeVal').textContent = o.captionFontSize;
    repackTimelineClipsSafe();
    drawFrame();
    updateTimeDisplay();
    scheduleAutoSave();
    renderFxTrack();
}
function repackTimelineClipsSafe() {
    try { renderTimelineClips(); } catch(e) {}
}

// Rellena el selector de clip de fondo del outro
function refreshOutroBgClipSelect() {
    const sel = document.getElementById('outroBgClip');
    if (!sel) return;
    const prev = state.outro.bgClipId || '';
    let html = '<option value="">Ninguno (solo color)</option>';
    state.clips.forEach((clip, i) => {
        const name = clip.file ? clip.file.name : 'Sin video';
        const safeName = escapeHtml(name.length > 22 ? name.substring(0, 20) + '…' : name);
        html += '<option value="' + clip.id + '"' + (prev === clip.id ? ' selected' : '') + '>Clip ' + (i + 1) + ' · ' + safeName + '</option>';
    });
    sel.innerHTML = html;
}
function handleOutroVoice(file) {
    if (!file) return;
    state.outro._voiceFile = file;
    state.outro.voiceFileName = file.name;
    attachOutroVoiceEl();
    document.getElementById('outroVoiceName').textContent = '🎵 ' + file.name;
    document.getElementById('outroVoiceRemove').style.display = '';
    document.getElementById('outroVoiceFile').value = '';
    scheduleAutoSave();
}
function removeOutroVoice() {
    if (outroVoiceEl) { outroVoiceEl.pause(); outroVoiceEl.remove(); outroVoiceEl = null; }
    state.outro._voiceFile = null;
    state.outro.voiceFileName = '';
    document.getElementById('outroVoiceName').textContent = '';
    document.getElementById('outroVoiceRemove').style.display = 'none';
    document.getElementById('outroVoiceFile').value = '';
    scheduleAutoSave();
}
function addOutroCaption() {
    state.outro.captions.push({ text: '', from: 0, to: 2 });
    renderOutroCaptions();
    scheduleAutoSave();
}
function remOutroCaption(idx) {
    state.outro.captions.splice(idx, 1);
    renderOutroCaptions();
    scheduleAutoSave();
}
function updateOutroCap(idx, field, val) {
    if (!state.outro.captions[idx]) return;
    state.outro.captions[idx][field] = field === 'text' ? val : parseFloat(val) || 0;
    scheduleAutoSave();
}
function renderOutroCaptions() {
    const container = document.getElementById('outroCaptionsList');
    if (!container) return;
    let html = '';
    state.outro.captions.forEach((cap, ci) => {
        html += '<div class="caption-row">' +
            '<input type="text" value="' + escapeHtml(cap.text) + '" placeholder="Texto" oninput="updateOutroCap(' + ci + ',\'text\',this.value)" onclick="event.stopPropagation()">' +
            '<input type="number" value="' + cap.from + '" step="0.1" title="Desde(s)" onchange="updateOutroCap(' + ci + ',\'from\',this.value)" onclick="event.stopPropagation()">' +
            '<input type="number" value="' + cap.to + '" step="0.1" title="Hasta(s)" onchange="updateOutroCap(' + ci + ',\'to\',this.value)" onclick="event.stopPropagation()">' +
            '<button class="caption-del" onclick="event.stopPropagation();remOutroCaption(' + ci + ')">✕</button>' +
        '</div>';
    });
    container.innerHTML = html || '<p class="hint" style="margin:0">Sin captions. Usa 🪄 IA sobre la voz importada o añade filas.</p>';
}

function syncStyleEngineUI() {
    // Voz en off master
    const voMaster = document.getElementById('voMasterEnabled');
    if (voMaster) voMaster.checked = state.voiceoversEnabled !== false;

    // Sound design
    ['bass', 'transition', 'sting'].forEach(kind => {
        const cfg = state.soundDesign[SFX_KIND_MAP[kind]];
        const chk = document.getElementById('sfx_' + kind + '_enable');
        const vol = document.getElementById('sfx_' + kind + '_vol');
        if (chk) chk.checked = cfg.enabled === true;
        if (vol) vol.value = Math.round((cfg.volume ?? 0.8) * 100);
        const volVal = document.getElementById('sfx_' + kind + '_volval');
        if (volVal && vol) volVal.textContent = vol.value + '%';
        if (cfg.fileName) {
            const nameEl = document.getElementById('sfx_' + kind + '_name');
            if (nameEl) nameEl.textContent = '🎵 ' + cfg.fileName;
            const rm = document.getElementById('sfx_' + kind + '_rm');
            if (rm) rm.style.display = '';
        }
    });

    // Textos en pantalla
    const h = state.screenTexts.headline;
    const q = state.screenTexts.endQuestion;
    document.getElementById('scrHeadlineEnabled').checked = h.enabled === true;
    document.getElementById('scrHeadlineText').value = h.text || '';
    document.getElementById('scrHeadlineDur').value = h.durationSec ?? 3;
    document.getElementById('scrHeadlineDurVal').textContent = (h.durationSec ?? 3) + 's';
    document.getElementById('scrHeadlineFont').value = h.font || "'Segoe UI', Arial, sans-serif";
    document.getElementById('scrHeadlineSize').value = h.fontSize ?? 80;
    document.getElementById('scrHeadlineSizeVal').textContent = h.fontSize ?? 80;
    document.getElementById('scrHeadlineColor').value = h.color || '#FFFFFF';
    document.getElementById('scrHeadlineOutline').checked = h.showOutline !== false;
    document.getElementById('scrEqEnabled').checked = q.enabled === true;
    document.getElementById('scrEqText').value = q.text || '';
    document.getElementById('scrEqLast').value = q.lastSecs ?? 4;
    document.getElementById('scrEqLastVal').textContent = (q.lastSecs ?? 4) + 's';
    document.getElementById('scrEqFont').value = q.font || "'Segoe UI', Arial, sans-serif";
    document.getElementById('scrEqSize').value = q.fontSize ?? 60;
    document.getElementById('scrEqSizeVal').textContent = q.fontSize ?? 60;
    document.getElementById('scrEqColor').value = q.color || '#FFFFFF';
    document.getElementById('scrEqOutline').checked = q.showOutline !== false;

    // Outro
    const o = state.outro;
    document.getElementById('outroEnabled').checked = o.enabled === true;
    document.getElementById('outroDur').value = o.durationSec ?? 5;
    document.getElementById('outroDurVal').textContent = (o.durationSec ?? 5) + 's';
    document.getElementById('outroCta').value = o.ctaText || '';
    document.getElementById('outroBg').value = o.bgColor || '#101018';
    document.getElementById('outroTextColor').value = o.textColor || '#FFFFFF';
    document.getElementById('outroFontSize').value = o.fontSize ?? 72;
    document.getElementById('outroFontSizeVal').textContent = o.fontSize ?? 72;
    document.getElementById('outroBgBlur').value = o.bgBlur ?? 20;
    document.getElementById('outroBgBlurVal').textContent = o.bgBlur ?? 20;
    document.getElementById('outroBgOverlay').value = o.bgOverlay ?? 40;
    document.getElementById('outroBgOverlayVal').textContent = (o.bgOverlay ?? 40) + '%';
    refreshOutroBgClipSelect();
    document.getElementById('outroCapEnabled').checked = o.captionsEnabled !== false;
    document.getElementById('outroCapFont').value = o.captionFont || "'Segoe UI', sans-serif";
    document.getElementById('outroCapLang').value = o.captionLanguage || 'spanish';
    document.getElementById('outroCapColor').value = o.captionColor || '#FFFFFF';
    document.getElementById('outroCapSize').value = o.captionFontSize ?? 36;
    document.getElementById('outroCapSizeVal').textContent = o.captionFontSize ?? 36;
    if (o.voiceFileName) {
        document.getElementById('outroVoiceName').textContent = '🎵 ' + o.voiceFileName;
        document.getElementById('outroVoiceRemove').style.display = '';
    }
    renderOutroCaptions();
    renderFreezesList();
}

// ═══════════════════════════════════════════════════════════
// ████  AUDIO TRACKS  ████
// ═══════════════════════════════════════════════════════════
// ████  AUDIO TRACKS  ████

function addAudioTrack(file) {
    if (!file) return;
    const track = {
        id: 'aud_' + (++audioTrackIdCounter) + '_' + Date.now(),
        file: file,
        url: URL.createObjectURL(file),
        audioEl: null,
        name: file.name,
        duration: 0,
        timelineStart: 0,
        trimStart: 0,
        trimEnd: 0,
        volume: 1.0
    };
    const audio = new Audio(track.url);
    audio.preload = 'auto';
    audio.muted = true; // muted for preview; unmuted via Web Audio during export
    track.audioEl = audio;
    videoContainer.appendChild(audio);

    audio.addEventListener('loadedmetadata', () => {
        track.duration = audio.duration;
        track.trimEnd = Math.min(Math.round(audio.duration * 100) / 100, audio.duration);
        // Place after existing tracks
        const maxEnd = state.audioTracks.reduce((max, t) => Math.max(max, t.timelineStart + (t.trimEnd - t.trimStart)), 0);
        track.timelineStart = maxEnd;
        state.timelineScaleDuration = Math.max(state.timelineScaleDuration, track.timelineStart + (track.trimEnd - track.trimStart));
        renderAudioTracks();
        scheduleAutoSave();
    });

    state.audioTracks.push(track);
    renderAudioTracks();
    scheduleAutoSave();
    document.getElementById('audioTrackFile').value = '';
}

function removeAudioTrack(id) {
    const idx = state.audioTracks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const t = state.audioTracks[idx];
    if (t.url) URL.revokeObjectURL(t.url);
    if (t.audioEl) t.audioEl.remove();
    if(tlSelection && tlSelection.type === 'audio' && tlSelection.id === id) tlSelection = null;
    state.audioTracks.splice(idx, 1);
    renderAudioTracks();
    renderTimelineClips();
    scheduleAutoSave();
}

function renderAudioTracks() {
    if (!trackAudioEl) return;
    const total = getTimelineScaleDuration();
    trackAudioEl.innerHTML = '';
    if (total <= 0) { renderFxTrack(); return; }

    state.audioTracks.forEach(track => {
        const dur = Math.max(0, (track.trimEnd || 0) - (track.trimStart || 0)) || track.duration || 1;
        const sel = tlSelection && tlSelection.type === 'audio' && tlSelection.id === track.id;
        const block = document.createElement('div');
        block.className = 'tl-block tl-ablock' + (sel ? ' selected' : '');
        block.dataset.trackId = track.id;
        block.style.left = ((track.timelineStart || 0) * tlPxPerSec) + 'px';
        block.style.width = Math.max(dur * tlPxPerSec, 5) + 'px';
        block.title = track.name + ' · ' + formatTime(dur);

        const wave = document.createElement('canvas');
        wave.className = 'tl-wave';
        block.appendChild(wave);

        const lbl = document.createElement('span');
        lbl.className = 'tl-blabel';
        lbl.textContent = '🎵 ' + track.name;
        block.appendChild(lbl);

        const delBtn = document.createElement('button');
        delBtn.className = 'tl-delbtn';
        delBtn.textContent = '✕';
        delBtn.title = 'Eliminar audio';
        delBtn.addEventListener('pointerdown', e => { e.stopPropagation(); removeAudioTrack(track.id); });
        block.appendChild(delBtn);

        block.addEventListener('pointerdown', e => onTlBlockDown(e, { type: 'audio', id: track.id }));
        if (sel) {
            const ti = document.createElement('div');
            ti.className = 'trim-handle trim-in';
            ti.addEventListener('pointerdown', e => startTrimDrag(e, { kind: 'audio', id: track.id }, 'in'));
            const to = document.createElement('div');
            to.className = 'trim-handle trim-out';
            to.addEventListener('pointerdown', e => startTrimDrag(e, { kind: 'audio', id: track.id }, 'out'));
            block.append(ti, to);
        }
        trackAudioEl.appendChild(block);
        drawWaveBlock(wave, track);
        ensureAudioPeaks(track);
    });
    renderFxTrack();
    renderAudioMixer();
}

function drawWaveBlock(canvas, track) {
    const peaks = track._peaks;
    if (!peaks) return;
    const wCss = parseFloat(canvas.parentElement.style.width) || 60;
    const w = Math.min(Math.max(10, Math.round(wCss)), 2000);
    canvas.width = w;
    canvas.height = 28;
    const c = canvas.getContext('2d');
    c.clearRect(0, 0, w, 28);
    c.fillStyle = '#8acaff';
    const n = peaks.length;
    for (let x = 0; x < w; x++) {
        const p = peaks[Math.floor((x / w) * n)] || 0;
        const h = Math.max(1, p * 24);
        c.fillRect(x, 14 - h / 2, 1, h);
    }
}

async function ensureAudioPeaks(track) {
    if (track._peaks || track._peaksLoading) return;
    track._peaksLoading = true;
    try {
        let buf;
        if (track.file) buf = await track.file.arrayBuffer();
        else if (track.url) buf = await fetch(track.url).then(r => r.arrayBuffer());
        else return;
        const actx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuf = await actx.decodeAudioData(buf);
        const data = audioBuf.getChannelData(0);
        const N = 250, step = Math.floor(data.length / N) || 1;
        const peaks = [];
        for (let i = 0; i < N; i++) {
            let max = 0;
            const off = i * step;
            for (let j = 0; j < step; j += 16) {
                const v = Math.abs(data[off + j] || 0);
                if (v > max) max = v;
            }
            peaks.push(max);
        }
        const norm = Math.max(...peaks, 0.01);
        track._peaks = peaks.map(p => p / norm);
        try { actx.close(); } catch (err) {}
        renderAudioTracks();
    } catch (err) {
        // sin forma de onda: el bloque queda sólido
    } finally {
        track._peaksLoading = false;
    }
}

// ─── Audio playback sync ───
function syncAudioPlayback(elapsed) {
    state.audioTracks.forEach(track => {
        if (!track.audioEl) return;
        const localTime = elapsed - track.timelineStart;
        if (localTime < 0) {
            if (!track.audioEl.paused) track.audioEl.pause();
            return;
        }
        const trimDur = track.trimEnd - track.trimStart;
        const trackLocalPos = track.trimStart + localTime;
        if (trackLocalPos >= track.trimEnd || localTime >= trimDur) {
            if (!track.audioEl.paused) track.audioEl.pause();
            return;
        }
        // Need to play
        if (track.audioEl.paused && isPlaying && !isExporting) {
            if (Math.abs(track.audioEl.currentTime - trackLocalPos) > 0.3) {
                try { track.audioEl.currentTime = trackLocalPos; } catch(e) {}
            }
            track.audioEl.muted = false;
            track.audioEl.volume = track.volume ?? 1.0;
            track.audioEl.play().catch(() => {});
        }
        // Keep in sync
        if (Math.abs(track.audioEl.currentTime - trackLocalPos) > 0.5) {
            try { track.audioEl.currentTime = trackLocalPos; } catch(e) {}
        }
    });
}

// ─── Mezclador de audio: lista todos los audios con volumen ───
function renderAudioMixer() {
    const container = document.getElementById('audioMixerList');
    if (!container) return;
    let html = '';
    const items = [];

    // Pistas de audio (música, sound effects importados)
    state.audioTracks.forEach(track => {
        items.push({ id: track.id, kind: 'track', name: track.name || 'audio', volume: track.volume ?? 1.0, duration: track.duration, color: '#5a9ada' });
    });
    // Voz en off por clip
    state.clips.forEach((clip, i) => {
        if (clip.vo && clip.vo.fileName && clip.vo.enabled !== false) {
            items.push({ id: clip.id, kind: 'vo', name: '🎙️ Voz clip ' + (i + 1), volume: 1.0, color: '#9a7ad8' });
        }
    });
    // Voz del outro
    if (state.outro.voiceFileName) {
        items.push({ id: 'outro', kind: 'outro', name: '🔔 Voz outro', volume: 1.0, color: '#caa84a' });
    }
    // Audios de intro
    if (state.intro.audioUrl) {
        items.push({ id: 'intro', kind: 'intro', name: '🎬 Voz intro', volume: 1.0, color: '#4aca8a' });
    }
    // Beep de censura
    if (state.censor && state.censor.bleepFileName) {
        items.push({ id: 'bleep', kind: 'bleep', name: '🤬 Beep censura', volume: state.censor.bleepVolume ?? 0.9, color: '#ff9a6a' });
    }

    if (items.length === 0) {
        container.innerHTML = '<p class="hint" style="margin:0;color:#6a6a8a">No hay audios en el proyecto todavía.</p>';
        return;
    }

    items.forEach(item => {
        const volPct = Math.round(item.volume * 100);
        html += '<div class="mixer-item">' +
            '<div class="mixer-item-header">' +
                '<span class="mixer-name" style="color:' + item.color + '">' + escapeHtml(item.name) + '</span>' +
                (item.kind === 'track' ? '<button class="caption-del" title="Eliminar" onclick="removeAudioTrack(\'' + item.id + '\')">✕</button>' : '') +
            '</div>' +
            '<div class="mixer-volume-row">' +
                '<label>🔊</label>' +
                '<input type="range" min="0" max="100" value="' + volPct + '" oninput="updateMixerVolume(\'' + item.kind + '\',\'' + item.id + '\', this.value)" onclick="event.stopPropagation()">' +
                '<span class="range-value" id="mixVol_' + item.kind + '_' + item.id + '">' + volPct + '%</span>' +
            '</div>' +
        '</div>';
    });
    container.innerHTML = html;
}

function updateMixerVolume(kind, id, val) {
    const vol = Math.max(0, Math.min(1, parseInt(val) / 100));
    const span = document.getElementById('mixVol_' + kind + '_' + id);
    if (span) span.textContent = val + '%';

    if (kind === 'track') {
        const track = state.audioTracks.find(t => t.id === id);
        if (track) {
            track.volume = vol;
            if (track.audioEl) track.audioEl.volume = vol;
        }
    } else if (kind === 'vo') {
        const clip = state.clips.find(c => c.id === id);
        if (clip && clip.vo && clip.vo.audioEl) clip.vo.audioEl.volume = vol;
    } else if (kind === 'outro') {
        if (outroVoiceEl) outroVoiceEl.volume = vol;
    } else if (kind === 'intro') {
        if (introAudioEl) introAudioEl.volume = vol;
    } else if (kind === 'bleep') {
        state.censor.bleepVolume = vol;
        if (bleepEl) bleepEl.volume = vol;
        const volSlider = document.getElementById('censorBleepVol');
        if (volSlider) volSlider.value = Math.round(vol * 100);
        const volVal = document.getElementById('censorBleepVolVal');
        if (volVal) volVal.textContent = Math.round(vol * 100) + '%';
    }
    scheduleAutoSave();
}

function pauseAllAudioTracks() {
    state.audioTracks.forEach(t => { if (t.audioEl) { t.audioEl.pause(); t.audioEl.muted = true; } });
}

function toggleSection(h) { h.classList.toggle('collapsed'); h.nextElementSibling.classList.toggle('hidden'); }

// ─── Pestañas de edición (rail izquierdo) ───
function switchTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
    document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    try { localStorage.setItem('vre_active_tab', name); } catch (e) { /* almacenamiento no disponible */ }
}

// Restaura la última pestaña usada (o Media por defecto)
function restoreTab() {
    let name = null;
    try { name = localStorage.getItem('vre_active_tab'); } catch (e) { /* ignorar */ }
    const valid = document.querySelector('.tab-panel[data-tab="' + name + '"]');
    switchTab(valid ? name : 'media');
}

// ─── Rail auto-ocultable ───
// Al apartar el cursor del costado izquierdo, el rail se oculta y su ancho
// pasa al panel de la categoría activa. Reaparece al acercar el cursor al
// borde izquierdo de la ventana.
const RAIL_REVEAL_EDGE = 20;   // px de proximidad al borde para revelarlo
const RAIL_HIDE_DELAY = 250;   // ms de gracia antes de ocultarlo
const appMainEl = document.querySelector('.app-main');
const editorRailEl = document.getElementById('editorRail');
let railHideTimer = null;

function setRailVisible(visible) {
    if (appMainEl) appMainEl.classList.toggle('rail-collapsed', !visible);
}
function scheduleRailHide() {
    if (appMainEl && appMainEl.classList.contains('rail-collapsed')) return; // ya oculto
    clearTimeout(railHideTimer);
    railHideTimer = setTimeout(() => setRailVisible(false), RAIL_HIDE_DELAY);
}
document.addEventListener('mousemove', (e) => {
    if (!appMainEl || !editorRailEl) return;
    if (e.clientX <= RAIL_REVEAL_EDGE) {
        // Cursor en el borde izquierdo: revelar y mantener
        clearTimeout(railHideTimer);
        setRailVisible(true);
    } else if (e.clientX > editorRailEl.offsetWidth + 6) {
        // Cursor fuera del rail (panel o preview): ocultar con retardo
        scheduleRailHide();
    }
    // Entre el borde y el final del rail (cursor sobre el rail): no hacer nada
}, { passive: true });

function syncUIFromState() {
    migrateTitleState();
    document.getElementById('titleFont').value = state.title.font;
    renderTitleLineInputs();
    document.getElementById('titleTextColor').value = state.title.textColor;
    document.getElementById('titleFontSize').value = state.title.fontSize;
    document.getElementById('titleFontSizeVal').textContent = state.title.fontSize;

    document.getElementById('numFont').value = state.numbers.font;
    document.getElementById('numFontSize').value = state.numbers.fontSize;
    document.getElementById('numFontSizeVal').textContent = state.numbers.fontSize;
    document.getElementById('numShowCircle').checked = state.numbers.showCircle !== false;
    document.getElementById('numColor').value = state.numbers.color || '#FFD700';
    document.getElementById('numShowOutline').checked = state.numbers.showOutline === true;
    document.getElementById('numOutlineIntensity').value = state.numbers.outlineIntensity ?? 50;
    document.getElementById('numOutlineIntensityVal').textContent = state.numbers.outlineIntensity ?? 50;
    document.getElementById('numTextSize').value = state.numbers.textSize ?? 22;
    document.getElementById('numTextSizeVal').textContent = state.numbers.textSize ?? 22;
    document.getElementById('numTextFont').value = state.numbers.textFont || "'Segoe UI', Arial, sans-serif";
    document.getElementById('numShowTextOutline').checked = state.numbers.showTextOutline === true;
    document.getElementById('numTextOutlineIntensity').value = state.numbers.textOutlineIntensity ?? 50;
    document.getElementById('numTextOutlineIntensityVal').textContent = state.numbers.textOutlineIntensity ?? 50;

    if (document.getElementById('shortsOverlayEnabled')) {
        document.getElementById('shortsOverlayEnabled').checked = !!(state.shortsOverlay && state.shortsOverlay.enabled);
        document.getElementById('shortsOverlayOpacity').value = Math.round((state.shortsOverlay?.opacity ?? 0.5) * 100);
        document.getElementById('shortsOverlayOpacityVal').textContent = Math.round((state.shortsOverlay?.opacity ?? 0.5) * 100) + '%';
        const hideBtn = document.getElementById('shortsOverlayHideBtn');
        if (hideBtn) hideBtn.textContent = (state.shortsOverlay && state.shortsOverlay.visible) ? 'Ocultar' : 'Mostrar';
    }

    document.getElementById('barTopColor').value = state.barTop.color;
    document.getElementById('barTopHeight').value = state.barTop.height;
    document.getElementById('barBottomColor').value = state.barBottom.color;
    document.getElementById('barBottomHeight').value = state.barBottom.height;
    document.getElementById('barTopStyle').value = state.barTop.style || 'solid';
    document.getElementById('barTopBlur').value = state.barTop.blur ?? 20;
    document.getElementById('barTopBlurVal').textContent = state.barTop.blur ?? 20;
    document.getElementById('barTopOverlay').value = state.barTop.overlay ?? 40;
    document.getElementById('barTopOverlayVal').textContent = (state.barTop.overlay ?? 40) + '%';
    document.getElementById('barBottomStyle').value = state.barBottom.style || 'solid';
    document.getElementById('barBottomBlur').value = state.barBottom.blur ?? 20;
    document.getElementById('barBottomBlurVal').textContent = state.barBottom.blur ?? 20;
    document.getElementById('barBottomOverlay').value = state.barBottom.overlay ?? 40;
    document.getElementById('barBottomOverlayVal').textContent = (state.barBottom.overlay ?? 40) + '%';

    // Censura de malas palabras
    document.getElementById('censorEnabled').checked = state.censor.enabled === true;
    document.getElementById('censorBleepVol').value = Math.round((state.censor.bleepVolume ?? 0.9) * 100);
    document.getElementById('censorBleepVolVal').textContent = Math.round((state.censor.bleepVolume ?? 0.9) * 100) + '%';
    document.getElementById('censorWords').value = (state.censor.words || []).join(', ');
    const censorNameEl = document.getElementById('censorBleepName');
    if (censorNameEl) censorNameEl.textContent = state.censor.bleepFileName ? '🎵 ' + state.censor.bleepFileName : '';
    const censorRmEl = document.getElementById('censorBleepRemove');
    if (censorRmEl) censorRmEl.style.display = state.censor.bleepFileName ? '' : 'none';

    renderBlurBarsList();

    document.getElementById('capColor').value = state.captionStyle.color;
    document.getElementById('capBgColor').value = state.captionStyle.bgColor;
    document.getElementById('capBgOpacity').value = Math.round(state.captionStyle.bgOpacity * 100);
    document.getElementById('capBgOpacityVal').textContent = Math.round(state.captionStyle.bgOpacity * 100) + '%';
    document.getElementById('capFontSize').value = state.captionStyle.fontSize;
    document.getElementById('capFontSizeVal').textContent = state.captionStyle.fontSize;

    syncIntroUI();
    syncStyleEngineUI();
    renderAudioTracks();
    renderClipsList();
    updateTimeDisplay();
}

// Init defaults and load saved project
try { restoreTab(); } catch(e) { console.error('restoreTab', e); }
// Por defecto, exportar en MP4 (WebCodecs, máxima calidad) si el navegador lo soporta
try { if (webCodecsSupported()) document.getElementById('exportFormat').value = 'mp4'; } catch(e) { /* ignorar */ }
try { migrateTitleState(); renderTitleLineInputs(); } catch(e) { console.error('initTitleLines', e); }
try { updateTitle(); } catch(e) { console.error('updateTitle', e); }
try { updateNumbers(); } catch(e) { console.error('updateNumbers', e); }
try { updateBars(); } catch(e) { console.error('updateBars', e); }
try { updateCaptionStyle(); } catch(e) { console.error('updateCaptionStyle', e); }
try { updateIntro(); } catch(e) { console.error('updateIntro', e); }
try { updateSoundDesign(); } catch(e) { console.error('updateSoundDesign', e); }
try { updateCensor(); } catch(e) { console.error('updateCensor', e); }
try { updateScreenTexts(); } catch(e) { console.error('updateScreenTexts', e); }
try { updateOutro(); } catch(e) { console.error('updateOutro', e); }
// Retrasar el render del timeline para que el layout flex esté calculado
requestAnimationFrame(() => { try { refreshTL(); } catch(e) { console.error('refreshTL', e); } });
setTimeout(() => { try { refreshTL(); } catch(e) { console.error('refreshTL2', e); } }, 200);
if (tlScroll) tlScroll.addEventListener('scroll', drawRuler);
window.addEventListener('resize', () => { syncTlWidths(); renderTimelineClips(); renderAudioTracks(); });
// ResizeObserver para redibujar la regla cuando el contenedor cambie de tamaño
if (window.ResizeObserver && tlScroll) {
    new ResizeObserver(() => { drawRuler(); }).observe(tlScroll);
}
loadProject().then(loaded => {
    if (loaded) {
        syncUIFromState();
        drawFrame();
        console.log('Proyecto cargado desde almacenamiento local');
    }
    renderPresetsList();
    renderAudioMixer();
    // Forzar render del timeline después de cargar
    requestAnimationFrame(() => { try { refreshTL(); } catch(e) { console.error('refreshTL after load', e); } });
});
