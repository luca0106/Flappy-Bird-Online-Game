// ===== MODERN FLAPPY BIRD 2026 =====
// Game Constants
const GRAVITY = 0.5;
const JUMP_STRENGTH = -10;
const PIPE_WIDTH = 100;
const PIPE_GAP = 170;
const PIPE_SPACING = 500;
const BIRD_SIZE = 30;


// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const isMobile = window.matchMedia('(pointer: coarse)').matches;

// Responsive canvas sizing
function resizeCanvas() {
    const gameScreen = document.getElementById('gameScreen');
    if (!gameScreen) return;
    
    const gameHeader = document.querySelector('.game-header');
    const headerHeight = gameHeader ? gameHeader.offsetHeight : 0;
    
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight - headerHeight;
    
    canvas.width = availableWidth;
    canvas.height = availableHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

if (isMobile) {
    canvas.style.touchAction = 'none';
}

// ===== AUDIO CONTROLLER =====
const audioController = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },
    playTone(freq, type, duration, vol, slideFreq) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
        }
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    playJumpSound() {
        this.playTone(300, 'sine', 0.15, 0.1, 600);
    },
    playScoreSound() {
        this.playTone(800, 'square', 0.1, 0.05);
        setTimeout(() => this.playTone(1200, 'square', 0.15, 0.05), 100);
    },
    playCrashSound() {
        this.playTone(150, 'sawtooth', 0.3, 0.1, 50);
    }
};

// ===== PARTICLE SYSTEM =====
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.velocityX = (Math.random() - 0.5) * 6;
        this.velocityY = (Math.random() - 0.5) * 6;
        this.life = 1;
        this.color = ['#00d4ff', '#ffd60a', '#ff006e'][Math.floor(Math.random() * 3)];
        this.size = Math.random() * 4 + 2;
    }

    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.velocityY += GRAVITY * 0.3;
        this.life -= 0.02;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ===== BIRD OBJECT =====
const bird = {
    x: 0,
    y: 0,
    width: BIRD_SIZE,
    height: BIRD_SIZE,
    velocityY: 0,
    color: '#ffd60a',
    rotation: 0,
    maxRotation: Math.PI / 4,
    flapCounter: 0,
    trail: [],

    init(canvasHeight) {
        this.x = canvas.width * 0.12;
        this.y = canvasHeight / 2;
        this.velocityY = 0;
        this.rotation = 0;
        this.flapCounter = 0;
        this.trail = [];
    },

    update() {
        this.velocityY += GRAVITY;
        this.y += this.velocityY;

        // Rotation based on velocity
        if (this.velocityY < -5) {
            this.rotation = -this.maxRotation;
        } else if (this.velocityY > 5) {
            this.rotation = this.maxRotation;
        } else {
            this.rotation = (this.velocityY / 15) * this.maxRotation;
        }

        this.flapCounter += 0.3;

        // Add current state to the trail
        this.trail.push({
            x: this.x,
            y: this.y,
            rotation: this.rotation
        });

        // Limit trail length
        if (this.trail.length > 15) { // Adjust for longer/shorter trail
            this.trail.shift();
        }
    },

    draw() {
        this.drawTrail();
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);

        // Bird body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bird wing (animated)
        const wingYOffset = Math.sin(this.flapCounter) * 3;
        ctx.fillStyle = '#ffb700';
        ctx.beginPath();
        ctx.ellipse(-5, wingYOffset, 6, 8, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(6, -3, 4, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(7, -4, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.strokeStyle = '#ff6b00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, -2);
        ctx.lineTo(14, 0);
        ctx.lineTo(8, 2);
        ctx.stroke();

        ctx.restore();
    },

    drawTrail() {
        ctx.save();
        this.trail.forEach((p, index) => {
            const opacity = (index / this.trail.length) * 0.3; // Trail is subtle
            const sizeFactor = index / this.trail.length;

            ctx.save();
            // Go to the trail segment's position and apply its rotation
            ctx.translate(p.x + this.width / 2, p.y + this.height / 2);
            ctx.rotate(p.rotation);

            // Set style for the trail segment
            ctx.globalAlpha = opacity;
            ctx.fillStyle = this.color;

            // Draw a simple ellipse for the trail segment
            ctx.beginPath();
            ctx.ellipse(0, 0, (this.width / 2) * sizeFactor, (this.height / 2) * sizeFactor, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });
        ctx.restore();
    },

    jump() {
        this.velocityY = JUMP_STRENGTH;
        gameState.particles.push(...createParticles(this.x, this.y, 5));
        audioController.playJumpSound();
    }
};

// ===== PIPE OBJECT =====
class Pipe {
    constructor(x, canvasHeight) {
        this.x = x;
        this.width = PIPE_WIDTH;
        // Gap decreases with difficulty
        const gapReduction = (gameState.difficulty - 1) * 8;
        this.gap = Math.max(120, PIPE_GAP - gapReduction);
        const minGap = 60;
        const maxGap = canvasHeight - this.gap - 60;
        this.gapY = Math.random() * (maxGap - minGap) + minGap;
        this.gapY = Math.max(minGap, Math.min(maxGap, this.gapY));
        this.scored = false;

        // Moving Pipes Logic
        this.isMoving = false;
        this.moveDirection = 0;
        this.moveSpeed = 0;
        this.minGapY = minGap;
        this.maxGapY = maxGap;

        if (gameState.score >= 10 || gameState.difficulty > 2) {
            // 30% chance to be a moving pipe
            if (Math.random() < 0.3) {
                this.isMoving = true;
                this.moveDirection = Math.random() < 0.5 ? 1 : -1;
                this.moveSpeed = 1 + (gameState.difficulty * 0.2);
            }
        }
    }

    update() {
        // Speed increases significantly with difficulty
        const baseSpeed = 4.75;
        const speedIncrease = (gameState.difficulty - 1) * 1.2;
        this.x -= (baseSpeed + speedIncrease);

        if (this.isMoving) {
            this.gapY += this.moveDirection * this.moveSpeed;
            if (this.gapY <= this.minGapY) {
                this.gapY = this.minGapY;
                this.moveDirection *= -1;
            } else if (this.gapY >= this.maxGapY) {
                this.gapY = this.maxGapY;
                this.moveDirection *= -1;
            }
        }
    }

    draw({ pipeColor, pipeDarkColor }) {
        const pipeGradient = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
        pipeGradient.addColorStop(0, pipeDarkColor);
        pipeGradient.addColorStop(0.5, pipeColor);
        pipeGradient.addColorStop(1, pipeDarkColor);

        // Top pipe
        ctx.fillStyle = pipeGradient;
        ctx.fillRect(this.x, 0, this.width, this.gapY);

        // Bottom pipe
        ctx.fillRect(this.x, this.gapY + this.gap, this.width, canvas.height - (this.gapY + this.gap));

        // Pipe caps for 3D effect
        const capHeight = 20;
        ctx.fillStyle = pipeGradient;
        // Top pipe cap
        ctx.fillRect(this.x - 5, this.gapY - capHeight, this.width + 10, capHeight);
        // Bottom pipe cap
        ctx.fillRect(this.x - 5, this.gapY + this.gap, this.width + 10, capHeight);

        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.strokeRect(this.x - 5, this.gapY - capHeight, this.width + 10, capHeight);
        ctx.strokeRect(this.x - 5, this.gapY + this.gap, this.width + 10, capHeight);
    }

    isOffScreen() {
        return this.x + this.width < 0;
    }

    checkCollision(bird) {
        // Hitbox tuning: Shrink the bird's effective collision box by roughly 20%
        const hitboxPaddingX = bird.width * 0.2;
        const hitboxPaddingY = bird.height * 0.2;
        
        const birdLeft = bird.x + hitboxPaddingX;
        const birdRight = bird.x + bird.width - hitboxPaddingX;
        const birdTop = bird.y + hitboxPaddingY;
        const birdBottom = bird.y + bird.height - hitboxPaddingY;
        
        if (birdRight > this.x && birdLeft < this.x + this.width) {
            if (birdTop < this.gapY || birdBottom > this.gapY + this.gap) {
                return true;
            }
        }
        return false;
    }

    checkScore(bird) {
        if (!this.scored && bird.x > this.x + this.width) {
            this.scored = true;
            return true;
        }
        return false;
    }
}

// ===== PARTICLE EFFECT HELPER =====
function createParticles(x, y, count) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y));
    }
    return particles;
}

// ===== COLOR AND PARALLAX HELPER =====
function lerpColor(color1, color2, t) {
    const r = Math.round(color1[0] + (color2[0] - color1[0]) * t);
    const g = Math.round(color1[1] + (color2[1] - color1[1]) * t);
    const b = Math.round(color1[2] + (color2[2] - color1[2]) * t);
    if (color1.length > 3 || color2.length > 3) {
        const a1 = color1.length > 3 ? color1[3] : 1;
        const a2 = color2.length > 3 ? color2[3] : 1;
        const a = a1 + (a2 - a1) * t;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
}

const drawParallaxElement = (type, offset, spacing, color) => {
    if (color.endsWith('0)')) return; // Don't draw if fully transparent

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    switch (type) {
        case 'cloud':
            for (let i = -(offset % spacing); i < canvas.width + spacing; i += spacing) {
                ctx.beginPath();
                ctx.arc(i + 50, canvas.height * 0.3, 40, 0, Math.PI, true);
                ctx.arc(i + 100, canvas.height * 0.3 + 10, 50, 0, Math.PI, true);
                ctx.arc(i + 150, canvas.height * 0.3, 40, 0, Math.PI, true);
                ctx.fill();
            }
            break;
        case 'star':
            // Stars are static and don't use offset/spacing
            gameState.stars.forEach(star => {
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });
            break;
        case 'vine':
            for (let i = -(offset % spacing); i < canvas.width + spacing; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.quadraticCurveTo(i + Math.random() * 40 - 20, canvas.height * 0.1, i + Math.random() * 20 - 10, canvas.height * 0.2);
                ctx.stroke();
            }
            break;
        case 'mountain':
             for (let i = -(offset % spacing); i < canvas.width + spacing; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i, canvas.height - 20);
                const peakHeight = 150 + ((Math.abs(Math.round(i)) / spacing) % 3) * 30;
                ctx.lineTo(i + spacing / 2, canvas.height - 20 - peakHeight);
                ctx.lineTo(i + spacing, canvas.height - 20);
                ctx.fill();
            }
            break;
        case 'tree':
            for (let i = -(offset % spacing); i < canvas.width + spacing; i += spacing) {
                ctx.beginPath();
                ctx.moveTo(i + 10, canvas.height - 20);
                ctx.lineTo(i + 30, canvas.height - 100);
                ctx.lineTo(i + 50, canvas.height - 20);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(i + 60, canvas.height - 20);
                ctx.lineTo(i + 90, canvas.height - 150);
                ctx.lineTo(i + 120, canvas.height - 20);
                ctx.fill();
            }
            break;
    }
};

const themes = [
    { // 0: Day
        name: 'Day',
        sky: { top: [135, 206, 235], bottom: [224, 246, 255] },
        pipe: { color: [0, 212, 80], darkColor: [0, 143, 58] },
        ground: [168, 213, 186],
        parallax: {
            layer1: { color: [255, 255, 255, 0.15], type: 'cloud' },
            layer2: { color: [0, 0, 0, 0.1], type: 'mountain' }
        }
    },
    { // 1: Sunset
        name: 'Sunset',
        sky: { top: [255, 126, 103], bottom: [255, 214, 165] },
        pipe: { color: [194, 110, 0], darkColor: [140, 67, 0] },
        ground: [209, 163, 119],
        parallax: {
            layer1: { color: [255, 230, 200, 0.2], type: 'cloud' },
            layer2: { color: [0, 0, 0, 0.15], type: 'mountain' }
        }
    },
    { // 2: Night
        name: 'Night',
        sky: { top: [10, 14, 39], bottom: [22, 33, 62] },
        pipe: { color: [80, 96, 130], darkColor: [44, 62, 80] },
        ground: [52, 73, 94],
        parallax: {
            layer1: { color: [255, 255, 255, 0.3], type: 'star' },
            layer2: { color: [0, 0, 0, 0.2], type: 'mountain' }
        }
    },
    { // 3: Jungle
        name: 'Jungle',
        sky: { top: [46, 139, 87], bottom: [143, 188, 143] },
        pipe: { color: [139, 69, 19], darkColor: [92, 47, 14] },
        ground: [107, 142, 35],
        parallax: {
            layer1: { color: [0, 100, 0, 0.2], type: 'vine' },
            layer2: { color: [34, 54, 14, 0.4], type: 'tree' }
        }
    }
];

// ===== UNLOCKABLE SKINS =====
const skins = [
    { name: 'Classic Yellow', color: '#ffd60a', scoreNeeded: 0 },
    { name: 'Neon Pink', color: '#ff006e', scoreNeeded: 20 },
    { name: 'Cyan Blue', color: '#00d4ff', scoreNeeded: 50 },
    { name: 'Matrix Green', color: '#00ff00', scoreNeeded: 100 }
];

let activeSkinIndex = parseInt(localStorage.getItem('flappyBirdSkinIndex')) || 0;
// Ensure loaded skin is actually unlocked
const savedBestScore = parseInt(localStorage.getItem('flappyBirdBestScore')) || 0;
if (savedBestScore < skins[activeSkinIndex].scoreNeeded) {
    activeSkinIndex = 0;
    localStorage.setItem('flappyBirdSkinIndex', 0);
}

// ===== DIFFICULTY PROGRESSION =====
function calculateDifficulty() {
    // Difficulty increases every 5 points more aggressively
    gameState.difficulty = 1 + Math.floor(gameState.score / 5) * 0.25;
    return gameState.difficulty;
}

// ===== GAME STATE =====
const gameState = {
    score: 0,
    bestScore: localStorage.getItem('flappyBirdBestScore') || 0,
    gameOver: false,
    gameActive: false,
    countingDown: false,
    paused: false,
    pipes: [],
    lastPipeX: 0,
    particles: [],
    stars: [],
    difficulty: 1,
    groundOffset: 0,
    bgOffset1: 0,
    bgOffset2: 0,
    shakeTime: 0,
    shakeMagnitude: 0
};

// ===== BACKEND & AUTH STATE =====
const API_URL = CONFIG.API_URL;
let authToken = localStorage.getItem('flappyBirdAuthToken') || null;
let currentUser = null;

// ===== DOM ELEMENTS =====
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const startButton = document.getElementById('startButton');
const menuButton = document.getElementById('menuButton');
const gameOverModal = document.getElementById('gameOverModal');
const restartButton = document.getElementById('restartButton');
const menuBackButton = document.getElementById('menuBackButton');
const bestScoreDisplay = document.getElementById('bestScore');
const finalScoreDisplay = document.getElementById('finalScore');
const bestScoreModalDisplay = document.getElementById('bestScoreModal');
const currentScoreDisplay = document.getElementById('currentScore');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownText = document.getElementById('countdownText');
const skinSelector = document.getElementById('skinSelector');
// Auth/Profile Elements
const userProfile = document.getElementById('userProfile');
const guestView = document.getElementById('guestView');
const welcomeMessage = document.getElementById('welcomeMessage');
const logoutButton = document.getElementById('logoutButton');
const loginPageButton = document.getElementById('loginPageButton');
const leaderboardList = document.getElementById('leaderboardList');

let countdownInterval;

function renderSkinSelector() {
    if (!skinSelector) return;
    skinSelector.innerHTML = '';
    skins.forEach((skin, index) => {
        const skinEl = document.createElement('div');
        const isUnlocked = gameState.bestScore >= skin.scoreNeeded;
        
        skinEl.className = `skin-option ${isUnlocked ? 'unlocked' : 'locked'} ${index === activeSkinIndex ? 'active' : ''}`;
        
        if (isUnlocked) {
            skinEl.style.backgroundColor = skin.color;
            skinEl.addEventListener('click', () => {
                activeSkinIndex = index;
                localStorage.setItem('flappyBirdSkinIndex', index);
                renderSkinSelector();
            });
        }
        
        const tooltip = document.createElement('div');
        tooltip.className = 'skin-tooltip';
        tooltip.textContent = isUnlocked ? skin.name : `Unlocks at ${skin.scoreNeeded}`;
        skinEl.appendChild(tooltip);
        
        skinSelector.appendChild(skinEl);
    });
}

// ===== INITIALIZATION =====
function initGame() {
    gameState.score = 0;
    gameState.gameOver = false;
    gameState.gameActive = false; // Wait for countdown
    gameState.paused = false;
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (pauseOverlay) pauseOverlay.style.display = 'none';
    gameState.pipes = [];
    gameState.lastPipeX = canvas.width;
    gameState.particles = [];
    gameState.stars = [];
    gameState.groundOffset = 0;
    gameState.bgOffset1 = 0;
    gameState.bgOffset2 = 0;
    bird.color = skins[activeSkinIndex].color; // Set bird color to active skin
    bird.init(canvas.height);
    updateScoreDisplay();
    gameOverModal.style.display = 'none';
    if (currentScoreDisplay) currentScoreDisplay.textContent = '0';
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    gameState.countingDown = true;
    gameState.gameActive = false;
    countdownOverlay.style.display = 'flex';
    let count = 3;
    countdownText.textContent = count;
    
    countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownText.textContent = count;
        } else if (count === 0) {
            countdownText.textContent = 'GO!';
        } else {
            clearInterval(countdownInterval);
            countdownOverlay.style.display = 'none';
            gameState.countingDown = false;
            gameState.gameActive = true;
            bird.jump(); // Give player a small initial hop
        }
    }, 1000);
}

function startGame() {
    startScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    initGame();
    startCountdown();
}

function goToMenu() {
    if (countdownInterval) clearInterval(countdownInterval);
    gameScreen.style.display = 'none';
    startScreen.style.display = 'flex';
    gameState.gameActive = false;
    gameState.gameOver = false;
    gameState.countingDown = false;
    gameState.paused = false;
    countdownOverlay.style.display = 'none';
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (pauseOverlay) pauseOverlay.style.display = 'none';
    renderSkinSelector(); // Refresh skins in case a new score was reached
    updateScoreDisplay(); // Update best score display
    fetchAndRenderLeaderboard(); // Refresh leaderboard
}

function showGameOver() {
    if (isMobile && navigator.vibrate) navigator.vibrate([60, 40, 60]);
    gameOverModal.style.display = 'flex';
    finalScoreDisplay.textContent = gameState.score;
    // If logged in, submit score to backend. Otherwise, use local best score.
    if (currentUser) {
        submitScore(gameState.score);
        // The best score will be updated after submission, here we just show the local one for now
        bestScoreModalDisplay.textContent = Math.max(gameState.bestScore, gameState.score);
    } else {
        bestScoreModalDisplay.textContent = Math.max(gameState.bestScore, gameState.score);
    }

    if (gameState.score > gameState.bestScore) {
        gameState.bestScore = gameState.score;
        localStorage.setItem('flappyBirdBestScore', gameState.bestScore);
        bestScoreDisplay.textContent = gameState.bestScore;
    }
}

function restart() {
    initGame();
    gameOverModal.style.display = 'none';
    gameState.gameActive = true;
    bird.jump(); // Give player a small initial hop
}

function togglePause() {
    gameState.paused = !gameState.paused;
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (pauseOverlay) {
        pauseOverlay.style.display = gameState.paused ? 'flex' : 'none';
    }
}

function triggerShake(magnitude, duration) {
    gameState.shakeMagnitude = magnitude;
    gameState.shakeTime = duration;
}

// ===== BACKEND API FUNCTIONS =====

function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('flappyBirdAuthToken');
    // Reset to guest view without reloading the page
    gameState.bestScore = localStorage.getItem('flappyBirdBestScore') || 0;
    updateUIAfterLogout();
}

async function fetchUserData() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_URL}/user/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.status === 401 || response.status === 403) {
            // Token is genuinely invalid or expired — clear it
            handleLogout();
            return;
        }

        if (!response.ok) {
            // Server error or network issue — keep the token, fall back to guest view
            throw new Error('Server error.');
        }

        const user = await response.json();
        currentUser = user;
        gameState.bestScore = user.bestScore ?? user.best_score ?? 0;
        updateUIAfterLogin();
    } catch (error) {
        // Network failure (offline, timeout, etc.) — don't erase the token
        console.error('Could not reach server.', error);
        guestView.style.display = 'flex';
        userProfile.style.display = 'none';
        gameState.bestScore = parseInt(localStorage.getItem('flappyBirdBestScore')) || 0;
        updateScoreDisplay();
    }
}

async function fetchAndRenderLeaderboard() {
    if (!leaderboardList) return;

    try {
        const response = await fetch(`${API_URL}/leaderboard`);
        if (!response.ok) throw new Error('Failed to fetch leaderboard');
        const leaderboardData = await response.json();

        leaderboardList.innerHTML = ''; // Clear previous list

        if (leaderboardData.length === 0) {
            leaderboardList.innerHTML = '<li>Be the first to set a score!</li>';
            return;
        }

        leaderboardData.forEach((player, index) => {
            const li = document.createElement('li');
            
            const rank = document.createElement('span');
            rank.className = 'leaderboard-rank';
            rank.textContent = `${index + 1}.`;

            const name = document.createElement('span');
            name.className = 'leaderboard-name';
            name.textContent = player.username;

            const score = document.createElement('span');
            score.className = 'leaderboard-score';
            score.textContent = player.best_score;

            li.appendChild(rank);
            li.appendChild(name);
            li.appendChild(score);

            leaderboardList.appendChild(li);
        });

    } catch (error) {
        console.error('Leaderboard error:', error);
        if (leaderboardList) {
            leaderboardList.innerHTML = '<li>Could not load leaderboard.</li>';
        }
    }
}

async function submitScore(score) {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_URL}/scores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ score })
        });
        const data = await response.json();
        if (response.ok && data.newBestScore !== undefined) {
            gameState.bestScore = data.newBestScore;
            updateScoreDisplay();
        }
    } catch (error) {
        console.error('Failed to submit score:', error);
    }
}

function updateUIAfterLogin() {
    if (currentUser) {
        guestView.style.display = 'none';
        userProfile.style.display = 'flex';
        welcomeMessage.textContent = `Welcome, ${currentUser.username}!`;
        updateScoreDisplay();
    }
}

function updateUIAfterLogout() {
    guestView.style.display = 'flex';
    userProfile.style.display = 'none';
    updateScoreDisplay();
}

function updateScoreDisplay() {
    const currentBest = gameState.bestScore || 0;
    bestScoreModalDisplay.textContent = currentBest;

    if (currentUser) {
        // Update score in the logged-in user profile
        bestScoreDisplay.textContent = currentBest;
    }
}

// Check for existing token on page load
async function checkForExistingSession() {
    if (authToken) {
        // Dacă există un token, încercăm întotdeauna să îl validăm cu backend-ul.
        // Backend-ul îl va respinge dacă este expirat sau invalid, iar funcția
        // fetchUserData va apela handleLogout() pentru a curăța sesiunea.
        await fetchUserData();
    } else {
        // Dacă nu există token, configurăm imediat interfața pentru vizitator.
        guestView.style.display = 'flex';
        userProfile.style.display = 'none';
        gameState.bestScore = localStorage.getItem('flappyBirdBestScore') || 0;
        updateScoreDisplay();
    }
}

// ===== EVENT LISTENERS =====
startButton.addEventListener('click', () => {
    audioController.init();
    startGame();
});
menuButton.addEventListener('click', goToMenu);
restartButton.addEventListener('click', () => {
    audioController.init();
    restart();
});
menuBackButton.addEventListener('click', goToMenu);

// Auth Navigation
loginPageButton.addEventListener('click', () => {
    window.location.href = 'login.html';
});
logoutButton.addEventListener('click', handleLogout);

document.addEventListener('keydown', (e) => {
    audioController.init();
    if (e.key === ' ') {
        e.preventDefault();
        if (gameState.gameActive && !gameState.gameOver && !gameState.paused) {
            bird.jump();
        } else if (gameState.gameActive && gameState.gameOver) {
            restart();
        }
    } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (gameState.gameActive && !gameState.gameOver && !gameState.countingDown) {
            togglePause();
        }
    }
});

canvas.addEventListener('click', () => {
    audioController.init();
    if (gameState.gameActive && !gameState.gameOver && !gameState.paused) {
        bird.jump();
    } else if (gameState.gameActive && gameState.gameOver) {
        restart();
    }
});

if (isMobile) {
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        audioController.init();
        if (gameState.gameActive && !gameState.gameOver && !gameState.paused) {
            bird.jump();
            if (navigator.vibrate) navigator.vibrate(15);
        } else if (gameState.gameActive && gameState.gameOver) {
            restart();
        } else if (gameState.gameActive && gameState.paused) {
            togglePause();
        }
    }, { passive: false });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const pauseButton = document.getElementById('pauseButton');
    if (pauseButton) {
        pauseButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (gameState.gameActive && !gameState.gameOver && !gameState.countingDown) {
                togglePause();
            }
        }, { passive: false });
    }
}

// ===== UPDATE GAME LOGIC =====
function update() {
    if (!gameState.gameActive || gameState.gameOver) return;

    // Calculate current difficulty
    calculateDifficulty();

    // Update bird
    bird.update();

    // Check bird boundaries
    if (bird.y + bird.height > canvas.height || bird.y < 0) {
        gameState.gameOver = true;
        audioController.playCrashSound();
        triggerShake(15, 20);
        showGameOver();
        return;
    }

    // Generate pipes - based on horizontal spacing
    const currentSpacing = Math.max(250, PIPE_SPACING - (gameState.difficulty - 1) * 40);
    const lastPipe = gameState.pipes.length > 0 ? gameState.pipes[gameState.pipes.length - 1] : null;
    if (!lastPipe || (canvas.width - lastPipe.x) > currentSpacing) {
        const spawnX = !lastPipe ? Math.floor(canvas.width * 0.6) : canvas.width;
        const newPipe = new Pipe(spawnX, canvas.height);
        gameState.pipes.push(newPipe);

        gameState.lastPipeX = canvas.width; // Keep for backward compatibility of state object
    }

    // Update pipes
    gameState.pipes = gameState.pipes.filter(pipe => !pipe.isOffScreen());
    for (const pipe of gameState.pipes) {
        pipe.update();

        // Check collision
        if (pipe.checkCollision(bird)) {
            gameState.gameOver = true;
            gameState.particles.push(...createParticles(bird.x, bird.y, 15));
            audioController.playCrashSound();
            triggerShake(15, 20);
            showGameOver();
            break; // stop processing — prevents score incrementing or double showGameOver
        }

        // Check score
        if (pipe.checkScore(bird)) {
            gameState.score++;
            gameState.particles.push(...createParticles(canvas.width / 2, canvas.height / 2, 8));
            audioController.playScoreSound();
            if (currentScoreDisplay) currentScoreDisplay.textContent = gameState.score;
        }
    }

    // Update ground offset for scrolling effect
    const baseSpeed = 4.75;
    const speedIncrease = (gameState.difficulty - 1) * 1.2;
    const currentSpeed = baseSpeed + speedIncrease;
    gameState.groundOffset = (gameState.groundOffset + currentSpeed) % 40;

    // Update background parallax offsets
    gameState.bgOffset1 = (gameState.bgOffset1 + currentSpeed * 0.15) % 300;
    gameState.bgOffset2 = (gameState.bgOffset2 + currentSpeed * 0.4) % 250;

    // Update particles
    gameState.particles = gameState.particles.filter(p => p.life > 0);
    gameState.particles.forEach(p => p.update());
}

// ===== DRAW GAME =====
function draw() {
    // Clear canvas on the original, untransformed context
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save the context state before applying transformations
    ctx.save();

    // Apply screen shake if active
    if (gameState.shakeTime > 0) {
        const shakeX = (Math.random() - 0.5) * gameState.shakeMagnitude;
        const shakeY = (Math.random() - 0.5) * gameState.shakeMagnitude;
        ctx.translate(shakeX, shakeY);
        gameState.shakeTime--;
        if (gameState.shakeTime <= 0) gameState.shakeMagnitude = 0;
    }

    // Calculate Theme
    const cycleLength = 10; // Points per theme
    const themeCount = themes.length;
    const normalizedScore = gameState.score % (cycleLength * themeCount);
    const themeIndex = Math.floor(normalizedScore / cycleLength);
    const nextThemeIndex = (themeIndex + 1) % themeCount;
    const t = (normalizedScore % cycleLength) / cycleLength;

    const currentTheme = themes[themeIndex];
    const nextTheme = themes[nextThemeIndex];

    // Interpolate colors
    const topColor = lerpColor(currentTheme.sky.top, nextTheme.sky.top, t);
    const bottomColor = lerpColor(currentTheme.sky.bottom, nextTheme.sky.bottom, t);
    const groundColor = lerpColor(currentTheme.ground, nextTheme.ground, t);
    const pipeColor = lerpColor(currentTheme.pipe.color, nextTheme.pipe.color, t);
    const pipeDarkColor = lerpColor(currentTheme.pipe.darkColor, nextTheme.pipe.darkColor, t);

    // Draw Sky
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, topColor);
    bgGradient.addColorStop(1, bottomColor);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // --- Parallax Drawing with Cross-Fade ---

    // Manage stars array: populate if needed, clear if not.
    const needsStars = currentTheme.parallax.layer1.type === 'star' || nextTheme.parallax.layer1.type === 'star';
    if (needsStars && gameState.stars.length === 0) {
        for (let i = 0; i < 100; i++) {
            gameState.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height * 0.7,
                size: Math.random() * 2 + 1
            });
        }
    } else if (!needsStars && gameState.stars.length > 0) {
        gameState.stars = [];
    }
    
    // Draw Parallax Layer 1 (cross-fading)
    const parallaxSpacing1 = 300;
    const c1 = currentTheme.parallax.layer1;
    const n1 = nextTheme.parallax.layer1;
    drawParallaxElement(c1.type, gameState.bgOffset1, parallaxSpacing1, `rgba(${c1.color[0]}, ${c1.color[1]}, ${c1.color[2]}, ${c1.color[3] * (1 - t)})`);
    drawParallaxElement(n1.type, gameState.bgOffset1, parallaxSpacing1, `rgba(${n1.color[0]}, ${n1.color[1]}, ${n1.color[2]}, ${n1.color[3] * t})`);

    // Draw Parallax Layer 2 (cross-fading)
    const parallaxSpacing2 = 250;
    const c2 = currentTheme.parallax.layer2;
    const n2 = nextTheme.parallax.layer2;
    drawParallaxElement(c2.type, gameState.bgOffset2, parallaxSpacing2, `rgba(${c2.color[0]}, ${c2.color[1]}, ${c2.color[2]}, ${c2.color[3] * (1 - t)})`);
    drawParallaxElement(n2.type, gameState.bgOffset2, parallaxSpacing2, `rgba(${n2.color[0]}, ${n2.color[1]}, ${n2.color[2]}, ${n2.color[3] * t})`);

    // Draw ground
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

    // Ground pattern
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let i = -(gameState.groundOffset); i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, canvas.height - 20);
        ctx.lineTo(i + 10, canvas.height);
        ctx.stroke();
    }

    // Draw pipes
    gameState.pipes.forEach(pipe => pipe.draw({ pipeColor, pipeDarkColor }));

    // Draw particles
    gameState.particles.forEach(p => p.draw(ctx));

    // Draw bird
    bird.draw();

    // Restore the context to its pre-shake state
    ctx.restore();
}

// ===== GAME LOOP =====
function gameLoop() {
    if (!gameState.paused) {
        update();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

// --- Inițializarea Aplicației ---
// Folosim o funcție asincronă pentru a ne asigura că totul se încarcă în ordinea corectă,
// prevenind erorile de tip "race condition".
async function initializeApp() {
    // 1. Verifică dacă există o sesiune activă și actualizează interfața. Așteptăm finalizarea.
    await checkForExistingSession(); 
    
    // 2. Acum că știm dacă utilizatorul este logat (și avem scorul corect), încărcăm restul.
    fetchAndRenderLeaderboard();
    renderSkinSelector();

    // 3. Pornește bucla principală a jocului.
    gameLoop();
}

// Rulează aplicația
initializeApp();
