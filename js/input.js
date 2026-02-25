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
    _calibrationTimeout: null, // 校准超时计时器（5秒）
    _calibrationStartTime: 0,  // 校准开始时间
    _loggedFirstEvent: false,  // 是否已记录第一个方向事件
    _lastDebugLog: 0,          // 上次调试日志时间
    
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
            this._loggedFirstEvent = false;
            this._lastDebugLog = 0;
            if (this._calibrationTimeout) {
                clearTimeout(this._calibrationTimeout);
                this._calibrationTimeout = null;
            }
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
            this._calibrationStartTime = Date.now();
            const joystick = document.getElementById('joystick');
            if (joystick) joystick.style.display = 'none';
            if (toggleBtn) {
                toggleBtn.textContent = '📱 请保持手机稳定...';
                toggleBtn.classList.add('active');
            }
            // 设置校准超时检测（5秒）
            this._calibrationTimeout = setTimeout(() => {
                if (!this.gravity.calibrated && this.gravityEnabled) {
                    console.warn('[Gravity] Calibration timeout');
                    this.gravityEnabled = false;
                    this.gravity.active = false;
                    if (toggleBtn) {
                        toggleBtn.textContent = '❌ 重力启动失败，请重试';
                        toggleBtn.classList.remove('active');
                        // 3秒后恢复按钮文字
                        setTimeout(() => {
                            if (toggleBtn && !this.gravityEnabled) {
                                toggleBtn.textContent = '🔄 切换重力模式';
                            }
                        }, 3000);
                    }
                    if (joystick) joystick.style.display = 'block';
                    // 显示提示
                    alert('重力感应启动超时，请检查设备是否支持或刷新页面重试');
                }
            }, 5000);
            this.requestGravityPermission();
        }
    },

    requestGravityPermission() {
        // 先移除旧监听器（防止重复绑定）
        if (this._orientationHandler) {
            window.removeEventListener('deviceorientation', this._orientationHandler);
        }
        this._orientationHandler = this.handleOrientation.bind(this);
        
        // 诊断：输出当前浏览器环境信息
        const ua = navigator.userAgent;
        const isWechat = /MicroMessenger/i.test(ua);
        const isIOS = /iPhone|iPad|iPod/i.test(ua);
        const isAndroid = /Android/i.test(ua);
        const hasRequestPermission = typeof DeviceOrientationEvent !== 'undefined' 
            && typeof DeviceOrientationEvent.requestPermission === 'function';
        console.log('[Gravity] ENV:', { isWechat, isIOS, isAndroid, hasRequestPermission, ua: ua.substring(0, 100) });

        if (typeof DeviceOrientationEvent !== 'undefined' && hasRequestPermission) {
            console.log('[Gravity] iOS/WKWebView mode: calling requestPermission()');
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    console.log('[Gravity] permission state:', permissionState);
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', this._orientationHandler);
                        console.log('[Gravity] listener added (iOS granted)');
                    } else {
                        // permissionState === 'denied'：用户之前拒绝过，iOS 不再弹框直接拒绝
                        console.warn('[Gravity] permission denied (state:', permissionState, ')');
                        // 清除超时计时器
                        if (this._calibrationTimeout) {
                            clearTimeout(this._calibrationTimeout);
                            this._calibrationTimeout = null;
                        }
                        this.gravityEnabled = false;
                        this.gravity.active = false;
                        const toggleBtn = document.getElementById('gravity-toggle');
                        if (toggleBtn) {
                            toggleBtn.textContent = '❌ 权限被拒绝';
                            toggleBtn.classList.remove('active');
                            setTimeout(() => {
                                if (toggleBtn && !this.gravityEnabled) {
                                    toggleBtn.textContent = '🔄 切换重力模式';
                                }
                            }, 4000);
                        }
                        const joystick = document.getElementById('joystick');
                        if (joystick) joystick.style.display = 'block';
                        alert('重力权限被拒绝。\n\n请按以下步骤重置权限：\n1. 前往「设置 → Safari → 隐私与安全性」\n2. 找到「动作与方向访问」，确保已开启\n3. 返回游戏页面，长按地址栏 → 网站设置 → 重置权限\n4. 刷新页面后再次点击重力按钮');
                    }
                })
                .catch(e => {
                    console.error('[Gravity] permission error:', e);
                    // iOS 权限被拒绝，显示友好提示
                    const toggleBtn = document.getElementById('gravity-toggle');
                    if (toggleBtn) {
                        toggleBtn.textContent = '❌ 权限被拒绝';
                        toggleBtn.classList.remove('active');
                        setTimeout(() => {
                            if (toggleBtn && !this.gravityEnabled) {
                                toggleBtn.textContent = '🔄 切换重力模式';
                            }
                        }, 3000);
                    }
                    this.gravityEnabled = false;
                    const joystick = document.getElementById('joystick');
                    if (joystick) joystick.style.display = 'block';

                    // 根据错误类型给出不同提示
                    let errorMsg = '需要设备方向权限才能使用重力控制。';
                    if (e.name === 'NotAllowedError') {
                        errorMsg += '\n\n可能原因：\n1. 你之前点击过"不允许"\n2. Safari 设置中禁用了"动作与方向访问"\n\n解决方法：\n• 刷新页面后再次点击重力按钮\n• 或前往 设置 > Safari > 动作与方向访问 > 允许';
                    } else if (location.protocol !== 'https:') {
                        errorMsg += '\n\n当前使用 HTTP 连接，iOS 要求 HTTPS 才能访问传感器。请使用 HTTPS 访问此页面。';
                    } else {
                        errorMsg += '\n\n错误信息: ' + (e.message || '未知错误');
                    }
                    alert(errorMsg);
                });
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
        if (!this.gravityEnabled) return;

        // 详细日志：检查事件数据
        if (event.beta === null || event.beta === undefined) {
            console.warn('[Gravity] event.beta is null/undefined');
            return;
        }

        let gamma = event.gamma || 0;
        let beta = event.beta || 0;

        // 日志：前几个事件的值
        if (!this._loggedFirstEvent) {
            console.log('[Gravity] First orientation event:', { beta, gamma, alpha: event.alpha });
            this._loggedFirstEvent = true;
        }
        
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
            // 清除校准超时计时器
            if (this._calibrationTimeout) {
                clearTimeout(this._calibrationTimeout);
                this._calibrationTimeout = null;
            }
            console.log('[Gravity] Calibrated at:', beta, gamma);
        }

        this.gravity.active = true;
        this.mouse.active = false;

        let dBeta = beta - this.gravity.baseBeta;
        let dGamma = gamma - this.gravity.baseGamma;

        // 日志：定期输出 delta 值用于调试
        if (!this._lastDebugLog || Date.now() - this._lastDebugLog > 1000) {
            console.log('[Gravity] delta:', { dBeta, dGamma, screenOrientation: this._getScreenOrientation() });
            this._lastDebugLog = Date.now();
        }
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
            // 校准完成后显示正常状态，不再频繁更新坐标（避免干扰）
            if (this.gravity.calibrated && toggleBtn.textContent.includes('请保持')) {
                toggleBtn.textContent = '🎯 重力模式已启用';
            }
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
                // 重力模式已校准时不启动摇杆；校准期间允许摇杆作为回退
                if (this.gravityEnabled && this.gravity.calibrated) return;
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

        // 重力模式开启且已校准时，优先使用重力输入
        if (this.gravityEnabled && this.gravity.calibrated) {
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
        }

        // 重力模式开启但未校准完成时，允许回退到摇杆/键盘/鼠标
        if (this.joystick.active) {
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
