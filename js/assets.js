class AssetManager {
    constructor() {
        this.images = {};
        this.loadedCount = 0;
        this.totalCount = 0;
        this.allLoaded = false;
        
        // Hardcoded precise sprite slices from Python analysis of SpriteSheet.png
        this.slices = {
            character: {
                head_down: { sx: 69, sy: 56, sw: 125, sh: 168, displayW: 75, displayH: 100 },
                head_down_open: { sx: 256, sy: 61, sw: 125, sh: 162, displayW: 75, displayH: 97 },
                head_left: { sx: 424, sy: 85, sw: 169, sh: 138, displayW: 100, displayH: 82 },
                head_right: { sx: 656, sy: 85, sw: 168, sh: 138, displayW: 100, displayH: 82 },
                head_up: { sx: 68, sy: 289, sw: 127, sh: 147, displayW: 75, displayH: 88 },
                body: { sx: 916, sy: 101, sw: 143, sh: 78, displayW: 85, displayH: 46 },     // horizontal body segment
                butt: { sx: 2229, sy: 114, sw: 158, sh: 70, displayW: 94, displayH: 42 }     // horizontal tail segment
            },
            props: {
                bone_s: { sx: 69, sy: 549, sw: 135, sh: 142, displayW: 40, displayH: 42 },
                bone_m: { sx: 219, sy: 520, sw: 183, sh: 190, displayW: 55, displayH: 57 },
                bone_l: { sx: 396, sy: 489, sw: 232, sh: 245, displayW: 70, displayH: 74 },
                
                bug_green: [
                    { sx: 1723, sy: 558, sw: 138, sh: 122, displayW: 55, displayH: 49 },
                    { sx: 1892, sy: 559, sw: 138, sh: 121, displayW: 55, displayH: 48 },
                    { sx: 2063, sy: 559, sw: 137, sh: 121, displayW: 55, displayH: 48 }
                ],
                bug_red: [
                    { sx: 2280, sy: 569, sw: 133, sh: 107, displayW: 53, displayH: 43 },
                    { sx: 2443, sy: 561, sw: 125, sh: 117, displayW: 50, displayH: 47 },
                    { sx: 2602, sy: 569, sw: 132, sh: 107, displayW: 53, displayH: 43 }
                ],
                candy: { sx: 850, sy: 545, sw: 145, sh: 139, displayW: 45, displayH: 43 },
                bread: { sx: 84, sy: 806, sw: 137, sh: 113, displayW: 50, displayH: 41 },
                poop: [
                    { sx: 1243, sy: 583, sw: 109, sh: 97, displayW: 42, displayH: 37 },
                    { sx: 1396, sy: 583, sw: 110, sh: 97, displayW: 42, displayH: 37 },
                    { sx: 1548, sy: 583, sw: 109, sh: 97, displayW: 42, displayH: 37 }
                ]
            },
            map: {
                // 从大地图预览图中提取的纯净小区域（避免过渡边缘和网格线）
                grass: { sx: 600, sy: 1300, sw: 64, sh: 64 },   // 纯草地
                water: { sx: 130, sy: 1180, sw: 64, sh: 64 },   // 纯水面
                dirt:  { sx: 1150, sy: 1300, sw: 64, sh: 64 },  // 纯泥土
                
                bridge_h: { sx: 1364, sy: 1026, sw: 285, sh: 195 },
                bridge_v: { sx: 1425, sy: 1252, sw: 164, sh: 206 },
                fence_h: { sx: 1688, sy: 1081, sw: 274, sh: 108 },
                fence_v: { sx: 1425, sy: 1252, sw: 164, sh: 206 }
            },
            decor: {
                flower_pink: { sx: 483, sy: 810, sw: 90, sh: 107, displayW: 45, displayH: 53.5 },
                flower_red: { sx: 617, sy: 809, sw: 86, sh: 107, displayW: 43, displayH: 53.5 },
                flower_yellow: { sx: 745, sy: 808, sw: 79, sh: 107, displayW: 39.5, displayH: 53.5 },
                flower_white_blue: { sx: 871, sy: 806, sw: 76, sh: 111, displayW: 38, displayH: 55.5 },
                flower_blue: { sx: 994, sy: 809, sw: 96, sh: 106, displayW: 48, displayH: 53 },
                flower_small_white: { sx: 1135, sy: 817, sw: 85, sh: 97, displayW: 42.5, displayH: 48.5 },
                flower_small_blue: { sx: 1266, sy: 826, sw: 89, sh: 83, displayW: 44.5, displayH: 41.5 },
                grass_tuft_1: { sx: 1404, sy: 834, sw: 66, sh: 53, displayW: 33, displayH: 26.5 },
                grass_tuft_2: { sx: 1519, sy: 846, sw: 62, sh: 55, displayW: 31, displayH: 27.5 },
                rock_1: { sx: 1628, sy: 852, sw: 60, sh: 50, displayW: 40, displayH: 33.3 },
                rock_2: { sx: 1786, sy: 847, sw: 86, sh: 61, displayW: 57.3, displayH: 40.6 },
                bush_1: { sx: 1924, sy: 822, sw: 128, sh: 92, displayW: 85.3, displayH: 61.3 },
                bush_2: { sx: 2099, sy: 833, sw: 110, sh: 80, displayW: 73.3, displayH: 53.3 },
                bush_3: { sx: 2260, sy: 835, sw: 119, sh: 81, displayW: 79.3, displayH: 54 },
                bush_4: { sx: 2430, sy: 810, sw: 136, sh: 109, displayW: 90.6, displayH: 72.6 },
                mushroom_house_red_1: { sx: 1993, sy: 1028, sw: 184, sh: 207, displayW: 140, displayH: 157.5 },
                mushroom_house_red_2: { sx: 2195, sy: 1027, sw: 185, sh: 208, displayW: 140.7, displayH: 158.2 },
                palm_tree_1: { sx: 2403, sy: 1036, sw: 168, sh: 197, displayW: 127.8, displayH: 149.9 },
                palm_tree_2: { sx: 2598, sy: 1031, sw: 164, sh: 201, displayW: 124.8, displayH: 152.9 },
                mushroom_house_orange: { sx: 1993, sy: 1252, sw: 184, sh: 209, displayW: 140, displayH: 159 },
                stump: { sx: 2396, sy: 1258, sw: 180, sh: 196, displayW: 136.9, displayH: 149.1 },
                flower_bed_1: { sx: 2588, sy: 1259, sw: 181, sh: 195, displayW: 137.7, displayH: 148.4 },
                flower_bed_2: { sx: 2202, sy: 1302, sw: 171, sh: 157, displayW: 130.1, displayH: 119.5 }
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

