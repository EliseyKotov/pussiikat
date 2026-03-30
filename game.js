'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let isMobile = window.innerWidth <= 768;
let gameLoopRunning = false;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    isMobile = window.innerWidth <= 768;
});

const STORAGE_KEY = 'catVsMiceGameData';

function loadGameData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
}

function saveGameData() {
    const data = {
        upgrades: gameState.upgrades,
        activeSkin: gameState.activeSkin,
        ownedSkins: gameState.ownedSkins,
        totalScore: gameState.totalScore,
        maxWave: gameState.maxWave,
        achievements: Array.from(gameState.achievements),
        completedQuests: gameState.completedQuests,
        totalKills: gameState.totalKills,
        totalAccuracy: gameState.totalAccuracy,
        totalShots: gameState.totalShots
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const WAVE_BONUSES = [
    { name: '💰 +200 молока', type: 'milk', value: 200 },
    { name: '❤️ +50 здоровья', type: 'health', value: 50 },
    { name: '🔥 x1.5 мультипликатор', type: 'multiplier', value: 1.5 },
    { name: '⚡ Ускорение бесплатно', type: 'booster', value: 'speedBoost' },
    { name: '🛡️ Щит бесплатно', type: 'booster', value: 'shield' },
    { name: '💥 x2 урон', type: 'damage', value: 2 }
];

function getWaveBonusForWave(wave) {
    const seed = wave * 12345;
    const index = (seed % WAVE_BONUSES.length);
    return WAVE_BONUSES[index];
}

const WEEKLY_QUESTS = [
    { id: 'butcher', name: '🥩 Мясник', desc: 'Убить 100 врагов', type: 'totalKills', goal: 100, reward: 200, rewardSkin: 'king', current: 0 },
    { id: 'hunter', name: '🎯 Охотник', desc: 'Пройти волну за ≤20 сек', type: 'waveSpeed', goal: 20, reward: 150, current: 0 },
    { id: 'rich', name: '💰 Богач', desc: 'Заработать 1000 молока за волну', type: 'waveMilk', goal: 1000, reward: 200, current: 0 },
    { id: 'fastman', name: '⚡ Комбо-мастер', desc: 'Создать комбо x5', type: 'combo', goal: 5, reward: 100, rewardSkin: 'moon', current: 0 }
];

const SKINS = {
    tabby: { name: 'Табби', emoji: '🐱', bonus: 'Обычный котик', bonusType: 'none', cost: 0, premium: false },
    warrior: { name: 'Боевой', emoji: '😾', bonus: '+25% урона', bonusType: 'damage', value: 1.25, cost: 150, premium: false },
    sniper: { name: 'Снайпер', emoji: '🐯', bonus: '+50% размер', bonusType: 'bulletSize', value: 1.5, cost: 180, premium: false },
    doctor: { name: 'Доктор', emoji: '🐱‍⚕️', bonus: '+30% HP', bonusType: 'health', value: 1.3, cost: 700, premium: true },
    gunner: { name: 'Пулемётчик', emoji: '🐱‍🐉', bonus: '+50% скорость', bonusType: 'fireRate', value: 1.5, cost: 750, premium: true },
    ninja: { name: 'Ниндзя', emoji: '🐱‍👓', bonus: '+20% всё', bonusType: 'all', value: 1.2, cost: 800, premium: true },
    king: { name: '👑 Король', emoji: '👑', bonus: '+40% всё', bonusType: 'all', value: 1.4, cost: 0, premium: true, questReward: true },
    moon: { name: '🌙 Луна', emoji: '🌙', bonus: '+30% скорость', bonusType: 'fireRate', value: 1.3, cost: 0, premium: true, questReward: true },
    star: { name: '⭐ Звезда', emoji: '⭐', bonus: '+50% комбо', bonusType: 'combo', value: 1.5, cost: 0, premium: true, questReward: true }
};

const ACHIEVEMENTS = {
    firstBlood: { name: 'Первая кровь', desc: 'Убить 1 врага', icon: '🩸', check: () => gameState.totalKills >= 1 },
    collector: { name: 'Коллекционер', desc: 'Купить все скины', icon: '👑', check: () => gameState.ownedSkins.length === Object.keys(SKINS).length },
    warrior: { name: 'Воин', desc: 'Убить 100 врагов', icon: '⚔️', check: () => gameState.totalKills >= 100 },
    legend: { name: 'Легенда', desc: 'Дойти до волны 20', icon: '⭐', check: () => gameState.maxWave >= 20 },
    comboMaster: { name: 'Мастер комбо', desc: 'Комбо x5', icon: '🔥', check: () => gameState.maxCombo >= 5 },
    speedRunner: { name: 'Спидраннер', desc: 'Пройти волну за 15 сек', icon: '⚡', check: () => false },
    noHit: { name: 'Непобедимый', desc: 'Пройти волну без урона', icon: '🛡️', check: () => false },
    richMan: { name: 'Богач', desc: 'Накопить 10000 молока', icon: '💰', check: () => gameState.totalScore >= 10000 },
    tenWaves: { name: 'Десятиволнец', desc: 'Пройти 10 волн', icon: '🌊', check: () => gameState.maxWave >= 10 },
    premiumSkins: { name: 'Премиум', desc: 'Получить премиум скин', icon: '💎', check: () => gameState.ownedSkins.some(s => SKINS[s]?.premium) }
};

const gameState = {
    currentWave: 1,
    score: 0,
    kills: 0,
    milk: 0,
    isGameOver: false,
    isPaused: false,
    totalScore: 0,
    totalKills: 0,
    maxWave: 1,
    maxCombo: 0,
    combo: 0,
    lastKillTime: 0,
    screenShakeIntensity: 0,
    totalShots: 0,
    totalAccuracy: 0,
    waveShots: 0,
    waveHits: 0,
    waveStats: {
        waveStartTime: 0,
        damageReceivedThisWave: 0,
        milkThisWave: 0
    },
    upgrades: {
        damage: { level: 1, baseCost: 35 },
        bulletCount: { level: 1, baseCost: 120 },
        bulletSize: { level: 1, baseCost: 40 },
        health: { level: 1, baseCost: 70 }
    },
    activeBoosters: [],
    achievements: new Set(),
    activeSkin: 'tabby',
    ownedSkins: ['tabby'],
    completedQuests: {},
    waveBonus: null
};

const savedData = loadGameData();
if (savedData) {
    gameState.upgrades = savedData.upgrades;
    gameState.activeSkin = savedData.activeSkin;
    gameState.ownedSkins = savedData.ownedSkins;
    gameState.totalScore = savedData.totalScore;
    gameState.maxWave = savedData.maxWave;
    gameState.achievements = new Set(savedData.achievements || []);
    gameState.totalKills = savedData.totalKills || 0;
    gameState.completedQuests = savedData.completedQuests || {};
    gameState.totalAccuracy = savedData.totalAccuracy || 0;
    gameState.totalShots = savedData.totalShots || 0;
}

function startGame() {
    closeAllModals();
    gameState.currentWave = 1;
    gameState.waveBonus = getWaveBonusForWave(1);
    document.getElementById('mainMenu').classList.add('menu-hidden');
    document.getElementById('gameArea').classList.add('active');
    createWave(1);
    updateUI();
    if (!gameLoopRunning) {
        gameLoopRunning = true;
        gameLoop();
    }
}

function showStatsModal() {
    document.getElementById('statMaxWave').textContent = gameState.maxWave;
    document.getElementById('statTotalMilk').textContent = gameState.totalScore;
    document.getElementById('statTotalKills').textContent = gameState.totalKills;
    document.getElementById('statMaxCombo').textContent = gameState.maxCombo;
    openModal('statsModal');
}

function showAchievementsModal() {
    const list = document.getElementById('achievementsList');
    list.innerHTML = '';

    let unlockedCount = 0;
    Object.keys(ACHIEVEMENTS).forEach(key => {
        const achievement = ACHIEVEMENTS[key];
        const unlocked = gameState.achievements.has(key);
        if (unlocked) unlockedCount++;

        const div = document.createElement('div');
        div.className = 'achievement-item' + (unlocked ? ' unlocked' : '');
        div.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-name">${achievement.name}</div>
            <div class="achievement-desc">${achievement.desc}</div>
        `;
        list.appendChild(div);
    });

    document.getElementById('menuAchievements').textContent = `${unlockedCount}/10`;
    openModal('achievementsModal');
}

function showQuestsModal() {
    const list = document.getElementById('questsList');
    list.innerHTML = '';

    let completedCount = 0;
    WEEKLY_QUESTS.forEach(quest => {
        const completed = gameState.completedQuests[quest.id];
        if (completed) completedCount++;

        const div = document.createElement('div');
        div.className = 'quest-item';
        const progress = Math.min(100, (quest.current / quest.goal) * 100);
        
        div.innerHTML = `
            <div class="quest-header">
                <span class="quest-name">${quest.name}</span>
                <span class="quest-reward">${completed ? '✓' : quest.reward + ' 🥛'}</span>
            </div>
            <div class="quest-desc">${quest.desc}</div>
            <div class="quest-progress">
                <div class="quest-progress-bar" style="width: ${progress}%"></div>
            </div>
            <div class="quest-status">${quest.current}/${quest.goal}</div>
        `;
        list.appendChild(div);
    });

    document.getElementById('menuQuests').textContent = `${completedCount}/4`;
    openModal('questsModal');
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

function returnToMenu() {
    gameState.isGameOver = false;
    gameState.isPaused = false;
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('pauseOverlay').classList.remove('active');
    document.getElementById('gameArea').classList.remove('active');
    document.getElementById('mainMenu').classList.remove('menu-hidden');
    document.getElementById('pauseInfoPanel').classList.remove('active');
    document.getElementById('wavePauseScreen').style.display = 'none';
    updateMenuStats();
}

function updateMenuStats() {
    document.getElementById('menuMaxWave').textContent = gameState.maxWave;
    document.getElementById('menuTotalMilk').textContent = gameState.totalScore;
    
    let achievements = gameState.achievements.size;
    document.getElementById('menuAchievements').textContent = `${achievements}/10`;
    
    let completed = Object.values(gameState.completedQuests).filter(x => x).length;
    document.getElementById('menuQuests').textContent = `${completed}/4`;
}

let lastTime = performance.now();
let frameCount = 0;
let fps = 0;

function updateFPS() {
    const now = performance.now();
    frameCount++;
    if (now >= lastTime + 1000) {
        fps = frameCount;
        document.getElementById('fpsCounter').textContent = `FPS: ${fps}`;
        frameCount = 0;
        lastTime = now;
    }
}

const keys = { a: false, d: false };

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'a' || key === 'arrowleft') keys.a = true;
    if (key === 'd' || key === 'arrowright') keys.d = true;
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'a' || key === 'arrowleft') keys.a = false;
    if (key === 'd' || key === 'arrowright') keys.d = false;
});

const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.a = true; });
leftBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys.a = false; });
rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); keys.d = true; });
rightBtn.addEventListener('touchend', (e) => { e.preventDefault(); keys.d = false; });

canvas.addEventListener('click', (e) => {
    if (gameState.isPaused || gameState.isGameOver) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    player.shoot(x, y);
});

canvas.addEventListener('touchstart', (e) => {
    if (gameState.isPaused || gameState.isGameOver) return;
    const touch = e.touches[e.touches.length - 1];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    player.shoot(x, y);
}, { passive: true });

// Image sources – all keys match names used throughout the code
const imageSources = {
    cat:    'cat.png',
    mouse1: 'mouse1.png',
    mouse2: 'mouse2.png',
    mouse3: 'mouse3.png',
    mouse4: 'mouse4.png',
    mouse5: 'mouse5.png',
    boss:   'boss.png',
    house:  'house.jpg',
    garden: 'garden.jpg',
    room:   'room.jpg'
};

const images = {};
Object.keys(imageSources).forEach(key => { images[key] = new Image(); });

let currentBgImage = null;

// Preload all images and report progress
function preloadImages(onProgress, onComplete) {
    const keys = Object.keys(imageSources);
    let loaded = 0;
    keys.forEach(key => {
        const img = images[key];
        const finish = () => {
            loaded++;
            onProgress(loaded, keys.length);
            if (loaded === keys.length) onComplete();
        };
        img.onload = finish;
        img.onerror = () => {
            console.warn('Could not load image "' + key + '": ' + imageSources[key]);
            finish();
        };
        img.src = imageSources[key];
    });
}

function showLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'flex';
}

function hideLoadingScreen() {
    const screen = document.getElementById('loadingScreen');
    screen.style.opacity = '0';
    screen.style.transition = 'opacity 0.5s';
    setTimeout(() => { screen.style.display = 'none'; }, 500);
}

function updateLoadingProgress(loaded, total) {
    const pct = Math.round((loaded / total) * 100);
    document.getElementById('loadingProgressBar').style.width = pct + '%';
    document.getElementById('loadingProgressText').textContent = pct + '%';
}

function playSound(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        let osc, gain;
        
        if (type === 'shoot') {
            osc = audioContext.createOscillator();
            gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = 600;
            gain.gain.setValueAtTime(0.2, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.08);
        } else if (type === 'hit') {
            osc = audioContext.createOscillator();
            gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = 800;
            gain.gain.setValueAtTime(0.2, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.15);
        } else if (type === 'enemy-death') {
            osc = audioContext.createOscillator();
            gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.setValueAtTime(600, audioContext.currentTime);
            osc.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.3);
        } else if (type === 'combo') {
            osc = audioContext.createOscillator();
            gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.setValueAtTime(1000, audioContext.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1400, audioContext.currentTime + 0.1);
            gain.gain.setValueAtTime(0.25, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0, audioContext.currentTime + 0.1);
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.1);
        }
    } catch (e) {}
}

const player = {
    x: canvas.width / 2,
    y: canvas.height - 120,
    width: 80,
    height: 80,
    velocityX: 0,
    health: 100,
    maxHealth: 100,
    fireRate: 0,
    rotation: 0,
    breathingPhase: 0,
    
    getDamage() {
        let dmg = 10 + (gameState.upgrades.damage.level - 1) * 5;
        const skin = SKINS[gameState.activeSkin];
        if (skin.bonusType === 'damage' || skin.bonusType === 'all') dmg *= skin.value;
        if (gameState.activeBoosters.some(b => b.type === 'powerStrike')) dmg *= 2;
        return dmg;
    },

    getFireRate() {
        let rate = Math.max(3, 10 - (gameState.upgrades.bulletCount.level - 1) * 0.5);
        const skin = SKINS[gameState.activeSkin];
        if (skin.bonusType === 'fireRate' || skin.bonusType === 'all') rate /= skin.value;
        if (gameState.activeBoosters.some(b => b.type === 'quickDraw')) rate /= 3;
        return rate;
    },

    getBulletSize() {
        let size = 4 + (gameState.upgrades.bulletSize.level - 1) * 1.5;
        const skin = SKINS[gameState.activeSkin];
        if (skin.bonusType === 'bulletSize' || skin.bonusType === 'all') size *= skin.value;
        return size;
    },

    getBulletCount() {
        return gameState.upgrades.bulletCount.level;
    },

    getMaxHealth() {
        let hp = 100 + (gameState.upgrades.health.level - 1) * 20;
        const skin = SKINS[gameState.activeSkin];
        if (skin.bonusType === 'health' || skin.bonusType === 'all') hp *= skin.value;
        return hp;
    },

    getMaxSpeed() {
        let speed = 6;
        if (gameState.activeBoosters.some(b => b.type === 'speedBoost')) speed *= 1.5;
        return speed;
    },

    update() {
        const maxSpeed = this.getMaxSpeed();
        if (keys.a) this.velocityX = -maxSpeed;
        else if (keys.d) this.velocityX = maxSpeed;
        else this.velocityX *= 0.85;

        this.x += this.velocityX;

        if (this.x < 40) this.x = 40;
        if (this.x + 40 > canvas.width) this.x = canvas.width - 40;

        if (this.fireRate > 0) this.fireRate--;
        
        this.breathingPhase += 0.05;
    },

    takeDamage(amount) {
        if (gameState.activeBoosters.some(b => b.type === 'shield')) {
            amount *= 0.5;
        }
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        gameState.waveStats.damageReceivedThisWave += amount;
        playSound('hit');
        gameState.screenShakeIntensity = Math.max(gameState.screenShakeIntensity, amount / 5);
    },

    shoot(targetX, targetY) {
        if (this.fireRate <= 0) {
            const angle = Math.atan2(targetY - (this.y + this.height / 2), targetX - (this.x + this.width / 2));
            this.rotation = angle;
            
            const bulletCount = this.getBulletCount();
            
            for (let i = 0; i < bulletCount; i++) {
                const spread = (bulletCount > 1) ? (i - (bulletCount - 1) / 2) * 0.15 : 0;
                const finalAngle = angle + spread;
                
                bullets.push({
                    x: this.x + Math.cos(finalAngle) * 45,
                    y: this.y + Math.sin(finalAngle) * 45,
                    vx: Math.cos(finalAngle) * 9,
                    vy: Math.sin(finalAngle) * 9,
                    life: 120,
                    damage: this.getDamage(),
                    size: this.getBulletSize()
                });
            }

            gameState.totalShots++;
            gameState.waveShots++;
            this.fireRate = this.getFireRate();
            playSound('shoot');
        }
    },

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        const breathing = Math.sin(this.breathingPhase) * 0.05 + 0.95;
        ctx.scale(breathing, breathing);
        
        if (images.cat.complete && images.cat.naturalHeight !== 0) {
            ctx.drawImage(images.cat, -40, -40, 80, 80);
        } else {
            ctx.fillStyle = '#ff8c42';
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.fillRect(-10, -5, 5, 5);
            ctx.fillRect(10, -5, 5, 5);
        }

        if (gameState.activeBoosters.some(b => b.type === 'shield')) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 50, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
};

let enemies = [];
let bossActive = false;
let waveEnemySpawnCount = 0;
let waveEnemyTotal = 0;
let particles = [];

function createParticle(x, y, type, color = '#FFD700') {
    for (let i = 0; i < 3; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            life: 30,
            maxLife: 30,
            color: color,
            size: Math.random() * 3 + 1
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life--;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function applyScreenShake() {
    if (gameState.screenShakeIntensity > 0) {
        const offsetX = (Math.random() - 0.5) * gameState.screenShakeIntensity;
        const offsetY = (Math.random() - 0.5) * gameState.screenShakeIntensity;
        ctx.translate(offsetX, offsetY);
        gameState.screenShakeIntensity *= 0.9;
    }
}

function createEnemy(type) {
    const baseX = Math.random() * (canvas.width - 60) + 30;
    const baseY = Math.random() * (canvas.height / 2 - 60) + 30;

    if (type === 'normal') {
        const mouseType = Math.floor(Math.random() * 4) + 1;
        const mouseImg = images['mouse' + mouseType];
        const enemyHealth = 15 + gameState.currentWave * 2;

        return {
            type: 'normal',
            x: baseX,
            y: baseY,
            width: 40,
            height: 40,
            velocityX: (Math.random() - 0.5) * 2.5,
            velocityY: (Math.random() - 0.5) * 2.5,
            health: enemyHealth,
            maxHealth: enemyHealth,
            alive: true,
            knockback: { x: 0, y: 0, duration: 0 },
            spawned: false,
            spawnProgress: 0,
            breathing: Math.random() * Math.PI * 2,
            isHit: false,
            hitDuration: 0,

            update() {
                if (!this.spawned) {
                    this.spawnProgress += 0.05;
                    if (this.spawnProgress >= 1) {
                        this.spawned = true;
                    }
                }

                this.x += this.velocityX + this.knockback.x;
                this.y += this.velocityY + this.knockback.y;

                if (this.knockback.duration > 0) {
                    this.knockback.x *= 0.9;
                    this.knockback.y *= 0.9;
                    this.knockback.duration--;
                }

                if (this.hitDuration > 0) {
                    this.hitDuration--;
                }

                this.breathing += 0.05;

                if (this.x < 0 || this.x > canvas.width) this.velocityX *= -1;
                if (this.y < 0 || this.y > canvas.height / 1.5) this.velocityY *= -1;
            },

            takeDamage(amount, bulletX, bulletY) {
                const isCrit = Math.random() < 0.2;
                if (isCrit) {
                    amount *= 1.5;
                    showCritText(this.x, this.y);
                    createParticle(this.x, this.y, 'crit', '#FFD700');
                }

                this.health -= amount;
                this.isHit = true;
                this.hitDuration = 10;

                const angle = Math.atan2(this.y - bulletY, this.x - bulletX);
                this.knockback.x = Math.cos(angle) * 5;
                this.knockback.y = Math.sin(angle) * 5;
                this.knockback.duration = 5;

                gameState.totalAccuracy++;
                gameState.waveHits++;

                if (this.health <= 0) {
                    this.alive = false;
                    gameState.score += 50;
                    
                    let baseMilk = 10 + gameState.currentWave * 2;
                    let comboMultiplier = 1.0;
                    
                    if (gameState.combo >= 10) comboMultiplier = 2.0;
                    else if (gameState.combo >= 5) comboMultiplier = 1.5;
                    else if (gameState.combo >= 3) comboMultiplier = 1.25;
                    
                    const finalMilk = Math.floor(baseMilk * comboMultiplier);
                    gameState.milk += finalMilk;
                    gameState.kills++;
                    gameState.totalKills++;
                    gameState.waveStats.milkThisWave += finalMilk;

                    const now = Date.now();
                    if (now - gameState.lastKillTime < 2000) {
                        gameState.combo++;
                        if (gameState.combo >= 2) {
                            playSound('combo');
                            showComboDisplay(gameState.combo);
                            gameState.maxCombo = Math.max(gameState.maxCombo, gameState.combo);
                        }
                    } else {
                        gameState.combo = 1;
                    }
                    gameState.lastKillTime = now;

                    if (comboMultiplier > 1.0) {
                        showComboMultiplier(this.x, this.y, `x${comboMultiplier}`);
                    }

                    WEEKLY_QUESTS.forEach(quest => {
                        if (quest.type === 'totalKills') quest.current++;
                        if (quest.type === 'combo' && gameState.combo >= quest.goal) quest.current = quest.goal;
                    });

                    playSound('enemy-death');
                }
            },

            draw() {
                if (!this.spawned) {
                    ctx.globalAlpha = this.spawnProgress;
                }

                ctx.save();
                
                if (this.isHit) {
                    ctx.globalAlpha = 0.5;
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    ctx.fillRect(this.x - 20, this.y - 20, 40, 40);
                }

                const breathing = Math.sin(this.breathing) * 0.05 + 0.95;
                ctx.translate(this.x, this.y);
                ctx.scale(breathing, breathing);

                if (mouseImg.complete && mouseImg.naturalHeight !== 0) {
                    ctx.drawImage(mouseImg, -20, -20, 40, 40);
                }

                ctx.restore();

                ctx.globalAlpha = 1;

                ctx.fillStyle = '#333';
                ctx.fillRect(this.x - 20, this.y - 30, 40, 5);
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(this.x - 20, this.y - 30, 40 * (this.health / this.maxHealth), 5);
            }
        };
    } else if (type === 'boss') {
        const bossHealth = 200 + gameState.currentWave * 50;

        return {
            type: 'boss',
            x: canvas.width / 2,
            y: 150,
            width: 140,
            height: 140,
            velocityX: 3,
            velocityY: 2,
            changeDirectionTimer: 0,
            health: bossHealth,
            maxHealth: bossHealth,
            shootTimer: 0,
            alive: true,
            bossImg: images.boss,
            knockback: { x: 0, y: 0, duration: 0 },
            spawned: false,
            spawnProgress: 0,
            breathing: Math.random() * Math.PI * 2,
            isHit: false,
            hitDuration: 0,

            update() {
                if (!this.spawned) {
                    this.spawnProgress += 0.05;
                    if (this.spawnProgress >= 1) {
                        this.spawned = true;
                    }
                }

                this.changeDirectionTimer++;
                if (this.changeDirectionTimer > 60) {
                    this.velocityX = (Math.random() - 0.5) * 6;
                    this.velocityY = (Math.random() - 0.5) * 6;
                    this.changeDirectionTimer = 0;
                }

                this.x += this.velocityX + this.knockback.x;
                this.y += this.velocityY + this.knockback.y;

                if (this.knockback.duration > 0) {
                    this.knockback.x *= 0.9;
                    this.knockback.y *= 0.9;
                    this.knockback.duration--;
                }

                if (this.hitDuration > 0) {
                    this.hitDuration--;
                }

                this.breathing += 0.05;

                if (this.x < 70 || this.x > canvas.width - 70) {
                    this.velocityX *= -1;
                    this.x = Math.max(70, Math.min(canvas.width - 70, this.x));
                }
                if (this.y < 70 || this.y > canvas.height - 100) {
                    this.velocityY *= -1;
                    this.y = Math.max(70, Math.min(canvas.height - 100, this.y));
                }

                this.shootTimer++;
                if (this.shootTimer > 40) {
                    this.shoot();
                    this.shootTimer = 0;
                }
            },

            shoot() {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                
                for (let i = -1; i <= 1; i++) {
                    enemyBullets.push({
                        x: this.x,
                        y: this.y,
                        vx: Math.cos(angle + i * 0.3) * 5,
                        vy: Math.sin(angle + i * 0.3) * 5,
                        life: 100,
                        damage: 10
                    });
                }
            },

            takeDamage(amount, bulletX, bulletY) {
                const isCrit = Math.random() < 0.2;
                if (isCrit) {
                    amount *= 1.5;
                    showCritText(this.x, this.y);
                    createParticle(this.x, this.y, 'crit', '#FFD700');
                }

                this.health -= amount;
                this.isHit = true;
                this.hitDuration = 10;

                const angle = Math.atan2(this.y - bulletY, this.x - bulletX);
                this.knockback.x = Math.cos(angle) * 3;
                this.knockback.y = Math.sin(angle) * 3;
                this.knockback.duration = 5;

                gameState.totalAccuracy++;
                gameState.waveHits++;

                if (this.health <= 0) {
                    this.alive = false;
                    gameState.score += 1000;
                    gameState.totalScore += 1000;
                    gameState.milk += 200 + gameState.currentWave * 100;
                    gameState.kills++;
                    gameState.totalKills += 5;
                    playSound('enemy-death');
                    bossActive = false;
                    gameState.screenShakeIntensity = 10;
                }
            },

            draw() {
                if (!this.spawned) {
                    ctx.globalAlpha = this.spawnProgress;
                }

                ctx.save();
                
                if (this.isHit) {
                    ctx.globalAlpha = 0.5;
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    ctx.fillRect(this.x - 70, this.y - 70, 140, 140);
                }

                const breathing = Math.sin(this.breathing) * 0.05 + 0.95;
                ctx.translate(this.x, this.y);
                ctx.scale(breathing, breathing);

                if (this.bossImg.complete && this.bossImg.naturalHeight !== 0) {
                    ctx.drawImage(this.bossImg, -70, -70, 140, 140);
                } else {
                    ctx.fillStyle = '#8B4513';
                    ctx.fillRect(-70, -70, 140, 140);
                }

                ctx.restore();
                ctx.globalAlpha = 1;

                ctx.fillStyle = '#333';
                ctx.fillRect(this.x - 70, this.y - 90, 140, 8);
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(this.x - 70, this.y - 90, 140 * (this.health / this.maxHealth), 8);

                ctx.fillStyle = '#ff0000';
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('👹 БОСС', this.x, this.y + 100);
            }
        };
    }
}

function showCritText(x, y) {
    const text = document.createElement('div');
    text.className = 'crit-text';
    text.textContent = 'КРИТ!';
    text.style.left = (x - 20) + 'px';
    text.style.top = (y - 50) + 'px';
    document.getElementById('gameCanvas').parentElement.appendChild(text);
    setTimeout(() => text.remove(), 800);
}

function showComboMultiplier(x, y, text) {
    const el = document.createElement('div');
    el.className = 'combo-multiplier-text';
    el.textContent = `✨ ${text} МОЛОКА!`;
    el.style.left = (x - 40) + 'px';
    el.style.top = (y - 70) + 'px';
    document.getElementById('gameCanvas').parentElement.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

let bullets = [];
let enemyBullets = [];

function togglePause() {
    if (gameState.isGameOver) return;

    gameState.isPaused = !gameState.isPaused;

    if (gameState.isPaused) {
        document.getElementById('pauseOverlay').classList.add('active');
        document.getElementById('pauseLabel').style.display = 'block';
        document.getElementById('pauseInfoPanel').classList.add('active');
        updatePauseInfoPanel();
    } else {
        document.getElementById('pauseOverlay').classList.remove('active');
        document.getElementById('pauseLabel').style.display = 'none';
        document.getElementById('pauseInfoPanel').classList.remove('active');
    }
}

function updatePauseInfoPanel() {
    document.getElementById('totalMilk').textContent = gameState.milk;
    document.getElementById('waveMilk').textContent = gameState.waveStats.milkThisWave;
    document.getElementById('totalScore').textContent = gameState.score;
    document.getElementById('maxWaveInfo').textContent = gameState.maxWave;
    document.getElementById('killsInfo').textContent = gameState.kills;
    document.getElementById('maxComboInfo').textContent = gameState.maxCombo;
    
    const accuracy = gameState.waveShots > 0 ? Math.round((gameState.waveHits / gameState.waveShots) * 100) : 0;
    document.getElementById('accuracyInfo').textContent = accuracy + '%';
    
    const comboMultiplier = getComboMultiplier(gameState.combo);
    document.getElementById('comboMultiplierInfo').textContent = `x${comboMultiplier}`;
}

function getComboMultiplier(combo) {
    if (combo >= 10) return '2.0';
    if (combo >= 5) return '1.5';
    if (combo >= 3) return '1.25';
    return '1.0';
}

function showWavePause() {
    gameState.isPaused = true;
    document.getElementById('wavePauseScreen').style.display = 'block';
    document.getElementById('pauseOverlay').classList.add('active');
    
    const timeTaken = Math.round((Date.now() - gameState.waveStats.waveStartTime) / 1000);
    const accuracy = gameState.waveShots > 0 ? Math.round((gameState.waveHits / gameState.waveShots) * 100) : 0;
    
    document.getElementById('wavePauseText').textContent = `Волна ${gameState.currentWave} завершена!`;
    document.getElementById('waveStats').textContent = `⏱️ ${timeTaken}сек | 🎯 Точность: ${accuracy}% | 💰 Молока: ${gameState.waveStats.milkThisWave}`;
}

function startNextWave() {
    gameState.isPaused = false;
    document.getElementById('wavePauseScreen').style.display = 'none';
    document.getElementById('pauseOverlay').classList.remove('active');
    document.getElementById('pauseLabel').style.display = 'none';
    document.getElementById('pauseInfoPanel').classList.remove('active');
    
    gameState.currentWave++;
    gameState.maxWave = Math.max(gameState.maxWave, gameState.currentWave);
    saveGameData();
    
    createWave(gameState.currentWave);
}

function getBackgroundImage(wave) {
    if (wave <= 5) return images.house;
    if (wave <= 10) return images.garden;
    return images.room;
}

function createWave(waveNum) {
    enemies = [];
    bullets = [];
    enemyBullets = [];
    particles = [];
    bossActive = false;
    gameState.combo = 0;
    waveEnemySpawnCount = 0;
    waveEnemyTotal = 0;
    gameState.waveShots = 0;
    gameState.waveHits = 0;
    gameState.waveStats = {
        waveStartTime: Date.now(),
        damageReceivedThisWave: 0,
        milkThisWave: 0
    };

    player.health = player.getMaxHealth();
    player.velocityX = 0;

    gameState.waveBonus = getWaveBonusForWave(waveNum);
    document.getElementById('bonusIndicator').textContent = gameState.waveBonus.name;
    document.getElementById('bonusIndicator').style.display = 'inline';

    currentBgImage = getBackgroundImage(waveNum);
    showWaveTitleDisplay(`ВОЛНА ${waveNum}`);

    if (waveNum % 5 === 0) {
        const boss = createEnemy('boss');
        enemies.push(boss);
        bossActive = true;
        waveEnemyTotal = 1;
        waveEnemySpawnCount = 1;
    } else {
        const baseEnemyCount = 4 + Math.floor(waveNum / 2);
        const enemyCount = baseEnemyCount + waveNum;
        waveEnemyTotal = enemyCount;

        let spawnedCount = 0;
        const spawnInterval = setInterval(() => {
            if (spawnedCount >= enemyCount || gameState.isGameOver) {
                clearInterval(spawnInterval);
            } else {
                const toSpawn = Math.min(Math.floor(Math.random() * 3) + 2, enemyCount - spawnedCount);
                for (let i = 0; i < toSpawn; i++) {
                    enemies.push(createEnemy('normal'));
                    waveEnemySpawnCount++;
                }
                spawnedCount += toSpawn;
            }
        }, 1500);
    }

    applyWaveBonus();
}

function applyWaveBonus() {
    const bonus = gameState.waveBonus;
    
    if (bonus.type === 'milk') {
        gameState.milk += bonus.value;
    } else if (bonus.type === 'health') {
        player.health = Math.min(player.health + bonus.value, player.getMaxHealth());
    } else if (bonus.type === 'booster') {
        gameState.activeBoosters.push({
            type: bonus.value,
            endTime: Date.now() + 20000,
            duration: 20000
        });
    }
}

function showWaveTitleDisplay(title) {
    const display = document.getElementById('waveTitleDisplay');
    display.textContent = title;
    display.style.display = 'block';
    setTimeout(() => {
        display.style.display = 'none';
    }, 1000);
}

function showComboDisplay(combo) {
    const display = document.getElementById('comboDisplay');
    display.textContent = `КОМБО x${combo}`;
    display.style.display = 'block';
    setTimeout(() => {
        display.style.display = 'none';
    }, 800);
}

function updateBoostersIndicator() {
    const indicator = document.getElementById('boostersIndicator');
    indicator.innerHTML = '';

    const now = Date.now();
    const colors = {
        quickDraw: '#00BFFF',
        powerStrike: '#FF4500',
        shield: '#00FF00',
        speedBoost: '#FFD700'
    };

    gameState.activeBoosters.forEach((booster, idx) => {
        const remaining = Math.max(0, booster.endTime - now);
        const percent = (remaining / booster.duration) * 100;
        const color = colors[booster.type] || '#FFD700';

        const bar = document.createElement('div');
        bar.className = 'booster-bar';
        bar.style.borderColor = color;
        bar.innerHTML = `
            <div class="booster-label" style="color: ${color}; font-size: 9px;">${booster.type === 'quickDraw' ? '⚡' : booster.type === 'powerStrike' ? '💪' : booster.type === 'shield' ? '🛡️' : '🚀'} ${Math.ceil(remaining / 1000)}s</div>
            <div class="booster-bar-fill" style="background: ${color}; width: ${percent}%"></div>
        `;
        indicator.appendChild(bar);
    });
}

function updateSidePanel() {
    if (!isMobile) return;

    const accuracy = gameState.waveShots > 0 ? Math.round((gameState.waveHits / gameState.waveShots) * 100) : 0;
    const multiplier = getComboMultiplier(gameState.combo);

    document.getElementById('sidePanelAccuracy').textContent = accuracy + '%';
    document.getElementById('sidePanelCombo').textContent = gameState.combo + 'x';
    document.getElementById('sidePanelMultiplier').textContent = `x${multiplier}`;
    document.getElementById('sidePanelWaveMilk').textContent = gameState.waveStats.milkThisWave;
}

function toggleShop() {
    const panel = document.getElementById('shopPanel');
    
    if (panel.classList.contains('open')) {
        panel.classList.remove('open');
        gameState.isPaused = false;
    } else {
        panel.classList.add('open');
        gameState.isPaused = true;
    }
}

function upgradeDamage() {
    const cost = gameState.upgrades.damage.baseCost * gameState.upgrades.damage.level;
    if (gameState.milk >= cost) {
        gameState.milk -= cost;
        gameState.upgrades.damage.level++;
        saveGameData();
        updateUI();
    }
}

function upgradeBulletCount() {
    const cost = gameState.upgrades.bulletCount.baseCost * gameState.upgrades.bulletCount.level;
    if (gameState.milk >= cost) {
        gameState.milk -= cost;
        gameState.upgrades.bulletCount.level++;
        saveGameData();
        updateUI();
    }
}

function upgradeBulletSize() {
    const cost = gameState.upgrades.bulletSize.baseCost * gameState.upgrades.bulletSize.level;
    if (gameState.milk >= cost) {
        gameState.milk -= cost;
        gameState.upgrades.bulletSize.level++;
        saveGameData();
        updateUI();
    }
}

function upgradeHealth() {
    const cost = gameState.upgrades.health.baseCost * gameState.upgrades.health.level;
    if (gameState.milk >= cost) {
        gameState.milk -= cost;
        gameState.upgrades.health.level++;
        player.maxHealth = player.getMaxHealth();
        player.health = player.maxHealth;
        saveGameData();
        updateUI();
    }
}

function activateBooster(type) {
    let cost = 0;
    let duration = 0;

    switch(type) {
        case 'quickDraw': cost = 30; duration = 15000; break;
        case 'powerStrike': cost = 40; duration = 20000; break;
        case 'shield': cost = 50; duration = 30000; break;
        case 'speedBoost': cost = 25; duration = 20000; break;
    }

    if (gameState.milk >= cost) {
        gameState.milk -= cost;
        gameState.activeBoosters.push({
            type: type,
            endTime: Date.now() + duration,
            duration: duration
        });
        playSound('enemy-death');
        updateUI();
    }
}

function updateBoosters() {
    const now = Date.now();
    gameState.activeBoosters = gameState.activeBoosters.filter(b => b.endTime > now);
    updateBoostersIndicator();
}

function updateUI() {
    document.getElementById('milk').textContent = gameState.milk;
    document.getElementById('waveCounter').textContent = gameState.currentWave;
    
    const damageCost = gameState.upgrades.damage.baseCost * gameState.upgrades.damage.level;
    const bulletCountCost = gameState.upgrades.bulletCount.baseCost * gameState.upgrades.bulletCount.level;
    const bulletCost = gameState.upgrades.bulletSize.baseCost * gameState.upgrades.bulletSize.level;
    const healthCost = gameState.upgrades.health.baseCost * gameState.upgrades.health.level;

    document.getElementById('damageCost').textContent = damageCost + '🥛';
    document.getElementById('bulletCountCost').textContent = bulletCountCost + '🥛';
    document.getElementById('bulletCost').textContent = bulletCost + '🥛';
    document.getElementById('healthCost').textContent = healthCost + '🥛';

    document.getElementById('damageBtn').disabled = gameState.milk < damageCost;
    document.getElementById('bulletCountBtn').disabled = gameState.milk < bulletCountCost;
    document.getElementById('bulletBtn').disabled = gameState.milk < bulletCost;
    document.getElementById('healthBtn').disabled = gameState.milk < healthCost;

    updateSidePanel();
    checkAchievements();
    checkQuests();
}

function checkAchievements() {
    Object.keys(ACHIEVEMENTS).forEach(key => {
        const achievement = ACHIEVEMENTS[key];
        if (achievement.check() && !gameState.achievements.has(key)) {
            gameState.achievements.add(key);
            saveGameData();
        }
    });
}

function checkQuests() {
    WEEKLY_QUESTS.forEach(quest => {
        if (!gameState.completedQuests[quest.id] && quest.current >= quest.goal) {
            gameState.completedQuests[quest.id] = true;
            gameState.milk += quest.reward;
            
            if (quest.rewardSkin) {
                gameState.ownedSkins.push(quest.rewardSkin);
            }
            
            saveGameData();
        }
    });
}

function showSkinsPanel() {
    const grid = document.getElementById('skinsGrid');
    grid.innerHTML = '';

    for (const [key, skin] of Object.entries(SKINS)) {
        const owned = gameState.ownedSkins.includes(key);
        const active = gameState.activeSkin === key;

        const item = document.createElement('div');
        item.className = 'skin-item' + (skin.premium ? ' premium' : '');
        if (owned) item.classList.add('owned');
        if (active) item.classList.add('active');

        let costText = '';
        if (skin.questReward) {
            costText = '📝 Квест';
        } else if (owned) {
            costText = active ? '✓ Активен' : '✓ Куплен';
        } else {
            costText = skin.cost + ' 🥛';
        }

        item.innerHTML = `
            <div class="skin-emoji">${skin.emoji}</div>
            <div class="skin-name">${skin.name}</div>
            <div class="skin-bonus">${skin.bonus}</div>
            ${skin.premium && !owned ? '<div class="skin-premium-badge">💎 ПРЕМИУМ</div>' : ''}
            <div class="skin-cost">${costText}</div>
        `;

        item.onclick = () => {
            if (!owned && !skin.questReward && gameState.milk >= skin.cost) {
                gameState.milk -= skin.cost;
                gameState.ownedSkins.push(key);
                gameState.activeSkin = key;
                player.maxHealth = player.getMaxHealth();
                player.health = player.maxHealth;
                saveGameData();
                showSkinsPanel();
                updateUI();
            } else if (owned) {
                gameState.activeSkin = key;
                player.maxHealth = player.getMaxHealth();
                player.health = player.maxHealth;
                saveGameData();
                showSkinsPanel();
                updateUI();
            }
        };

        grid.appendChild(item);
    }

    document.getElementById('skinsPanel').classList.add('active');
}

function hideSkinsPanel() {
    document.getElementById('skinsPanel').classList.remove('active');
}

function gameLoop() {
    if (currentBgImage.complete && currentBgImage.naturalHeight !== 0) {
        ctx.drawImage(currentBgImage, 0, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 5; i++) {
        const x = (Date.now() / 80 + i * 250) % (canvas.width + 100);
        ctx.beginPath();
        ctx.arc(x, 50 + i * 50, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 25, 50 + i * 50, 40, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.save();
    applyScreenShake();

    if (!gameState.isGameOver && !gameState.isPaused) {
        updateBoosters();
        updateParticles();
        player.update();
        
        for (let enemy of enemies) {
            if (enemy.alive) enemy.update();
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            bullet.life--;

            if (bullet.life <= 0 || bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
                bullets.splice(i, 1);
                continue;
            }

            for (let enemy of enemies) {
                if (enemy.alive && 
                    bullet.x > enemy.x - 25 && bullet.x < enemy.x + 25 &&
                    bullet.y > enemy.y - 25 && bullet.y < enemy.y + 25) {
                    
                    enemy.takeDamage(bullet.damage, bullet.x, bullet.y);
                    playSound('hit');
                    bullets.splice(i, 1);
                    break;
                }
            }
        }

        for (let enemy of enemies) {
            if (enemy.alive && Math.random() < 0.008) {
                if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 400) {
                    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
                    enemyBullets.push({
                        x: enemy.x,
                        y: enemy.y,
                        vx: Math.cos(angle) * 4,
                        vy: Math.sin(angle) * 4,
                        life: 100,
                        damage: 5
                    });
                }
            }
        }

        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const bullet = enemyBullets[i];
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            bullet.life--;

            if (bullet.life <= 0 || bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
                enemyBullets.splice(i, 1);
                continue;
            }

            if (bullet.x > player.x - 40 && bullet.x < player.x + 40 &&
                bullet.y > player.y - 40 && bullet.y < player.y + 40) {
                
                player.takeDamage(bullet.damage || 5);
                enemyBullets.splice(i, 1);
            }
        }

        const allEnemiesDead = enemies.length > 0 && enemies.every(e => !e.alive);
        const allEnemiesSpawned = waveEnemyTotal > 0 && waveEnemySpawnCount >= waveEnemyTotal;
        
        if (allEnemiesDead && allEnemiesSpawned) {
            const timeTaken = Math.round((Date.now() - gameState.waveStats.waveStartTime) / 1000);
            
            WEEKLY_QUESTS.forEach(quest => {
                if (quest.type === 'waveSpeed' && timeTaken <= quest.goal) quest.current = quest.goal;
                if (quest.type === 'waveMilk' && gameState.waveStats.milkThisWave >= quest.goal) quest.current = quest.goal;
            });

            gameState.totalScore += gameState.score;
            saveGameData();
            showWavePause();
        }

        if (player.health <= 0) {
            gameState.isGameOver = true;
            document.getElementById('gameOverScore').textContent = `Очки: ${gameState.score}`;
            document.getElementById('gameOverKills').textContent = `Убито врагов: ${gameState.kills}`;
            document.getElementById('gameOverLevel').textContent = `Волн пройдено: ${gameState.currentWave}`;
            document.getElementById('gameOverCombo').textContent = `Макс комбо: ${gameState.maxCombo}`;
            document.getElementById('gameOver').style.display = 'block';
            saveGameData();
        }

        player.draw();

        for (let enemy of enemies) {
            if (enemy.alive) enemy.draw();
        }

        for (let bullet of bullets) {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.size + 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        for (let bullet of enemyBullets) {
            ctx.fillStyle = '#ff6b9d';
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 107, 157, 0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        drawParticles();
    }

    ctx.restore();

    document.getElementById('healthFill').style.width = (player.health / player.maxHealth * 100) + '%';
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('kills').textContent = gameState.kills;

    updateUI();
    updateFPS();

    requestAnimationFrame(gameLoop);
}

// Initialise: show loading screen, preload images, then show the main menu
showLoadingScreen();
preloadImages(updateLoadingProgress, () => {
    currentBgImage = images.house;
    hideLoadingScreen();
    updateMenuStats();
});
