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
    player = new Player(0, 0);
    propsManager = new PropsManager();
    lastTime = performance.now();
    
    if (!animationId) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

window.onGameOver = function() {
    gameState = 'gameover';
    finalScoreEl.innerText = `得分: ${player.score}`;
    finalLengthEl.innerText = `最大长度: ${player.segments}`;
    gameOverScreen.classList.add('active');
};

function init() {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    Input.init();

    // 绑定按钮事件
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    
    // 加载全部美术素材然后显示首页背景
    assets.load({
        'dog_head': 'assets/dog_head.png',
        'dog_body': 'assets/dog_body.png',
        'dog_tail': 'assets/dog_tail.png',
        'props': 'assets/props.png',
        'scene': 'assets/scene.png'
    }, () => {
        drawBackgroundOnly();
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
    ctx.fillRect(10, 10, 150, 60);
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`得分: ${player.score}`, 20, 32);
    ctx.fillText(`长度: ${player.segments}`, 20, 56);
}

function drawBackgroundOnly() {
    ctx.fillStyle = '#6ab04c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 渲染无缝大背景铺砖
    if (assets.allLoaded) {
        let sceneImg = assets.getImage('scene');
        if (sceneImg) {
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
    drawBackgroundOnly();
    
    if (gameState === 'playing' || gameState === 'gameover') {
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
