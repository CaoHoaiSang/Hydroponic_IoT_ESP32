import { describe, expect, it } from "vitest";
import { BackendApiAdapter } from "./BackendApiAdapter";
import { CapabilityAdapter } from "./CapabilityAdapter";

describe("local-operation capability safety", () => {
  it("defaults every actuator permission to fail-closed", async () => {
    await expect(new CapabilityAdapter().get()).resolves.toMatchObject({ actuatorsLocked: true, pumpCommandsEnabled: false, pumpMainCanSet: false, nutrientPumpCanPulse: false, autoDosingCanEnable: false });
  });
  it("does not read URL query parameters as authority", async () => {
    window.history.replaceState({}, "", "/zones/zone-nft-01/pumps?capabilities=unlocked");
    await expect(new BackendApiAdapter().getCapabilities()).resolves.toMatchObject({ actuatorsLocked: true, pumpCommandsEnabled: false });
  });
});
