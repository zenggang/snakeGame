class AssetManager {
    constructor() {
        this.images = {};
        this.loadedCount = 0;
        this.totalCount = 0;
        this.allLoaded = false;
        
        // Hardcoded precise sprite slices from Python analysis of SpriteSheet.png
        this.slices = {
            character: {
                head_down: { sx: 34, sy: 28, sw: 62, sh: 84, displayW: 75, displayH: 100 },
                head_down_open: { sx: 128, sy: 30, sw: 62, sh: 81, displayW: 75, displayH: 97 },
                head_left: { sx: 212, sy: 42, sw: 84, sh: 69, displayW: 100, displayH: 82 },
                head_right: { sx: 328, sy: 42, sw: 84, sh: 69, displayW: 100, displayH: 82 },
                head_up: { sx: 34, sy: 144, sw: 63, sh: 73, displayW: 75, displayH: 88 },
                body: { sx: 458, sy: 50, sw: 71, sh: 39, displayW: 85, displayH: 46 },     // horizontal body segment
                butt: { sx: 1114, sy: 57, sw: 79, sh: 35, displayW: 94, displayH: 42 }     // horizontal tail segment
            },
            props: {
                bone_s: { sx: 34, sy: 274, sw: 67, sh: 71, displayW: 40, displayH: 42 },
                bone_m: { sx: 109, sy: 260, sw: 91, sh: 95, displayW: 55, displayH: 57 },
                bone_l: { sx: 198, sy: 244, sw: 116, sh: 122, displayW: 70, displayH: 74 },
                
                bug_green: [
                    { sx: 861, sy: 279, sw: 69, sh: 61, displayW: 55, displayH: 49 },
                    { sx: 946, sy: 279, sw: 69, sh: 60, displayW: 55, displayH: 48 },
                    { sx: 1031, sy: 279, sw: 68, sh: 60, displayW: 55, displayH: 48 }
                ],
                bug_red: [
                    { sx: 1140, sy: 284, sw: 66, sh: 53, displayW: 53, displayH: 43 },
                    { sx: 1221, sy: 280, sw: 62, sh: 58, displayW: 50, displayH: 47 },
                    { sx: 1301, sy: 284, sw: 66, sh: 53, displayW: 53, displayH: 43 }
                ],
                candy: { sx: 425, sy: 272, sw: 72, sh: 69, displayW: 45, displayH: 43 },
                bread: { sx: 42, sy: 403, sw: 68, sh: 56, displayW: 50, displayH: 41 },
                poop: [
                    { sx: 621, sy: 291, sw: 54, sh: 48, displayW: 42, displayH: 37 },
                    { sx: 698, sy: 291, sw: 55, sh: 48, displayW: 42, displayH: 37 },
                    { sx: 774, sy: 291, sw: 54, sh: 48, displayW: 42, displayH: 37 }
                ]
            },
            map: {
                // 从大地图预览图中提取的纯净小区域（避免过渡边缘和网格线）
                grass: { sx: 300, sy: 650, sw: 32, sh: 32 },   // 纯草地
                water: { sx: 65, sy: 590, sw: 32, sh: 32 },   // 纯水面
                dirt:  { sx: 575, sy: 650, sw: 32, sh: 32 },  // 纯泥土
                
                bridge_h: { sx: 682, sy: 513, sw: 142, sh: 97 },
                bridge_v: { sx: 712, sy: 626, sw: 82, sh: 103 },
                fence_h: { sx: 844, sy: 540, sw: 137, sh: 54 },
                fence_v: { sx: 712, sy: 626, sw: 82, sh: 103 }
            },
            decor: {
                flower_pink: { sx: 241, sy: 405, sw: 45, sh: 53, displayW: 45, displayH: 53.5 },
                flower_red: { sx: 308, sy: 404, sw: 43, sh: 53, displayW: 43, displayH: 53.5 },
                flower_yellow: { sx: 372, sy: 404, sw: 39, sh: 53, displayW: 39.5, displayH: 53.5 },
                flower_white_blue: { sx: 435, sy: 403, sw: 38, sh: 55, displayW: 38, displayH: 55.5 },
                flower_blue: { sx: 497, sy: 404, sw: 48, sh: 53, displayW: 48, displayH: 53 },
                flower_small_white: { sx: 567, sy: 408, sw: 42, sh: 48, displayW: 42.5, displayH: 48.5 },
                flower_small_blue: { sx: 633, sy: 413, sw: 44, sh: 41, displayW: 44.5, displayH: 41.5 },
                grass_tuft_1: { sx: 702, sy: 417, sw: 33, sh: 26, displayW: 33, displayH: 26.5 },
                grass_tuft_2: { sx: 759, sy: 423, sw: 31, sh: 27, displayW: 31, displayH: 27.5 },
                rock_1: { sx: 814, sy: 426, sw: 30, sh: 25, displayW: 40, displayH: 33.3 },
                rock_2: { sx: 893, sy: 423, sw: 43, sh: 30, displayW: 57.3, displayH: 40.6 },
                bush_1: { sx: 962, sy: 411, sw: 64, sh: 46, displayW: 85.3, displayH: 61.3 },
                bush_2: { sx: 1049, sy: 416, sw: 55, sh: 40, displayW: 73.3, displayH: 53.3 },
                bush_3: { sx: 1130, sy: 417, sw: 59, sh: 40, displayW: 79.3, displayH: 54 },
                bush_4: { sx: 1215, sy: 405, sw: 68, sh: 54, displayW: 90.6, displayH: 72.6 },
                mushroom_house_red_1: { sx: 996, sy: 514, sw: 92, sh: 103, displayW: 140, displayH: 157.5 },
                mushroom_house_red_2: { sx: 1097, sy: 513, sw: 92, sh: 104, displayW: 140.7, displayH: 158.2 },
                palm_tree_1: { sx: 1201, sy: 518, sw: 84, sh: 98, displayW: 127.8, displayH: 149.9 },
                palm_tree_2: { sx: 1299, sy: 515, sw: 82, sh: 100, displayW: 124.8, displayH: 152.9 },
                mushroom_house_orange: { sx: 996, sy: 626, sw: 92, sh: 104, displayW: 140, displayH: 159 },
                stump: { sx: 1198, sy: 629, sw: 90, sh: 98, displayW: 136.9, displayH: 149.1 },
                flower_bed_1: { sx: 1294, sy: 629, sw: 90, sh: 97, displayW: 137.7, displayH: 148.4 },
                flower_bed_2: { sx: 1101, sy: 651, sw: 85, sh: 78, displayW: 130.1, displayH: 119.5 }
            }
        };
    }

    load(sources, callback, onProgress) {
        this.totalCount = Object.keys(sources).length;
        if (this.totalCount === 0) {
            this.allLoaded = true;
            if(callback) callback();
            return;
        }

        for (let key in sources) {
            let img = new Image();
            img.onload = () => {
                this.images[key] = img;
                this.loadedCount++;
                if (onProgress) {
                    onProgress(this.loadedCount, this.totalCount);
                }
                if (this.loadedCount === this.totalCount) {
                    this.allLoaded = true;
                    if(callback) callback();
                }
            };
            
            img.onerror = () => {
                console.error(`加载图片失败: ${sources[key]}`);
                this.loadedCount++;
                if (onProgress) {
                    onProgress(this.loadedCount, this.totalCount);
                }
            }
            img.src = sources[key];
        }
    }

    getImage(key) {
        return this.images[key];
    }
}

const assets = new AssetManager();

