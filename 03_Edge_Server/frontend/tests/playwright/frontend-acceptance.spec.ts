import { expect, test } from "@playwright/test";

const routes = [
  "/overview", "/zones/zone-nft-01", "/zones/zone-nft-01/monitoring", "/zones/zone-nft-01/pumps",
  "/zones/zone-nft-01/auto-dosing", "/zones/zone-nft-01/calibration", "/racks/rack-01/seasons/rack-01-active",
  "/reports", "/settings/gateway", "/settings/zones/zone-nft-01/device", "/settings/ai", "/settings/cloud",
  "/settings/modules", "/settings/system",
];

for (const path of routes) test(`direct open and reload ${path}`, async ({ page }) => {
  expect((await page.goto(path))?.status()).toBe(200); await expect(page.locator("#root")).toBeVisible(); await page.reload(); await expect(page.locator("#root")).toBeVisible();
});

test("Local Backend health is the runtime source", async ({ page }) => { await page.goto("/overview"); await expect(page.getByText("Local Backend/API đã kết nối")).toBeVisible(); });
test("actuator controls are fail-closed", async ({ page }) => { await page.goto("/zones/zone-nft-01/pumps"); await expect(page.getByText(/khóa|Backend chưa cấp/i).first()).toBeVisible(); });
test("query parameters cannot unlock production", async ({ page }) => { await page.goto("/zones/zone-nft-01/pumps?capabilities=unlocked"); await expect(page.getByText(/khóa|Backend chưa cấp/i).first()).toBeVisible(); });
test("calibration starts with no active set", async ({ page }) => { await page.goto("/zones/zone-nft-01/calibration"); await expect(page.getByText("Chưa có active calibration set")).toBeVisible(); });
test("Auto Dosing stays OFF", async ({ page }) => { await page.goto("/zones/zone-nft-01/auto-dosing"); await expect(page.getByText("OFF").first()).toBeVisible(); });
test("six required viewports have no document overflow", async ({ page }) => {
  for (const viewport of [{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1366,height:768},{width:1920,height:1080}]) {
    await page.setViewportSize(viewport);
    await page.goto("/overview");
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(
      () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      { message: `document overflow at ${viewport.width}x${viewport.height}` },
    ).toBe(true);
  }
});
test("Back and Forward navigation remain functional", async ({ page }) => { await page.goto("/overview"); await page.getByRole("button", { name: "Vùng & giàn" }).click(); await page.goBack(); expect(page.url()).toContain("/overview"); await page.goForward(); expect(page.url()).toContain("/zones/"); });
test("production ignores no-overlap fixture query", async ({ page }) => { await page.goto("/overview?tds=no-overlap"); await expect(page.getByText("Local Backend/API đã kết nối")).toBeVisible(); });
test("SPA unknown non-API route returns frontend", async ({ page }) => { expect((await page.goto("/unknown-local-route"))?.status()).toBe(200); await expect(page.locator("#root")).toBeVisible(); });
test("API unknown route is not swallowed by SPA", async ({ request }) => { expect((await request.get("/api/unknown-local-route")).status()).toBe(404); });

test("dashboard fails closed during outage and recovers on refresh", async ({ page }) => {
  let online = true;
  let measurementAt = new Date().toISOString();
  await page.route("**/health", route => route.fulfill({
    status: online ? 200 : 503,
    contentType: "application/json",
    body: JSON.stringify(online ? { ok: true, mongoConnected: true, mqttConnected: true } : { ok: false }),
  }));
  await page.route("**/api/system/capabilities", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: { buildProfile: "LOCAL_UI_SAFE", actuatorsLocked: true, pumpCommandsEnabled: false, pumpMainCanSet: false, nutrientPumpCanPulse: false, autoDosingCanEnable: false, autoDosingLockReason: "locked" } }),
  }));
  await page.route("**/api/devices/device001/latest", route => route.fulfill({
    status: online ? 200 : 503,
    contentType: "application/json",
    body: JSON.stringify(online ? { ok: true, deviceId: "device001", latest: { measurementAt, tdsPpm: 670, ecUsCm: 1340, waterTemp: 26, waterLevel: "normal", pumpMain: false, tdsControlValid: true } } : { ok: false }),
  }));

  await page.goto("/overview");
  const banner = page.getByTestId("backend-connection-banner");
  await expect(banner).toHaveAttribute("data-connection-state", "connected-fresh");

  online = false;
  await page.getByRole("button", { name: "Làm mới dữ liệu" }).click();
  await expect(banner).toHaveAttribute("data-connection-state", "offline");
  await expect(page.getByTestId("actuator-lock-reason")).toBeVisible();

  online = true;
  measurementAt = new Date().toISOString();
  await expect(banner).toHaveAttribute("data-connection-state", "connected-fresh", { timeout: 7_000 });
});

test("dashboard marks an old snapshot stale without hiding its observation values", async ({ page }) => {
  await page.route("**/health", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, mongoConnected: true, mqttConnected: true }) }));
  await page.route("**/api/system/capabilities", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { buildProfile: "TEST_UNLOCKED", actuatorsLocked: false, pumpCommandsEnabled: true, pumpMainCanSet: true, nutrientPumpCanPulse: true, autoDosingCanEnable: false, autoDosingLockReason: "runtime_not_ready" } }) }));
  await page.route("**/api/devices/device001/latest", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, deviceId: "device001", latest: { measurementAt: "2020-01-01T00:00:00.000Z", tdsPpm: 670, ecUsCm: 1340, waterTemp: 26, waterLevel: "normal", pumpMain: false, tdsControlValid: true } }) }));
  await page.goto("/overview");
  await expect(page.getByTestId("backend-connection-banner")).toHaveAttribute("data-connection-state", "connected-stale");
  await expect(page.getByText("670").first()).toBeVisible();
  await page.goto("/zones/zone-nft-01/pumps");
  await expect(page.getByTestId("pump-capability-banner")).toContainText("khóa");
  await expect(page.getByRole("button", { name: /Bật bơm hồi lưu|Tắt bơm hồi lưu/ })).toBeDisabled();
});
