class PropsManager {
    constructor() {
        this.props = [];
        this.maxProps = 50; // 场上最大道具数
        this.spawnRadius = 1500; // 生成范围
    }

    update(player, dt) {
        // 补充道具
        while (this.props.length < this.maxProps) {
            this.spawnProp(player);
        }

        // 碰撞检测
        for (let i = this.props.length - 1; i >= 0; i--) {
            let prop = this.props[i];
            let dist = Math.hypot(player.x - prop.x, player.y - prop.y);
            
            // 头半径 + 道具半径 的碰撞检测
            if (dist < player.radius + prop.radius) {
                // 吃掉道具
                this.consumeProp(player, prop);
                this.props.splice(i, 1);
            }
        }
    }

    spawnProp(player) {
        // 随机在玩家周围但不在屏幕内的位置生成（简化：随机在一个圈内）
        let angle = Math.random() * Math.PI * 2;
        let r = Math.random() * (this.spawnRadius - 500) + 500; // 距离玩家500 - 1500像素
        
        // 7:3 比例生成增益和减益
        let isBuff = Math.random() < 0.7;
        
        // 随机选择具体材质 key
        let buffKeys = ['bone', 'candy', 'bread'];
        let debuffKeys = ['poop', 'bacteria', 'bug'];
        let textureKey = isBuff ? 
            buffKeys[Math.floor(Math.random() * buffKeys.length)] : 
            debuffKeys[Math.floor(Math.random() * debuffKeys.length)];
        
        let prop = {
            x: player.x + Math.cos(angle) * r,
            y: player.y + Math.sin(angle) * r,
            radius: 20, // 调整半径匹配图片显示大小
            type: isBuff ? 'buff' : 'debuff',
            textureKey: textureKey,
            points: isBuff ? 10 : -10
        };
        
        this.props.push(prop);
    }

    consumeProp(player, prop) {
        if (prop.type === 'buff') {
            player.segments += 1;
            player.score += prop.points;
            this.playSound('buff');
        } else if (prop.type === 'debuff') {
            player.score += prop.points;
            if (player.segments > 0) {
                player.segments -= 1;
            } else {
                // 触发死亡
                if (typeof window.onGameOver === 'function') {
                    window.onGameOver();
                }
            }
            this.playSound('debuff');
        }
    }

    draw(ctx, camera) {
        if (!assets.allLoaded) return;
        
        const propsImg = assets.getImage('props');
        const sData = assets.slices.props;
        
        const time = performance.now() / 200; // 时间因子用于浮动动画

        for (let prop of this.props) {
            const screenX = prop.x - camera.x;
            const screenY = prop.y - camera.y;
            
            if (screenX < -50 || screenX > window.innerWidth + 50 || 
                screenY < -50 || screenY > window.innerHeight + 50) {
                continue;
            }
            
            // 简单的上下浮动效果
            const floatY = Math.sin(time + prop.x) * 5;

            ctx.save();
            ctx.translate(screenX, screenY + floatY);
            
            // 获取对应的切片配置
            let s = sData[prop.textureKey];
            if (s) {
                // 如果是 debuff，适当增加旋转摇晃效果
                if (prop.type === 'debuff') {
                     ctx.rotate(Math.sin(time * 2 + prop.y) * 0.1);
                }
                
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
            const audioCtx = new AudioContext();
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
