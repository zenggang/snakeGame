class MapManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tileSize = 150; // Visual rendering size of each grid tile
        this.tiles = [];
        this.cols = Math.ceil(width / this.tileSize);
        this.rows = Math.ceil(height / this.tileSize);
        
        this.generateMap();
    }

    generateMap() {
        // Initialize everything with null (transparent, showing scene background)
        for (let x = 0; x < this.cols; x++) {
            this.tiles[x] = [];
            for (let y = 0; y < this.rows; y++) {
                this.tiles[x][y] = null;
            }
        }

        // Add border walls
        for (let x = 0; x < this.cols; x++) {
            this.tiles[x][0] = 'wall_h';
            this.tiles[x][this.rows - 1] = 'wall_h';
        }
        for (let y = 0; y < this.rows; y++) {
            this.tiles[0][y] = 'wall_v';
            this.tiles[this.cols - 1][y] = 'wall_v';
        }

        // Add a central horizontal river (shifted down so player doesn't spawn in it)
        const riverY = Math.floor(this.rows / 2) + 3;
        for (let x = 1; x < this.cols - 1; x++) {
            this.tiles[x][riverY] = 'water';
            this.tiles[x][riverY + 1] = 'water'; // 2 tiles wide
        }

        // Add some vertical bridges over the river
        const bridgeX1 = Math.floor(this.cols * 0.3);
        const bridgeX2 = Math.floor(this.cols * 0.7);
        this.tiles[bridgeX1][riverY] = 'bridge_v';
        this.tiles[bridgeX1][riverY + 1] = 'bridge_v';
        this.tiles[bridgeX2][riverY] = 'bridge_v';
        this.tiles[bridgeX2][riverY + 1] = 'bridge_v';
        
        // 生成连通小路：仅从出生点各修一条窄路通向两座桥
        const spawnTileX = Math.floor((this.width / 2) / this.tileSize);
        const spawnTileY = Math.floor((this.height / 2) / this.tileSize);
        
        // 辅助函数：画 L 形窄路（先横后纵或先纵后横），避免斜切产生大面积覆盖
        const drawLPath = (x1, y1, x2, y2, horizontalFirst) => {
            const setDirt = (x, y) => {
                if (x >= 1 && x < this.cols - 1 && y >= 1 && y < this.rows - 1) {
                    if (!this.tiles[x][y]) this.tiles[x][y] = 'dirt';
                }
            };
            
            if (horizontalFirst) {
                // 先走横向
                const stepX = Math.sign(x2 - x1);
                for (let x = x1; x !== x2; x += stepX) {
                    setDirt(x, y1);
                }
                // 再走纵向
                const stepY = Math.sign(y2 - y1);
                for (let y = y1; y !== y2 + stepY; y += stepY) {
                    setDirt(x2, y);
                }
            } else {
                // 先走纵向
                const stepY = Math.sign(y2 - y1);
                for (let y = y1; y !== y2; y += stepY) {
                    setDirt(x1, y);
                }
                // 再走横向
                const stepX = Math.sign(x2 - x1);
                for (let x = x1; x !== x2 + stepX; x += stepX) {
                    setDirt(x, y2);
                }
            }
        };
        
        // 左桥：先纵后横；右桥：先横后纵（两条路不重叠）
        // 目标为 riverY-1（河岸），这样小路紧贴桥梁入口
        drawLPath(spawnTileX, spawnTileY, bridgeX1, riverY - 1, false);
        drawLPath(spawnTileX, spawnTileY, bridgeX2, riverY - 1, true);

        // Add pure static decor items (密度适中，不要太密)
        const decorKeys = Object.keys(assets.slices.decor || {});
        
        for (let i = 0; i < 150; i++) {
            const rx = Math.floor(1 + Math.random() * (this.cols - 2));
            const ry = Math.floor(1 + Math.random() * (this.rows - 2));
            
            // 出生安全区：中心点周围 3 格内禁止放置任何东西
            if (Math.abs(rx - spawnTileX) <= 3 && Math.abs(ry - spawnTileY) <= 3) {
                continue;
            }
            
            if (!this.tiles[rx][ry] && decorKeys.length > 0) {
                 const randKey = decorKeys[Math.floor(Math.random() * decorKeys.length)];
                 const isSolid = randKey.includes('mushroom') || 
                                 randKey.includes('stump') || 
                                 randKey.includes('rock') || 
                                 randKey.includes('flower_bed') || 
                                 randKey.includes('tree');
                                 
                 // 如果是有碰撞体积的物体，严禁生成在桥所在的列，保证有一条通畅的过河直道
                 if (isSolid && (rx === bridgeX1 || rx === bridgeX2)) {
                     continue;
                 }
                 
                 this.tiles[rx][ry] = 'decor_' + randKey;
            }
        }
    }

    // Collision detection
    isLethal(x, y, radius = 0) {
        if (x < radius || x >= this.width - radius || y < radius || y >= this.height - radius) return true;
        
        // Check 4 corners of the bounding box to be safer
        const corners = [
            {cx: x - radius, cy: y - radius},
            {cx: x + radius, cy: y - radius},
            {cx: x - radius, cy: y + radius},
            {cx: x + radius, cy: y + radius}
        ];
        
        for (let p of corners) {
            const tx = Math.floor(p.cx / this.tileSize);
            const ty = Math.floor(p.cy / this.tileSize);
            if (tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows) {
                const tile = this.tiles[tx][ty];
                if (tile === 'wall_h' || tile === 'wall_v') return true;
            }
        }
        
        // 岩石使用像素级距离碰撞检测（石头很小，不应占满整格 150px）
        for (let cx = Math.floor((x - radius) / this.tileSize); cx <= Math.floor((x + radius) / this.tileSize); cx++) {
            for (let cy = Math.floor((y - radius) / this.tileSize); cy <= Math.floor((y + radius) / this.tileSize); cy++) {
                if (cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows) {
                    const tile = this.tiles[cx][cy];
                    if (tile && tile.startsWith('decor_') && tile.replace('decor_', '').includes('rock')) {
                        // 石头视觉中心在瓦片的正中央
                        const rockCenterX = cx * this.tileSize + this.tileSize / 2;
                        const rockCenterY = cy * this.tileSize + this.tileSize / 2;
                        const dist = Math.hypot(x - rockCenterX, y - rockCenterY);
                        // 碰撞半径 = 石头显示尺寸的一半（约 25px）+ 蛇头半径
                        if (dist < 25 + radius) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    isWall(x, y, radius = 0) {
        if (x < radius || x >= this.width - radius || y < radius || y >= this.height - radius) return true;
        
        // Check 4 corners of the bounding box to be safer
        const corners = [
            {cx: x - radius, cy: y - radius},
            {cx: x + radius, cy: y - radius},
            {cx: x - radius, cy: y + radius},
            {cx: x + radius, cy: y + radius}
        ];
        
        for (let p of corners) {
            const tx = Math.floor(p.cx / this.tileSize);
            const ty = Math.floor(p.cy / this.tileSize);
            if (tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows) {
                const tile = this.tiles[tx][ty];
                if (tile === 'wall_h' || tile === 'wall_v') return true;
                if (tile && tile.startsWith('decor_')) {
                    const key = tile.replace('decor_', '');
                    if (key.includes('mushroom') || 
                        key.includes('stump') || 
                        key.includes('rock') || 
                        key.includes('flower_bed') || 
                        key.includes('tree')) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    isWater(x, y, radius = 0) {
        // Only checking the very center point instead of corners to be lenient
        const tx = Math.floor(x / this.tileSize);
        const ty = Math.floor(y / this.tileSize);
        if (tx >= 0 && tx < this.cols && ty >= 0 && ty < this.rows) {
            return this.tiles[tx][ty] === 'water';
        }
        return false;
    }

    draw(ctx, camera) {
        if (!assets.allLoaded) return;
        const img = assets.getImage('spritesheet');
        if (!img) return;

        const sMap = assets.slices.map;

        const startCol = Math.max(0, Math.floor(camera.x / this.tileSize));
        const endCol = Math.min(this.cols - 1, Math.floor((camera.x + window.innerWidth) / this.tileSize));
        const startRow = Math.max(0, Math.floor(camera.y / this.tileSize));
        const endRow = Math.min(this.rows - 1, Math.floor((camera.y + window.innerHeight) / this.tileSize));

        for (let x = startCol; x <= endCol; x++) {
            for (let y = startRow; y <= endRow; y++) {
                const type = this.tiles[x][y];
                const screenX = x * this.tileSize - camera.x;
                const screenY = y * this.tileSize - camera.y;
                
                if (!type) continue;
                
                if (type === 'dirt') {
                    ctx.drawImage(img, sMap.dirt.sx, sMap.dirt.sy, sMap.dirt.sw, sMap.dirt.sh, screenX, screenY, this.tileSize, this.tileSize);
                } else if (type === 'water') {
                    ctx.drawImage(img, sMap.water.sx, sMap.water.sy, sMap.water.sw, sMap.water.sh, screenX, screenY, this.tileSize, this.tileSize);
                } else if (type === 'wall_h') {
                    // 上下墙壁用 fence_h 绘制，保持宽高比居中
                    let s = sMap.fence_h;
                    let ratio = s.sw / s.sh;
                    let dw = this.tileSize;
                    let dh = this.tileSize / ratio;
                    let dy = screenY + (this.tileSize - dh) / 2;
                    ctx.drawImage(img, s.sx, s.sy, s.sw, s.sh, screenX, dy, dw, dh);
                } else if (type === 'wall_v') {
                    // 左右侧的墙壁借助原地旋转 90 度的 fence_h 绘制，并保证上下连贯（此时渲染高度也就是原贴图宽度拉伸满 tileSize）
                    let s = sMap.fence_h;
                    let ratio = s.sw / s.sh;
                    let visualH = this.tileSize;
                    let visualW = this.tileSize / ratio;
                    
                    let cx = screenX + this.tileSize / 2;
                    let cy = screenY + this.tileSize / 2;
                    
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(Math.PI / 2);
                    // 绘制在旋转后的坐标系中心点 (-width/2, -height/2)
                    ctx.drawImage(img, s.sx, s.sy, s.sw, s.sh, -visualH / 2, -visualW / 2, visualH, visualW);
                    ctx.restore();
                } else if (type === 'bridge_v') {
                    // 先画水面底层
                    ctx.drawImage(img, sMap.water.sx, sMap.water.sy, sMap.water.sw, sMap.water.sh, screenX, screenY, this.tileSize, this.tileSize);
                    // 桥面保持宽高比居中绘制
                    let s = sMap.bridge_v;
                    let ratio = s.sw / s.sh;
                    let dw = this.tileSize * 0.9;
                    let dh = dw / ratio;
                    let dx = screenX + (this.tileSize - dw) / 2;
                    let dy = screenY + (this.tileSize - dh) / 2;
                    ctx.drawImage(img, s.sx, s.sy, s.sw, s.sh, dx, dy, dw, dh);
                } else if (type.startsWith('decor_')) {
                    const decorKey = type.replace('decor_', '');
                    const s = assets.slices.decor[decorKey];
                    if (s) {
                        let dx = screenX + (this.tileSize - s.displayW) / 2;
                        let dy = screenY + (this.tileSize - s.displayH) / 2;
                        ctx.drawImage(img, s.sx, s.sy, s.sw, s.sh, dx, dy, s.displayW, s.displayH);
                    }
                }
            }
        }
    }
}
