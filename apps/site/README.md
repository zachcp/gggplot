# gggplot documentation site

The WebGPU gallery self-hosts the `Basic` and `Lato` typefaces from the official
Google Fonts repository. `public/fonts/Basic-Regular.ttf` and
`public/fonts/Lato-Regular.ttf` are distributed under the SIL Open Font License
1.1 copied at `public/fonts/OFL-Basic.txt` and `public/fonts/OFL-Lato.txt`; no
system or proprietary font file is required for chart text.

Run the docs locally with `deno task --cwd apps/site dev`.

## Adding geom examples

Every public `geom*` constructor must be a primary subject of at least one
discoverable `DocExample`. Add the example to its owning page, then update
`src/docs/geom_coverage.ts` with the exact constructor export and example id.
Related geoms may share a comparison example only when its title, prose, DSL
source, and rendered result explicitly teach each geom. The coverage test
rejects missing constructors, stale entries, and missing or duplicate ids.

## Visual route-health gate

`deno task --cwd apps/site test:visual` builds the production bundle and opens
every documentation hash route in a fixed 1440×1080 Chromium viewport. It checks
that each route has chart surfaces with plausible bounds, captures browser
errors and warnings, and writes a full-page PNG for each route plus
`report.json` under `.artifacts/visual-smoke/`.

The gate intentionally fails on rendering faults; do not waive a failure based
on successful compiler output. Attach the generated route PNG and report to the
owning Beads issue when triaging. The current baseline exposes the known WebGPU
shader/buffer failure tracked in `gggplot-1ha.2`.
