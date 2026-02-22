class AssetManager {
    constructor() {
        this.images = {};
        this.loadedCount = 0;
        this.totalCount = 0;
        this.allLoaded = false;
        this.slices = {
            character: {},
            props: {}
        };
    }

    // 智能去近白底色与紧凑边缘自动裁剪
    removeBackground(img, autoCrop = false) {
        let canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        let ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;
        
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                let i = (y * canvas.width + x) * 4;
                let r = data[i], g = data[i+1], b = data[i+2];
                
                // 去除白色与近白色 (AI 图片泛白过渡)
                if (r > 240 && g > 240 && b > 240) {
                    data[i+3] = 0; // 设置为完全透明
                } else if (autoCrop) {
                    // 更新包围盒
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        if (autoCrop && maxX >= minX && maxY >= minY) {
            let cropW = maxX - minX + 1;
            let cropH = maxY - minY + 1;
            let cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            let cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
            return cropCanvas;
        }

        return canvas;
    }

    load(sources, callback) {
        this.totalCount = Object.keys(sources).length;
        if (this.totalCount === 0) {
            this.allLoaded = true;
            if(callback) callback();
            return;
        }

        for (let key in sources) {
            let img = new Image();
            img.onload = () => {
                // 如果是道具或单独组件原始图片，则进入强制去底色处理
                if (key.startsWith('dog_')) {
                    this.images[key] = this.removeBackground(img, true); // AI 单图带裁剪
                } else if (key === 'props' || key === 'character') {
                    this.images[key] = this.removeBackground(img, false); // 整图贴片不裁剪
                } else {
                    this.images[key] = img; // scene 是场景风景不抠背景
                }
                
                // 动态基于原始图像尺寸进行相对裁剪定位，防错误
                if (key === 'props') {
                    let w = img.width, h = img.height;
                    this.slices.props = {
                        // 上半截（增益）
                        bone: { sx: w*0.05, sy: h*0.25, sw: w*0.25, sh: h*0.25, displayW: 55, displayH: 55 },
                        candy: { sx: w*0.38, sy: h*0.15, sw: w*0.22, sh: h*0.3, displayW: 50, displayH: 50 },
                        bread: { sx: w*0.7, sy: h*0.15, sw: w*0.25, sh: h*0.3, displayW: 55, displayH: 50 },
                        // 下半截（减益）
                        poop: { sx: w*0.05, sy: h*0.7, sw: w*0.25, sh: h*0.25, displayW: 55, displayH: 55 },
                        bacteria: { sx: w*0.4, sy: h*0.6, sw: w*0.2, sh: h*0.35, displayW: 50, displayH: 70 },
                        bug: { sx: w*0.7, sy: h*0.65, sw: w*0.22, sh: h*0.28, displayW: 50, displayH: 60 }
                    };
                }
                
                if (key === 'dog_head') {
                    this.slices.character.head = { displayW: 75, displayH: 75 };
                }
                if (key === 'dog_body') {
                    this.slices.character.body = { displayW: 50, displayH: 50 };
                }
                if (key === 'dog_tail') {
                    this.slices.character.butt = { displayW: 45, displayH: 45 };
                }

                this.loadedCount++;
                if (this.loadedCount === this.totalCount) {
                    this.allLoaded = true;
                    if(callback) callback();
                }
            };
            
            img.onerror = () => {
                console.error(`加载图片失败: ${sources[key]}`);
                this.loadedCount++;
            }
            img.src = sources[key];
        }
    }

    getImage(key) {
        return this.images[key];
    }
}

const assets = new AssetManager();
