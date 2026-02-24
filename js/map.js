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

    // 各种装饰物的实际碰撞半径（精灵都远小于 150px 的瓦片格）
    _getDecorCollisionRadius(key) {
        if (key.includes('mushroom')) return 35;  // 蘑菇房较大
        if (key.includes('tree'))     return 30;  // 树
        if (key.includes('stump'))    return 20;  // 树桩较小
        if (key.includes('rock'))     return 25;  // 石头
        if (key.includes('flower_bed')) return 30; // 花坛
        return 0; // 非碰撞装饰
    }
    
    // 获取围栏在世界坐标中的实际碰撞矩形（而非整个瓦片格）
    _getFenceRect(tx, ty, tileType) {
        const fenceH = assets.slices.map.fence_h;
        const ratio = fenceH.sw / fenceH.sh;
        
        if (tileType === 'wall_h') {
            const dw = this.tileSize;
            const dh = this.tileSize / ratio;
            return {
                left: tx * this.tileSize,
                top: ty * this.tileSize + (this.tileSize - dh) / 2,
                width: dw,
                height: dh
            };
        } else { // wall_v
            const visualH = this.tileSize;
            const visualW = this.tileSize / ratio;
            return {
                left: tx * this.tileSize + (this.tileSize - visualW) / 2,
                top: ty * this.tileSize,
                width: visualW,
                height: visualH
            };
        }
    }

    // 圆形与矩形碰撞检测
    _circleRectCollision(cx, cy, radius, rect) {
        const closestX = Math.max(rect.left, Math.min(cx, rect.left + rect.width));
        const closestY = Math.max(rect.top, Math.min(cy, rect.top + rect.height));
        const dist = Math.hypot(cx - closestX, cy - closestY);
        return dist < radius;
    }

    // 像素级围栏碰撞检测（扫描周围瓦片，只检测围栏精灵的实际渲染区域）
    _checkFenceHit(x, y, radius) {
        const scanRange = 2;
        const centerTX = Math.floor(x / this.tileSize);
        const centerTY = Math.floor(y / this.tileSize);
        
        for (let cx = centerTX - scanRange; cx <= centerTX + scanRange; cx++) {
            for (let cy = centerTY - scanRange; cy <= centerTY + scanRange; cy++) {
                if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) continue;
                const tile = this.tiles[cx][cy];
                if (tile !== 'wall_h' && tile !== 'wall_v') continue;
                
                const rect = this._getFenceRect(cx, cy, tile);
                if (this._circleRectCollision(x, y, radius, rect)) {
                    return true;
                }
            }
        }
        return false;
    }

    // 通用装饰物像素级碰撞检测（返回碰撞到的 key 或 null）
    _checkDecorHit(x, y, radius, filterFn) {
        const scanRange = Math.max(1, Math.ceil((radius + 40) / this.tileSize));
        const centerTX = Math.floor(x / this.tileSize);
        const centerTY = Math.floor(y / this.tileSize);
        
        for (let cx = centerTX - scanRange; cx <= centerTX + scanRange; cx++) {
            for (let cy = centerTY - scanRange; cy <= centerTY + scanRange; cy++) {
                if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) continue;
                const tile = this.tiles[cx][cy];
                if (!tile || !tile.startsWith('decor_')) continue;
                
                const key = tile.replace('decor_', '');
                const decorRadius = this._getDecorCollisionRadius(key);
                if (decorRadius <= 0) continue;  // 没有碰撞体积的装饰（小花小草等）
                if (filterFn && !filterFn(key)) continue;  // 不符合过滤条件
                
                // 装饰物视觉中心 = 瓦片正中央
                const objCX = cx * this.tileSize + this.tileSize / 2;
                const objCY = cy * this.tileSize + this.tileSize / 2;
                const dist = Math.hypot(x - objCX, y - objCY);
                
                if (dist < decorRadius + radius) {
                    return key;
                }
            }
        }
        return null;
    }

    // 致命碰撞检测（边界墙 + 岩石）
    isLethal(x, y, radius = 0) {
        if (x < radius || x >= this.width - radius || y < radius || y >= this.height - radius) return true;
        
        // 边界围栏检测（像素级：只检测围栏精灵的实际渲染区域）
        if (this._checkFenceHit(x, y, radius)) return true;
        
        // 岩石：像素级距离检测
        const hitKey = this._checkDecorHit(x, y, radius, (key) => key.includes('rock'));
        return hitKey !== null;
    }

    // 阻挡物碰撞检测（边界 + 蘑菇房/树/树桩/花坛/岩石全部像素级）
    isWall(x, y, radius = 0) {
        if (x < radius || x >= this.width - radius || y < radius || y >= this.height - radius) return true;
        
        // 边界围栏检测（像素级：只检测围栏精灵的实际渲染区域）
        if (this._checkFenceHit(x, y, radius)) return true;
        
        // 所有实体装饰物：像素级距离检测
        const hitKey = this._checkDecorHit(x, y, radius);
        return hitKey !== null;
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

        const vs = window.viewScale || 1;
        const effW = ctx.canvas.width / vs;
        const effH = ctx.canvas.height / vs;
        const startCol = Math.max(0, Math.floor(camera.x / this.tileSize));
        const endCol = Math.min(this.cols - 1, Math.floor((camera.x + effW) / this.tileSize));
        const startRow = Math.max(0, Math.floor(camera.y / this.tileSize));
        const endRow = Math.min(this.rows - 1, Math.floor((camera.y + effH) / this.tileSize));

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
