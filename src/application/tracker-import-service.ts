import { TrackerImportConfigSchema, type TrackerAdapter, type TrackerImportConfig } from "../domain/tracker.js";
import { TaskRepository } from "../infrastructure/repositories/task-repository.js";

export interface TrackerImportResult { imported: number; skippedExisting: number; skippedByStatus: number; }

export class TrackerImportService {
  constructor(private readonly repository: TaskRepository, private readonly tracker: TrackerAdapter) {}

  async import(source: string, input: TrackerImportConfig): Promise<TrackerImportResult> {
    const config = TrackerImportConfigSchema.parse(input);
    const issues = await this.tracker.read(source, config);
    const result: TrackerImportResult = { imported: 0, skippedExisting: 0, skippedByStatus: 0 };
    for (const issue of issues) {
      if (!included(issue.status, config)) { result.skippedByStatus += 1; continue; }
      const sourceReference = `${this.tracker.name}:${config.project}:${issue.externalId}`;
      if (await this.repository.findBySourceReference(sourceReference)) { result.skippedExisting += 1; continue; }
      const context = [issue.description, issue.status ? `Tracker status: ${issue.status}` : "", issue.url ? `Tracker URL: ${issue.url}` : ""].filter(Boolean).join("\n\n");
      await this.repository.create({ title: issue.title, source: "bug-tracker", sourceReference, assignmentDescription: context, assignedToMe: false, occurredAt: new Date() });
      result.imported += 1;
    }
    return result;
  }
}

function included(status: string | null, config: TrackerImportConfig): boolean {
  const normalized = normalize(status ?? "");
  const include = config.statuses.include?.map(normalize);
  const exclude = config.statuses.exclude?.map(normalize);
  if (include?.length) return include.includes(normalized);
  if (exclude?.length) return !exclude.includes(normalized);
  return true;
}
function normalize(value: string) { return value.trim().toLocaleLowerCase(); }
