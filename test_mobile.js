const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // 模拟 iPhone 13 Pro
    const iPhone = puppeteer.devices['iPhone 13 Pro'];
    const iPhoneLandscape = puppeteer.devices['iPhone 13 Pro landscape'];
    
    const fileUrl = 'file://' + path.resolve('index.html');
    
    console.log('Testing Portrait Mode...');
    await page.emulate(iPhone);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: '/Users/javababy/.gemini/antigravity/brain/ef0edf49-7c04-4e5d-934e-46f5789a5d40/mobile_portrait.png' });
    
    console.log('Testing Landscape Mode...');
    await page.emulate(iPhoneLandscape);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    
    // 等待加载条完成，点击开始简单模式
    await page.waitForTimeout(1500);
    try {
        await page.click('#start-btn'); // 点击简易模式开始游戏
        await page.waitForTimeout(500); // 等待游戏渲染一帧
    } catch(e) {
        console.log("Could not click start button, maybe still loading");
    }
    
    await page.screenshot({ path: '/Users/javababy/.gemini/antigravity/brain/ef0edf49-7c04-4e5d-934e-46f5789a5d40/mobile_landscape.png' });
    
    await browser.close();
    console.log('Done screenshots.');
})();
