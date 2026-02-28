# Branching & Cleanup Checklist

## Default branch

* **Current default branch:** `work` (update this if the repo uses `main`, `master`, or `stable`).

## Naming convention

Use clear prefixes so branches are self-describing:

* `feat/mobile-pagination`
* `fix/login-edge`
* `chore/help-modal-copy`

## Safe cleanup checklist

### A) Safety first (do not skip)

1. Confirm the default branch:
   ```sh
   git branch --list main master stable work
   ```
2. Check out and sync the default branch:
   ```sh
   git checkout <default-branch>
   git pull origin <default-branch>
   ```
3. Fetch all refs and prune:
   ```sh
   git fetch --all --prune
   ```
4. Tag the current state (rollback point):
   ```sh
   git tag pre-branch-cleanup-$(date +%Y%m%d)
   git push origin --tags
   ```

### B) Audit branches (local + remote)

1. List branches with merge status:
   ```sh
   git branch --all --verbose
   git branch --merged
   git branch --no-merged
   ```
2. Generate a cleanup report (optional but recommended):
   ```sh
   git branch -r --merged origin/<default-branch> > merged-remote-branches.txt
   git branch -r --no-merged origin/<default-branch> > unmerged-remote-branches.txt
   ```
3. Manually scan for:
   * Old experiment branches
   * Duplicate feature branches
   * Branches with no commits ahead of the default branch

### C) Delete merged branches (safe)

Local:
```sh
git branch --merged <default-branch> | grep -v "<default-branch>" | xargs -n 1 git branch -d
```

Remote:
```sh
git branch -r --merged origin/<default-branch> \
  | grep -v "origin/<default-branch>" \
  | sed 's|origin/||' \
  | xargs -n 1 git push origin --delete
```

> If a branch refuses to delete locally, it likely contains unmerged commits. Do **not** force-delete yet.

### D) Handle unmerged / abandoned branches

For each branch in `--no-merged`:

```sh
git log <default-branch>..branch-name --oneline
git diff <default-branch>..branch-name
```

Decision matrix:

* **Valuable work** → merge or cherry-pick
* **Superseded** → delete
* **Unsure** → archive

Archive instead of deleting (safe option):

```sh
git tag archive-branch-name branch-name
git push origin archive-branch-name
git push origin --delete branch-name
```

### E) Final prune + verification

```sh
git fetch --prune
git branch -a
```

Confirm:

* No orphaned branches
* No CI references broken
* No open PRs pointing to deleted branches

### F) Prevent this in the future (guardrails)

* Enable **Automatically delete head branches** in GitHub settings.
* Review and delete stale branches during each release cycle.
* Keep the naming convention consistent so cleanup is obvious.
