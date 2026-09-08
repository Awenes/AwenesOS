# Date-aware standups and weekly reviews

Status: implemented

Generate Markdown reports from completion timestamps and current actionable state. Daily standups use the previous configured working day, not merely the previous calendar day. Weekly reviews cover five configured working days and include completed work, carried-forward tasks, blockers, and evidence counts.

Working days are local weekday numbers configured with `AWENES_WORK_DAYS` (`0` Sunday through `6` Saturday; default `1,2,3,4,5`). CLI dates accept `today`, `yesterday`, or `YYYY-MM-DD`. Reports print to stdout or an explicitly selected UTF-8 Markdown file.
