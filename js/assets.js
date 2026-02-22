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
                // 原画去近白底色与紧凑边缘自动裁剪
                if (key === 'props' || key === 'character') {
                    this.images[key] = this.removeBackground(img, false); 
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
                
                if (key === 'character') {
                    let w = img.width, h = img.height;
                    
                    // 使用 Canvas 读回已经去过底色(去除了发白背景)的位图数据
                    let canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    let ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(this.images[key], 0, 0);
                    let data = ctx.getImageData(0, 0, w, h).data;
                    
                    // 1. 全图水平投影扫描，寻找独立的实体模块（以应对AI生成图片间距不一的问题）
                    let colHasPixels = new Array(w).fill(false);
                    for (let x = 0; x < w; x++) {
                        for (let y = 0; y < h; y++) {
                            if (data[(y * w + x) * 4 + 3] > 10) {
                                colHasPixels[x] = true;
                                break;
                            }
                        }
                    }
                    
                    let regions = [];
                    let inRegion = false;
                    let startX = 0;
                    for (let x = 0; x < w; x++) {
                        if (colHasPixels[x] && !inRegion) {
                            inRegion = true;
                            startX = x;
                        } else if (!colHasPixels[x] && inRegion) {
                            inRegion = false;
                            if (x - startX > 20) { // 忽略噪点
                                regions.push({ startX, endX: x });
                            }
                        }
                    }
                    if (inRegion && w - startX > 20) {
                        regions.push({ startX, endX: w });
                    }
                    
                    // Fallback: 如果图像没有被干净地切成独立的 3 个部分，就做简单三等分
                    if (regions.length < 3) {
                         let thirdW = Math.floor(w / 3);
                         regions = [
                             { startX: 0, endX: thirdW },
                             { startX: thirdW, endX: thirdW * 2 },
                             { startX: thirdW * 2, endX: w }
                         ];
                    }
                    
                    // 2. 局部边界扫描方法：在确定的左右区间里再次寻找上下边界计算完美贴图 bbox
                    const getBounds = (regStartX, regEndX) => {
                        let minX = regEndX, minY = h, maxX = regStartX, maxY = 0;
                        let found = false;
                        for (let y = 0; y < h; y++) {
                            for (let x = regStartX; x < regEndX; x++) {
                                let alpha = data[(y * w + x) * 4 + 3];
                                if (alpha > 10) {
                                    found = true;
                                    if (x < minX) minX = x;
                                    if (y < minY) minY = y;
                                    if (x > maxX) maxX = x;
                                    if (y > maxY) maxY = y;
                                }
                            }
                        }
                        if (!found) return { x: regStartX, y: 0, w: Math.max(1, regEndX - regStartX), h: h };
                        // 外扩2像素边缘缓冲防止截断
                        return { 
                            x: Math.max(regStartX, minX - 2), 
                            y: Math.max(0, minY - 2), 
                            w: (maxX - minX + 1) + 4, 
                            h: (maxY - minY + 1) + 4 
                        };
                    };
                    
                    let b1 = getBounds(regions[0].startX, regions[0].endX);
                    let b2 = getBounds(regions[1].startX, regions[1].endX);
                    let b3 = getBounds(regions[2].startX, regions[2].endX);

                    this.slices.character = {
                        // 车头
                        head: { sx: b1.x, sy: b1.y, sw: b1.w, sh: b1.h, displayW: 75, displayH: 75 },
                        // 车身（肉卷）
                        body: { sx: b2.x, sy: b2.y, sw: b2.w, sh: b2.h, displayW: 55, displayH: 55 },
                        // 车尾
                        butt: { sx: b3.x, sy: b3.y, sw: b3.w, sh: b3.h, displayW: 60, displayH: 60 }
                    };
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
