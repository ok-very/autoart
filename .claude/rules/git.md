# Git Safety Rules

- Use **stackit** for all stacked PR workflows
- Merge with `stackit merge next` or `gh pr merge <number> --merge --delete-branch`
- NEVER use `--squash` when merging PRs — it breaks stacked branches
- NEVER amend commits that have been pushed — create NEW commits for fixes
- NEVER force push stacked branches
- NEVER manually rebase stacks — use `stackit restack`
- NEVER retarget all PRs to main before merging
- If a child PR shows "not mergeable" after parent merges, WAIT — GitHub is retargeting
- Commit prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
