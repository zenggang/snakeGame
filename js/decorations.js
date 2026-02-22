class DecorationsManager {
    constructor() {
        this.decorations = [];
        this.maxDecorations = 400; // 较多的装饰物数量让场景更丰富
        this.spawnRadius = 2500; // 距离玩家足够远处
        
        // 游戏初始时在原地按随机半径铺满装饰物
        for (let i = 0; i < this.maxDecorations; i++) {
            this.spawnDecoration(0, 0, Math.random() * this.spawnRadius);
        }
    }

    update(player) {
        // 回收太远的装饰物，并在视线外重新生成，维持大地图的无缝感
        for (let i = 0; i < this.decorations.length; i++) {
            let item = this.decorations[i];
            let dist = Math.hypot(player.x - item.x, player.y - item.y);
            
            if (dist > this.spawnRadius) {
                let angle = Math.random() * Math.PI * 2;
                // 在边缘生成
                let r = this.spawnRadius - 100;
                item.x = player.x + Math.cos(angle) * r;
                item.y = player.y + Math.sin(angle) * r;
            }
        }
    }

    spawnDecoration(centerX, centerY, radius) {
        let angle = Math.random() * Math.PI * 2;
        let r = radius !== undefined ? radius : (Math.random() * this.spawnRadius);
        
        let types = ['flower_white', 'flower_pink', 'bush', 'mushroom', 'rock'];
        let type = types[Math.floor(Math.random() * types.length)];
        
        this.decorations.push({
            x: centerX + Math.cos(angle) * r,
            y: centerY + Math.sin(angle) * r,
            type: type,
            size: Math.random() * 8 + 12 // 12 到 20 的大小随机
        });
    }

    draw(ctx, camera) {
        if (!assets.allLoaded) return;
        
        const sceneImg = assets.getImage('scene');
        // 如果我们用同一张整图的特定部分作为静态装饰
        // 简易起见，可以直接从场景大图中切下一些有代表性的花草或石头
        // 这里基于提供的完整图大致坐标切点缀
        const decorSlices = {
            'flower_white': { sx: 104, sy: 718, sw: 50, sh: 50},
            'flower_pink': { sx: 855, sy: 830, sw: 50, sh: 50},
            'bush': { sx: 195, sy: 890, sw: 120, sh: 80},
            'mushroom': { sx: 850, sy: 320, sw: 60, sh: 50},
            'rock': { sx: 920, sy: 730, sw: 55, sh: 45}
        };

        for (let item of this.decorations) {
            const screenX = item.x - camera.x;
            const screenY = item.y - camera.y;
            
            if (screenX < -150 || screenX > window.innerWidth + 150 || 
                screenY < -150 || screenY > window.innerHeight + 150) {
                continue;
            }

            ctx.save();
            ctx.translate(screenX, screenY);
            
            let slice = decorSlices[item.type];
            if (slice) {
                // 根据 size 比例缩放
                const scale = item.size / 20; 
                ctx.scale(scale, scale);
                
                ctx.drawImage(sceneImg,
                    slice.sx, slice.sy, slice.sw, slice.sh,
                    -slice.sw/2, -slice.sh/2,
                    slice.sw, slice.sh
                );
            }
            
            ctx.restore();
        }
    }
}
