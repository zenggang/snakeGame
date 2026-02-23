class PropsManager {
    constructor() {
        this.props = [];
        this.maxProps = 80; // 场上最大道具数
        this.spawnRadius = 1500; // 生成范围
    }

    update(player, dt) {
        // 补充道具
        while (this.props.length < this.maxProps) {
            this.spawnProp(player);
        }

        // 碰撞检测与逻辑更新
        for (let i = this.props.length - 1; i >= 0; i--) {
            let prop = this.props[i];
            
            // 如果是虫子，处理移动和动画
            if (prop.type === 'debuff') {
                // 只有虫子才有追踪 AI，便便不追人（vx/vy 始终为 0）
                const isBug = prop.textureKey === 'bug_green' || prop.textureKey === 'bug_red';
                
                if (isBug) {
                    let chaseDistSq = Math.pow(player.x - prop.x, 2) + Math.pow(player.y - prop.y, 2);
                    
                    // 初始化追踪计时器
                    if (prop.chaseTimer === undefined) prop.chaseTimer = 0;
                    
                    if (chaseDistSq < 300 * 300 && prop.chaseTimer <= 0) {
                        // 进入追踪状态，持续 2 秒
                        let chaseAngle = Math.atan2(player.y - prop.y, player.x - prop.x);
                        let chaseSpeed = 120; // 追踪速度（主角 200，保证主角更快）
                        prop.vx = Math.cos(chaseAngle) * chaseSpeed;
                        prop.vy = Math.sin(chaseAngle) * chaseSpeed;
                        prop.chaseTimer = 2000; // 追 2 秒就放弃
                    }
                    
                    if (prop.chaseTimer > 0) {
                        prop.chaseTimer -= dt;
                        if (prop.chaseTimer <= 0) {
                            // 追踪结束，恢复随机漫步并进入 3 秒冷却
                            prop.vx = (Math.random() - 0.5) * 60;
                            prop.vy = (Math.random() - 0.5) * 60;
                            prop.chaseTimer = -3000; // 负值表示冷却中
                        }
                    } else if (prop.chaseTimer < 0) {
                        prop.chaseTimer += dt; // 冷却倒计时
                    }
                    
                    // 虫子移动
                    prop.x += prop.vx * (dt / 1000);
                    prop.y += prop.vy * (dt / 1000);
                    
                    // 碰到墙壁反弹
                    if (typeof mapManager !== 'undefined') {
                        if (mapManager.isWall(prop.x, prop.y, prop.radius)) {
                            prop.vx *= -1;
                            prop.vy *= -1;
                            prop.x += prop.vx * (dt / 1000) * 2;
                            prop.y += prop.vy * (dt / 1000) * 2;
                        }
                    }
                }

                // 帧动画
                prop.animTimer += dt;
                if (prop.animTimer > 150) { // 每 150ms 切换一帧
                    prop.animTimer = 0;
                    prop.frameIdx = (prop.frameIdx + 1) % 3;
                }
            }

            let dist = Math.hypot(player.x - prop.x, player.y - prop.y);
            
            // 头半径 + 道具半径 的碰撞检测
            if (dist < player.radius + prop.radius) {
                this.consumeProp(player, prop);
                this.props.splice(i, 1);
            } 
            // 越界回收
            else if (dist > 1500) {
                this.props.splice(i, 1);
            }
        }
    }

    spawnProp(player) {
        // 随机在玩家周围生成
        let angle = Math.random() * Math.PI * 2;
        let r = Math.random() * (this.spawnRadius - 800) + 800;
        let px = player.x + Math.cos(angle) * r;
        let py = player.y + Math.sin(angle) * r;
        
        // 如果出生点是水或者墙，就放弃本次生成
        if (typeof mapManager !== 'undefined') {
            if (mapManager.isWall(px, py, 20) || mapManager.isWater(px, py, 20)) {
                return;
            }
        }
        
        // 将 buff 概率下降至 0.25 减少整体骨头
        let isBuff = Math.random() < 0.25;
        let textureKey = '';
        let points = 0;
        let growth = 0;
        let radius = 20;

        if (isBuff) {
            let roll = Math.random();
            if (roll < 0.5) {
                // 50% 概率是普通骨头，进一步稀释了骨头浓度
                let boneRoll = Math.random();
                if (boneRoll < 0.6) {
                    textureKey = 'bone_s'; points = 10; growth = 1; radius = 20;
                } else if (boneRoll < 0.9) {
                    textureKey = 'bone_m'; points = 30; growth = 2; radius = 25;
                } else {
                    textureKey = 'bone_l'; points = 100; growth = 5; radius = 35;
                }
            } else if (roll < 0.8) {
                // 30% 是糖果
                textureKey = 'candy'; points = 50; growth = 5; radius = 25;
            } else {
                // 20% 是面包
                textureKey = 'bread'; points = 80; growth = 8; radius = 30;
            }
        } else {
            let roll = Math.random();
            if (roll < 0.4) {
                textureKey = 'bug_green'; points = -30; growth = -1; radius = 25;
            } else if (roll < 0.8) {
                textureKey = 'bug_red'; points = -50; growth = -1; radius = 25;
            } else {
                textureKey = 'poop'; points = -5; growth = -5; radius = 25; // 大便：减5节
            }
        }
        
        // 便便和增益一样不移动
        let isImmobile = isBuff || textureKey === 'poop';
        
        // 虫子速度倍率：红虫 2 倍、绿虫 1.5 倍
        let speedMul = 1;
        if (textureKey === 'bug_red') speedMul = 2;
        else if (textureKey === 'bug_green') speedMul = 1.5;
        
        let prop = {
            x: px,
            y: py,
            radius: radius,
            type: isBuff ? 'buff' : 'debuff',
            textureKey: textureKey,
            points: points,
            growth: growth,
            // 虫子专用属性
            animTimer: 0,
            frameIdx: 0,
            vx: isImmobile ? 0 : (Math.random() - 0.5) * 100 * speedMul,
            vy: isImmobile ? 0 : (Math.random() - 0.5) * 100 * speedMul
        };
        
        this.props.push(prop);
    }

    consumeProp(player, prop) {
        if (prop.type === 'buff') {
            player.segments += prop.growth;
            player.score += prop.points;
            if (prop.textureKey === 'bread') {
                // 面包：额外冲刺次数 +1
                player.boostCharges++;
            }
            this.playSound('buff');
        } else if (prop.type === 'debuff') {
            player.score = Math.max(0, player.score + prop.points);
            
            if (prop.textureKey === 'bug_green') {
                // 绿虫子：长度直接减半，但至少保留一节
                player.segments = Math.max(1, Math.floor(player.segments / 2));
            } else if (prop.textureKey === 'bug_red') {
                // 红虫子：碰上直接死亡
                if (typeof window.onGameOver === 'function') {
                    window.onGameOver("吃下了极其剧毒的红瓢虫！");
                }
            } else if (prop.textureKey === 'poop') {
                // 大便：减 5 节
                player.segments = Math.max(1, player.segments - 5);
            }
            this.playSound('debuff');
        }
    }

    draw(ctx, camera) {
        if (!assets.allLoaded) return;
        
        const propsImg = assets.getImage('spritesheet');
        const sData = assets.slices.props;
        
        const time = performance.now() / 200;

        for (let prop of this.props) {
            const screenX = prop.x - camera.x;
            const screenY = prop.y - camera.y;
            
            if (screenX < -100 || screenX > window.innerWidth + 100 || 
                screenY < -100 || screenY > window.innerHeight + 100) {
                continue;
            }
            
            ctx.save();
            
            let s;
            if (prop.type === 'buff') {
                // 增益道具，带上下浮动
                const floatY = Math.sin(time + prop.x) * 5;
                ctx.translate(screenX, screenY + floatY);
                s = sData[prop.textureKey];
                
                if (prop.textureKey === 'bone_l' || prop.textureKey === 'candy' || prop.textureKey === 'bread') {
                    // 稀有增益道具发光特效
                    ctx.shadowColor = 'rgba(255, 255, 0, 0.8)';
                    ctx.shadowBlur = 15;
                }
            } else {
                // 虫子，根据朝向旋转
                ctx.translate(screenX, screenY);
                let angle = Math.atan2(prop.vy, prop.vx);
                ctx.rotate(angle);
                if (Math.abs(angle) > Math.PI / 2) ctx.scale(1, -1);
                
                s = sData[prop.textureKey][prop.frameIdx];
            }
            
            if (s) {
                ctx.drawImage(propsImg,
                    s.sx, s.sy, s.sw, s.sh,
                    -s.displayW/2, -s.displayH/2,
                    s.displayW, s.displayH
                );
            }
            
            ctx.restore();
        }
    }

    playSound(type) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            // 复用全局 AudioContext 实例
            if (!PropsManager._audioCtx || PropsManager._audioCtx.state === 'closed') {
                PropsManager._audioCtx = new AudioContext();
            }
            const audioCtx = PropsManager._audioCtx;
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            if (type === 'buff') {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.1);
            } else {
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.2);
            }
        } catch(e) {}
    }
}
