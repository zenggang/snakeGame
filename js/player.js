class Player {
    constructor(x, y) {
        // 世界坐标
        this.x = x;
        this.y = y;
        this.radius = 20; // 头部大小
        this.color = '#ff6b6b'; // 暂时代替材质色块

        this.speed = 200; // 每秒移动像素
        this.direction = { x: 0, y: 0 }; // 运动方向
        
        // 冲刺系统
        this.boostCharges = 3;     // 默认 3 次冲刺
        this.boostActive = false;
        this.boostTimer = 0;       // 冲刺剩余时间(ms)
        this.boostDuration = 5000; // 冲刺持续 5 秒
        
        // 身体机制
        this.segments = 3; // 初始 3 个身体节，给新手缓冲
        this.score = 0; // 积分
        this.pathHistory = [];
        this.recordDistance = 2; // 历史记录点的间隔像素
        this.segmentSpacing = 28; // 身体节点间的绝对距离大小
        this.historySpacing = Math.round(this.segmentSpacing / this.recordDistance);
        
        // 初始化记录当前点
        this.pathHistory.push({x: this.x, y: this.y});
    }

    activateBoost() {
        if (this.boostCharges > 0 && !this.boostActive) {
            this.boostCharges--;
            this.boostActive = true;
            this.boostTimer = this.boostDuration;
        }
    }

    update(dt) {
        // 冲刺计时器
        if (this.boostActive) {
            this.boostTimer -= dt;
            if (this.boostTimer <= 0) {
                this.boostActive = false;
                this.boostTimer = 0;
            }
        }

        // 从输入获取当前朝向（针对屏幕中心，因为摄像机一直对准头部）
        // 获取 Canvas 尺寸，默认主角在屏幕中心
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        const currentSpeed = this.boostActive ? this.speed * 2 : this.speed;
        
        const dir = Input.getDirection(centerX, centerY);
        if (dir) {
            this.direction = dir;
            // 依据方向和 dt 进行位移计算
            const stepX = this.direction.x * currentSpeed * (dt / 1000);
            const stepY = this.direction.y * currentSpeed * (dt / 1000);
            
            const nextX = this.x + stepX;
            const nextY = this.y + stepY;

            // 地形检查 (致命障碍物、普通阻挡墙壁、落水)
            if (typeof mapManager !== 'undefined') {
                if (mapManager.isLethal(nextX, nextY, this.radius)) {
                    if (typeof window.onGameOver === 'function') {
                        window.onGameOver("撞碎在了坚硬的岩石或世界尽头的墙上！");
                    }
                    return;
                }
                
                if (mapManager.isWall(nextX, nextY, this.radius)) {
                    // 非致命的墙壁（蘑菇房、树等），阻拦玩家继续移动
                    return;
                }
                // 碰水反弹推回，不直接死亡
                if (mapManager.isWater(nextX, nextY, this.radius)) {
                    // 反向推回
                    this.x -= stepX * 2;
                    this.y -= stepY * 2;
                    // 扣一些分数作为惩罚
                    this.score = Math.max(0, this.score - 20);
                    return;
                }
            }
            
            this.x = nextX;
            this.y = nextY;
            
            // 记录 Path History
            if (this.pathHistory.length > 0) {
                const head = {x: this.x, y: this.y};
                const last = this.pathHistory[0];
                const dist = Math.hypot(head.x - last.x, head.y - last.y);
                
                if (dist >= this.recordDistance) {
                    // 如果单帧位移较大，通过线性插值补充路径点以确保平滑
                    const steps = Math.floor(dist / this.recordDistance);
                    for (let i = 1; i <= steps; i++) {
                        const t = i / steps;
                        this.pathHistory.unshift({
                            x: last.x + (head.x - last.x) * t,
                            y: last.y + (head.y - last.y) * t
                        });
                    }
                }
            }
        }
        
        // 修剪不需要的过长历史记录
        const maxLength = (this.segments + 1) * this.historySpacing + 10;
        if (this.pathHistory.length > maxLength) {
            this.pathHistory.length = maxLength;
        }

        // 自杀（咬到自己身体）判定
        // 前几节因为转弯半径问题可能会有重叠缓冲，所以从第 3 节身体开始检测
        for (let i = 3; i <= this.segments; i++) {
            let index = i * this.historySpacing;
            if (index < this.pathHistory.length) {
                const sPoint = this.pathHistory[index];
                const distToBody = Math.hypot(this.x - sPoint.x, this.y - sPoint.y);
                // 距离过近代表咬到了（考虑一点容错值）
                if (distToBody < this.radius) {
                    if (typeof window.onGameOver === 'function') {
                        window.onGameOver("不小心咬到了自己的身体！");
                    }
                    return; // 一死直接中断移动
                }
            }
        }
    }

    draw(ctx, camera) {
        if (!assets.allLoaded) return; 

        const charImg = assets.getImage('spritesheet');
        const sData = assets.slices.character;

        // 1. 先绘制身体（从最后一个节往前画，只在路径够长时才画）
        const minHistoryForBody = 2 * this.historySpacing;
        for (let i = this.segments; i >= 1; i--) {
            let index = i * this.historySpacing;
            if (index >= this.pathHistory.length) {
                index = Math.max(0, this.pathHistory.length - 1);
            }
            
            const point = this.pathHistory[index];
            if (point && this.pathHistory.length >= minHistoryForBody) {
                const screenX = point.x - camera.x;
                const screenY = point.y - camera.y;
                
                let angle = 0;
                if (index - 1 >= 0) {
                    const nextP = this.pathHistory[index - 1]; 
                    angle = Math.atan2(nextP.y - point.y, nextP.x - point.x);
                } else if (index + 1 < this.pathHistory.length) {
                    const prevP = this.pathHistory[index + 1];
                    angle = Math.atan2(point.y - prevP.y, point.x - prevP.x);
                }

                ctx.save();
                ctx.translate(screenX, screenY);
                ctx.rotate(angle);
                if (Math.abs(angle) > Math.PI / 2) {
                    ctx.scale(1, -1);
                }
                
                if (charImg && sData.body) {
                    ctx.drawImage(charImg, 
                        sData.body.sx, sData.body.sy, sData.body.sw, sData.body.sh,
                        -sData.body.displayW/2, -sData.body.displayH/2, 
                        sData.body.displayW, sData.body.displayH
                    );
                }
                ctx.restore();
            }
        }

        // 2. 绘制尾巴（路径足够长时才画）
        if (this.segments >= 1 && this.pathHistory.length >= minHistoryForBody) {
            let lastIndex = this.segments * this.historySpacing;
            if (lastIndex >= this.pathHistory.length) lastIndex = Math.max(0, this.pathHistory.length - 1);
            const tailP = this.pathHistory[lastIndex];
            if (tailP) {
                let tailAngle = 0;
                if (lastIndex - 1 >= 0) {
                    const nextP = this.pathHistory[lastIndex - 1]; 
                    tailAngle = Math.atan2(nextP.y - tailP.y, nextP.x - tailP.x);
                } else if (lastIndex + 1 < this.pathHistory.length) {
                    const prevP = this.pathHistory[lastIndex + 1];
                    tailAngle = Math.atan2(tailP.y - prevP.y, tailP.x - prevP.x);
                }
                
                const tailX = tailP.x - camera.x - Math.cos(tailAngle) * 15;
                const tailY = tailP.y - camera.y - Math.sin(tailAngle) * 15;
                
                ctx.save();
                ctx.translate(tailX, tailY);
                ctx.rotate(tailAngle);
                
                // Tail piece we picked (sx:2229) is drawn horizontally.
                if (Math.abs(tailAngle) > Math.PI / 2) {
                    ctx.scale(1, -1);
                }
                
                if (charImg && sData.butt) {
                    ctx.drawImage(charImg,
                        sData.butt.sx, sData.butt.sy, sData.butt.sw, sData.butt.sh,
                        -sData.butt.displayW/2, -sData.butt.displayH/2,
                        sData.butt.displayW, sData.butt.displayH
                    );
                }
                ctx.restore();
            }
        }

        // 3. 最后绘制头部
        const headScreenX = this.x - camera.x;
        const headScreenY = this.y - camera.y;
        
        // 头部的朝向
        let headAngle = Math.atan2(this.direction.y, this.direction.x);
        if(this.direction.x === 0 && this.direction.y === 0 && this.pathHistory.length > 5) {
             headAngle = Math.atan2(this.y - this.pathHistory[5].y, this.x - this.pathHistory[5].x);
        }

        ctx.save();
        ctx.translate(headScreenX, headScreenY);
        
        let headSlice = sData.head_right;
        
        // Determing which head slice to use based on angle
        if (headAngle >= -Math.PI / 4 && headAngle <= Math.PI / 4) {
             headSlice = sData.head_right;
        } else if (headAngle > Math.PI / 4 && headAngle < 3 * Math.PI / 4) {
             headSlice = sData.head_down;
        } else if (headAngle >= 3 * Math.PI / 4 || headAngle <= -3 * Math.PI / 4) {
             headSlice = sData.head_left;
        } else {
             headSlice = sData.head_up;
        }
        
        if (charImg && headSlice) {
            ctx.drawImage(charImg,
                headSlice.sx, headSlice.sy, headSlice.sw, headSlice.sh,
                -headSlice.displayW/2, -headSlice.displayH/2,
                headSlice.displayW, headSlice.displayH
            );
        }
        ctx.restore();
    }
}
