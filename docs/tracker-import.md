# Tracker import

Import a CSV export with a project-specific JSON mapping:

```powershell
pnpm cli tracker-import .\exports\issues.csv --config .\tracker-config.json
```

Example configuration:

```json
{
  "project": "skoolbod",
  "columns": {
    "id": ["Issue Key", "ID"],
    "title": ["Summary", "Title"],
    "description": ["Details", "Description"],
    "status": ["Workflow", "Status"],
    "url": ["Link", "URL"]
  },
  "statuses": {
    "exclude": ["Done", "Closed", "Rejected"]
  }
}
```

Use either `statuses.include` or `statuses.exclude`, never both. Column and status matching ignores case; column matching also treats spaces, hyphens, and underscores equivalently.

Repeat imports skip an existing issue with the same adapter, project, and external ID. Every new issue enters the inbox as an unassigned `captured` candidate. Review and claim it before it can enter active work.

CSV files may contain quoted commas, escaped quotes, and multiline quoted values. Native `.xlsx` input is not yet supported; export the relevant worksheet as CSV first.
