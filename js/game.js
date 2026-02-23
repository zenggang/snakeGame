const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 游戏状态配置
const config = {
    gridSize: 50, // 背景网格大小
    gridColor: 'rgba(255, 255, 255, 0.05)'
};

// 实例
let player;
let propsManager;
let mapManager;
let camera = { x: 0, y: 0 };
let lastTime = 0;
let gameState = 'menu'; // 'menu', 'playing', 'gameover'
let animationId;

// UI 元素
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const restartBtn = document.getElementById('restart-btn');
const finalScoreEl = document.getElementById('final-score');
const finalLengthEl = document.getElementById('final-length');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// 难度配置
const DIFFICULTY = {
    easy:   { buffChance: 0.45, maxProps: 100, chaseSpeed: 60,  bugSpeedMul: 0.5, label: '简易' },
    medium: { buffChance: 0.25, maxProps: 80,  chaseSpeed: 120, bugSpeedMul: 1.0, label: '中等' },
    hard:   { buffChance: 0.22, maxProps: 60,  chaseSpeed: 180, bugSpeedMul: 2.0, label: '困难' }
};

function startGame(diff = 'medium') {
    window.difficulty = DIFFICULTY[diff] || DIFFICULTY.medium;
    gameState = 'playing';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    // 初始化或重置游戏对象
    mapManager = new MapManager(8000, 6000);
    player = new Player(4000, 3000); // 居中放置
    propsManager = new PropsManager();
    lastTime = performance.now();
    
    if (!animationId) {
        lastTime = performance.now();
        animationId = requestAnimationFrame(gameLoop);
    }
}

window.onGameOver = function(reason = "未知原因") {
    gameState = 'gameover';
    document.getElementById('death-reason').innerText = `死因: ${reason}`;
    finalScoreEl.innerText = `得分: ${player.score}`;
    finalLengthEl.innerText = `最大长度: ${player.segments}`;
    
    const finalDiffEl = document.getElementById('final-difficulty');
    if (finalDiffEl && window.difficulty) {
        finalDiffEl.innerText = `难度: ${window.difficulty.label}`;
    }
    
    gameOverScreen.classList.add('active');
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
};

function init() {
    window.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    window.viewScale = window.isMobile ? 0.75 : 1.0;
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    Input.init();

    // 绑定难度按钮
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => startGame(btn.dataset.diff));
    });
    restartBtn.addEventListener('click', () => {
        gameOverScreen.classList.remove('active');
        startScreen.classList.add('active');
        // 重新在背景画个图，避免黑屏
        if (typeof drawBackgroundOnly === 'function') drawBackgroundOnly();
    });
    
    // 加载全部美术素材，显示进度条
    const loadingBar = document.getElementById('loading-bar-fill');
    const loadingPercent = document.getElementById('loading-percent');
    const loadingScreen = document.getElementById('loading-screen');
    
    assets.load({
        'spritesheet': 'assets/SpriteSheet_half.webp?v=' + Date.now(),
        'scene': 'assets/scene.png'
    }, () => {
        // 加载完毕：隐藏加载画面，显示开始界面
        if (loadingScreen) loadingScreen.classList.remove('active');
        startScreen.classList.add('active');
        drawBackgroundOnly();
    }, (loaded, total) => {
        // 进度回调：更新进度条
        const pct = Math.round((loaded / total) * 100);
        if (loadingBar) loadingBar.style.width = pct + '%';
        if (loadingPercent) loadingPercent.textContent = pct + '%';
    });
}

function update(dt) {
    if (gameState !== 'playing') return;
    
    // 更新主角位置
    player.update(dt);
    
    // 更新道具
    propsManager.update(player, dt);
    
    // 摄像机跟随主角（考虑缩放后的视口大小）
    const vWidth = canvas.width / (window.viewScale || 1.0);
    const vHeight = canvas.height / (window.viewScale || 1.0);
    camera.x = player.x - vWidth / 2;
    camera.y = player.y - vHeight / 2;
}

function drawGrid() {
    ctx.strokeStyle = config.gridColor;
    ctx.lineWidth = 1;
    
    // 根据摄像机偏移计算网格绘制起点
    const startX = - (camera.x % config.gridSize);
    const startY = - (camera.y % config.gridSize);
    
    ctx.beginPath();
    // 垂直线
    for (let x = startX; x < canvas.width; x += config.gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }
    // 水平线
    for (let y = startY; y < canvas.height; y += config.gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();
    ctx.closePath();
}

function drawHUD() {
    if (gameState !== 'playing') return;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, 10, 220, 132);
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`得分: ${player.score}`, 20, 32);
    ctx.fillText(`长度: ${player.segments}`, 20, 56);
    
    // 冲刺状态
    if (player.boostActive) {
        const secs = Math.ceil(player.boostTimer / 1000);
        ctx.fillStyle = '#ffa500';
        ctx.fillText(`🚀 冲刺中! ${secs}s`, 20, 80);
    } else {
        ctx.fillStyle = '#88d8f8';
        ctx.fillText(`🚀 x${player.boostCharges} (空格)`, 20, 80);
    }
    
    // 护盾状态
    if (player.shieldActive) {
        const secs = Math.ceil(player.shieldTimer / 1000);
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`🛡️ 无敌中! ${secs}s`, 20, 104);
    } else {
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`🛡️ x${player.shieldCharges} (E键)`, 20, 104);
    }
    
    // 显示当前难度 + 阶梯
    if (window.difficulty) {
        ctx.fillStyle = '#ff9f43';
        let diffText = `难度: ${window.difficulty.label}`;
        if (window.difficulty.label !== '简易') {
            const tier = Math.floor(player.score / 500);
            if (tier > 0) diffText += ` ⬆${tier}`;
        }
        ctx.fillText(diffText, 20, 128);
    }
    
    // 同步更新移动端冲刺按钮
    const boostBtn = document.getElementById('boost-btn');
    if (boostBtn) {
        if (player.boostActive) {
            boostBtn.textContent = `🚀 ${Math.ceil(player.boostTimer / 1000)}s`;
            boostBtn.classList.add('boosting');
        } else {
            boostBtn.textContent = `🚀 冲刺 (${player.boostCharges})`;
            boostBtn.classList.remove('boosting');
        }
    }
    
    // 同步更新移动端护盾按钮
    const shieldBtn = document.getElementById('shield-btn');
    if (shieldBtn) {
        if (player.shieldActive) {
            shieldBtn.textContent = `🛡️ ${Math.ceil(player.shieldTimer / 1000)}s`;
            shieldBtn.classList.add('shielding');
        } else {
            shieldBtn.textContent = `🛡️ 护盾 (${player.shieldCharges})`;
            shieldBtn.classList.remove('shielding');
        }
    }
}

function drawBackgroundOnly() {
    const vs = window.viewScale || 1;
    const effW = canvas.width / vs;
    const effH = canvas.height / vs;
    
    ctx.fillStyle = '#6ab04c';
    ctx.fillRect(0, 0, effW, effH);
    
    // 渲染无缝大背景铺砖
    if (assets.allLoaded) {
        let sceneImg = assets.getImage('scene');
        if (sceneImg && sceneImg.width > 0 && sceneImg.height > 0) {
            let sw = sceneImg.width;
            let sh = sceneImg.height;
            // 确保背景铺砖能紧跟摄像机并呈现无限循环
            const startX = Math.floor(camera.x / sw) * sw - camera.x;
            const startY = Math.floor(camera.y / sh) * sh - camera.y;
            
            ctx.save();
            ctx.globalAlpha = 0.8;
            for (let x = startX - sw; x < effW + sw; x += sw) {
                for (let y = startY - sh; y < effH + sh; y += sh) {
                    ctx.drawImage(sceneImg, x, y, sw, sh);
                }
            }
            ctx.restore();
        }
    }
}

function draw() {
    if (gameState === 'playing' || gameState === 'gameover') {
        const vs = window.viewScale || 1.0;
        ctx.save();
        if (vs !== 1.0) ctx.scale(vs, vs);
        
        // 背景层也在缩放空间内绘制，保证与地形/道具比例一致
        drawBackgroundOnly();
        
        // 先渲染地形
        if (mapManager) mapManager.draw(ctx, camera);
        
        // 绘制游戏元素，传入摄像机进行坐标转换
        propsManager.draw(ctx, camera);
        if (player) player.draw(ctx, camera);
        
        ctx.restore();
        
        // UI 层不受游戏空间缩放影响
        drawHUD();
        drawMinimap();
    } else {
        drawBackgroundOnly();
    }
}

function drawMinimap() {
    if (gameState !== 'playing' || !mapManager) return;
    
    const mapW = mapManager.width;
    const mapH = mapManager.height;
    // 移动端小地图也稍微缩小
    const mmW = window.isMobile ? 120 : 160;
    const mmH = Math.round(mmW * mapH / mapW);
    const mmX = canvas.width - mmW - 12;
    const mmY = 12;
    const scaleX = mmW / mapW;
    const scaleY = mmH / mapH;
    
    ctx.save();
    ctx.globalAlpha = 0.6;
    
    // 背景（草地）
    ctx.fillStyle = '#4a8c3f';
    ctx.fillRect(mmX, mmY, mmW, mmH);
    
    // 渲染地形瓦片
    const ts = mapManager.tileSize;
    const tileW = ts * scaleX;
    const tileH = ts * scaleY;
    
    for (let tx = 0; tx < mapManager.cols; tx++) {
        for (let ty = 0; ty < mapManager.rows; ty++) {
            const tile = mapManager.tiles[tx] && mapManager.tiles[tx][ty];
            if (!tile) continue;
            
            let color = null;
            if (tile === 'water') color = '#3a8fd8';
            else if (tile === 'wall_h' || tile === 'wall_v') color = '#8B7355';
            else if (tile === 'dirt') color = '#c4a66a';
            else if (tile === 'bridge_v' || tile === 'bridge_h') color = '#a0826d';
            
            if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(mmX + tx * tileW, mmY + ty * tileH, Math.ceil(tileW), Math.ceil(tileH));
            }
        }
    }
    
    ctx.globalAlpha = 0.85;
    
    // 道具（小点）
    if (propsManager && propsManager.props) {
        for (const p of propsManager.props) {
            const px = mmX + p.x * scaleX;
            const py = mmY + p.y * scaleY;
            if (p.type === 'buff') {
                ctx.fillStyle = '#ffd700';
            } else if (p.textureKey === 'bug_red') {
                ctx.fillStyle = '#ff4444';
            } else if (p.textureKey === 'bug_green') {
                ctx.fillStyle = '#44ff44';
            } else {
                ctx.fillStyle = '#8B4513';
            }
            ctx.fillRect(px - 1, py - 1, 2, 2);
        }
    }
    
    // 玩家身体轨迹
    if (player && player.pathHistory && player.pathHistory.length > 0) {
        ctx.fillStyle = '#ffaa00';
        const step = Math.max(1, Math.floor(player.pathHistory.length / 20));
        for (let i = 0; i < player.pathHistory.length; i += step) {
            const pt = player.pathHistory[i];
            ctx.fillRect(mmX + pt.x * scaleX - 1, mmY + pt.y * scaleY - 1, 2, 2);
        }
    }
    
    // 玩家位置（亮白大点）
    if (player) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(mmX + player.x * scaleX, mmY + player.y * scaleY, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 当前视口框（真实视野区域）
    const vWidth = canvas.width / (window.viewScale || 1.0);
    const vHeight = canvas.height / (window.viewScale || 1.0);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
        mmX + Math.max(0, camera.x) * scaleX,
        mmY + Math.max(0, camera.y) * scaleY,
        vWidth * scaleX,
        vHeight * scaleY
    );
    
    // 边框
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(mmX, mmY, mmW, mmH);
    
    ctx.restore();
}

function gameLoop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    
    update(dt);
    draw();
    
    animationId = requestAnimationFrame(gameLoop);
}

// 启动游戏逻辑
init();
