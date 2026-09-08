import { z } from "zod";

export const WorkingDaysSchema = z.array(z.number().int().min(0).max(6)).min(1).transform((days) => [...new Set(days)]);
export const ReportDateSchema = z.string().trim().transform((value, context) => {
  const normalized = value.toLowerCase(); const now = new Date();
  if (normalized === "today") return startOfDay(now);
  if (normalized === "yesterday") { const date = startOfDay(now); date.setDate(date.getDate() - 1); return date; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { context.addIssue({ code: "custom", message: "Use today, yesterday, or YYYY-MM-DD" }); return z.NEVER; }
  const [year, month, day] = value.split("-").map(Number); const date = new Date(year!, month! - 1, day!);
  if (date.getFullYear() !== year || date.getMonth() !== month! - 1 || date.getDate() !== day) { context.addIssue({ code: "custom", message: "Date is not valid" }); return z.NEVER; }
  return date;
});

export function configuredWorkingDays(input = process.env.AWENES_WORK_DAYS): number[] {
  if (!input?.trim()) return [1, 2, 3, 4, 5];
  return WorkingDaysSchema.parse(input.split(",").map((value) => Number(value.trim())));
}
function startOfDay(value: Date) { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; }
