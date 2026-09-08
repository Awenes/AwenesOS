export interface CollectedGitEvidence {
  repository: string;
  branch: string;
  commits: string[];
  files: string[];
}

export interface GitEvidenceCollector {
  collect(input: { repositoryPath: string; since: Date }): Promise<CollectedGitEvidence>;
}

export interface GitRepositoryIdentity {
  repository: string;
  branch: string;
  head: string;
}

export interface GitRepositoryInspector {
  inspect(repositoryPath: string): Promise<GitRepositoryIdentity>;
}
