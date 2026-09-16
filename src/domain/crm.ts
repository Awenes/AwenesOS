export interface CrmTaskMapping {
  taskId: string;
  adapter: string;
  projectId: string;
  externalTaskId: string;
  externalUrl: string | null;
}

export interface CrmTaskAdapter {
  readonly name: string;
  createTask(input: {
    projectId: string;
    title: string;
    description: string;
  }): Promise<{ externalTaskId: string; externalUrl?: string }>;
  updateExecutionStatus(
    mapping: CrmTaskMapping,
    status: "in_progress" | "paused",
  ): Promise<void>;
  completeTask(
    mapping: CrmTaskMapping,
    input: { assignmentDescription: string; completionDescription: string },
  ): Promise<void>;
}

export type CrmCoordinationMode = "automatic" | "manual" | "local";
