import { z } from "zod";

const ColumnSelectorSchema = z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]);

export const TrackerImportConfigSchema = z.object({
  project: z.string().trim().min(1),
  columns: z.object({
    id: ColumnSelectorSchema,
    title: ColumnSelectorSchema,
    description: ColumnSelectorSchema.optional(),
    status: ColumnSelectorSchema.optional(),
    url: ColumnSelectorSchema.optional()
  }),
  statuses: z.object({
    include: z.array(z.string().trim().min(1)).optional(),
    exclude: z.array(z.string().trim().min(1)).optional()
  }).default({})
}).superRefine((value, context) => {
  if (value.statuses.include?.length && value.statuses.exclude?.length) {
    context.addIssue({ code: "custom", path: ["statuses"], message: "Configure include or exclude statuses, not both" });
  }
});

export type TrackerImportConfig = z.infer<typeof TrackerImportConfigSchema>;

export interface TrackerIssue {
  externalId: string;
  title: string;
  description: string;
  status: string | null;
  url: string | null;
}

export interface TrackerAdapter {
  readonly name: string;
  read(source: string, config: TrackerImportConfig): Promise<TrackerIssue[]>;
}
