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
    gravityEnabled: false, // 用户是否主动开启了重力模式

    toggleGravity() {
        const dpad = document.getElementById('dpad');
        const toggleBtn = document.getElementById('gravity-toggle');
        
        if (this.gravityEnabled) {
            // 关闭重力模式，回到按钮模式
            this.gravityEnabled = false;
            this.gravity.active = false;
            this.gravity.x = 0;
            this.gravity.y = 0;
            if (dpad) dpad.style.display = 'flex';
            if (toggleBtn) {
                toggleBtn.textContent = '🔄 切换重力模式';
                toggleBtn.classList.remove('active');
            }
        } else {
            // 开启重力模式，隐藏按钮
            this.gravityEnabled = true;
            if (dpad) dpad.style.display = 'none';
            if (toggleBtn) {
                toggleBtn.textContent = '🎮 切换按钮模式';
                toggleBtn.classList.add('active');
            }
            this.requestGravityPermission();
        }
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
        if (!this.gravityEnabled) return; // 用户未开启重力模式时忽略
        
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
            // 空格键触发冲刺
            if (e.code === 'Space' && typeof player !== 'undefined') {
                e.preventDefault();
                player.activateBoost();
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
        
        // 移动端虚拟方向键绑定
        const dpadMap = {
            'dpad-up': 'ArrowUp',
            'dpad-down': 'ArrowDown',
            'dpad-left': 'ArrowLeft',
            'dpad-right': 'ArrowRight'
        };
        
        Object.entries(dpadMap).forEach(([btnId, keyName]) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            
            const press = (e) => {
                e.preventDefault();
                this.keys[keyName] = true;
                this.mouse.active = false;
                this.gravity.active = false;
                btn.classList.add('pressed');
            };
            const release = (e) => {
                e.preventDefault();
                this.keys[keyName] = false;
                btn.classList.remove('pressed');
            };
            
            btn.addEventListener('touchstart', press, { passive: false });
            btn.addEventListener('touchend', release, { passive: false });
            btn.addEventListener('touchcancel', release, { passive: false });
        });
        
        // 重力模式切换按钮
        const gravityToggle = document.getElementById('gravity-toggle');
        if (gravityToggle) {
            gravityToggle.addEventListener('click', () => {
                this.toggleGravity();
            });
        }
        
        // 冲刺按钮
        const boostBtn = document.getElementById('boost-btn');
        if (boostBtn) {
            boostBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof player !== 'undefined') {
                    player.activateBoost();
                }
            });
        }
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
