const Input = {
    keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        ArrowUp: false,
        ArrowLeft: false,
        ArrowDown: false,
        ArrowRight: false
    },
    mouse: {
        x: null,
        y: null,
        active: false // 表示最近使用的是鼠标还是键盘
    },
    gravity: {
        active: false,
        x: 0,
        y: 0
    },

    requestGravityPermission() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', this.handleOrientation.bind(this));
                    }
                })
                .catch(console.error);
        } else {
            // 非 iOS 13+ 设备或不支持的设备直接监听
            window.addEventListener('deviceorientation', this.handleOrientation.bind(this));
        }
    },

    handleOrientation(event) {
        if (event.beta === null) return; // 设备不支持或无法获取
        
        this.gravity.active = true;
        this.mouse.active = false;
        
        let gamma = event.gamma || 0; // 左右倾斜 [-90, 90]
        let beta = event.beta || 0;   // 前后倾斜 [-180, 180]
        
        // 考虑屏幕横竖屏旋转
        let orientation = window.orientation || 0;
        let dx = 0;
        let dy = 0;
        
        if (orientation === 90) { // 向左横屏
            dx = beta;
            dy = -gamma;
        } else if (orientation === -90) { // 向右横屏
            dx = -beta;
            dy = gamma;
        } else { // 竖屏
            // 用户大概率会平躺或者斜拿着手机，所以把基础 beta 减去一定值会让体验更好
            // 但为了通用，只设死区
            dx = gamma;
            dy = beta - 30; // 假设标准握持角度是向上倾斜 30 度
        }

        const deadzone = 8; // 死区，防止轻微晃动导致误触
        
        if (Math.abs(dx) < deadzone) dx = 0;
        if (Math.abs(dy) < deadzone) dy = 0;
        
        // 归一化倾角到 -1 到 1 的速度输入（最高控制角度为 30 度）
        this.gravity.x = Math.max(-1, Math.min(1, dx / 30));
        this.gravity.y = Math.max(-1, Math.min(1, dy / 30));
    },

    init() {
        // 键盘事件监听
        window.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.key) || this.keys.hasOwnProperty(e.code)) {
                this.keys[e.key] = true;
                this.mouse.active = false;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.key) || this.keys.hasOwnProperty(e.code)) {
                this.keys[e.key] = false;
            }
        });

        // 鼠标事件监听
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            this.mouse.active = true;
        });
        
        // 当鼠标不再处于激活状态或移出屏幕时处理
        window.addEventListener('mouseout', () => {
             this.mouse.active = false;
        });
    },

    getDirection(playerScreenX, playerScreenY) {
        let dx = 0;
        let dy = 0;

        if (this.gravity.active && (this.gravity.x !== 0 || this.gravity.y !== 0)) {
            // 优先使用手机重力感应
            dx = this.gravity.x;
            dy = this.gravity.y;
            // 倾斜本身已经归一化并提供了平滑度，不再做长度 1 的强制固定
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length > 1) {
                dx /= length;
                dy /= length;
            }
            return { x: dx, y: dy };
        } else if (!this.mouse.active) {
            // 使用键盘输入
            if (this.keys.w || this.keys.ArrowUp) dy -= 1;
            if (this.keys.s || this.keys.ArrowDown) dy += 1;
            if (this.keys.a || this.keys.ArrowLeft) dx -= 1;
            if (this.keys.d || this.keys.ArrowRight) dx += 1;
            
            if (dx === 0 && dy === 0) return null; // 没有输入
        } else {
            // 使用鼠标输入
            if (this.mouse.x === null || this.mouse.y === null) return null;
            dx = this.mouse.x - playerScreenX;
            dy = this.mouse.y - playerScreenY;
            
            // 如果鼠标和主角位置非常接近，则停止移动，避免抖动
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
                return null;
            }
        }

        // 归一化方向向量（鼠标和键盘模式依然保持固定速度）
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            return { x: dx / length, y: dy / length };
        }
        return null; // 保护
    }
};
