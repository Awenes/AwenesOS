import { readFile } from "node:fs/promises";
import type { TrackerAdapter, TrackerImportConfig, TrackerIssue } from "../../domain/tracker.js";

export class CsvTrackerAdapter implements TrackerAdapter {
  readonly name = "csv";

  async read(source: string, config: TrackerImportConfig): Promise<TrackerIssue[]> {
    const rows = parseCsv(await readFile(source, "utf8"));
    if (!rows.length) return [];
    const headers = rows[0]!.map((header) => header.trim());
    const indexes = {
      id: requiredIndex(headers, config.columns.id, "id"),
      title: requiredIndex(headers, config.columns.title, "title"),
      description: optionalIndex(headers, config.columns.description),
      status: optionalIndex(headers, config.columns.status),
      url: optionalIndex(headers, config.columns.url)
    };
    return rows.slice(1).filter((row) => row.some((value) => value.trim())).map((row, index) => {
      const externalId = value(row, indexes.id);
      const title = value(row, indexes.title);
      if (!externalId || !title) throw new Error(`Tracker row ${index + 2} requires both id and title`);
      return { externalId, title, description: value(row, indexes.description), status: nullable(row, indexes.status), url: nullable(row, indexes.url) };
    });
  }
}

function requiredIndex(headers: string[], selector: string | string[], field: string): number {
  const index = optionalIndex(headers, selector);
  if (index === -1) throw new Error(`Could not find configured tracker ${field} column (${aliases(selector).join(", ")})`);
  return index;
}
function optionalIndex(headers: string[], selector?: string | string[]): number {
  if (!selector) return -1;
  const normalized = headers.map(normalize);
  return aliases(selector).map(normalize).map((name) => normalized.indexOf(name)).find((index) => index >= 0) ?? -1;
}
function aliases(selector: string | string[]) { return Array.isArray(selector) ? selector : [selector]; }
function value(row: string[], index: number) { return index < 0 ? "" : (row[index] ?? "").trim(); }
function nullable(row: string[], index: number) { return value(row, index) || null; }
function normalize(value: string) { return value.trim().toLocaleLowerCase().replace(/[\s_-]+/g, " "); }

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (quoted) throw new Error("Invalid CSV: unterminated quoted field");
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}
