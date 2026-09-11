import { z } from "zod";
export const CommitMessageSchema = z.string().trim().min(1).max(200);
export interface GitReview {
  branch: string;
  head: string;
  status: string;
  diffStat: string;
  diff: string;
}
export interface GitDelivery {
  id: string;
  runId: string;
  branch: string;
  commitSha: string | null;
  pushed: boolean;
  remote: string | null;
  review: GitReview;
  createdAt: Date;
  updatedAt: Date;
}
export interface GitDeliveryDriver {
  review(worktree: string): Promise<GitReview>;
  commit(worktree: string, message: string): Promise<string>;
  push(worktree: string, remote: string, branch: string): Promise<void>;
}
