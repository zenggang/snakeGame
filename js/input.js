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
    
    // 虚拟摇杆状态
    joystick: {
        active: false,
        dx: 0,
        dy: 0
    },

    toggleGravity() {
        const toggleBtn = document.getElementById('gravity-toggle');
        
        if (this.gravityEnabled) {
            // 关闭重力模式，回到摇杆模式
            this.gravityEnabled = false;
            this.gravity.active = false;
            this.gravity.x = 0;
            this.gravity.y = 0;
            const joystick = document.getElementById('joystick');
            if (joystick) joystick.style.display = 'block';
            if (toggleBtn) {
                toggleBtn.textContent = '🔄 切换重力模式';
                toggleBtn.classList.remove('active');
            }
        } else {
            // 开启重力模式，隐藏摇杆
            this.gravityEnabled = true;
            const joystick = document.getElementById('joystick');
            if (joystick) joystick.style.display = 'none';
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
        // 检测触屏设备（兼容微信等内嵌浏览器）
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            document.body.classList.add('touch-device');
        }
        
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
            // E 键触发护盾
            if (e.code === 'KeyE' && typeof player !== 'undefined') {
                e.preventDefault();
                player.activateShield();
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
        
        // 浮动虚拟摇杆：在屏幕任意非按钮区域按下即出现
        const joystickEl = document.getElementById('joystick');
        const knobEl = document.getElementById('joystick-knob');
        
        if (joystickEl && knobEl) {
            const maxDrag = 40;
            let touchId = null;       // 跟踪的触摸点 ID
            let originX = 0;          // 按下时的触摸中心
            let originY = 0;
            
            // 判断触摸点是否在按钮区域
            const isOnButton = (touch) => {
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (!el) return false;
                return el.closest('#boost-btn, #shield-btn, #gravity-toggle, .screen button');
            };
            
            const onTouchStart = (e) => {
                if (touchId !== null) return; // 已经有一个摇杆触摸在跟踪
                const touch = e.changedTouches[0];
                if (isOnButton(touch)) return; // 按钮区域不触发摇杆
                
                e.preventDefault();
                touchId = touch.identifier;
                originX = touch.clientX;
                originY = touch.clientY;
                
                // 将摇杆移到触摸位置
                joystickEl.style.left = (originX - 65) + 'px';
                joystickEl.style.top = (originY - 65) + 'px';
                joystickEl.style.bottom = 'auto';
                joystickEl.style.opacity = '1';
                
                knobEl.style.transform = 'translate(-50%, -50%)';
                this.joystick.active = false;
            };
            
            const onTouchMove = (e) => {
                if (touchId === null) return;
                for (const touch of e.changedTouches) {
                    if (touch.identifier !== touchId) continue;
                    e.preventDefault();
                    
                    let dx = touch.clientX - originX;
                    let dy = touch.clientY - originY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > maxDrag) {
                        dx = (dx / dist) * maxDrag;
                        dy = (dy / dist) * maxDrag;
                    }
                    
                    knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                    this.joystick.active = true;
                    this.joystick.dx = dx / maxDrag;
                    this.joystick.dy = dy / maxDrag;
                    this.mouse.active = false;
                    this.gravity.active = false;
                }
            };
            
            const onTouchEnd = (e) => {
                for (const touch of e.changedTouches) {
                    if (touch.identifier !== touchId) continue;
                    e.preventDefault();
                    touchId = null;
                    
                    joystickEl.style.opacity = '0';
                    knobEl.style.transform = 'translate(-50%, -50%)';
                    this.joystick.active = false;
                    this.joystick.dx = 0;
                    this.joystick.dy = 0;
                }
            };
            
            document.addEventListener('touchstart', onTouchStart, { passive: false });
            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('touchend', onTouchEnd, { passive: false });
            document.addEventListener('touchcancel', onTouchEnd, { passive: false });
        }
        
        // 重力模式切换按钮（touchstart 优先，保留 click 兼容桌面端）
        const gravityToggle = document.getElementById('gravity-toggle');
        if (gravityToggle) {
            gravityToggle.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                this.toggleGravity();
            }, { passive: false });
            gravityToggle.addEventListener('click', () => {
                this.toggleGravity();
            });
        }
        
        // 冲刺按钮
        const boostBtn = document.getElementById('boost-btn');
        if (boostBtn) {
            boostBtn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                if (typeof player !== 'undefined') player.activateBoost();
            }, { passive: false });
            boostBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof player !== 'undefined') player.activateBoost();
            });
        }
        
        // 护盾按钮
        const shieldBtn = document.getElementById('shield-btn');
        if (shieldBtn) {
            shieldBtn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                if (typeof player !== 'undefined') player.activateShield();
            }, { passive: false });
            shieldBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof player !== 'undefined') player.activateShield();
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
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length > 1) {
                dx /= length;
                dy /= length;
            }
            return { x: dx, y: dy };
        } else if (this.joystick.active) {
            // 虚拟摇杆输入
            dx = this.joystick.dx;
            dy = this.joystick.dy;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length < 0.15) return null; // 死区
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
