// ═══════════════════════════════════════════════════════════
// ████  CONSTANTS & GLOBAL STATE  ████
// ═══════════════════════════════════════════════════════════
const EXPORT_W = 1080;
const EXPORT_H = 1920;
const PREVIEW_W = 405;
const PREVIEW_H = 720;
const SCALE = PREVIEW_W / EXPORT_W;
const FPS = 30;
const EXPORT_FRAME_MS = 1000 / FPS;

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

let state = {
    title: {
        line1: 'Top 5 [Mejores](#FFD700)',
        line2: 'Teléfonos [2024](#FFD700)',
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
        title1Pos: { x: 540, y: 150 },
        title2Pos: { x: 540, y: 240 },
        numberPos: { x: 82, y: 960 }
    },
    intro: {
        enabled: false,
        duration: 5,
        blurAmount: 20,
        overlayOpacity: 0.4,
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
    timelineScaleDuration: 0
};

let currentClipIndex = 0;
let isPlaying = false;
let isExporting = false;
let clipIdCounter = 0;
let audioTrackIdCounter = 0;
let blurBarIdCounter = 0;
let isInIntro = false;
let introStartTime = 0;
let introAudioEl = null;

// ─── Style engine runtime ───
let isInOutro = false;
let outroStartTime = 0;
let outroVoiceEl = null;
let sfxEls = {};              // kind -> Audio element ('bass' | 'transition' | 'sting')
const sfxKeys = { bass: 'sfx_bass', transition: 'sfx_transition', sting: 'sfx_sting' };
let freezeRuntime = {};       // freezeId -> { startedAt, done }
let sfxFired = { bassIdx: -1, transIdx: -1, stingIdx: -1 };
// Plantilla de posiciones individuales de los números (índice -> {x,y} o null)
// Se guarda en el proyecto y en los presets para que los clips nuevos hereden
// una posición óptima en lugar del centro.
let numberPosTemplate = [];

// Bounding boxes for canvas hit-testing
let title1BBox = null;
let title2BBox = null;
let numberBBox = null;
let numberBBoxes = []; // individual number hit boxes
let introCaptionBBox = null;
let blurBarBBoxes = []; // individual blur bar hit boxes
let headlineBBox = null;
let endQuestionBBox = null;
let outroCaptionBBox = null;
let voCaptionBBox = null;
let freezeTextBBoxes = [];

let dragging = null; // 'title1' | 'title2' | 'number' | 'video' | 'introCaption' | 'blurBar' | 'freezeText_N' | 'headline' | 'endQuestion' | 'outroCaption' | null
let dragOffset = { x: 0, y: 0 };
let dragStartPan = { x: 0, y: 0 };

// Canvas references
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const clipsList = document.getElementById('clipsList');
const videoContainer = document.getElementById('videoContainer');

// Timeline references
const timelineTrack = document.getElementById('timelineTrack');
const timelineClips = document.getElementById('timelineClips');
const timelineProgress = document.getElementById('timelineProgress');
const timelineHandle = document.getElementById('timelineHandle');
let isDraggingTimeline = false;
let activeTrimDrag = null;
let isDraggingPlayback = false;

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
                rankingPosition: c.rankingPosition,
                numberPos: c.numberPos,
                timelineStart: c.timelineStart,
                panX: c.panX,
                panY: c.panY,
                volume: c.volume,
                blurBars: c.blurBars || [],
                freezes: c.freezes || [],
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
        if (saved.intro) {
            state.intro.enabled = saved.intro.enabled ?? false;
            state.intro.duration = saved.intro.duration ?? 5;
            state.intro.blurAmount = saved.intro.blurAmount ?? 20;
            state.intro.overlayOpacity = saved.intro.overlayOpacity ?? 0.4;
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
        freezeIdCounter = saved.freezeIdCounter || 0;
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
                numberText: savedClip.numberText || '',
                numberColor: savedClip.numberColor || '#FFD700',
                rankingPosition: savedClip.rankingPosition || '',
                numberPos: savedClip.numberPos || null,
                timelineStart: Number.isFinite(savedClip.timelineStart) ? savedClip.timelineStart : null,
                panX: savedClip.panX || 0,
                panY: savedClip.panY || 0,
                volume: savedClip.volume ?? 1.0,
                blurBars: savedClip.blurBars || [],
                freezes: savedClip.freezes || [],
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
                        clip.duration = video.duration;
                        if (clip.trimEnd === 0) clip.trimEnd = Math.round(video.duration * 100) / 100;
                        renderClipsList();
                        drawFrame();
                    });
                }
            }
            state.clips.push(clip);
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
// A seeking element still reports readyState 2 while holding the frame from *before*
// the seek, so drawing it during a clip change shows the wrong content.
function isClipDrawable(clip) {
    return !!(clip && clip.videoEl && clip.videoEl.readyState >= 2
              && !clip.videoEl.seeking && clip.videoEl.videoWidth > 0);
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

    c.drawImage(video, x, y, sw, sh);
    c.restore();
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
            cy: cy
        });
    }
    c.restore();

    // Global bbox for moving all numbers together
    const pad = 12;
    return { x: baseCx - circleR - pad, y: startY - circleR - pad, w: circleR*2 + pad*2, h: totalH + pad*2 };
}

function drawCaptions(c, s) {
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
    let yBottom = cH - barBottomH - 30 * s;

    // Draw from bottom to up
    for (let i = active.length - 1; i >= 0; i--) {
        const text = active[i].text;
        const textW = c.measureText(text).width;
        const boxW = textW + padding * 2;
        const boxH = lineH + padding;
        const boxX = (cW - boxW) / 2;
        const boxY = yBottom - boxH;

        c.fillStyle = hexToRgba(cs.bgColor, cs.bgOpacity);
        c.beginPath();
        c.roundRect(boxX, boxY, boxW, boxH, 8 * s);
        c.fill();

        c.fillStyle = cs.color;
        c.shadowColor = 'rgba(0,0,0,0.8)';
        c.shadowBlur = 4 * s;
        c.fillText(text, cW / 2, boxY + padding / 2);

        yBottom = boxY - 8 * s;
    }
    c.restore();
}

function drawIntroFrame(c, s) {
    const intro = state.intro;
    const cW = c.canvas.width;
    const cH = c.canvas.height;

    // Black background
    c.fillStyle = '#000';
    c.fillRect(0, 0, cW, cH);

    // Blurred video frame as background
    const bgClip = state.clips.find(cl => cl.videoEl && cl.videoEl.readyState >= 2);
    if (bgClip) drawBlurredCover(c, bgClip, intro.blurAmount * s, s);

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
    drawBlurredCover(c, bgClip, Math.max(1, (o.bgBlur ?? 20) * s), s);
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


const BLUR_DOWNSCALE = 4;
let blurScratch = null, blurScratchCtx = null;
let coverScratch = null, coverScratchCtx = null;

// Full-canvas blurred video backdrop, used by the intro and the outro. Rasterizing at
// 1/BLUR_DOWNSCALE and blurring the small copy costs a fraction of running the filter
// over a full 1080x1920 video draw, which both were doing on every frame.
function drawBlurredCover(c, clip, blurPx, s) {
    if (!clip || !clip.videoEl || clip.videoEl.readyState < 2) return;
    const cW = c.canvas.width;
    const cH = c.canvas.height;
    const sw = Math.max(1, Math.round(cW / BLUR_DOWNSCALE));
    const sh = Math.max(1, Math.round(cH / BLUR_DOWNSCALE));
    if (!coverScratch) {
        coverScratch = document.createElement('canvas');
        coverScratchCtx = coverScratch.getContext('2d', { alpha: false });
    }
    if (coverScratch.width !== sw || coverScratch.height !== sh) {
        coverScratch.width = sw;
        coverScratch.height = sh;
    }
    coverScratchCtx.fillStyle = '#000';
    coverScratchCtx.fillRect(0, 0, sw, sh);
    drawVideoCover(coverScratchCtx, clip, 0, 0, sw, sh, s / BLUR_DOWNSCALE);

    // Overdraw by the blur radius so the filter samples real pixels at the borders
    // instead of fading them out into a dark vignette.
    const radius = Math.max(1, blurPx);
    const pad = Math.ceil(radius);
    c.save();
    c.filter = `blur(${radius}px)`;
    c.drawImage(coverScratch, 0, 0, sw, sh, -pad, -pad, cW + pad * 2, cH + pad * 2);
    c.filter = 'none';
    c.restore();
}

function drawBlurBars(c, s) {
    blurBarBBoxes = [];
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.videoEl || clip.videoEl.readyState < 2) return;
    // Mid-transition the video layer is still holding the outgoing clip, so bars taken
    // from the incoming one would blur content that is not on screen.
    if (isPlaying && !isClipDrawable(clip)) return;
    const bars = clip.blurBars;
    if (!bars || bars.length === 0) return;

    const cW = c.canvas.width;
    const cH = c.canvas.height;

    // The frame is rasterized once into a downscaled scratch canvas and each bar is
    // blitted out of it. The old code re-drew the full-size video through a blur filter
    // once per bar, which at 1080x1920 costs tens of ms each and was the main reason
    // clips with blur bars dropped frames while exporting.
    const sw = Math.max(1, Math.round(cW / BLUR_DOWNSCALE));
    const sh = Math.max(1, Math.round(cH / BLUR_DOWNSCALE));
    if (!blurScratch) {
        blurScratch = document.createElement('canvas');
        blurScratchCtx = blurScratch.getContext('2d', { alpha: false });
    }
    if (blurScratch.width !== sw || blurScratch.height !== sh) {
        blurScratch.width = sw;
        blurScratch.height = sh;
    }
    blurScratchCtx.fillStyle = '#000';
    blurScratchCtx.fillRect(0, 0, sw, sh);
    drawVideoCover(blurScratchCtx, clip, 0, 0, sw, sh, s / BLUR_DOWNSCALE);

    for (const bar of bars) {
        const bx = bar.x * s;
        const by = bar.y * s;
        const bw = Math.max(1, bar.w * s);
        const bh = Math.max(1, bar.h * s);
        const radius = Math.max(1, bar.blur) * s;

        // Sample past the bar edges so the blur pulls in real pixels instead of fading
        // the border out to transparent.
        const pad = Math.ceil(radius);
        const sx = Math.max(0, Math.floor((bx - pad) / BLUR_DOWNSCALE));
        const sy = Math.max(0, Math.floor((by - pad) / BLUR_DOWNSCALE));
        const sx2 = Math.min(sw, Math.ceil((bx + bw + pad) / BLUR_DOWNSCALE));
        const sy2 = Math.min(sh, Math.ceil((by + bh + pad) / BLUR_DOWNSCALE));

        if (sx2 > sx && sy2 > sy) {
            c.save();
            c.beginPath();
            c.rect(bx, by, bw, bh);
            c.clip();
            c.filter = `blur(${radius}px)`;
            c.drawImage(blurScratch, sx, sy, sx2 - sx, sy2 - sy,
                        sx * BLUR_DOWNSCALE, sy * BLUR_DOWNSCALE,
                        (sx2 - sx) * BLUR_DOWNSCALE, (sy2 - sy) * BLUR_DOWNSCALE);
            c.filter = 'none';
            c.restore();
        }

        blurBarBBoxes.push({ id: bar.id, x: bx, y: by, w: bw, h: bh });
    }
}

function drawFrame() {
    if (isInIntro) {
        drawIntroFrame(ctx, SCALE);
        return;
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

    const clip = state.clips[currentClipIndex];
    // Only fall back to the outgoing clip during a real transition. While scrubbing, the
    // current clip seeks constantly and swapping in a different clip would flicker.
    const videoSrc = (isClipDrawable(clip) || !isPlaying) ? clip : state.clips[currentClipIndex - 1];
    if (videoSrc) drawVideoCover(ctx, videoSrc, 0, 0, PREVIEW_W, PREVIEW_H, SCALE);

    drawBlurBars(ctx, SCALE);
    drawBarsAndPercentage(ctx, SCALE);

    // Save bboxes only during preview
    title1BBox = drawTitleLine(ctx, state.title.line1, state.layout.title1Pos, state.title.font, state.title.fontSize * SCALE, state.title.textColor, SCALE);
    title2BBox = drawTitleLine(ctx, state.title.line2, state.layout.title2Pos, state.title.font, state.title.fontSize * SCALE, state.title.textColor, SCALE);
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

    // Outro: solo se dibuja cuando el cabezal está en su tramo final
    const outroStartAt = getIntroOffset() + getClipsEnd();
    if (state.outro.enabled && !isPlaying && !isExporting && getElapsedTime() >= outroStartAt - 0.05) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
        drawOutroBackground(ctx, SCALE);
        drawOutroContent(ctx, SCALE);
    }

    // Drag outlines
    if (dragging) {
        ctx.save();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(90,90,255,0.8)'; ctx.lineWidth = 2;
        const drawOutline = (bbox) => { if(bbox) ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h); };
        if (dragging === 'title1') drawOutline(title1BBox);
        if (dragging === 'title2') drawOutline(title2BBox);
        if (dragging === 'number') drawOutline(numberBBox);
        if (dragging === 'introCaption') drawOutline(introCaptionBBox);
        if (dragging === 'headline') drawOutline(headlineBBox);
        if (dragging === 'endQuestion') drawOutline(endQuestionBBox);
        if (dragging === 'outroCaption') drawOutline(outroCaptionBBox);
        if (dragging === 'voCaption') drawOutline(voCaptionBBox);
        if (dragging.startsWith('freezeText_')) {
            const idx = parseInt(dragging.split('_')[1]);
            const fb = freezeTextBBoxes.find(b => b.index === idx);
            drawOutline(fb);
        }
        if (dragging === 'blurBar') blurBarBBoxes.forEach(b => drawOutline(b));
        ctx.restore();
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
    // Check individual numbers from last to first (top-most first visually)
    for (let i = numberBBoxes.length - 1; i >= 0; i--) {
        const b = numberBBoxes[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            return b.index;
        }
    }
    return -1;
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

canvas.addEventListener('mousedown', (e) => {
    if (isPlaying || isExporting) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

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
    } else if (hitTestFreezeText(mx, my) !== null) {
        const fb = hitTestFreezeText(mx, my);
        dragging = 'freezeText_' + fb.index;
        dragOffset = { x: mx - fb.x, y: my - fb.y };
    } else if (hitTestBlurBar(mx, my) !== -1) {
        const barId = hitTestBlurBar(mx, my);
        const clip = state.clips[currentClipIndex];
        const bar = clip && clip.blurBars ? clip.blurBars.find(b => b.id === barId) : null;
        if (bar) {
            dragging = 'blurBar';
            dragOffset = { x: mx - bar.x * SCALE, y: my - bar.y * SCALE, id: barId };
        }
    } else if (hitTest(mx, my, title1BBox)) {
        dragging = 'title1';
        dragOffset = { x: mx - state.layout.title1Pos.x * SCALE, y: my - state.layout.title1Pos.y * SCALE };
    } else if (hitTest(mx, my, title2BBox)) {
        dragging = 'title2';
        dragOffset = { x: mx - state.layout.title2Pos.x * SCALE, y: my - state.layout.title2Pos.y * SCALE };
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
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragging) {
        if (dragging === 'introCaption') {
            state.intro.captionPos = {
                x: Math.max(0, Math.min(1, (mx - dragOffset.x) / PREVIEW_W)),
                y: Math.max(0, Math.min(1, (my - dragOffset.y) / PREVIEW_H))
            };
        } else if (dragging === 'headline') {
            state.screenTexts.headline.pos = {
                x: Math.max(0, Math.min(1, (mx - dragOffset.x) / PREVIEW_W)),
                y: Math.max(0, Math.min(1, (my - dragOffset.y) / PREVIEW_H))
            };
        } else if (dragging === 'endQuestion') {
            state.screenTexts.endQuestion.pos = {
                x: Math.max(0, Math.min(1, (mx - dragOffset.x) / PREVIEW_W)),
                y: Math.max(0, Math.min(1, (my - dragOffset.y) / PREVIEW_H))
            };
        } else if (dragging === 'outroCaption') {
            state.outro.captionPos = {
                x: Math.max(0, Math.min(1, (mx - dragOffset.x) / PREVIEW_W)),
                y: Math.max(0, Math.min(1, (my - dragOffset.y) / PREVIEW_H))
            };
        } else if (dragging === 'voCaption') {
            const clip = state.clips[currentClipIndex];
            if (clip && clip.vo) {
                ensureVo(clip).capPos = {
                    x: Math.max(0, Math.min(1, (mx - dragOffset.x) / PREVIEW_W)),
                    y: Math.max(0, Math.min(1, (my - dragOffset.y) / PREVIEW_H))
                };
            }
        } else if (dragging.startsWith('freezeText_')) {
            const idx = parseInt(dragging.split('_')[1]);
            const clip = state.clips[currentClipIndex];
            const ff = clip && clip.freezes ? clip.freezes[idx] : null;
            if (ff) {
                ff.posX = Math.max(0, Math.min(1, (mx - dragOffset.x) / PREVIEW_W));
                ff.posY = Math.max(0, Math.min(1, (my - dragOffset.y) / PREVIEW_H));
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
            clip.numberPos = {
                x: (mx - dragOffset.x) / SCALE,
                y: (my - dragOffset.y) / SCALE
            };
            numberPosTemplate[idx] = { ...clip.numberPos };
        } else {
            const newX = (mx - dragOffset.x) / SCALE;
            const newY = (my - dragOffset.y) / SCALE;
            if (dragging === 'title1') state.layout.title1Pos = { x: newX, y: newY };
            if (dragging === 'title2') state.layout.title2Pos = { x: newX, y: newY };
            if (dragging === 'number') state.layout.numberPos = { x: newX, y: newY };
        }
    } else {
        if (hitTest(mx, my, introCaptionBBox) || hitTest(mx, my, title1BBox) || hitTest(mx, my, title2BBox) || hitTestNumber(mx, my) !== -1 || hitTest(mx, my, numberBBox) || hitTestBlurBar(mx, my) !== -1) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
    }
});

canvas.addEventListener('mouseup', () => {
    if (dragging) scheduleAutoSave();
    dragging = null;
    canvas.style.cursor = 'default';
});
canvas.addEventListener('mouseleave', () => {
    if (dragging) scheduleAutoSave();
    dragging = null;
    canvas.style.cursor = 'default';
});

// ═══════════════════════════════════════════════════════════
// ████  PLAYBACK & LOOP  ████
// ═══════════════════════════════════════════════════════════
let exportFrameClock = 0;

function renderLoop(now) {
    if (isExporting && exportCtx) {
        // The export overlay covers the preview canvas, so drawing it here would double
        // the per-frame cost for something nobody sees. Export drawing is paced to FPS:
        // rAF fires at the display refresh rate, so on a 60/120Hz screen the old loop
        // rendered 2-4 full 1080x1920 frames for every frame actually captured.
        if (now - exportFrameClock >= EXPORT_FRAME_MS) {
            exportFrameClock = Math.max(now - EXPORT_FRAME_MS, exportFrameClock + EXPORT_FRAME_MS);
            drawExportFrame();
            if (exportFrameTrack) exportFrameTrack.requestFrame();
        }
    } else {
        drawFrame();
        if (isPlaying) updatePlaybackState();
        if (!isDraggingTimeline) updateTimelineUI();
    }
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
    document.getElementById('timeDisplay').textContent = formatTime(getElapsedTime()) + ' / ' + formatTime(getTotalDuration());
}

// ─── TIMELINE ───
function updateTimelineUI() {
    const total = getTimelineScaleDuration();
    const pct = total > 0 ? (getElapsedTime() / total) * 100 : 0;
    timelineProgress.style.width = pct + '%';
    timelineHandle.style.left = pct + '%';
}

function renderTimelineClips() {
    if (!timelineClips) return;
    const total = getTimelineScaleDuration();
    timelineClips.innerHTML = '';
    if (total <= 0) return;

    // Intro segment
    const introOffset = getIntroOffset();
    if (introOffset > 0) {
        const seg = document.createElement('div');
        seg.className = 'timeline-clip timeline-intro';
        seg.style.left = '0%';
        seg.style.width = Math.max(introOffset / total * 100, 0.8) + '%';
        seg.title = 'Introducción · ' + formatTime(introOffset);
        const lbl = document.createElement('span');
        lbl.className = 'timeline-clip-label';
        lbl.textContent = '🎬 Intro · ' + formatTime(introOffset);
        seg.append(lbl);
        seg.addEventListener('pointerdown', e => {
            e.stopPropagation();
            seekToTime(0);
        });
        timelineClips.appendChild(seg);
    }

    state.clips.forEach((clip, index) => {
        const start = Number.isFinite(clip.timelineStart) ? clip.timelineStart : 0;
        const duration = getClipTrimDuration(clip);
        const segment = document.createElement('div');
        segment.className = 'timeline-clip' + (index === currentClipIndex ? ' selected' : '');
        segment.dataset.clipId = clip.id;
        segment.style.left = ((introOffset + start) / total * 100) + '%';
        segment.style.width = Math.max(duration / total * 100, 0.8) + '%';
        segment.title = 'Clip ' + (index + 1) + ' · ' + formatTime(duration);
        segment.addEventListener('pointerdown', e => {
            if (e.target.closest('.trim-handle')) return;
            e.stopPropagation();
            selectClip(index);
            seekToTime(introOffset + start);
        });

        const label = document.createElement('span');
        label.className = 'timeline-clip-label';
        label.textContent = 'Clip ' + (index + 1) + ' · ' + formatTime(duration);

        const trimIn = document.createElement('div');
        trimIn.className = 'trim-handle trim-in';
        trimIn.title = 'Trim In: ' + formatTime(clip.trimStart);
        trimIn.addEventListener('pointerdown', e => startTrimDrag(e, clip.id, 'in'));

        const trimOut = document.createElement('div');
        trimOut.className = 'trim-handle trim-out';
        trimOut.title = 'Trim Out: ' + formatTime(clip.trimEnd);
        trimOut.addEventListener('pointerdown', e => startTrimDrag(e, clip.id, 'out'));

        segment.append(label);
        if (index === currentClipIndex) segment.append(trimIn, trimOut);
        timelineClips.appendChild(segment);
    });

    // Outro segment
    const outroDur = getOutroOffset();
    if (outroDur > 0) {
        const seg = document.createElement('div');
        seg.className = 'timeline-clip timeline-intro';
        const startPct = (getIntroOffset() + getClipsEnd()) / total * 100;
        seg.style.left = startPct + '%';
        seg.style.width = Math.max(outroDur / total * 100, 0.8) + '%';
        seg.title = 'Outro · ' + formatTime(outroDur);
        const lbl = document.createElement('span');
        lbl.className = 'timeline-clip-label';
        lbl.textContent = '🔔 Outro · ' + formatTime(outroDur);
        seg.append(lbl);
        seg.addEventListener('pointerdown', e => {
            e.stopPropagation();
            seekToTime(getIntroOffset() + getClipsEnd());
        });
        timelineClips.appendChild(seg);
    }
}

function updateTrimPreview(clip) {
    if (!clip.videoEl) return;
    clip.videoEl.currentTime = clip.trimStart;
    drawFrame();
    updateTimeDisplay();
    updateTimelineUI();
}

function startTrimDrag(event, clipId, edge) {
    if (isPlaying || isExporting) return;
    const clip = state.clips.find(c => c.id === clipId);
    if (!clip) return;
    event.preventDefault();
    event.stopPropagation();
    currentClipIndex = state.clips.indexOf(clip);
    const rect = timelineTrack.getBoundingClientRect();
    activeTrimDrag = {
        clipId,
        edge,
        pointerId: event.pointerId,
        startX: event.clientX,
        startTimelineStart: clip.timelineStart || 0,
        startTrimStart: clip.trimStart,
        startTrimEnd: clip.trimEnd,
        pixelsPerSecond: rect.width / Math.max(getTimelineScaleDuration(), 0.001)
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.classList.add('trimming-clip');
}

function updateTrimDrag(event) {
    if (!activeTrimDrag || event.pointerId !== activeTrimDrag.pointerId) return;
    const drag = activeTrimDrag;
    const clip = state.clips.find(c => c.id === drag.clipId);
    if (!clip) return;
    const delta = (event.clientX - drag.startX) / drag.pixelsPerSecond;
    const minDuration = 0.5;

    if (drag.edge === 'in') {
        const nextStart = clamp(drag.startTrimStart + delta, 0, drag.startTrimEnd - minDuration);
        const appliedDelta = nextStart - drag.startTrimStart;
        clip.trimStart = nextStart;
        clip.timelineStart = Math.max(0, drag.startTimelineStart + appliedDelta);
        repackTimelineClips();
    } else {
        clip.trimEnd = clamp(drag.startTrimEnd + delta, drag.startTrimStart + minDuration, clip.duration);
        repackTimelineClips();
    }

    renderTimelineClips();
    updateTrimPreview(clip);
    updateTrimDurationLabel(clip);
}

function finishTrimDrag() {
    if (!activeTrimDrag) return;
    activeTrimDrag = null;
    document.body.classList.remove('trimming-clip');
    scheduleAutoSave();
    renderClipsList();
}

function updateTrimDurationLabel(clip) {
    const segment = timelineClips?.querySelector('[data-clip-id="' + clip.id + '"]');
    if (segment) {
        const label = segment.querySelector('.timeline-clip-label');
        if (label) label.textContent = 'Clip ' + (state.clips.indexOf(clip) + 1) + ' · ' + formatTime(getClipTrimDuration(clip));
    }
    const cardLabel = document.querySelector('[data-duration-clip="' + clip.id + '"]');
    if (cardLabel) {
        const fileName = clip.file ? clip.file.name : 'Sin video';
        cardLabel.textContent = 'Clip ' + (state.clips.indexOf(clip) + 1) + ' - ' + fileName + ' (' + formatTime(getClipTrimDuration(clip)) + ')';
    }
}

document.addEventListener('pointermove', updateTrimDrag);
document.addEventListener('pointerup', finishTrimDrag);

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
    const rect = timelineTrack.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const ratio = x / rect.width;
    return ratio * getTimelineScaleDuration();
}

function handleTimelineSeek(e) {
    if (isExporting || state.clips.length === 0) return;
    seekToTime(getTimeFromTimelineX(e.clientX));
}

timelineTrack.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.trim-handle, .timeline-handle') || isExporting || state.clips.length === 0) return;
    e.preventDefault();
    isDraggingTimeline = true;
    handleTimelineSeek(e);
});

timelineHandle.addEventListener('pointerdown', e => {
    if (isExporting || state.clips.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    isDraggingPlayback = true;
    timelineHandle.setPointerCapture?.(e.pointerId);
    handleTimelineSeek(e);
});

document.addEventListener('pointermove', (e) => {
    if (isDraggingTimeline) {
        e.preventDefault();
        handleTimelineSeek(e);
    }
    if (isDraggingPlayback) {
        e.preventDefault();
        handleTimelineSeek(e);
    }
});

document.addEventListener('pointerup', () => {
    if (isDraggingTimeline) {
        isDraggingTimeline = false;
        // If it was playing, resume from new position
        if (isPlaying) playCurrentClip();
    }
    isDraggingPlayback = false;
});

// ─── STYLE ENGINE: freezes · SFX · voz en off · outro ───
function resetStyleEngineState() {
    freezeRuntime = {};
    sfxFired = { bassIdx: -1, transIdx: -1, stingIdx: -1 };
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

function pauseAllStyleAudio() {
    state.clips.forEach(c => { if (c.vo && c.vo.audioEl && !c.vo.audioEl.paused) c.vo.audioEl.pause(); });
    Object.values(sfxEls).forEach(el => { if (el && !el.paused) el.pause(); });
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

async function playCurrentClip() {
    if (currentClipIndex >= state.clips.length) {
        if (isExporting) { isPlaying = false; exportRecorder?.stop(); }
        else stopPlayback();
        return;
    }
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.videoEl) return;

    // Wait for video to be ready (without forcing a reload)
    if (clip.videoEl.readyState < 2) {
        await new Promise((resolve) => {
            const onReady = () => { clip.videoEl.removeEventListener('canplay', onReady); resolve(); };
            clip.videoEl.addEventListener('canplay', onReady);
            setTimeout(() => { clip.videoEl.removeEventListener('canplay', onReady); resolve(); }, 5000);
        });
    }

    // Set to trim start
    if (clip.videoEl.currentTime < clip.trimStart || clip.videoEl.currentTime >= clip.trimEnd) {
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

    prerollClip(currentClipIndex + 1);
}

// Decode and seek the upcoming clip while the current one is still on screen, so the
// switch lands on a frame that is already there instead of waiting on a seek.
function prerollClip(index) {
    const clip = state.clips[index];
    if (!clip || !clip.videoEl) return;
    const v = clip.videoEl;
    if (v.readyState < 1) return;
    if (Math.abs(v.currentTime - clip.trimStart) > 0.05) {
        try { v.currentTime = clip.trimStart; } catch (e) {}
    }
}

function updatePlaybackState() {
    if (isInIntro) {
        updateTimeDisplay();
        const elapsed = getIntroElapsedTime();
        syncAudioPlayback(elapsed);
        if (elapsed >= state.intro.duration) {
            isInIntro = false;
            if (introAudioEl) { introAudioEl.pause(); introAudioEl.muted = true; }
            restoreIntroBgClip();
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
    if (clip.videoEl.ended || clip.videoEl.currentTime >= clip.trimEnd) {
        clip.videoEl.muted = true;
        clip.videoEl.pause();
        currentClipIndex++;
        if (currentClipIndex < state.clips.length) playCurrentClip();
        else if (getOutroOffset() > 0) startOutroPhase();
        else stopPlayback();
    }
}

// The intro borrows a random clip and parks it on a random frame to use as its blurred
// backdrop. playCurrentClip() only re-seeks a clip that sits outside its trim range, so
// a clip left partway through by the intro later starts from that random point and the
// export silently drops however much of it the seek skipped — a different amount each run.
let introBgClipIndex = -1;
function restoreIntroBgClip() {
    const clip = state.clips[introBgClipIndex];
    introBgClipIndex = -1;
    if (!clip || !clip.videoEl) return;
    try { clip.videoEl.currentTime = clip.trimStart; } catch (e) {}
}

function startIntro() {
    isInIntro = true;
    introStartTime = performance.now();

    // Seek a random clip to a random position for blurred background
    introBgClipIndex = -1;
    const readyIndexes = [];
    state.clips.forEach((c, i) => { if (c.videoEl && c.videoEl.readyState >= 2) readyIndexes.push(i); });
    if (readyIndexes.length > 0) {
        introBgClipIndex = readyIndexes[Math.floor(Math.random() * readyIndexes.length)];
        const randomClip = state.clips[introBgClipIndex];
        const randomTime = Math.random() * (randomClip.duration || 0);
        try { randomClip.videoEl.currentTime = randomTime; randomClip.videoEl.pause(); } catch(e) {}
    }

    // Play intro audio if available
    if (introAudioEl) {
        introAudioEl.currentTime = 0;
        introAudioEl.muted = false;
        introAudioEl.volume = 1.0;
        introAudioEl.play().catch(() => {});
    }
}

function togglePlay() {
    if (isExporting || state.clips.length === 0) return;
    if (isPlaying) {
        isPlaying = false; document.getElementById('btnPlay').textContent = '▶ Play';
        if (isInIntro) { isInIntro = false; if (introAudioEl) { introAudioEl.pause(); introAudioEl.muted = true; } restoreIntroBgClip(); }
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
let exportFrameTrack = null; // canvas track driven manually via requestFrame()
let exportWentHidden = false;
let lastProgressPct = -1;

// Chrome reports isTypeSupported('video/mp4') as false while still supporting the same
// container with an explicit codec string, so the plain type alone silently downgraded
// every MP4 export to WebM.
function pickRecorderMime(fmt) {
    const mp4 = [
        'video/mp4;codecs=avc1.640034,mp4a.40.2',
        'video/mp4;codecs=avc1.4d0034,mp4a.40.2',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=h264,aac',
        'video/mp4'
    ];
    const webm = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
    ];
    if (fmt === 'mp4') {
        const hit = mp4.find(m => MediaRecorder.isTypeSupported(m));
        if (hit) return { mime: hit, ext: 'mp4' };
    }
    const hit = webm.find(m => MediaRecorder.isTypeSupported(m));
    return { mime: hit || 'video/webm', ext: 'webm' };
}

// rAF is paused while the tab is hidden, but MediaRecorder keeps recording in real time,
// so a backgrounded export bakes in a frozen stretch that cannot be recovered afterwards.
function onExportVisibilityChange() {
    if (document.hidden && isExporting) exportWentHidden = true;
}

function drawExportFrame() {
    if (isInIntro) {
        drawIntroFrame(exportCtx, 1);
        updateExportProgress();
        return;
    }
    if (isInOutro) {
        drawOutroFrame(exportCtx, 1);
        updateExportProgress();
        return;
    }
    exportCtx.fillStyle = '#000'; exportCtx.fillRect(0, 0, EXPORT_W, EXPORT_H);
    const clip = state.clips[currentClipIndex];
    // playCurrentClip() is async: for the few frames it spends seeking the incoming clip
    // the new element has nothing to draw, which used to record a burst of black frames
    // at every transition. Hold the outgoing clip's last frame instead.
    const videoSrc = isClipDrawable(clip) ? clip : state.clips[currentClipIndex - 1];
    if (videoSrc) drawVideoCover(exportCtx, videoSrc, 0, 0, EXPORT_W, EXPORT_H, 1);
    drawBlurBars(exportCtx, 1);
    drawBarsAndPercentage(exportCtx, 1);
    drawTitleLine(exportCtx, state.title.line1, state.layout.title1Pos, state.title.font, state.title.fontSize, state.title.textColor, 1);
    drawTitleLine(exportCtx, state.title.line2, state.layout.title2Pos, state.title.font, state.title.fontSize, state.title.textColor, 1);
    drawNumbers(exportCtx, 1);
    drawCaptions(exportCtx, 1);
    drawFreezeOverlays(exportCtx, 1);
    drawScreenTexts(exportCtx, 1);
    drawVoCaptions(exportCtx, 1);
    updateExportProgress();
}

async function startExport() {
    if (state.clips.length === 0) return alert('Agrega al menos un clip.');
    stopPlayback();
    isExporting = true; exportChunks = []; lastProgressPct = -1;
    exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_W; exportCanvas.height = EXPORT_H;
    exportCtx = exportCanvas.getContext('2d', { alpha: false });
    // Source clips are often smaller than 1080x1920 (TikTok downloads are commonly
    // 576x1024), and the default 'low' resampler makes those upscales look soft.
    exportCtx.imageSmoothingEnabled = true;
    exportCtx.imageSmoothingQuality = 'high';

    // ─── AUDIO CAPTURE ───
    // Route each clip's audio into a recording destination (not to speakers).
    // MediaElementAudioSourceNode can only be created ONCE per element, so we cache it.
    exportAudioDest = null;
    try {
        if (!exportAudioCtx) exportAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        await exportAudioCtx.resume();
        exportAudioDest = exportAudioCtx.createMediaStreamDestination();
        state.clips.forEach(c => {
            if (!c.videoEl) return;
            if (!c.audioSourceNode) {
                c.audioSourceNode = exportAudioCtx.createMediaElementSource(c.videoEl);
            }
            try { c.audioSourceNode.disconnect(); } catch(e) {}
            c.audioSourceNode.connect(exportAudioDest);
            c.videoEl.muted = false;
            c.videoEl.volume = (c.volume ?? 1.0);
        });
        // Route intro audio element too
        if (introAudioEl) {
            if (!introAudioEl._audioSourceNode) {
                introAudioEl._audioSourceNode = exportAudioCtx.createMediaElementSource(introAudioEl);
            }
            try { introAudioEl._audioSourceNode.disconnect(); } catch(e) {}
            introAudioEl._audioSourceNode.connect(exportAudioDest);
            introAudioEl.muted = false;
        }
        // Route audio tracks too
        state.audioTracks.forEach(t => {
            if (!t.audioEl) return;
            if (!t.audioSourceNode) {
                t.audioSourceNode = exportAudioCtx.createMediaElementSource(t.audioEl);
            }
            try { t.audioSourceNode.disconnect(); } catch(e) {}
            t.audioSourceNode.connect(exportAudioDest);
            t.audioEl.muted = false;
        });
        // Route voiceovers, SFX and outro voice
        state.clips.forEach(c => {
            if (!c.vo || !c.vo.audioEl) return;
            if (!c.vo.audioSourceNode) {
                c.vo.audioSourceNode = exportAudioCtx.createMediaElementSource(c.vo.audioEl);
            }
            try { c.vo.audioSourceNode.disconnect(); } catch(e) {}
            c.vo.audioSourceNode.connect(exportAudioDest);
        });
        Object.values(sfxEls).forEach(el => {
            if (!el) return;
            if (!el._audioSourceNode) el._audioSourceNode = exportAudioCtx.createMediaElementSource(el);
            try { el._audioSourceNode.disconnect(); } catch(e) {}
            el._audioSourceNode.connect(exportAudioDest);
        });
        if (outroVoiceEl) {
            if (!outroVoiceEl._audioSourceNode) outroVoiceEl._audioSourceNode = exportAudioCtx.createMediaElementSource(outroVoiceEl);
            try { outroVoiceEl._audioSourceNode.disconnect(); } catch(e) {}
            outroVoiceEl._audioSourceNode.connect(exportAudioDest);
        }
    } catch (e) {
        console.error('Audio capture setup failed, exporting without audio:', e);
        exportAudioDest = null;
    }

    const fmt = document.getElementById('exportFormat').value;
    const picked = pickRecorderMime(fmt);
    const mime = picked.mime, ext = picked.ext;
    if (fmt === 'mp4' && ext !== 'mp4') {
        alert('Este navegador no puede grabar MP4/H.264. Se exportará en WebM.');
    }

    const quality = document.getElementById('exportQuality');
    const videoBps = quality ? parseInt(quality.value, 10) : 16000000;

    // captureStream(0) hands frame timing to us: exactly one captured frame per frame
    // drawn. With a fixed rate the capture clock and the draw clock run independently,
    // so frames get silently duplicated or skipped and motion judders.
    let stream = null;
    exportFrameTrack = null;
    try {
        const manual = exportCanvas.captureStream(0);
        const vTrack = manual.getVideoTracks()[0];
        if (vTrack && typeof vTrack.requestFrame === 'function') {
            stream = manual;
            exportFrameTrack = vTrack;
        } else {
            manual.getTracks().forEach(t => t.stop());
        }
    } catch (e) {
        console.warn('Manual frame capture unavailable, falling back to timed capture:', e);
    }
    if (!stream) stream = exportCanvas.captureStream(FPS);
    if (exportAudioDest) {
        exportAudioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    }
    exportRecorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: videoBps, audioBitsPerSecond: 192000 });
    exportRecorder.ondataavailable = e => { if (e.data.size) exportChunks.push(e.data); };
    exportRecorder.onstop = () => {
        const url = URL.createObjectURL(new Blob(exportChunks, { type: mime }));
        const a = document.createElement('a'); a.href = url; a.download = 'ranking_video.' + ext;
        a.click(); URL.revokeObjectURL(url);
        finishExport();
    };

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

    // Put a real frame on the canvas before recording opens, otherwise the first
    // captured frame is the blank canvas.
    exportWentHidden = false;
    document.addEventListener('visibilitychange', onExportVisibilityChange);
    exportFrameClock = performance.now();
    drawExportFrame();
    if (exportFrameTrack) exportFrameTrack.requestFrame();

    exportRecorder.start(100);

    if (state.intro.enabled) {
        startIntro();
    } else {
        await playCurrentClip();
    }
}

function updateExportProgress() {
    const tot = getTotalDuration();
    const pct = tot > 0 ? Math.min(100, (getElapsedTime() / tot) * 100) : 0;
    const rounded = Math.round(pct);
    if (rounded !== lastProgressPct) {
        lastProgressPct = rounded;
        document.getElementById('exportProgress').style.width = pct + '%';
        document.getElementById('exportProgressText').textContent = rounded + '%';
    }

    // Sync audio tracks during export
    syncExportAudioTracks(getElapsedTime());

    // Handle intro phase
    if (isInIntro) {
        const elapsed = getIntroElapsedTime();
        if (elapsed >= state.intro.duration) {
            isInIntro = false;
            if (introAudioEl) introAudioEl.pause();
            restoreIntroBgClip();
            currentClipIndex = 0;
            playCurrentClip();
        }
        return;
    }

    // Handle outro phase
    if (isInOutro) {
        if (getOutroElapsedTime() >= state.outro.durationSec) {
            isPlaying = false;
            exportRecorder?.stop();
        }
        return;
    }

    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.videoEl) { isPlaying = false; exportRecorder?.stop(); return; }

    // Style engine: freezes + SFX + voiceovers
    tickStyleEngine();
    syncVoiceovers(getElapsedTime());

    // Check if current clip has ended (ended covers rounding issues with trimEnd)
    if (clip.videoEl.ended || clip.videoEl.currentTime >= clip.trimEnd) {
        clip.videoEl.pause();
        currentClipIndex++;
        if (currentClipIndex < state.clips.length) {
            playCurrentClip();
        } else if (getOutroOffset() > 0) {
            startOutroPhase();
        } else {
            isPlaying = false;
            exportRecorder?.stop();
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
function cancelExport() { exportRecorder?.stop(); finishExport(); }
function finishExport() {
    isExporting = false; isPlaying = false; exportRecorder = null; exportCtx = null;
    exportFrameTrack = null;
    isInIntro = false;
    document.removeEventListener('visibilitychange', onExportVisibilityChange);
    if (exportWentHidden) {
        exportWentHidden = false;
        alert('⚠️ La pestaña estuvo en segundo plano durante la exportación.\n\n' +
              'El navegador congela el renderizado mientras la pestaña no está visible, ' +
              'así que el video puede tener tramos congelados. Vuelve a exportar dejando ' +
              'esta pestaña al frente.');
    }
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
    if (outroVoiceEl) { try { outroVoiceEl._audioSourceNode?.disconnect(); } catch(e) {} outroVoiceEl.muted = true; }
    if (introAudioEl) { try { introAudioEl._audioSourceNode?.disconnect(); } catch(e) {} introAudioEl.muted = true; }
    state.audioTracks.forEach(t => {
        if (t.audioSourceNode) { try { t.audioSourceNode.disconnect(); } catch(e) {} }
        if (t.audioEl) t.audioEl.muted = true;
    });
    document.getElementById('exportOverlay').classList.add('hidden');
    stopPlayback();
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
            numberPos: getTemplateNumberPos(state.clips.length), // posición óptima desde plantilla
            timelineStart: state.clips.reduce((max, c) => Math.max(max, (c.timelineStart || 0) + getClipTrimDuration(c)), 0),
            panX: 0, panY: 0,
            volume: 1.0,
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
    const video = document.createElement('video');
    video.preload = 'auto'; video.muted = true; video.playsInline = true; video.src = clip.url;
    videoContainer.appendChild(video);
    clip.videoEl = video;

    video.addEventListener('loadedmetadata', () => {
        clip.duration = video.duration;
        clip.trimEnd = Math.min(Math.round(video.duration * 100) / 100, video.duration);
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
    const c = state.clips[idx]; if(c && c.videoEl && c.videoEl.readyState>=2) c.videoEl.currentTime = c.trimStart;
    renderTimelineClips();
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
                '<label>Palabras</label>' +
                '<select onchange="updateVoField(\'' + clip.id + '\',\'capWords\',this.value)" onclick="event.stopPropagation()">' +
                    [1, 2, 3, 4, 5, 6].map(n => '<option value="' + n + '"' + ((vo.capWords ?? 3) === n ? ' selected' : '') + '>' + n + ' a la vez</option>').join('') +
                '</select>' +
            '</div>' +
            '<div class="form-row">' +
                '<label>Fuente</label>' +
                '<select onchange="updateVoField(\'' + clip.id + '\',\'capFont\',this.value)" onclick="event.stopPropagation()">' +
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
                    '<input type="number" value="' + clip.rankingPosition + '" placeholder="' + (idx+1) + '" style="width:45px;flex:none" title="Número del ranking (vacío = automático)" oninput="updateClipField(\'' + clip.id + '\',\'rankingPosition\',this.value)" onclick="event.stopPropagation()">' +
                    '<input type="text" value="' + clip.numberText + '" placeholder="Texto (ej: never again)" style="flex:1" oninput="updateClipField(\'' + clip.id + '\',\'numberText\',this.value)" onclick="event.stopPropagation()">' +
                    '<input type="color" value="' + (clip.numberColor || state.numbers.color || '#FFD700') + '" oninput="updateClipField(\'' + clip.id + '\',\'numberColor\',this.value)" onclick="event.stopPropagation()">' +
                    '<span style="flex:1"></span>' +
                    '<input type="text" value="' + clip.percentage + '" placeholder="ej: 99" style="width:50px;flex:none" title="Porcentaje" oninput="updateClipField(\'' + clip.id + '\',\'percentage\',this.value)" onclick="event.stopPropagation()"> %' +
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
            '</div>' +
        '</div>';
    });
    clipsList.innerHTML = html;
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
let aiTargetMode = null;   // 'intro' | 'clip' | 'vo' | 'outro'
let aiTargetClipId = null;

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
    return aiTargetMode === 'vo' ? (clip.vo && clip.vo._file) : clip.file;
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
        const wordLevel = (aiTargetMode === 'intro' || aiTargetMode === 'vo');
        const lang = aiTargetMode === 'outro'
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
    state.title.line1 = document.getElementById('titleLine1').value;
    state.title.line2 = document.getElementById('titleLine2').value;
    state.title.textColor = document.getElementById('titleTextColor').value;
    state.title.fontSize = parseInt(document.getElementById('titleFontSize').value);
    document.getElementById('titleFontSizeVal').textContent = state.title.fontSize;
    scheduleAutoSave();
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

function updateIntro() {
    state.intro.enabled = document.getElementById('introEnabled').checked;
    state.intro.duration = parseInt(document.getElementById('introDuration').value);
    state.intro.blurAmount = parseInt(document.getElementById('introBlur').value);
    state.intro.overlayOpacity = parseInt(document.getElementById('introOverlay').value) / 100;
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

function handleIntroAudio(file) {
    if (!file) return;
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
    if (!clip.vo) clip.vo = { enabled: true, text: '', offset: 0, fileName: '', captions: [], _file: null, audioEl: null, duration: 0 };
    const vo = clip.vo;
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
}
function removeFreeze(fid) {
    const clip = state.clips[currentClipIndex];
    if (!clip || !clip.freezes) return;
    clip.freezes = clip.freezes.filter(f => f.id !== fid);
    delete freezeRuntime[fid];
    renderFreezesList();
    drawFrame();
    scheduleAutoSave();
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
                '<label>Fuente</label><select onchange="updateFreezeField(' + ff.id + ',\'font\',this.value)">' + fontOpts + '</select>' +
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
const audioClipsContainer = document.getElementById('audioClips');
let audioDragData = null;

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
    state.audioTracks.splice(idx, 1);
    renderAudioTracks();
    renderTimelineClips();
    scheduleAutoSave();
}

function renderAudioTracks() {
    if (!audioClipsContainer) return;
    const total = getTimelineScaleDuration();
    audioClipsContainer.innerHTML = '';
    if (total <= 0) return;

    state.audioTracks.forEach(track => {
        const dur = Math.max(0, track.trimEnd - track.trimStart);
        const seg = document.createElement('div');
        seg.className = 'timeline-audio-clip';
        seg.style.left = (track.timelineStart / total * 100) + '%';
        seg.style.width = Math.max(dur / total * 100, 1) + '%';
        seg.title = track.name + ' · ' + formatTime(dur);
        seg.dataset.trackId = track.id;

        const lbl = document.createElement('span');
        lbl.className = 'timeline-audio-clip-label';
        lbl.textContent = '🎵 ' + track.name;
        seg.appendChild(lbl);

        const trimIn = document.createElement('div');
        trimIn.className = 'trim-handle trim-in';
        trimIn.addEventListener('pointerdown', e => startAudioTrimDrag(e, track.id, 'in'));

        const trimOut = document.createElement('div');
        trimOut.className = 'trim-handle trim-out';
        trimOut.addEventListener('pointerdown', e => startAudioTrimDrag(e, track.id, 'out'));

        const delBtn = document.createElement('button');
        delBtn.className = 'caption-del';
        delBtn.style.cssText = 'position:absolute;top:-1px;right:-18px;font-size:12px;padding:0 2px;z-index:5;';
        delBtn.textContent = '✕';
        delBtn.title = 'Eliminar';
        delBtn.addEventListener('pointerdown', e => { e.stopPropagation(); removeAudioTrack(track.id); });

        seg.append(trimIn, trimOut, delBtn);

        seg.addEventListener('pointerdown', e => {
            if (e.target.closest('.trim-handle, .caption-del')) return;
            e.preventDefault();
            const rect = audioClipsContainer.getBoundingClientRect();
            audioDragData = {
                trackId: track.id,
                startClientX: e.clientX,
                origStart: track.timelineStart,
                laneRect: rect
            };
        });

        audioClipsContainer.appendChild(seg);
    });
}

document.addEventListener('pointermove', e => {
    if (audioDragData) {
        e.preventDefault();
        const track = state.audioTracks.find(t => t.id === audioDragData.trackId);
        if (!track) return;
        const total = getTimelineScaleDuration();
        const dx = e.clientX - audioDragData.startClientX;
        const dTime = (dx / audioDragData.laneRect.width) * total;
        track.timelineStart = Math.max(0, audioDragData.origStart + dTime);
        renderAudioTracks();
    }
});

document.addEventListener('pointerup', () => {
    if (audioDragData) {
        audioDragData = null;
        scheduleAutoSave();
    }
});

function startAudioTrimDrag(event, trackId, edge) {
    event.preventDefault();
    event.stopPropagation();
    const track = state.audioTracks.find(t => t.id === trackId);
    if (!track) return;
    const rect = audioClipsContainer.getBoundingClientRect();
    audioDragData = {
        trackId: trackId,
        edge: edge,
        startClientX: event.clientX,
        origTrimStart: track.trimStart,
        origTrimEnd: track.trimEnd,
        origStart: track.timelineStart,
        laneRect: rect,
        isTrim: true
    };
}

// Update audio trim during drag
function updateAudioTrimDrag(e) {
    if (!audioDragData || !audioDragData.isTrim) return;
    const track = state.audioTracks.find(t => t.id === audioDragData.trackId);
    if (!track) return;
    const total = getTimelineScaleDuration();
    const dx = e.clientX - audioDragData.startClientX;
    const dTime = (dx / audioDragData.laneRect.width) * total;

    if (audioDragData.edge === 'in') {
        const newTrim = clamp(audioDragData.origTrimStart + dTime, 0, track.trimEnd - 0.1);
        const delta = newTrim - track.trimStart;
        track.trimStart = newTrim;
        track.timelineStart += delta;
    } else {
        track.trimEnd = clamp(audioDragData.origTrimEnd + dTime, track.trimStart + 0.1, track.duration || 9999);
    }
    renderAudioTracks();
}

// Hook trim updates into pointermove
document.addEventListener('pointermove', e => {
    if (audioDragData && audioDragData.isTrim) updateAudioTrimDrag(e);
});

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

function pauseAllAudioTracks() {
    state.audioTracks.forEach(t => { if (t.audioEl) { t.audioEl.pause(); t.audioEl.muted = true; } });
}

function toggleSection(h) { h.classList.toggle('collapsed'); h.nextElementSibling.classList.toggle('hidden'); }

function syncUIFromState() {
    document.getElementById('titleFont').value = state.title.font;
    document.getElementById('titleLine1').value = state.title.line1;
    document.getElementById('titleLine2').value = state.title.line2;
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
updateTitle(); updateNumbers(); updateBars(); updateCaptionStyle(); updateIntro();
updateSoundDesign(); updateScreenTexts(); updateOutro();
loadProject().then(loaded => {
    if (loaded) {
        syncUIFromState();
        drawFrame();
        console.log('Proyecto cargado desde almacenamiento local');
    }
    renderPresetsList();
});
