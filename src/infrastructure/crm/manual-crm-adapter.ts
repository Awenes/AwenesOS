import type { CrmTaskAdapter } from "../../domain/crm.js";

export class ManualCrmAdapter implements CrmTaskAdapter {
  readonly name = "manual";
  async createTask(): Promise<never> { throw new Error("Create the CRM task manually, then record its reference in Awenes"); }
  async updateExecutionStatus(): Promise<never> { throw new Error("Manual CRM mode does not call external mutation endpoints"); }
  async completeTask(): Promise<never> { throw new Error("Manual CRM mode does not call external mutation endpoints"); }
}
