class Player {
    constructor(x, y) {
        // 世界坐标
        this.x = x;
        this.y = y;
        this.radius = 20; // 头部大小
        this.color = '#ff6b6b'; // 暂时代替材质色块

        this.speed = 200; // 每秒移动像素
        this.direction = { x: 0, y: 0 }; // 运动方向
        
        // 身体机制
        this.segments = 1; // 初始 1 个身体节
        this.score = 0; // 积分
        this.pathHistory = [];
        this.recordDistance = 2; // 历史记录点的间隔像素
        this.segmentSpacing = 28; // 身体节点间的绝对距离大小
        this.historySpacing = Math.round(this.segmentSpacing / this.recordDistance);
        
        // 初始化记录当前点
        this.pathHistory.push({x: this.x, y: this.y});
    }

    update(dt) {
        // 从输入获取当前朝向（针对屏幕中心，因为摄像机一直对准头部）
        // 获取 Canvas 尺寸，默认主角在屏幕中心
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        const dir = Input.getDirection(centerX, centerY);
        if (dir) {
            this.direction = dir;
            // 依据方向和 dt 进行位移计算
            const stepX = this.direction.x * this.speed * (dt / 1000);
            const stepY = this.direction.y * this.speed * (dt / 1000);
            
            this.x += stepX;
            this.y += stepY;
            
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
                        window.onGameOver();
                    }
                    return; // 一死直接中断移动
                }
            }
        }
    }

    draw(ctx, camera) {
        if (!assets.allLoaded) return; // 图片没加载完不画

        const charImg = assets.getImage('character');
        const sData = assets.slices.character;

        // 1. 先绘制身体（从最后一个节往前画）
        for (let i = this.segments; i >= 1; i--) {
            let index = i * this.historySpacing;
            if (index >= this.pathHistory.length) {
                index = Math.max(0, this.pathHistory.length - 1);
            }
            
            const point = this.pathHistory[index];
            if (point) {
                const screenX = point.x - camera.x;
                const screenY = point.y - camera.y;
                
                // 计算当前节点真正朝向头部的切线角度
                let angle = 0;
                if (index - 1 >= 0) {
                    const nextP = this.pathHistory[index - 1]; // 朝向头部的最近点
                    angle = Math.atan2(nextP.y - point.y, nextP.x - point.x);
                } else if (index + 1 < this.pathHistory.length) {
                    const prevP = this.pathHistory[index + 1];
                    angle = Math.atan2(point.y - prevP.y, point.x - prevP.x);
                }

                ctx.save();
                ctx.translate(screenX, screenY);
                ctx.rotate(angle);
                // 当朝左移动时，垂直翻转让肉卷的肚皮也能始终保持在下方
                if (Math.abs(angle) > Math.PI / 2) {
                    ctx.scale(1, -1);
                }
                
                // 绘制躯干切图
                if (charImg) {
                    ctx.drawImage(charImg, 
                        sData.body.sx, sData.body.sy, sData.body.sw, sData.body.sh,
                        -sData.body.displayW/2, -sData.body.displayH/2, 
                        sData.body.displayW, sData.body.displayH
                    );
                }
                ctx.restore();
            }
        }

        // 2. 绘制尾巴（挂在最后一节后面）
        if (this.segments >= 1) {
            let lastIndex = this.segments * this.historySpacing;
            if (lastIndex >= this.pathHistory.length) lastIndex = Math.max(0, this.pathHistory.length - 1);
            const tailP = this.pathHistory[lastIndex];
            if (tailP) {
                let tailAngle = 0;
                if (lastIndex - 1 >= 0) {
                    const nextP = this.pathHistory[lastIndex - 1]; // 朝向头部的最近点
                    tailAngle = Math.atan2(nextP.y - tailP.y, nextP.x - tailP.x);
                } else if (lastIndex + 1 < this.pathHistory.length) {
                    const prevP = this.pathHistory[lastIndex + 1];
                    tailAngle = Math.atan2(tailP.y - prevP.y, tailP.x - prevP.x);
                }
                
                // 尾巴衔接处往后退一点避免吃进身子里
                const tailX = tailP.x - camera.x - Math.cos(tailAngle) * 15;
                const tailY = tailP.y - camera.y - Math.sin(tailAngle) * 15;
                
                ctx.save();
                ctx.translate(tailX, tailY);
                ctx.rotate(tailAngle);
                // 同样适配向左边走时的防倒置翻转
                if (Math.abs(tailAngle) > Math.PI / 2) {
                    ctx.scale(1, -1);
                }
                
                if (charImg) {
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
        // 如果没有移动，就跟随最后一个有朝向的过程
        if(this.direction.x === 0 && this.direction.y === 0 && this.pathHistory.length > 5) {
             headAngle = Math.atan2(this.y - this.pathHistory[5].y, this.x - this.pathHistory[5].x);
        }

        ctx.save();
        ctx.translate(headScreenX, headScreenY);
        
        // 当朝左移动时，垂直翻转让人物始终保持正脸而不会倒置
        if (Math.abs(headAngle) > Math.PI / 2) {
            ctx.scale(1, -1);
        }
        
        ctx.rotate(headAngle);
        
        // 渲染头部贴图
        if (charImg) {
            ctx.drawImage(charImg,
                sData.head.sx, sData.head.sy, sData.head.sw, sData.head.sh,
                -sData.head.displayW/2, -sData.head.displayH/2,
                sData.head.displayW, sData.head.displayH
            );
        }
        ctx.restore();
    }
}
