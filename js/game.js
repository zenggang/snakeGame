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
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalScoreEl = document.getElementById('final-score');
const finalLengthEl = document.getElementById('final-length');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function startGame() {
    gameState = 'playing';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    // 初始化或重置游戏对象
    mapManager = new MapManager(8000, 6000);
    player = new Player(4000, 3000); // 居中放置
    propsManager = new PropsManager();
    lastTime = performance.now();
    
    // 不再自动请求重力权限，改为用户手动切换
    // Input.requestGravityPermission();
    
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
    gameOverScreen.classList.add('active');
    // 停止动画循环
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
};

function init() {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    Input.init();

    // 绑定按钮事件
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    
    // 加载全部美术素材，显示进度条
    const loadingBar = document.getElementById('loading-bar-fill');
    const loadingPercent = document.getElementById('loading-percent');
    const loadingScreen = document.getElementById('loading-screen');
    
    assets.load({
        'spritesheet': 'assets/SpriteSheet_transparent.png?v=' + Date.now(),
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
    
    // 摄像机跟随主角
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
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
    ctx.fillRect(10, 10, 220, 108);
    
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
    ctx.fillStyle = '#6ab04c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
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
            ctx.globalAlpha = 0.8; // 让草地微透，不抢戏主角
            // 渲染覆盖视口的九宫格平铺地图
            for (let x = startX - sw; x < window.innerWidth + sw; x += sw) {
                for (let y = startY - sh; y < window.innerHeight + sh; y += sh) {
                    ctx.drawImage(sceneImg, x, y, sw, sh);
                }
            }
            ctx.restore();
        }
    }
}

function draw() {
    // Fill fallback background
    drawBackgroundOnly();
    
    if (gameState === 'playing' || gameState === 'gameover') {
        // 先渲染地形
        if (mapManager) mapManager.draw(ctx, camera);
        
        // 绘制游戏元素，传入摄像机进行坐标转换
        propsManager.draw(ctx, camera);
        if (player) player.draw(ctx, camera);
        drawHUD();
    }
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
