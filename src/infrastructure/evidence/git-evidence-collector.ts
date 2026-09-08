import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CollectedGitEvidence, GitEvidenceCollector, GitRepositoryIdentity, GitRepositoryInspector } from "../../domain/git-evidence.js";

const run = promisify(execFile);

export class LocalGitEvidenceCollector implements GitEvidenceCollector, GitRepositoryInspector {
  async inspect(repositoryPath: string): Promise<GitRepositoryIdentity> {
    const repository = await git(repositoryPath, ["rev-parse", "--show-toplevel"]);
    const branch = await git(repository, ["branch", "--show-current"]);
    const head = await git(repository, ["rev-parse", "HEAD"]);
    return { repository, branch: branch || "detached HEAD", head };
  }

  async collect(input: { repositoryPath: string; since: Date }): Promise<CollectedGitEvidence> {
    const { repository, branch } = await this.inspect(input.repositoryPath);
    const log = await git(repository, ["log", `--since=${input.since.toISOString()}`, "--format=%H%x09%s"]);
    const committedFiles = await git(repository, ["log", `--since=${input.since.toISOString()}`, "--name-only", "--format="]);
    const workingTree = await git(repository, ["status", "--porcelain=v1", "-uall"]);
    return {
      repository,
      branch: branch || "detached HEAD",
      commits: unique(lines(log)),
      files: unique([...lines(committedFiles), ...lines(workingTree).map(statusPath)]).sort()
    };
  }
}

async function git(directory: string, args: string[]): Promise<string> {
  try {
    const result = await run("git", ["-C", directory, ...args], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    return result.stdout.trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not collect Git evidence from ${directory}: ${detail}`);
  }
}
function lines(value: string) { return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function unique(values: string[]) { return [...new Set(values)]; }
function statusPath(line: string) {
  const path = line.slice(3).trim();
  const rename = path.lastIndexOf(" -> ");
  return rename >= 0 ? path.slice(rename + 4) : path;
}
