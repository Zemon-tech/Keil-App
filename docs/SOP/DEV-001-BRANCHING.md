# SOP: Branching & Committing Code

| Field            | Value          |
| ---------------- | -------------- |
| **Doc ID**       | DEV-001        |
| **Version**      | 2.0            |
| **Status**       | Approved       |
| **Owner**        | ZemonTech      |
| **Audience**     | All Developers |
| **Last Updated** | 2026-06-07     |

## 1. Purpose

Standardize how developers branch, commit, push, merge, and clean up code to keep the `development` branch stable and reviewable, and protect the production codebase.

## 2. Scope

Applies to **all code changes** — features, bug fixes, refactors, documentation updates, chores.

## 3. Branching Strategy

```
main (production) - Protected (GitHub Ruleset)
   ▲
   │ [PR after release verification]
   │
development - Active integration branch
   ▲
   │ [PR after peer approval]
   │
feature/* | bug/* | chore/* - Short-lived local/remote branches
```

### Core Branches
* **`main`**: Production code. Direct commits and pushes are strictly blocked via a GitHub ruleset. It only receives updates from `development` via approved pull requests when a release is ready.
* **`development`**: Integration branch. All new work starts from here, and all feature/bug branches must target this branch in their pull requests.
* **Feature/Bug/Chore branches**: Short-lived branches created locally off `development` for individual developer tasks.

---

## 4. Branch & Commit Message Conventions

### 4.1. Branch Naming Format
Format: `<type>/<short-description>`

| Type       | Use for                         | Example              |
| ---------- | ------------------------------- | -------------------- |
| `feature/` | New functionality               | `feature/user-login` |
| `bug/`     | Bug fixes                       | `bug/cart-total`     |
| `chore/`   | Refactor, dependencies, tooling | `chore/eslint-setup` |

* **Rules**: Lowercase, hyphen-separated, no spaces, no underscores, clear and descriptive description.

### 4.2. Commit Messages (Conventional Commits)
All commit messages must follow the **Conventional Commits** specification:

```
<type>(<scope>): <short summary>

[optional body: what changes were made & why]

[optional footer: refs, issue number, BREAKING CHANGE]
```

| Type       | Use for                                                  |
| ---------- | -------------------------------------------------------- |
| `feat`     | New feature                                              |
| `fix`      | Bug fix                                                  |
| `chore`    | Tooling, dependencies, non-production files              |
| `refactor` | Code restructuring without changing behavior             |
| `docs`     | Documentation changes only                               |
| `test`     | Adding or fixing test cases                              |
| `style`    | Formatting, semi-colons, white spaces (no logic changes) |

* **Commit Rules**:
  - Write in the imperative mood (*"add authentication"*, NOT *"added authentication"* or *"adds authentication"*).
  - Limit the summary line to 72 characters.
  - Do not end the summary with a period.

---

## 5. Developer Workflow: Step-by-Step

### Step 1 — Sync development and Pull Latest Code
Before starting any new work, always pull the latest updates from the remote `development` branch to avoid conflicts:
```bash
git checkout development
git pull origin development
```
> [!NOTE]
> Verify that your working directory is clean using `git status` before pulling.

### Step 2 — Create and Checkout a Local Feature Branch
Create a new branch off the updated `development` branch:
```bash
git checkout -b feature/your-feature-name
```
This command combines `git branch feature/your-feature-name` and `git checkout feature/your-feature-name`.

### Step 3 — Make Changes & Commit
Write your code, run unit tests and linters locally, then stage and commit using conventional commit messages:
```bash
# Stage specific files
git add path/to/file.ts
# Commit with conventional message
git commit -m "feat(auth): integrate OAuth2 login button"
```

### Step 4 — Push Feature Branch to Remote
Push your local branch to GitHub, setting the upstream remote tracking branch:
```bash
git push -u origin feature/your-feature-name
```

### Step 5 — Open a Pull Request (PR)
1. Go to the GitHub repository.
2. Open a Pull Request from `feature/your-feature-name` targeting **`development`**.
3. **DO NOT** target `main` directly.
4. Fill in the PR template, add a description of the changes, and assign reviewers.
5. Peer review approval is required before the PR can be merged.

### Step 6 — Merge Strategy
On GitHub, the preferred merge strategy is **Rebase and Merge** to maintain a linear and clean project history.
* **Preferred**: **Rebase and Merge** (applies commits directly onto `development` without a merge commit).
* **Fallback**: If errors, ruleset blocks, or complex conflicts prevent a rebase and merge on GitHub, a standard **Merge Commit** is acceptable.

### Step 7 — Post-Merge Cleanup
Once your PR has been merged into `development`, clean up the merged feature branch to keep the repository tidy:
```bash
# 1. Switch back to your local development branch
git checkout development

# 2. Pull the latest development branch (which now contains your merged changes)
git pull origin development

# 3. Safely delete the local feature branch (-d only succeeds if the branch has been merged)
git branch -d feature/your-feature-name

# 4. Delete the remote feature branch on GitHub (if it wasn't deleted automatically by PR settings)
git push origin --delete feature/your-feature-name
```

---

## 6. Keeping Your Branch Up-to-Date (Rebase vs. Merge)

When other developers merge code into `development` while you are still working on your branch, your branch will fall behind. You must sync it.

There are two primary strategies for doing this. Here is how they work and their specific use cases:

### Strategy A: Rebasing (`git pull --rebase origin development`) — PREFERRED
Rebasing rewrites your feature branch's commit history by placing all of your new commits *on top* of the latest commits from the `development` branch.

```
Before Rebase:
development: A --- B --- C --- D
feature:     A --- B --- X --- Y (branched off B)

After Rebase:
development: A --- B --- C --- D
feature:     A --- B --- C --- D --- X' --- Y' (commits X and Y are reapplied on D)
```

* **Command**:
  ```bash
  # While checked out on your feature branch:
  git pull --rebase origin development
  ```
* **Use Case (Preferred)**:
  - You are working on a private feature branch that only you are committing to.
  - You want to keep a clean, linear git history without cluttering the project with intermediate "Merge branch 'development' into feature/..." commits.
* **Important Note**:
  - Because rebasing rewrites git commit history, if you have already pushed your feature branch to remote previously, you will get a rejection if you try to do a normal `git push`.
  - **You must force push safely** using `--force-with-lease`:
    ```bash
    git push --force-with-lease
    ```
    > [!WARNING]
    > Never run `git push --force` or `--force-with-lease` on shared/public branches like `development` or `main`. This can overwrite other developers' work. Only use it on your personal feature branch.

---

### Strategy B: Merging (`git merge development`) — FALLBACK / COLLABORATION
Merging takes the latest changes from `development` and creates a new, separate "merge commit" on your feature branch, stitching the histories together.

```
Before Merge:
development: A --- B --- C --- D
feature:     A --- B --- X --- Y

After Merge:
development: A --- B --- C --- D
feature:     A --- B --- X --- Y --- M (M is the merge commit linking D and Y)
```

* **Command**:
  ```bash
  # Fetch latest updates from remote
  git fetch origin
  # Merge remote development into your current feature branch
  git merge origin/development
  ```
* **Use Cases**:
  - **Shared Feature Branch**: Multiple developers are working on the *same* feature branch. Rebasing in this scenario would rewrite the history and break their local clones. Merging is safe because it does not rewrite history.
  - **Rebase Complexity**: If rebasing results in a loop of complex conflicts across multiple intermediate commits, merging is a simpler fallback since you only resolve conflicts once in the final merge commit.

---

## 7. Branch Deletion & Cleanup

### 7.1. Simple Branch Deletion Commands

For deleting individual branches, use these standard commands:

#### Delete a Local Branch
* **Safe Deletion**: Will only delete the branch if it has been fully merged into your current active branch (or upstream).
  ```bash
  git branch -d branch-name
  ```
* **Force Deletion**: Forcefully deletes the branch regardless of its merge status. Use this to discard unwanted local work.
  ```bash
  git branch -D branch-name
  ```

#### Delete a Remote Branch
* Deletes the branch from the remote repository (GitHub).
  ```bash
  git push origin --delete branch-name
  ```

### 7.2. Bulk Stale Branch Cleanup

Over time, your local machine will accumulate tracking branches that have already been deleted on the remote repository. Use the following procedure to purge them.

#### Step 1: Prune Remote Tracking References
Pruning removes references to remote branches that no longer exist on GitHub:
```bash
git fetch --prune
```

#### Step 2: Purge Stale Local Branches
To delete all local branches whose remote counterparts have been deleted:

##### For PowerShell Users (Windows):
```powershell
# List branches, find those marked as ': gone]', extract the branch name, and delete them
git branch -vv | Select-String ": gone]" | ForEach-Object { $_.Line.Trim().Split(" ")[0] } | ForEach-Object { git branch -D $_ }
```
**Explanation**:
- `git branch -vv`: Lists local branches along with their upstream tracking branch status. If the remote branch was deleted, it shows `[origin/branch-name: gone]`.
- `Select-String ": gone]"`: Filters the list to show only lines containing `: gone]`.
- `ForEach-Object { $_.Line.Trim().Split(" ")[0] }`: Extracts the branch name (the first word in the line) from the filtered output.
- `ForEach-Object { git branch -D $_ }`: Force deletes each matching branch locally.

##### For Bash / macOS / Linux / Git Bash Users:
```bash
# List branches, find ': gone]', extract the branch name using awk, and force delete them
git branch -vv | grep ': gone]' | awk '{print $1}' | xargs git branch -D
```
**Explanation**:
- `grep ': gone]'`: Filters the local branches list for branches whose upstream is gone.
- `awk '{print $1}'`: Extracts the first column (the local branch name).
- `xargs git branch -D`: Passes the list of branch names to the git branch delete command.

---

## 8. Common Edge Cases & Troubleshooting

### Edge Case 1: Uncommitted Changes when Switching/Pulling
**Problem**: You want to switch branches or pull the latest changes, but you have uncompleted local edits, and git blocks you: `"Your local changes to the following files would be overwritten by checkout..."`

**Solution (Git Stash)**:
Temporarily save your modifications without committing them:
```bash
# 1. Stash your current uncommitted changes (tracked and untracked files)
git stash -u

# 2. Safely perform your checkout, pull, or merge
git checkout development
git pull origin development
git checkout -b new-feature

# 3. Apply your stashed changes back and remove them from stash memory
git stash pop
```

---

### Edge Case 2: Resolving Merge or Rebase Conflicts
**Problem**: Git halts a merge or rebase operation with conflict errors: `"CONFLICT (content): Merge conflict in..."`

**Step-by-Step Resolution**:
1. Open the conflicted files in your IDE (e.g., VS Code).
2. Look for conflict markers:
   ```
   <<<<<<< HEAD
   Your current local code
   =======
   Incoming remote code from target branch
   >>>>>>> origin/development
   ```
3. Edit the file: remove the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) and decide which code to keep (Current, Incoming, or a manual combination of both).
4. Save the file.
5. Stage the resolved files:
   ```bash
   git add path/to/resolved-file.ts
   ```
6. **Continue the operation**:
   - If you were **rebasing**: `git rebase --continue` (Do NOT run `git commit`). Repeat if there are conflicts on subsequent commits.
   - If you were **merging**: `git commit -m "merge: resolve conflicts with development"` to finish the merge.

---

### Edge Case 3: Accidentally Committing to the Wrong Branch Locally
**Problem**: You made changes and committed them to `development` (or `main`) locally, but you should have put them on a feature branch.

#### Scenario A: You haven't pushed the wrong commits yet
If you haven't pushed to remote, you can easily shift the commits to a new branch:
```bash
# 1. Create and switch to the new feature branch (carries your commits with it)
git checkout -b feature/correct-branch-name

# 2. Switch back to the development branch
git checkout development

# 3. Reset development back to match the remote state (removes local commits from development)
git reset --hard origin/development
```

#### Scenario B: You have pushed, or want to selectively move a commit
Use cherry-picking to copy specific commits onto the correct branch:
```bash
# 1. Switch to the correct branch (or create it off development)
git checkout feature/correct-branch-name

# 2. Copy the commit by its hash
git cherry-pick <commit-hash>

# 3. Fix the incorrect branch (revert or reset) as needed
```

---

### Edge Case 4: Accidental Commit or Push of Sensitive Data
**Problem**: You accidentally committed and pushed a `.env` file, API key, password, or security token.

> [!CAUTION]
> Once a secret is pushed to GitHub, it must be treated as **publicly compromised** immediately.

**Correct Actions**:
1. **Rotate/Revoke the Secret**: Immediately revoke, delete, or regenerate the compromised credential on the provider's side (e.g., AWS, Stripe, Google). This is the only way to guarantee security.
2. **Alert the Team Lead**: Report the incident to your tech lead immediately.
3. **Remove from Git History**: Simply committing a deletion does not remove the secret from your repository's history. Use `git-filter-repo` (or BFG Repo-Cleaner) to purge the file or text from the entire repository git history:
   ```bash
   # (To be performed or assisted by Tech Lead to avoid disrupting colleagues)
   pip install git-filter-repo
   git-filter-repo --path .env --invert-paths
   ```
4. **Force Update Remote**: Force push the cleaned repository back to GitHub.

---

### Edge Case 5: Push Rejected (Protected Branch / Non-Fast-Forward)
**Problem**: You attempt to push your branch, and Git rejects it.

* **Rejection Case A**: `[rejected - non-fast-forward]`.
  - **Reason**: The remote branch contains commits that you do not have locally.
  - **Solution**: Pull latest changes via rebase (`git pull --rebase origin <your-branch>`), resolve any conflicts, and push again.
* **Rejection Case B**: `[protected branch hook declined]`.
  - **Reason**: You tried to push directly to `main` (which is blocked by the GitHub ruleset).
  - **Solution**: Undo the push, switch to a feature branch, and submit a PR to `development`.

---

## 9. References
- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Pro Git Book (Git Branching - Rebasing)](https://git-scm.com/book/en/v2/Git-Branching-Rebasing)

---

## 10. Change Log

| Version | Date       | Author    | Change Description                                                                                                                                                                 |
| ------- | ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-06-02 | ZemonTech | Initial draft.                                                                                                                                                                     |
| 2.0     | 2026-06-07 | ZemonTech | Comprehensive Git Workflow update: main protection ruleset, development branch setup, Rebase vs. Merge guidelines, stale branch cleanup commands, and detailed edge case handling. |
