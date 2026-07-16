# gggplot documentation site

Run the docs locally with `deno task --cwd apps/site dev`.

## Visual route-health gate

`deno task --cwd apps/site test:visual` builds the production bundle and opens
every documentation hash route in a fixed 1440×1080 Chromium viewport. It
checks that each route has chart surfaces with plausible bounds, captures
browser errors and warnings, and writes a full-page PNG for each route plus
`report.json` under `.artifacts/visual-smoke/`.

The gate intentionally fails on rendering faults; do not waive a failure based
on successful compiler output. Attach the generated route PNG and report to
the owning Beads issue when triaging. The current baseline exposes the known
WebGPU shader/buffer failure tracked in `gggplot-1ha.2`.
