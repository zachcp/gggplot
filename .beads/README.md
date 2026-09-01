# Beads - AI-Native Issue Tracking

Welcome to Beads! This repository uses **Beads** for issue tracking - a modern, AI-native tool designed to live directly in your codebase alongside your code.

## What is Beads?

Beads is issue tracking that lives in your repo, making it perfect for AI coding agents and developers who want their issues close to their code. No web UI required - everything works through the CLI and integrates seamlessly with git.

**Learn more:** [github.com/steveyegge/beads](https://github.com/steveyegge/beads)

## Quick Start

### Essential Commands

```bash
# Create new issues
bd create "Add user authentication"

# View all issues
bd list

# View issue details
bd show <issue-id>

# Update issue status
bd update <issue-id> --claim
bd update <issue-id> --status done

# Sync with Dolt remote
bd dolt push
```

### Working with Issues

Issues in Beads are:
- **Git-native**: Stored in Dolt database with version control and branching
- **AI-friendly**: CLI-first design works perfectly with AI coding agents
- **Branch-aware**: Issues can follow your branch workflow
- **Sync-ready**: Uses Dolt remotes for backup and team sharing

## Why Beads?

✨ **AI-Native Design**
- Built specifically for AI-assisted development workflows
- CLI-first interface works seamlessly with AI coding agents
- No context switching to web UIs

🚀 **Developer Focused**
- Issues live in your repo, right next to your code
- Works offline, syncs when you push
- Fast, lightweight, and stays out of your way

🔧 **Git Integration**
- Dolt-native sync via bd dolt push / bd dolt pull
- Branch-aware issue tracking
- Dolt-native three-way merge resolution

## Get Started with Beads

For this repository, bootstrap from the existing reconciled Dolt remote:

```bash
# Never run bd init here: it creates unrelated Dolt ancestry.
./scripts/bootstrap_beads.sh

# Create your first issue
bd create "Try out Beads"
```

`scripts/bootstrap_beads.sh` pins the supported bd 1.2.2 contract, runs the
non-destructive `bd bootstrap --yes`, and repairs the ignored, machine-local
`events` table that the shared remote intentionally does not clone. The repair
uses a checksum-pinned Dolt CLI only to create that ignored table. It does not
run `bd migrate`, commit schema, or advance shared Dolt history; a clean Dolt
status is required before the script succeeds.

Why this exists: the reconciled remote has the migration-62 `dolt_ignore` rule
for `events` while remaining on the schema compatible with bd 1.2.2. A fresh
clone therefore reads all issues but cannot record a mutation event until its
local table is recreated. Do not remove the ignore rule, import JSONL, run
`bd init`, or migrate/push a newer accidental schema as a workaround.

## Learn More

- **Documentation**: [github.com/steveyegge/beads/docs](https://github.com/steveyegge/beads/tree/main/docs)
- **Quick Start Guide**: Run `bd quickstart`
- **Examples**: [github.com/steveyegge/beads/examples](https://github.com/steveyegge/beads/tree/main/examples)

---

*Beads: Issue tracking that moves at the speed of thought* ⚡
