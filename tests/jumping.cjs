const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

test('heroes get two air jumps, recharge on landing, and reset on respawn', async () => {
  const server = http.createServer(async (req, res) => {
    try {
      const file = path.basename(req.url) || 'index.html';
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
      res.end(await fs.readFile(path.resolve(__dirname, '../dist', file)));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    for (const hero of ['sun', 'dragon', 'fairy']) {
      await page.click(`[data-character="${hero}"]`);
      await page.click('#play');
      const jumps = await page.evaluate(() => {
        const results = [];
        for (let i = 0; i < 4; i++) {
          moth.vy = 0;
          queuedJump = .13;
          step(1 / 120);
          results.push(moth.vy < 0);
        }
        return results;
      });
      assert.deepEqual(jumps, [true, true, true, false], `${hero}: exactly three jumps`);
      for (const recovery of ['landing', 'respawn']) {
        const jumps = await page.evaluate(recovery => {
          queuedJump = 0;
          if (recovery === 'landing') {
            moth.x = 90; moth.y = 402; moth.vy = 200;
            step(1 / 120);
          } else spawn();
          const results = [];
          for (let i = 0; i < 4; i++) {
            moth.vy = 0; queuedJump = .13; step(1 / 120);
            results.push(moth.vy < 0);
          }
          return results;
        }, recovery);
        assert.deepEqual(jumps, [true, true, true, false], `${hero}: ${recovery} restores jumps`);
      }
      await page.evaluate(() => setState('ready'));
    }
  } finally { await browser.close(); server.close(); }
});
