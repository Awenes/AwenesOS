import type { EvidenceKind, Task } from "../domain/task.js";
import type { TaskRepositoryMapping } from "../infrastructure/repositories/task-repository.js";

export interface CompletionEvidence { kind: EvidenceKind | string; value: string; }

export function draftCompletionDescription(task: Task, evidence: CompletionEvidence[], repository: TaskRepositoryMapping | null): string {
  const grouped = new Map<string, string[]>();
  for (const entry of evidence) grouped.set(entry.kind, [...(grouped.get(entry.kind) ?? []), entry.value]);
  const sections: string[] = [section("Completed", [task.title])];
  const changeItems = [...values(grouped, "commit").map(formatCommit), ...values(grouped, "note")];
  if (changeItems.length) sections.push(section("What changed", changeItems));
  const files = values(grouped, "file").map(formatFile);
  if (files.length) sections.push(section("Files changed", files));
  const verification = [...values(grouped, "test").map((value) => `Test: ${value}`), ...values(grouped, "build").map((value) => `Build: ${value}`)];
  if (verification.length) sections.push(section("Verification", verification));
  const links = values(grouped, "link");
  if (links.length || task.sourceReference) sections.push(section("References", [...links, ...(task.sourceReference ? [task.sourceReference] : [])]));
  if (repository) sections.push(section("Repository context", [`${repository.repositoryRoot} (${repository.branchAtMapping})`]));
  if (task.assignmentDescription.trim()) sections.push(section("Requested outcome", [task.assignmentDescription.trim()]));
  if (!evidence.length) sections.push(section("Review required", ["No completion evidence is recorded yet. Replace or expand this draft before synchronization."]));
  return sections.join("\n\n");
}

function values(grouped: Map<string, string[]>, kind: string) { return grouped.get(kind) ?? []; }
function section(title: string, items: string[]) { return `${title}:\n${items.map((item) => `- ${item}`).join("\n")}`; }
function formatCommit(value: string) { const [hash, ...messageParts] = value.split("\t"); const message = messageParts.join("\t").trim(); return message ? `${message} (${hash?.slice(0, 8)})` : value; }
function formatFile(value: string) { const separator = value.indexOf(": "); return separator >= 0 ? value.slice(separator + 2) : value; }
