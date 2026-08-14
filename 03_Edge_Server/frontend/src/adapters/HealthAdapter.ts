import { BackendApiAdapter } from "./BackendApiAdapter";
export class HealthAdapter { constructor(private source = new BackendApiAdapter()) {} get() { return this.source.getHealth(); } }
