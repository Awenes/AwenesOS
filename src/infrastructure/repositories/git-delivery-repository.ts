import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { GitDelivery, GitReview } from "../../domain/git-delivery.js";
import type { Database } from "../db/database.js";
import { gitDeliveries, workflowEvents } from "../db/schema.js";
export class GitDeliveryRepository {
  constructor(private db: Database) {}
  async saveReview(runId: string, review: GitReview) {
    const now = new Date(),
      existing = await this.get(runId);
    const value: GitDelivery = {
      id: existing?.id ?? randomUUID(),
      runId,
      branch: review.branch,
      commitSha: existing?.commitSha ?? null,
      pushed: existing?.pushed ?? false,
      remote: existing?.remote ?? null,
      review,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.db
      .insert(gitDeliveries)
      .values({
        ...value,
        review: value.review as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: gitDeliveries.runId,
        set: {
          branch: review.branch,
          review: review as unknown as Record<string, unknown>,
          updatedAt: now,
        },
      });
    await this.event(
      runId,
      "git.reviewed",
      { branch: review.branch, head: review.head },
      now,
    );
    return value;
  }
  async recordCommit(runId: string, sha: string) {
    const now = new Date();
    await this.db
      .update(gitDeliveries)
      .set({ commitSha: sha, updatedAt: now })
      .where(eq(gitDeliveries.runId, runId));
    await this.event(runId, "git.committed", { sha }, now);
    return this.get(runId);
  }
  async recordPush(runId: string, remote: string) {
    const now = new Date();
    await this.db
      .update(gitDeliveries)
      .set({ pushed: true, remote, updatedAt: now })
      .where(eq(gitDeliveries.runId, runId));
    await this.event(runId, "git.pushed", { remote }, now);
    return this.get(runId);
  }
  async get(runId: string) {
    const row = await this.db.query.gitDeliveries.findFirst({
      where: eq(gitDeliveries.runId, runId),
    });
    return row
      ? ({ ...row, review: row.review as unknown as GitReview } as GitDelivery)
      : null;
  }
  private event(
    runId: string,
    type: string,
    data: Record<string, unknown>,
    occurredAt: Date,
  ) {
    return this.db
      .insert(workflowEvents)
      .values({ id: randomUUID(), runId, type, data, occurredAt });
  }
}
