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
        y: 0,
        calibrated: false, // 是否已校准基线
        baseBeta: 0,       // 校准时的 beta 值
        baseGamma: 0       // 校准时的 gamma 值
    },
    gravityEnabled: false, // 用户是否主动开启了重力模式
    _orientationHandler: null, // 保存 deviceorientation 监听器引用以便移除
    _calibrationTimer: null,   // 校准延迟计时器
    _calibrationReady: false,  // 300ms 等待窗口结束后为 true，代表可以采样
    
    // 虚拟摇杆状态
    joystick: {
        active: false,
        dx: 0,
        dy: 0
    },

    toggleGravity() {
        const toggleBtn = document.getElementById('gravity-toggle');
        
        if (this.gravityEnabled) {
            this.gravityEnabled = false;
            this.gravity.active = false;
            this.gravity.calibrated = false;
            // 取消还未完成的校准计时器，防止关闭后状态被污染
            if (this._calibrationTimer) {
                clearTimeout(this._calibrationTimer);
                this._calibrationTimer = null;
            }
            this._calibrationReady = false;
            if (this._orientationHandler) {
                window.removeEventListener('deviceorientation', this._orientationHandler);
                this._orientationHandler = null;
            }
            const joystick = document.getElementById('joystick');
            if (joystick) joystick.style.display = 'block';
            if (toggleBtn) {
                toggleBtn.textContent = '🔄 切换重力模式';
                toggleBtn.classList.remove('active');
            }
        } else {
            this.gravityEnabled = true;
            this.gravity.calibrated = false;
            this._calibrationReady = false;
            this._calibrationTimer = null;
            this.joystick.active = false;
            const joystick = document.getElementById('joystick');
            if (joystick) joystick.style.display = 'none';
            if (toggleBtn) {
                toggleBtn.textContent = '⌛ 正在启动重力...';
                toggleBtn.classList.add('active');
            }
            this.requestGravityPermission();
        }
    },

    requestGravityPermission() {
        // 先移除旧监听器（防止重复绑定）
        if (this._orientationHandler) {
            window.removeEventListener('deviceorientation', this._orientationHandler);
        }
        this._orientationHandler = this.handleOrientation.bind(this);
        
        console.log('[Gravity] requestGravityPermission called');
        
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            console.log('[Gravity] iOS mode: calling requestPermission()');
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    console.log('[Gravity] permission state:', permissionState);
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', this._orientationHandler);
                        console.log('[Gravity] listener added (iOS granted)');
                    }
                })
                .catch(e => console.error('[Gravity] permission error:', e));
        } else {
            window.addEventListener('deviceorientation', this._orientationHandler);
            console.log('[Gravity] listener added (non-iOS)');
        }
    },

    // 获取当前屏幕方向角度（兼容新旧 API）
    _getScreenOrientation() {
        if (screen.orientation && screen.orientation.angle !== undefined) {
            const angle = screen.orientation.angle;
            // screen.orientation.angle: 0=竖屏, 90=左横屏, 270=右横屏
            return angle === 270 ? -90 : angle;
        }
        // 降级到已弃用的 window.orientation（0, 90, -90）
        if (window.orientation !== undefined) {
            return window.orientation;
        }
        return 0;
    },

    handleOrientation(event) {
        if (!this.gravityEnabled || event.beta === null) return;
        
        let gamma = event.gamma || 0;
        let beta = event.beta || 0;
        
        // 延迟校准逻辑：先等待 300ms 让手机平稳，再用下一个事件的实时值作为零点
        if (!this.gravity.calibrated) {
            if (!this._calibrationReady) {
                // 还在等待窗口期，只启动一次 timer
                if (!this._calibrationTimer) {
                    this._calibrationTimer = setTimeout(() => {
                        this._calibrationReady = true; // 标记：下一个事件可以采样
                        this._calibrationTimer = null;
                    }, 300);
                }
                return; // 继续忽略数据
            }
            // 等待结束，用当前帧实时值作为零点
            this.gravity.baseBeta = beta;
            this.gravity.baseGamma = gamma;
            this.gravity.calibrated = true;
            this.gravity.active = true;
            this._calibrationReady = false;
            console.log('[Gravity] Calibrated at:', beta, gamma);
        }
        
        this.gravity.active = true;
        this.mouse.active = false;
        
        let dBeta = beta - this.gravity.baseBeta;
        let dGamma = gamma - this.gravity.baseGamma;
        const orientation = this._getScreenOrientation();
        let dx = 0, dy = 0;
        
        if (orientation === 90) { dx = dBeta; dy = -dGamma; }
        else if (orientation === -90) { dx = -dBeta; dy = dGamma; }
        else { dx = dGamma; dy = dBeta; }

        const deadzone = 4;
        if (Math.abs(dx) < deadzone) dx = 0;
        if (Math.abs(dy) < deadzone) dy = 0;
        
        this.gravity.x = Math.max(-1, Math.min(1, dx / 25));
        this.gravity.y = Math.max(-1, Math.min(1, dy / 25));
        
        const toggleBtn = document.getElementById('gravity-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = `🎯 已对准 [${this.gravity.x.toFixed(1)}, ${this.gravity.y.toFixed(1)}]`;
        }
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
                if (this.gravityEnabled) return; // 重力模式下不启动摇杆
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
                    // 注意：不要在这里设置 gravity.active = false，重力模式和摇杆互斥由 gravityEnabled 控制
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
            
            const container = document.getElementById('game-container') || document.body;
            container.addEventListener('touchstart', onTouchStart, { passive: false });
            container.addEventListener('touchmove', onTouchMove, { passive: false });
            container.addEventListener('touchend', onTouchEnd, { passive: false });
            container.addEventListener('touchcancel', onTouchEnd, { passive: false });
        }
        
        // 重力模式切换按钮
        const gravityToggle = document.getElementById('gravity-toggle');
        if (gravityToggle) {
            const isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0);
            if (isTouchDevice) {
                // 触屏设备：只用 touchstart，完全不绑 click（防止微信等环境双触发）
                gravityToggle.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleGravity();
                }, { passive: false });
            } else {
                // 桌面端：只用 click
                gravityToggle.addEventListener('click', () => {
                    this.toggleGravity();
                });
            }
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

        // 重力模式开启时，独占输入通道（不穿透到摇杆/鼠标）
        if (this.gravityEnabled) {
            if (!this.gravity.active) return null; // 事件尚未就绪
            dx = this.gravity.x;
            dy = this.gravity.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length < 0.05) return null; // 微小倾斜视为静止
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
