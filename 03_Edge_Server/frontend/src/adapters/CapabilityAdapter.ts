import type { SystemCapabilities } from "./types";
import { BackendApiAdapter } from "./BackendApiAdapter";
export class CapabilityAdapter {
  constructor(private source = new BackendApiAdapter()) {}
  async get(): Promise<SystemCapabilities> {
    const value = await this.source.getCapabilities();
    return value.actuatorsLocked || !value.pumpCommandsEnabled ? { ...value, pumpMainCanSet: false, nutrientPumpCanPulse: false, autoDosingCanEnable: false } : value;
  }
}
