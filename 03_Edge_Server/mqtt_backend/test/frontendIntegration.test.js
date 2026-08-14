const assert = require('node:assert/strict');
const test = require('node:test');

const { buildHttpApp } = require('../src/httpServer');

async function withServer(run) {
  const server = buildHttpApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('capability API is fail-closed and SPA never swallows unknown API routes', async () => {
  await withServer(async (baseUrl) => {
    const capabilityResponse = await fetch(`${baseUrl}/api/system/capabilities`);
    const capabilityBody = await capabilityResponse.json();
    assert.equal(capabilityResponse.status, 200);
    assert.equal(capabilityBody.ok, true);
    assert.equal(capabilityBody.data.actuatorsLocked, true);
    assert.equal(capabilityBody.data.autoDosingCanEnable, false);

    const missingApiResponse = await fetch(`${baseUrl}/api/not-a-real-route`);
    assert.equal(missingApiResponse.status, 404);
  });
});

test('root and deep links serve the built SPA or legacy dashboard fallback', async () => {
  await withServer(async (baseUrl) => {
    for (const route of ['/', '/zones/zone-nft-01/monitoring']) {
      const response = await fetch(`${baseUrl}${route}`);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, /HydroFlow|Hydroponic Device Dashboard/);
    }
  });
});
