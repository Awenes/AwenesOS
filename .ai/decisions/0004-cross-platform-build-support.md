# ADR 0004: Cross-platform build support (macOS/Linux)

Status: rejected — after reviewing scope, staying Windows-only for v0.1

Extend v0.1 from Windows-only to also building and running on macOS and Linux. This widens a boundary the current docs treat as fixed: the README describes AwenesOS as "a local-first **Windows** command center," AGENTS.md commits to "preserve... Windows support," and CI (`.github/workflows/ci.yml`) runs only on `windows-latest`.

## What changes

- `package.json` `build` config gains `mac` (dmg/zip) and `linux` (AppImage/deb) targets alongside `win`, each with its own icon (`.icns`, `.png`) in `build/`.
- `@libsql/client` platform binaries must be added to `optionalDependencies` (pnpm 10+ does not auto-install transitive platform binaries; `electron-builder` already warns about this on the Windows build).
- Four files carry Windows-specific assumptions and need platform branching or abstraction: `src/infrastructure/environment/local-environment-inspector.ts`, `src/infrastructure/browser/local-browser-setup-detector.ts`, `src/infrastructure/providers/local-provider-command.ts`, `src/infrastructure/execution/guarded-command-executor.ts` (path separators, `.exe` suffixes, known browser install locations, shell invocation).
- CI matrix expands to `windows-latest`, `macos-latest`, `ubuntu-latest`.
- macOS builds are unsigned/un-notarized unless a signing identity and notarization credentials are added — Gatekeeper will warn on distribution until that's set up.
- Docs (`README.md`, `AGENTS.md`, `.ai/context/product.md`) drop "Windows" as the fixed platform and describe per-OS support/caveats instead.

## Open questions before implementation

- Does "physical QA" (mentioned in the README's quality gates) get a per-OS pass, or does macOS/Linux ship as best-effort/unverified initially?
- Is code signing/notarization for macOS in scope now, or is an unsigned build acceptable for v0.1?
- Do the four Windows-specific modules get abstracted behind a platform interface, or does each just add an `if (process.platform === ...)` branch?

## Consequences

Broader reach, but more surface area to test and maintain without a Mac/Linux CI runner already in place, and the "Windows support" framing throughout docs and AGENTS.md needs updating everywhere it appears.
