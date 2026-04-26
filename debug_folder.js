const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message, error.stack));
    page.on('requestfailed', request => console.error('REQUEST FAILED:', request.url(), request.failure().errorText));

    await page.goto('http://localhost:3000/document-locker.html', {waitUntil: 'networkidle2'});
    
    // Fill folder
    await page.type('#new-folder-input', 'aa');
    await page.click('#create-folder-btn');
    
    // Wait for any toasts or requests
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
})();
