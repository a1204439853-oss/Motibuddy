# Reliability regression tests

Run `npm run check:desktop` from the repository root for the current full gate (TypeScript, 96 Node tests, 22 Rust library tests and desktop compilation). `npm run check` runs frontend checks only. The test suite uses Node's built-in test runner and TypeScript type stripping; Node.js 24 is the verified development runtime. No additional test framework is installed. The desktop application's runtime does not depend on Node.js.

After the second batch, the Node suite contains 77 passing tests. `pet-repository.test.mjs` covers migration backups, conflicting copies, explicit selection, interrupted migration, queued updates and session invalidation. `pet-rewards.test.mjs` covers durable reward receipts and compensation after later interactions. `pet-session-rules.test.mjs` covers disposable cache cleanup and shared interaction rules. `widget-pet-commands.test.mjs` covers request/reply ordering, session validation, bounded deduplication, failed saves, timeout and listener cleanup. Storage integration tests also exercise pet migration and reward receipts with real temporary JSON files.

`storage-reliability.test.mjs` uses isolated temporary directories named `motibuddy-storage-test-*`. It verifies real file replacement and backup behavior, plus injected read, write, backup and replacement failures. Cleanup verifies the generated directory is directly inside the temporary root before recursively removing that directory.

`task-session.test.mjs` verifies load failure protection, empty lists, explicit commit acknowledgement, queued edits, retry, account-bound requests, obsolete responses and React StrictMode's setup/cleanup/setup lifecycle.

The Rust helper `src-tauri/src/storage_paths.rs` also contains tests. They can be run with `cargo test --manifest-path src-tauri/Cargo.toml --locked storage_paths::tests`. To test just this standard-library-only helper without rebuilding the desktop test binary on Windows, the verified commands are:

```powershell
rustc --edition=2021 --test src-tauri/src/storage_paths.rs -o node_modules/.cache/motibuddy-storage-paths-tests.exe
.\node_modules\.cache\motibuddy-storage-paths-tests.exe
```

Create `node_modules/.cache` first if it does not exist. These tests validate filenames, distinguish missing files from directories, and cover Windows treating a file in an ancestor path as `PATH_NOT_FOUND`. The production adapter uses the custom `data_file_exists` backend command, because Tauri v1's generic `exists()` suppresses some filesystem errors.

These tests do not read the real application's AppData or WebView storage. Disk-full and access-denied errors are injected; they are not operating-system fault or power-loss tests. The file adapter exercised here is Node's filesystem adapter; the production Tauri filesystem adapter still requires an installed-app smoke test.

The legacy JSON adapter still serializes only within one WebView and keeps one previous valid `.bak` file. After the third batch it is used for legacy migration sources, not normal task/pet/settings commits. The new backend snapshot store, Windows instance lock and exit barrier are described below. Power-loss durability, a general restore UI and backup management remain unverified or unfinished.

The pet-copy selection dialog is a migration choice, not a general damaged-file recovery UI. Cross-window command tests use an injected transport; they do not prove the real Tauri event bus, route changes or dialog clicks work. Those require the isolated manual checks in `MANUAL_VERIFICATION_GUIDE.md`. The test suite has not been run against real user accounts.

## Third batch: account transactions and shutdown

The current suite has 96 passing Node tests and 22 passing Rust library tests. The earlier 77-test count above is historical.

Later additions: `localization.test.mjs` adds 9 language tests. `starter-tasks.test.mjs` adds 8 onboarding tests covering new-account eligibility, atomic examples + marker, concurrency, deletion/restart, future-version protection, failed writes, lost acknowledgements and existing tasks/session isolation. The suite now has 113 Node tests; older counts in historical records are retained. The browser smoke script also exercises registration, first sign-in, adoption and visible starter examples against a simulated Tauri bridge.

The new business-transactions.test.mjs covers one-commit task/pet/achievement changes, feeding and quota, compensation after restart, lost acknowledgements, request deduplication, stale revisions, legacy-cache conflicts and exit drainage. It also checks every task command queued at the account authority is included in exit waiting and that late initial loads cannot overwrite newer committed progress. These TypeScript tests use an injected persistence adapter.

The Rust tests directly exercise the production BusinessStore in isolated temporary directories: whole-snapshot replacement, previous backups, staged-write failures, blocked backup paths, interruption before replacement, concurrent optimistic writers, exact legacy-source archives, equivalent date offsets, duplicate operation receipts, bounded history and widget projections. The Windows lock test verifies a second file handle is rejected and a later handle succeeds after release; it does not launch two application processes.

Run all backend tests without opening a WebView:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --locked --offline --lib
```

Business tests use motibuddy-business-test-* directories and validate their temporary-root boundary before cleanup. No real AppData is accessed. Credentials remain in legacy localStorage, outside the atomic business snapshot. Backend session authorization, real IPC and GUI flows, installed-app dual process behavior, power loss and installer upgrade/downgrade are not verified by this suite.

Durable receipts retain 128 recent commits. Unknown acknowledgement outcomes are read back rather than automatically resent; receipts are not an unlimited replay log. See MANUAL_VERIFICATION_GUIDE.md M17-M22 for the new desktop checks. The release beforeBuildCommand now uses build:desktop and includes the Rust gate.
