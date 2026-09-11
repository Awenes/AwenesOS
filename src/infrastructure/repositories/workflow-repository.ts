import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import type { Approval, ApprovalKind, WorkflowRun, WorkflowStage, WorkflowStep } from "../../domain/workflow.js";
import type { Database } from "../db/database.js";
import { workflowApprovals, workflowEvents, workflowRuns, workflowSteps } from "../db/schema.js";

export class WorkflowRepository {
  constructor(private readonly db: Database) {}
  async create(taskId:string, projectId:string) { const now=new Date(); const run:WorkflowRun={id:randomUUID(),taskId,projectId,status:"created",currentStage:null,createdAt:now,updatedAt:now,startedAt:null,completedAt:null,error:null}; await this.db.insert(workflowRuns).values(run); await this.event(run.id,"workflow.created",{},now); return run; }
  async get(id:string) { const row=await this.db.query.workflowRuns.findFirst({where:eq(workflowRuns.id,id)}); if(!row)throw new Error(`Workflow run not found: ${id}`); return row as WorkflowRun; }
  list(){return this.db.select().from(workflowRuns).orderBy(asc(workflowRuns.createdAt));}
  async setState(id:string,status:WorkflowRun["status"],stage:WorkflowStage|null,error:string|null=null){const current=await this.get(id);const now=new Date();await this.db.update(workflowRuns).set({status,currentStage:stage,error,updatedAt:now,startedAt:status==="running"&&!current.startedAt?now:undefined,completedAt:status==="completed"?now:undefined}).where(eq(workflowRuns.id,id));await this.event(id,`workflow.${status}`,{stage,error},now);return this.get(id);}
  async addStep(runId:string,ordinal:number,stage:WorkflowStage,roleId:string|null,instructionSnapshot:Record<string,unknown>|null){const step:WorkflowStep={id:randomUUID(),runId,ordinal,stage,roleId,status:"pending",attempt:0,instructionSnapshot,output:null,startedAt:null,completedAt:null};await this.db.insert(workflowSteps).values(step);return step;}
  steps(runId:string){return this.db.select().from(workflowSteps).where(eq(workflowSteps.runId,runId)).orderBy(asc(workflowSteps.ordinal));}
  async startStep(id:string){await this.db.update(workflowSteps).set({status:"running",startedAt:new Date(),attempt:sql`${workflowSteps.attempt} + 1`}).where(eq(workflowSteps.id,id));}
  async finishStep(id:string,passed:boolean,output:string){const row=await this.db.query.workflowSteps.findFirst({where:eq(workflowSteps.id,id)});if(!row)throw new Error(`Workflow step not found: ${id}`);const now=new Date();await this.db.update(workflowSteps).set({status:passed?"passed":"failed",output,completedAt:now}).where(eq(workflowSteps.id,id));await this.event(row.runId,passed?"step.passed":"step.failed",{stepId:id,stage:row.stage,attempt:row.attempt+1},now);}
  async requestApproval(runId:string,kind:ApprovalKind,detail:string){const value:Approval={id:randomUUID(),runId,kind,status:"pending",detail,requestedAt:new Date(),decidedAt:null};await this.db.insert(workflowApprovals).values(value);await this.event(runId,"approval.requested",{approvalId:value.id,kind},value.requestedAt);return value;}
  approvals(runId:string){return this.db.select().from(workflowApprovals).where(eq(workflowApprovals.runId,runId)).orderBy(asc(workflowApprovals.requestedAt));}
  async decide(id:string,approved:boolean){const row=await this.db.query.workflowApprovals.findFirst({where:eq(workflowApprovals.id,id)});if(!row||row.status!=="pending")throw new Error("Pending approval not found");const decidedAt=new Date();await this.db.update(workflowApprovals).set({status:approved?"approved":"rejected",decidedAt}).where(eq(workflowApprovals.id,id));await this.event(row.runId,approved?"approval.approved":"approval.rejected",{approvalId:id,kind:row.kind},decidedAt);return this.get(row.runId);}
  history(runId:string){return this.db.select().from(workflowEvents).where(eq(workflowEvents.runId,runId)).orderBy(asc(workflowEvents.occurredAt));}
  private event(runId:string,type:string,data:Record<string,unknown>,occurredAt=new Date()){return this.db.insert(workflowEvents).values({id:randomUUID(),runId,type,data,occurredAt});}
}
