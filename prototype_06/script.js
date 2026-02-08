// Matter.js module aliases
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Events = Matter.Events,
    Body = Matter.Body,
    Vector = Matter.Vector;

// Game State
let engine, render, runner;
let slimes = [];
let particles = [];
let mapHeight = 3000;
let mapWidth = 600; // Set from view width in startGame so walls fit in max-width (Review 2)
const wallThickness = 24; // Review 13: Restore original thickness (8 -> 24)
let worldViewWidth = 800; // View width in world coords (for minimap & wall bounds)
let isGameRunning = false;
let finishedSlimes = [];
let rankPrizes = []; // Review 5: Persistent prize pool
let wallPoints = { left: [], right: [] };
let spawnPassageMinX = -400, spawnPassageMaxX = 400; // Set in generateMap from funnel at startY

// Review 15: Camera smoothing
let cameraX = 0;
let cameraY = 0;
const cameraSmoothness = 0.08; // Lower = smoother (0.02~0.1 recommended)

// Review 4: Sound Settings
let bgmEnabled = localStorage.getItem('bgmEnabled') !== 'false'; // Default: true
let sfxEnabled = localStorage.getItem('sfxEnabled') !== 'false'; // Default: true

// Web Audio API Sound System
let audioCtx = null;
let bgmInterval = null;
let bgmGainNode = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Simple synthesizer note player
function playNote(frequency, duration, type = 'square', volume = 0.1, delay = 0) {
    if (!audioCtx) initAudio();

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime + delay);

    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime + delay);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(audioCtx.currentTime + delay);
    oscillator.stop(audioCtx.currentTime + delay + duration);
}

// BGM - Simple retro racing melody loop
const bgmMelody = [
    { note: 392, dur: 0.15 }, // G4
    { note: 440, dur: 0.15 }, // A4
    { note: 494, dur: 0.15 }, // B4
    { note: 523, dur: 0.3 },  // C5
    { note: 494, dur: 0.15 }, // B4
    { note: 440, dur: 0.15 }, // A4
    { note: 392, dur: 0.3 },  // G4
    { note: 330, dur: 0.15 }, // E4
    { note: 349, dur: 0.15 }, // F4
    { note: 392, dur: 0.3 },  // G4
    { note: 440, dur: 0.15 }, // A4
    { note: 392, dur: 0.15 }, // G4
    { note: 349, dur: 0.15 }, // F4
    { note: 330, dur: 0.3 },  // E4
];

let bgmNoteIndex = 0;
let bgmPlaying = false;

function startBGM() {
    if (!bgmEnabled || bgmPlaying) return;
    initAudio();
    bgmPlaying = true;
    bgmNoteIndex = 0;

    function playNextNote() {
        if (!bgmPlaying || !bgmEnabled) return;

        const { note, dur } = bgmMelody[bgmNoteIndex];
        playNote(note, dur * 0.9, 'square', 0.05);

        bgmNoteIndex = (bgmNoteIndex + 1) % bgmMelody.length;
        bgmInterval = setTimeout(playNextNote, dur * 1000);
    }

    playNextNote();
}

function stopBGM() {
    bgmPlaying = false;
    if (bgmInterval) {
        clearTimeout(bgmInterval);
        bgmInterval = null;
    }
}

// SFX - Sound Effects
function playSfxCollision() {
    if (!sfxEnabled) return;
    initAudio();
    playNote(200, 0.1, 'sawtooth', 0.08);
}

function playSfxGoal() {
    if (!sfxEnabled) return;
    initAudio();
    playNote(523, 0.1, 'sine', 0.15, 0);    // C5
    playNote(659, 0.1, 'sine', 0.15, 0.1);  // E5
    playNote(784, 0.2, 'sine', 0.15, 0.2);  // G5
}

function playSfxFanfare() {
    if (!sfxEnabled) return;
    initAudio();
    // Victory fanfare
    playNote(523, 0.15, 'square', 0.1, 0);     // C5
    playNote(523, 0.15, 'square', 0.1, 0.15);  // C5
    playNote(523, 0.15, 'square', 0.1, 0.3);   // C5
    playNote(659, 0.4, 'square', 0.12, 0.45);  // E5
    playNote(622, 0.15, 'square', 0.1, 0.85);  // Eb5
    playNote(659, 0.15, 'square', 0.1, 1.0);   // E5
    playNote(784, 0.5, 'square', 0.15, 1.15);  // G5
}

// Review 5: Obstacle-specific SFX (increased volume)
function playSfxPin() {
    if (!sfxEnabled) return;
    initAudio();
    console.log('SFX: Pin');
    playNote(800, 0.15, 'sine', 0.3); // 높은 '통' 소리
}

function playSfxSpinner() {
    if (!sfxEnabled) return;
    initAudio();
    console.log('SFX: Spinner');
    playNote(300, 0.2, 'sawtooth', 0.25); // 회전 소리
    playNote(350, 0.15, 'sawtooth', 0.2, 0.1);
}

function playSfxSlider() {
    if (!sfxEnabled) return;
    initAudio();
    console.log('SFX: Slider');
    playNote(250, 0.15, 'triangle', 0.3); // 슬라이딩 소리
}

function playSfxBooster() {
    if (!sfxEnabled) return;
    initAudio();
    console.log('SFX: Booster');
    playNote(400, 0.15, 'sawtooth', 0.25);  // 가속 시작
    playNote(600, 0.2, 'sawtooth', 0.3, 0.1); // 가속 상승
    playNote(800, 0.25, 'sawtooth', 0.2, 0.25);  // 최고점
}

function playSfxSpring() {
    if (!sfxEnabled) return;
    initAudio();
    console.log('SFX: Spring');
    playNote(500, 0.1, 'sine', 0.35);    // 튕김
    playNote(700, 0.12, 'sine', 0.3, 0.08);
    playNote(900, 0.15, 'sine', 0.25, 0.15);
}

function playSfxWall() {
    if (!sfxEnabled) return;
    initAudio();
    console.log('SFX: Wall');
    playNote(150, 0.15, 'square', 0.3); // 낮은 '쿵' 소리
}

// DOM Elements
const startScreen = document.getElementById('start-screen');
const resultsScreen = document.getElementById('results-screen');
const gameHud = document.getElementById('game-hud');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const playerCountInput = document.getElementById('player-count');
const mapLengthInput = document.getElementById('map-length');
const rankList = document.getElementById('rank-list');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
const bottomRankHud = document.getElementById('bottom-rank-hud');
const bgmBtn = document.getElementById('bgm-btn');
const sfxBtn = document.getElementById('sfx-btn');

// Style update for HUD
bottomRankHud.style.maxHeight = '200px';
bottomRankHud.style.overflowY = 'auto';

// Review 4: Sound Button Event Listeners
function updateSoundButtons() {
    if (bgmBtn) {
        bgmBtn.classList.toggle('off', !bgmEnabled);
        bgmBtn.textContent = bgmEnabled ? '🎵' : '🎵';
    }
    if (sfxBtn) {
        sfxBtn.classList.toggle('off', !sfxEnabled);
        sfxBtn.textContent = sfxEnabled ? '🔊' : '🔇';
    }
}

if (bgmBtn) {
    bgmBtn.addEventListener('click', () => {
        bgmEnabled = !bgmEnabled;
        localStorage.setItem('bgmEnabled', bgmEnabled);
        updateSoundButtons();

        // Toggle BGM based on state
        if (bgmEnabled && isGameRunning) {
            startBGM();
        } else {
            stopBGM();
        }
    });
}

if (sfxBtn) {
    sfxBtn.addEventListener('click', () => {
        sfxEnabled = !sfxEnabled;
        localStorage.setItem('sfxEnabled', sfxEnabled);
        updateSoundButtons();
        // SFX toggle is handled in individual playSfx functions
    });
}

// Initialize button states
updateSoundButtons();

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

// UI Initialization
const playerCountSelect = document.getElementById('player-count');
const playerList = document.getElementById('player-list');

function initUI() {
    // Populate Select Options (2-50)
    playerCountSelect.innerHTML = '';
    for (let i = 2; i <= 50; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i}명`;
        if (i === 10) option.selected = true;
        playerCountSelect.appendChild(option);
    }

    // Initial List Generation
    generatePlayerInputs(10);

    // Event Listeners
    playerCountSelect.addEventListener('change', (e) => {
        generatePlayerInputs(parseInt(e.target.value));
    });
}

function generatePlayerInputs(count, presetNames = []) {
    playerList.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '30px 1fr 1fr';
        row.style.gap = '5px';
        row.style.marginBottom = '5px';

        const num = document.createElement('span');
        num.textContent = i + 1;
        num.style.lineHeight = '30px';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = `슬라임 ${i + 1}`;
        nameInput.className = 'player-name-input';
        nameInput.value = presetNames[i] || '';
        nameInput.style.padding = '5px';

        const prizeInput = document.createElement('input');
        prizeInput.type = 'text';
        prizeInput.placeholder = '경품';
        prizeInput.className = 'player-prize-input';
        prizeInput.value = `${i + 1}등상품`; // Review 5: Default rank prize
        prizeInput.style.padding = '5px';

        row.appendChild(num);
        row.appendChild(nameInput);
        row.appendChild(prizeInput);
        playerList.appendChild(row);
    }
}

// Call initUI immediately
initUI();

function initMatter() {
    // Create engine with higher iterations to prevent tunneling
    engine = Engine.create({
        positionIterations: 10,  // Default 6 -> 10 for better collision
        velocityIterations: 8    // Default 4 -> 8 for better collision
    });
    engine.world.gravity.y = 0.2; // 1/5 Speed (Default is 1)

    const gameContainer = document.getElementById('game-container');
    const containerWidth = gameContainer ? gameContainer.clientWidth : window.innerWidth;
    const containerHeight = gameContainer ? gameContainer.clientHeight : window.innerHeight;

    // Create renderer (max-width 768px container)
    render = Render.create({
        element: gameContainer || document.body,
        engine: engine,
        options: {
            width: containerWidth,
            height: containerHeight,
            wireframes: false,
            background: '#222',
            pixelRatio: window.devicePixelRatio,
            showAngleIndicator: false
        }
    });

    // Create runner
    runner = Runner.create();

    // Resize handler (respect 768px max-width container)
    window.addEventListener('resize', () => {
        const el = document.getElementById('game-container');
        const w = el ? el.clientWidth : window.innerWidth;
        const h = el ? el.clientHeight : window.innerHeight;
        render.options.width = w;
        render.options.height = h;
        render.canvas.width = w;
        render.canvas.height = h;
    });

    Runner.run(runner, engine);
    Render.run(render);

    // Game Loop for custom logic (Camera, Updates)
    Events.on(engine, 'beforeUpdate', updateGame);

    // Hook for custom rendering (Visual Polish v2)
    Events.on(render, 'afterRender', function () {
        const ctx = render.context;

        // Review 4: Curved wall overlay removed; only Matter.js wall bodies are shown

        slimes.forEach(slime => {
            // Note: slime.render.visible is now false, so we MUST draw everything manually here

            let { position, velocity, circleRadius } = slime;

            // REVIEW 5: Decoupled Render for Absolute Lock
            if (slime.gameData.finished && slime.gameData.fixedPosition) {
                position = slime.gameData.fixedPosition;
                velocity = { x: 0, y: 0 }; // Force zero velocity for render calc
            }
            const radius = circleRadius;

            // Camera transform
            const viewX = position.x - render.bounds.min.x;
            const viewY = position.y - render.bounds.min.y;

            // Squash & Stretch Calculation
            const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
            let scaleX = 1;
            let scaleY = 1;

            // Stretch along velocity vector
            if (Math.abs(velocity.y) > 5) {
                scaleY = 1 + Math.min(Math.abs(velocity.y) * 0.02, 0.3);
                scaleX = 1 / scaleY; // Preserve volume
            }

            // Apply Transform
            ctx.save();
            ctx.translate(viewX, viewY);
            ctx.scale(scaleX, scaleY);

            // Draw Body (Manual Render for Ultimate Freeze compatibility)
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, 2 * Math.PI);
            ctx.fillStyle = slime.render.fillStyle;
            ctx.fill();

            // Draw Eyes (Simple Face)
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(-5, -5, 4, 0, 2 * Math.PI);
            ctx.arc(5, -5, 4, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = 'black';
            ctx.beginPath();
            // Pupils
            const lookX = Math.min(Math.max(velocity.x, -2), 2);
            const lookY = Math.min(Math.max(velocity.y, -2), 2);
            ctx.arc(-5 + lookX, -5 + lookY, 2, 0, 2 * Math.PI);
            ctx.arc(5 + lookX, -5 + lookY, 2, 0, 2 * Math.PI);
            ctx.fill();

            // Draw Mouth
            ctx.beginPath();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            if (Math.abs(velocity.y) > 10 || Math.abs(velocity.x) > 5) {
                ctx.ellipse(0, 8, 3, 5, 0, 0, 2 * Math.PI);
                ctx.stroke();
            } else {
                ctx.arc(0, 5, 6, 0.2 * Math.PI, 0.8 * Math.PI);
                ctx.stroke();
            }
            ctx.restore(); // Undo transform

            // Draw Name & Rank Label (No transform/squash for text)
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'black';

            let label = slime.gameData.name;
            if (slime.gameData.rank) {
                label = `${slime.gameData.rank}등 ${label}`;
                ctx.fillStyle = '#FFD700'; // Gold color for rank
            }

            ctx.strokeText(label, viewX, viewY - radius - 15);
            ctx.fillText(label, viewX, viewY - radius - 15);
        });

        // Draw Gradient Pins
        Composite.allBodies(engine.world).forEach(body => {
            if (body.label === 'pin') { // Need to set label in generateMap
                const viewX = body.position.x - render.bounds.min.x;
                const viewY = body.position.y - render.bounds.min.y;
                const r = body.circleRadius;

                const grad = ctx.createRadialGradient(viewX, viewY, r * 0.2, viewX, viewY, r);
                grad.addColorStop(0, '#ff6b6b'); // Light Red
                grad.addColorStop(1, '#c0392b'); // Dark Red

                ctx.globalCompositeOperation = 'source-over'; // Default
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(viewX, viewY, r, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        // Feature: Draw Booster Text
        Composite.allBodies(engine.world).forEach(body => {
            if (body.label === 'booster') {
                const viewX = body.position.x - render.bounds.min.x;
                const viewY = body.position.y - render.bounds.min.y;
                const w = 80;
                const h = 20;

                // Draw Arrows (>>>)
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = -20; i <= 20; i += 20) {
                    ctx.moveTo(viewX + i - 5, viewY - 5);
                    ctx.lineTo(viewX + i + 5, viewY);
                    ctx.lineTo(viewX + i - 5, viewY + 5);
                }
                ctx.stroke();

                ctx.font = 'bold 10px Arial';
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.fillText(`${body.custom.duration}s`, viewX, viewY + 14);
            }

            if (body.label === 'spring') {
                const viewX = body.position.x - render.bounds.min.x;
                const viewY = body.position.y - render.bounds.min.y;
                const w = 60;

                // Draw Coil/Zigzag
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(viewX - w / 2, viewY + 5);
                for (let i = -w / 2 + 10; i <= w / 2; i += 10) {
                    ctx.lineTo(i % 20 === 0 ? viewX + i : viewX + i, viewY + (i % 20 === 0 ? -5 : 5));
                }
                ctx.stroke();
            }
        });

        // Feature: Update and Draw Particles
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.update();
            p.draw(ctx, render.bounds);
        });

        // Feature: Draw Minimap
        drawMinimap();
    });
}

function drawMinimap() {
    if (!minimapCanvas || !minimapCtx) return;

    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const padding = 10;
    const drawW = w - padding * 2;
    const drawH = h - padding * 2;

    minimapCtx.clearRect(0, 0, w, h);

    // Scaling (world x range = worldViewWidth; Review 2)
    const scaleX = drawW / Math.max(1, worldViewWidth);
    const scaleY = drawH / mapHeight;
    const offsetX = w / 2;

    // 1. Draw Start & Goal lines
    minimapCtx.strokeStyle = '#777';
    minimapCtx.lineWidth = 1;
    // Start
    minimapCtx.beginPath();
    minimapCtx.moveTo(padding, padding);
    minimapCtx.lineTo(w - padding, padding);
    minimapCtx.stroke();
    // Goal
    const goalY = padding + mapHeight * scaleY;
    minimapCtx.strokeStyle = '#4CAF50';
    minimapCtx.beginPath();
    minimapCtx.moveTo(padding, goalY);
    minimapCtx.lineTo(w - padding, goalY);
    minimapCtx.stroke();

    // 2. Draw Walls
    if (wallPoints && wallPoints.left.length > 0) {
        minimapCtx.fillStyle = '#444';

        // Left wall
        minimapCtx.beginPath();
        minimapCtx.moveTo(offsetX + wallPoints.left[0].x * scaleX, padding + wallPoints.left[0].y * scaleY);
        for (let i = 1; i < wallPoints.left.length; i++) {
            minimapCtx.lineTo(offsetX + wallPoints.left[i].x * scaleX, padding + wallPoints.left[i].y * scaleY);
        }
        // Right wall
        minimapCtx.moveTo(offsetX + wallPoints.right[0].x * scaleX, padding + wallPoints.right[0].y * scaleY);
        for (let i = 1; i < wallPoints.right.length; i++) {
            minimapCtx.lineTo(offsetX + wallPoints.right[i].x * scaleX, padding + wallPoints.right[i].y * scaleY);
        }
        minimapCtx.stroke(); // Draw silhouette lines
    }

    // 3. Draw Slimes
    slimes.forEach(slime => {
        const sx = offsetX + slime.position.x * scaleX;
        const sy = padding + slime.position.y * scaleY;

        // Slime dot
        minimapCtx.fillStyle = slime.render.fillStyle;
        minimapCtx.beginPath();
        minimapCtx.arc(sx, sy, 3, 0, Math.PI * 2);
        minimapCtx.fill();

        // Slime name (optional but requested)
        minimapCtx.font = '8px Arial';
        minimapCtx.fillStyle = 'white';
        minimapCtx.textAlign = 'left';
        minimapCtx.fillText(slime.gameData.name, sx + 5, sy + 3);
    });
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.03;
        this.size = 2 + Math.random() * 4;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.vy += 0.1; // Slight gravity
    }
    draw(ctx, renderBounds) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x - renderBounds.min.x, this.y - renderBounds.min.y, this.size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function createConfetti(x, y) {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    for (let i = 0; i < 40; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const p = new Particle(x, y, color);
        p.vx = (Math.random() - 0.5) * 15;
        p.vy = -Math.random() * 12 - 5; // Strong upwards initial burst
        p.decay = 0.01 + Math.random() * 0.01;
        p.size = 3 + Math.random() * 4;
        particles.push(p);
    }
}

function showCelebration(name) {
    const popup = document.getElementById('celebration-popup');
    const nameEl = document.getElementById('celebration-name');
    if (popup && nameEl) {
        nameEl.textContent = `${name}`;
        popup.style.display = 'block';

        // Auto hide after 3 seconds
        setTimeout(() => {
            popup.style.display = 'none';
        }, 3000);
    }
}

function startGame() {
    startScreen.style.display = 'none';
    resultsScreen.style.display = 'none';
    gameHud.style.display = 'block';

    if (!engine) initMatter();

    // Review 3 (P06): Maximize game width (minimal margin)
    worldViewWidth = render.options.width;
    const marginForWobble = 2 * wallThickness; // Minimal margin - only wall thickness
    mapWidth = Math.max(280, worldViewWidth - marginForWobble);

    const difficulty = mapLengthInput.value;

    // Set map height based on difficulty
    if (difficulty === 'short') mapHeight = 4000;
    else if (difficulty === 'medium') mapHeight = 7000;
    else mapHeight = 10000; // Long -> XL

    // Gather data from UI
    const nameInputs = document.querySelectorAll('.player-name-input');
    const prizeInputs = document.querySelectorAll('.player-prize-input');

    const players = [];
    rankPrizes = []; // Reset prize pool

    nameInputs.forEach((input, index) => {
        players.push({
            name: input.value.trim() || `슬라임 ${index + 1}`
        });
        rankPrizes.push(prizeInputs[index].value.trim() || `${index + 1}등상품`);
    });

    resetWorld();
    generateMap();
    spawnSlimes(players);

    isGameRunning = true;
    finishedSlimes = [];

    // Start BGM
    startBGM();
}

function resetGame() {
    stopBGM(); // Stop BGM when returning to menu
    resultsScreen.style.display = 'none';
    startScreen.style.display = 'block';
    gameHud.style.display = 'none';
    resetWorld();
}

function resetWorld() {
    Composite.clear(engine.world);
    Engine.clear(engine);
    slimes = [];
    render.bounds.min.y = 0;
    render.bounds.max.y = window.innerHeight;

    // Review 15: Reset camera position
    cameraX = 0;
    cameraY = 0;

    // Reset HUD
    const bottomRankHud = document.getElementById('bottom-rank-hud');
    if (bottomRankHud) bottomRankHud.innerHTML = '';
}

function generateMap() {
    const world = engine.world;
    const wallOptions = { isStatic: true, render: { fillStyle: '#555' }, friction: 0, restitution: 0.5 };

    // Ground
    // Review 4: Goal height is 50px
    const groundHeight = 50;
    const ground = Bodies.rectangle(0, mapHeight + groundHeight / 2, mapWidth * 4, groundHeight, {
        isStatic: true,
        label: 'ground',
        render: { fillStyle: '#4CAF50' }
    });
    Composite.add(world, ground);

    const segmentHeight = 21; // Review 13: Restore original size (7 -> 21)
    const segments = Math.ceil(mapHeight / segmentHeight);
    const halfView = (render && render.options.width) ? render.options.width / 2 : 400;
    const wallHalf = wallThickness / 2;

    const outerLeftX = -halfView + wallHalf;
    const outerRightX = halfView - wallHalf;

    // Zigzag params; Review 10: wider passage (smaller amplitude = more space between walls)
    const zigzagAmplitude = (halfView - wallThickness) * 0.32;
    const zigzagFreq = 0.2;
    const passageHalfWidth = halfView - wallThickness - zigzagAmplitude;
    const firstZigzagLeft = -passageHalfWidth - wallHalf;
    const firstZigzagRight = passageHalfWidth + wallHalf;

    const startY = -100;
    const funnelSegmentHeight = segmentHeight + 10;
    const funnelTop = startY - 120;
    const funnelBottom = 20;
    const funnelStep = 18; // Denser funnel segments (overlap with funnelSegmentHeight 30)
    const funnelYSteps = [];
    for (let fy = funnelTop; fy <= funnelBottom; fy += funnelStep) funnelYSteps.push(fy);
    if (funnelYSteps[funnelYSteps.length - 1] !== funnelBottom) funnelYSteps.push(funnelBottom);

    wallPoints = { left: [], right: [] };

    for (let f = 0; f < funnelYSteps.length; f++) {
        const y = funnelYSteps[f];
        const t = f / (funnelYSteps.length - 1);
        const leftX = outerLeftX * (1 - t) + firstZigzagLeft * t;
        const rightX = outerRightX * (1 - t) + firstZigzagRight * t;

        wallPoints.left.push({ x: leftX + wallThickness, y: y });
        wallPoints.right.push({ x: rightX - wallThickness, y: y });

        const leftWall = Bodies.rectangle(leftX, y, wallThickness, funnelSegmentHeight, { isStatic: true, render: { fillStyle: '#555' }, friction: 0, restitution: 0.5 });
        const rightWall = Bodies.rectangle(rightX, y, wallThickness, funnelSegmentHeight, { isStatic: true, render: { fillStyle: '#555' }, friction: 0, restitution: 0.5 });
        Composite.add(world, [leftWall, rightWall]);
    }

    // Spawn bounds from funnel at startY so slimes never spawn outside
    const tSpawn = (startY - funnelTop) / (funnelBottom - funnelTop);
    const leftXAtSpawn = outerLeftX * (1 - tSpawn) + firstZigzagLeft * tSpawn;
    const rightXAtSpawn = outerRightX * (1 - tSpawn) + firstZigzagRight * tSpawn;
    spawnPassageMinX = leftXAtSpawn + wallHalf;
    spawnPassageMaxX = rightXAtSpawn - wallHalf;

    // Review 8: Zigzag walls – 통로가 sin(i)로 좌우 이동 → 슬라임이 좌→우→좌로 튕겨 내려감
    for (let i = 0; i < segments; i++) {
        const y = i * segmentHeight + segmentHeight / 2;
        const shift = zigzagAmplitude * Math.sin(i * zigzagFreq);
        let leftX = -passageHalfWidth - wallHalf + shift;
        let rightX = passageHalfWidth + wallHalf + shift;
        leftX = Math.max(leftX, -halfView + wallHalf);
        rightX = Math.min(rightX, halfView - wallHalf);

        wallPoints.left.push({ x: leftX + wallThickness, y: y });
        wallPoints.right.push({ x: rightX - wallThickness, y: y });

        const wallSegmentHeight = segmentHeight + 10;
        const leftWall = Bodies.rectangle(leftX, y, wallThickness, wallSegmentHeight, wallOptions);
        const rightWall = Bodies.rectangle(rightX, y, wallThickness, wallSegmentHeight, wallOptions);

        Composite.add(world, [leftWall, rightWall]);

        const passageWidthHere = rightX - leftX - wallThickness;
        if (i > 8 && i < segments - 8 && i % 3 === 0) {
            const densityProb = 0.2 + (i / segments) * 0.6;
            if (Math.random() < densityProb) {
                addRandomObstacle(y, Math.max(100, passageWidthHere));
            }
        }
    }
}

function addRandomObstacle(y, mapWidthAtY) {
    const type = Math.random();
    const x = (Math.random() - 0.5) * (mapWidthAtY - 150); // Use dynamic width

    if (type < 0.4) {
        // Static Pin (Circle)
        const pin = Bodies.circle(x, y, 15, {
            isStatic: true,
            label: 'pin',
            render: { fillStyle: '#aaa' },
            restitution: 0.8
        });
        Composite.add(engine.world, pin);
    } else if (type < 0.6) {
        // Spinner
        const width = 120 + Math.random() * 80;
        const spinner = Bodies.rectangle(x, y, width, 15, {
            isStatic: false,
            label: 'spinner',
            render: { fillStyle: '#E91E63' },
            density: 0.1,
            frictionAir: 0
        });

        // Constraint to hold it in place but allow rotation
        const constraint = Matter.Constraint.create({
            pointA: { x: x, y: y },
            bodyB: spinner,
            length: 0,
            stiffness: 1
        });

        Composite.add(engine.world, [spinner, constraint]);

    } else if (type < 0.7) {
        // Sliding Wall (We need to construct it differently or update it in loop)
        // Let's create a body and mark it for custom update
        const slider = Bodies.rectangle(x, y, 100, 20, {
            isStatic: true, // We will move its position manually
            label: 'slider',
            render: { fillStyle: '#03A9F4' },
            custom: {
                startX: x,
                range: 100,
                speed: 2 + Math.random() * 2,
                offset: Math.random() * Math.PI * 2
            }
        });
        Composite.add(engine.world, slider);
    } else if (type < 0.8) {
        // Speed Booster (Sensor)
        // Feature: Random Duration (0.1s - 1.0s)
        const duration = (0.1 + Math.random() * 0.9).toFixed(1); // 1 decimal place

        const booster = Bodies.rectangle(x, y, 80, 20, {
            isStatic: true,
            isSensor: true,
            label: 'booster',
            render: { fillStyle: 'rgba(255, 235, 59, 0.5)' },
            custom: {
                duration: parseFloat(duration) // Store as number
            }
        });
        Composite.add(engine.world, booster);
    } else if (type < 0.9) {
        // Spring (Bouncy Block)
        const spring = Bodies.rectangle(x, y, 60, 20, {
            isStatic: true,
            label: 'spring',
            render: { fillStyle: '#9C27B0' },
            restitution: 1.5 // Extra bouncy
        });
        Composite.add(engine.world, spring);
    }
}

function spawnSlimes(players) {
    // Generate distinct colors
    const count = players.length;
    const colors = generateDistinctColors(count);

    const startY = -100; // REVIEW 1 (P03): Same starting height for all slimes

    // Spawn inside funnel passage at startY (use bounds from generateMap)
    const slimeRadius = 15; // Review 13: Restore original size (5 -> 15)
    const minX = spawnPassageMinX + slimeRadius;
    const maxX = spawnPassageMaxX - slimeRadius;
    const passageWidth = Math.max(2 * slimeRadius, maxX - minX);

    for (let i = 0; i < count; i++) {
        const x = minX + Math.random() * passageWidth;
        const y = startY;

        const slime = Bodies.circle(x, y, 15, {
            restitution: 0.7,
            friction: 0.005,
            density: 0.04,
            label: `slime-${i + 1}`,
            render: {
                fillStyle: colors[i % colors.length],
                visible: false // DISABLE MATTER.JS RENDERER (We draw manually)
            }
        });

        // Store slime info
        slime.gameData = {
            id: i + 1,
            name: players[i].name,
            prize: null, // Review 5: Assigned on finish
            finished: false,
            rank: null,
            lastY: y,
            stuckTimer: 0,
            boostTimer: 0, // Review 9: Duration-based boost
            deformation: { x: 1, y: 1 } // For squash effect
        };

        slimes.push(slime);
        Composite.add(engine.world, slime);
    }
}

function generateDistinctColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        const hue = Math.floor((360 / count) * i);
        colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colors;
}

function getRandomColor() {
    const colors = ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function updateGame(event) {
    if (!isGameRunning) return;

    const time = engine.timing.timestamp;

    // 1. Update Camera
    let lowestY = -Infinity;
    let highestY = Infinity;

    slimes.forEach(slime => {
        if (slime.position.y > lowestY) lowestY = slime.position.y;
        if (slime.position.y < highestY) highestY = slime.position.y;

        // Check finish
        if (slime.gameData.finished) {
            return;
        }

        // Check finish
        // Review 18: More generous finish line detection (mapHeight - 50)
        if (slime.position.y >= mapHeight - 50) {
            if (!slime.gameData.finished) {
                console.log(`Slime ${slime.gameData.id} FINISHED at Y=${slime.position.y} (MapHeight=${mapHeight})`);
            }
            slime.gameData.finished = true;
            finishedSlimes.push(slime.gameData);

            // Assign real-time rank
            slime.gameData.rank = finishedSlimes.length;

            // Review 5: Assign prize based on rank
            const prizeIndex = slime.gameData.rank - 1;
            slime.gameData.prize = rankPrizes[prizeIndex] || '';

            // Feature: 1st Place Celebration
            if (slime.gameData.rank === 1) {
                showCelebration(slime.gameData.name);
                createConfetti(slime.position.x, slime.position.y);
                playSfxFanfare(); // Victory fanfare
            } else {
                playSfxGoal(); // Regular goal sound
            }

            // ULTIMATE FREEZE: Remove from physics world
            Composite.remove(engine.world, slime);

            // Set final position for rendering
            const deepY = mapHeight - 5;
            Body.setPosition(slime, { x: slime.position.x, y: deepY });

            // REVIEW 5: Store fixed position for decoupled rendering
            slime.gameData.fixedPosition = { x: slime.position.x, y: deepY };

            Body.setVelocity(slime, { x: 0, y: 0 });
            Body.setAngularVelocity(slime, 0);

            // Trigger HUD update immediately
            updateBottomHUD();

            // Review 20: End game when only 1 slime remains (auto-finish last slime)
            if (finishedSlimes.length >= slimes.length - 1) {
                // Auto-finish remaining slimes
                slimes.forEach(s => {
                    if (!s.gameData.finished) {
                        s.gameData.finished = true;
                        finishedSlimes.push(s.gameData);
                        s.gameData.rank = finishedSlimes.length;
                        s.gameData.prize = rankPrizes[s.gameData.rank - 1] || '';
                    }
                });
                endGame();
            }
        }

        // Stuck Detection
        if (!slime.gameData.finished) {
            if (Math.abs(slime.position.y - slime.gameData.lastY) < 5) {
                slime.gameData.stuckTimer++;
            } else {
                slime.gameData.stuckTimer = 0;
                slime.gameData.lastY = slime.position.y;
            }

            if (slime.gameData.stuckTimer > 30) { // Review 19: 0.5 seconds at 60fps (was 180 = 3s)
                // Push down and random side
                Body.setVelocity(slime, {
                    x: (Math.random() - 0.5) * 10,
                    y: 10
                });
                slime.gameData.stuckTimer = 0;
            }
        }

        // Review 9: Handle Duration-based Boost
        if (slime.gameData.boostTimer > 0) {
            // Constant acceleration while boosting
            Body.applyForce(slime, slime.position, { x: 0, y: 0.005 });
            // Reduced boost speed to prevent tunneling (30 -> 15)
            if (slime.velocity.y < 15) {
                Body.setVelocity(slime, { x: slime.velocity.x, y: 15 });
            }
            slime.gameData.boostTimer -= 1000 / 60; // Approx 16.6ms
        }

        // Anti-tunneling: Clamp max velocity
        const maxVelocity = 18;
        if (Math.abs(slime.velocity.y) > maxVelocity) {
            Body.setVelocity(slime, {
                x: slime.velocity.x,
                y: Math.sign(slime.velocity.y) * maxVelocity
            });
        }
        if (Math.abs(slime.velocity.x) > maxVelocity) {
            Body.setVelocity(slime, {
                x: Math.sign(slime.velocity.x) * maxVelocity,
                y: slime.velocity.y
            });
        }
    });

    // Review 3 & 4: Camera Follow & Clamping (use container/view size for 768px max-width)
    const vw = render.options.width;
    const vh = render.options.height;

    // Review 17: 줌 제거 (zoomFactor = 1)
    const zoomFactor = 1;

    // 첫 번째 슬라임 찾기 (아직 완주하지 않은 슬라임 중 가장 앞서는 슬라임)
    let firstSlime = null;
    let leadingY = -Infinity;
    slimes.forEach(slime => {
        if (!slime.gameData.finished && slime.position.y > leadingY) {
            leadingY = slime.position.y;
            firstSlime = slime;
        }
    });

    // 타겟 위치 계산
    let targetX = 0;
    let targetY = (lowestY !== -Infinity) ? lowestY + 100 : 0;

    if (firstSlime) {
        targetX = firstSlime.position.x;
        targetY = firstSlime.position.y;
    }

    // 줌 된 뷰포트 크기
    const zoomedVw = vw / zoomFactor;
    const zoomedVh = vh / zoomFactor;

    // Y축 클램핑
    const minFollowY = zoomedVh / 2;
    const maxFollowY = mapHeight + 50 - zoomedVh / 2;
    targetY = Math.max(targetY, minFollowY);
    targetY = Math.min(targetY, maxFollowY);

    // Review 15: Lerp로 부드러운 카메라 이동
    cameraX += (targetX - cameraX) * cameraSmoothness;
    cameraY += (targetY - cameraY) * cameraSmoothness;

    Render.lookAt(render, {
        min: { x: cameraX - zoomedVw / 2, y: cameraY - zoomedVh / 2 },
        max: { x: cameraX + zoomedVw / 2, y: cameraY + zoomedVh / 2 }
    });

    // 2. Update Dynamic Obstacles
    Composite.allBodies(engine.world).forEach(body => {
        if (body.label === 'slider') {
            const dx = Math.sin(time * 0.001 * body.custom.speed + body.custom.offset) * body.custom.range;
            Body.setPosition(body, {
                x: body.custom.startX + dx,
                y: body.position.y
            });
            Body.setVelocity(body, { x: 0, y: 0 });
        }

        if (body.label === 'spinner') {
            Body.setAngularVelocity(body, 0.1); // Review 8: Reduced speed (0.2 -> 0.1)
        }
    });

    // Update Progress Bar
    // const progress = Math.min(Math.max(lowestY / mapHeight, 0), 1) * 100;
    // progressBar.style.width = `${progress}%`;

    // Update Bottom Rank HUD (Throttled)
    if (Math.floor(time / 100) % 5 === 0) { // Approx every 500ms
        updateBottomHUD();
    }
}

function updateBottomHUD() {
    const sortedSlimes = [...slimes].sort((a, b) => {
        if (a.gameData.finished && b.gameData.finished) return a.gameData.rank - b.gameData.rank;
        if (a.gameData.finished) return -1;
        if (b.gameData.finished) return 1;
        return b.position.y - a.position.y;
    });

    const bottomRankHud = document.getElementById('bottom-rank-hud');
    const scrollTop = bottomRankHud.scrollTop;

    bottomRankHud.innerHTML = '';
    sortedSlimes.forEach((slime) => {
        const rank = slime.gameData.rank ? `${slime.gameData.rank}등` : '';
        const name = slime.gameData.name;
        const prize = (slime.gameData.finished && slime.gameData.prize) ? ` - ${slime.gameData.prize}` : '';

        const span = document.createElement('span');
        span.textContent = rank ? `${rank}. ${name}${prize}` : `${name}`;
        span.style.marginRight = '10px';
        span.style.padding = '2px 5px';
        span.style.whiteSpace = 'nowrap';

        if (slime.gameData.finished) {
            span.style.color = '#FFD700';
            span.style.fontWeight = 'bold';
            span.style.border = '1px solid #FFD700';
            span.style.borderRadius = '3px';
        } else {
            span.style.color = '#aaa';
        }

        bottomRankHud.appendChild(span);
    });

    bottomRankHud.scrollTop = scrollTop;
}

// Separate collision handler
Events.on(engine, 'collisionStart', function (event) {
    const pairs = event.pairs;

    // Review 5: Calculate current rank for SFX (only 1st and 2nd place)
    const currentRanks = slimes
        .filter(s => !s.gameData.finished)
        .sort((a, b) => b.position.y - a.position.y)
        .slice(0, 2)
        .map(s => s.label);

    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;

        let slime = null;
        let other = null;

        if (bodyA.label.startsWith('slime')) { slime = bodyA; other = bodyB; }
        else if (bodyB.label.startsWith('slime')) { slime = bodyB; other = bodyA; }

        if (slime) {
            // Collision Particles
            if (other.label !== 'booster' && other.label !== 'ground') {
                createExplosion(slime.position.x, slime.position.y, slime.render.fillStyle, 3);
            }

            // Review 5: Play SFX only for 1st and 2nd place slimes
            const isTopRanked = currentRanks.includes(slime.label);

            // Debug logging
            console.log('Collision:', slime.label, 'with', other.label, '| TopRanked:', isTopRanked, '| Ranks:', currentRanks);

            if (isTopRanked) {
                switch (other.label) {
                    case 'pin':
                        playSfxPin();
                        break;
                    case 'spinner':
                        playSfxSpinner();
                        break;
                    case 'slider':
                        playSfxSlider();
                        break;
                    case 'booster':
                        playSfxBooster();
                        break;
                    case 'spring':
                        playSfxSpring();
                        break;
                    default:
                        // Wall or other static obstacles
                        if (other.isStatic && other.label !== 'ground') {
                            playSfxWall();
                        }
                        break;
                }
            }

            if (other.label === 'booster') {
                // Review 9: Initialize duration-based boost
                slime.gameData.boostTimer = other.custom.duration * 1000;

                // Initial kick (Review 10: Doubled intensity)
                Body.setVelocity(slime, {
                    x: slime.velocity.x,
                    y: Math.max(slime.velocity.y * 3, 40) // Increased factor and min speed
                });
            }
        }
    }
});

function endGame() {
    isGameRunning = false;

    gameHud.style.display = 'none';
    resultsScreen.style.display = 'block';

    rankList.innerHTML = '';
    finishedSlimes.forEach((data, index) => {
        const li = document.createElement('li');
        let prizeText = data.prize ? ` - ${data.prize}` : '';
        li.textContent = `${index + 1}등: ${data.name}${prizeText}`;
        rankList.appendChild(li);
    });
}
