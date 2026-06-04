# SOP: Branching & Committing Code

| Field            | Value                |
| ---------------- | -------------------- |
| **Doc ID**       | SOP-DEV-001          |
| **Version**      | 1.0                  |
| **Status**       | Draft                |
| **Owner**        | ZemonTech            |
| **Audience**     | All Developers       |
| **Last Updated** | 2026-06-02           |

## 1. Purpose

Standardize how developers branch, commit, and push code to keep the `development` branch stable and reviewable.

## 2. Scope

Applies to **all code changes** — features, bug fixes, refactors, chores.

## 3. Branch Strategy

```
main (production)
   ↑
development  ←  base for all new work
   ↑
feature/* | bugfix/* | chore/*
```

- **`main`** — production code. No direct commits.
- **`development`** — integration branch. All new work starts here.
- **Feature branches** — short-lived, branched from `development`.

## 4. Branch Naming Convention

Format: `<type>/<short-description>`

| Type        | Use for                            | Example                       |
| ----------- | ---------------------------------- | ----------------------------- |
| `feature/`  | New functionality                  | `feature/user-login`          |
| `bug/`      | Non-urgent bug fix                 | `bug/cart-total`              |
| `chore/`    | Refactor, deps, tooling            | `chore/eslint-setup`          |

**Rules:**

- Lowercase, hyphen-separated.
- No spaces, no underscores.
- Description should be short, meaningful, and action-oriented.

## 5. Commit Message Convention

Follow **Conventional Commits**:

```
<type>(<scope>): <short summary>

[optional body: what & why]

[optional footer: refs, BREAKING CHANGE]
```

| Type       | Use for                                       |
| ---------- | --------------------------------------------- |
| `feat`     | New feature                                   |
| `fix`      | Bug fix                                       |
| `chore`    | Tooling, deps, no production code change      |
| `refactor` | Code change, no behavior change               |
| `docs`     | Documentation only                            |
| `test`     | Adding or fixing tests                        |

**Examples:**

- `feat(auth): add Google OAuth login`
- `fix(cart): correct tax calculation for EU`
- `chore: bump axios to 1.7.2`

**Rules:**

- Imperative mood (*"add"*, not *"added"*).
- Summary ≤ 72 chars, no trailing period.
- One logical change per commit.

## 6. Procedure

### Step 1 — Sync with `development`

```bash
git checkout development
git pull origin development
```

**Verify:** `git status` shows a clean working tree and you are on `development`.

### Step 2 — Create feature branch

```bash
git checkout -b feature/short-description
```

**Verify:** `git branch --show-current` shows your new branch.

### Step 3 — Make changes

Write code locally. Run linter and tests before committing.

### Step 4 — Stage and commit

```bash
git add <files>
git commit -m "feat(scope): summary"
```

**Verify:** `git log --oneline -1` shows the commit with the correct message format.

### Step 5 — Push branch

```bash
git push -u origin feature/short-description
```

**Verify:** Push succeeds with no auth or rejection errors.

### Step 6 — Open Pull Request

- Target: **`development`** (never `main` directly).
- Title: same as commit summary or `Short title`.
- Fill PR template; request reviewer.
- **Wait for approval** before merging.

### Step 7 — After merge

Delete the feature branch locally and remotely:

```bash
git checkout development
git pull
git branch -d feature/short-description
git push origin --delete feature/short-description
```

## 7. Rules (Do's & Don'ts)

**Do:**

- Pull from `development` daily to stay current.
- Keep branches small and focused.
- Write meaningful commit messages.

**Don't:**

- Commit directly to `development` or `main`.
- Force-push to shared branches (`git push --force`).
- Mix unrelated changes in one branch.
- Commit secrets, `.env`, or build artifacts (use `.gitignore`).

## 8. Error Handling

| Issue                                          | Action                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `development` has new commits while you work    | `git pull --rebase origin development`                                               |
| Push rejected (non-fast-forward)               | Pull or rebase, resolve conflicts, push again                                         |
| Wrong branch committed to                      | `git stash` → switch branch → `git stash pop` (ask lead if unsure)                    |
| Committed sensitive data                       | **Stop. Notify Tech Lead immediately.** Do not push.                                  |

## 9. References

- [Conventional Commits specification](https://www.conventionalcommits.org/)
- Internal: Code Review SOP, `.gitignore` template

## 10. Change Log

| Version | Date       | Author     | Change         |
| ------- | ---------- | ---------- | -------------- |
| 1.0     | 2026-06-02 | ZemonTech  | Initial draft  |
