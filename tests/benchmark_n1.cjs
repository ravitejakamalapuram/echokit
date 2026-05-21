const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const pathToExtension = path.join(__dirname, '../extension');
  const userDataDir = '/tmp/test-user-data-dir';

  if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });

  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent('serviceworker');
  }

  const result = await background.evaluate(async () => {
    await new Promise(r => setTimeout(r, 500));
    await self.__echokitHandle({type: 'echokit:interactions:clearAll'}, {});

    const interactions = [];
    for (let i = 0; i < 500; i++) {
      interactions.push({
        id: `test_id_${i}`,
        hash: 'test_hash_1',
        url: 'http://example.com/api',
        method: 'GET',
        responseStatus: 200,
        responseBody: '{"ok": true}'
      });
    }

    await self.__echokitHandle({
      type: 'echokit:import',
      data: { interactions },
      strategy: 'override'
    }, {});

    const targetId = interactions[0].id;

    const start = performance.now();
    await self.__echokitHandle({type: 'echokit:interaction:setActiveVersion', id: targetId}, {});
    const end = performance.now();

    return {
      time: end - start,
      count: interactions.length
    };
  });

  console.log(`Optimized benchmark: updated ${result.count} interactions in ${result.time.toFixed(2)} ms`);
  await context.close();
})();
