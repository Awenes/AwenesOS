import { z } from "zod";
export const notificationKinds = ["crm_sync_failed", "crm_update_pending", "completion_ready", "task_paused", "evidence_missing", "tracker_update_pending"] as const;
export const NotificationKindSchema = z.enum(notificationKinds);
export const NotificationSnoozeSchema = z.object({ until: z.coerce.date() });
export const NotificationDurationSchema = z.string().trim().toLowerCase().regex(/^\d+(m|h|d)$/, "Use a duration such as 30m, 1h, or 1d");
export type NotificationKind = z.infer<typeof NotificationKindSchema>;
export type NotificationSeverity = "info" | "action" | "critical";
export interface LocalNotification { key: string; taskId: string; kind: NotificationKind; severity: NotificationSeverity; title: string; detail: string; suggestedAction: string; createdAt: Date; }
export interface NotificationPreference { notificationKey: string; taskId: string; dismissedAt: Date | null; snoozedUntil: Date | null; updatedAt: Date; }
