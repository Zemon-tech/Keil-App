# 📝 Commit Message Guide — Documentation Plan

> **Source File:** `.agent/rules/commit-structure.md`
> **Purpose:** Teach the team (and AI) how to write clean, consistent Git commit messages.
> **Standard Used:** [Conventional Commits](https://www.conventionalcommits.org/)

---

## 📌 What Is This Guide About?

This guide explains **how to write a proper Git commit message** so that:

- Anyone reading the project history can **instantly understand what changed and why**.
- Changelogs can be **generated automatically**.
- The team stays **consistent** across all commits.

---

## 🧱 The Commit Message Structure

Every commit message has **3 parts**:

```
<type>(<scope>): <subject>        ← HEADER  (always required)

<body>                            ← BODY    (optional, but recommended)

<footer>                          ← FOOTER  (optional)
```

---

## 📦 Part 1 — Header (REQUIRED)

> **Maximum 50 characters. Always required.**

The header has 3 pieces:

| Piece | Required? | What It Is |
|-------|-----------|------------|
| `type` | ✅ Yes | What kind of change is this? |
| `(scope)` | ⚪ Optional | Which part of the code changed? |
| `subject` | ✅ Yes | A short description of the change |

---

### 🏷️ All Valid `type` Values

| Type | When to Use |
|------|-------------|
| `feat` | Adding a **new feature** |
| `fix` | Fixing a **bug** |
| `docs` | Only **documentation** changes (README, comments) |
| `style` | Formatting, whitespace — **no logic changes** |
| `refactor` | Code cleanup — **not a fix, not a feature** |
| `perf` | A change that **improves performance** |
| `test` | Adding or fixing **tests** |
| `build` | Changes to **build tools** or dependencies |
| `ci` | Changes to **CI/CD** config (GitHub Actions, etc.) |
| `chore` | Other small tasks — **doesn't touch src or tests** |
| `revert` | **Undoing** a previous commit |

---

### ✏️ Rules for Writing the `subject`

- ✅ Use **present tense**: `add` not `added`
- ✅ Use **imperative mood**: `fix bug` not `fixes bug`
- ❌ Do **NOT** capitalize the first letter
- ❌ Do **NOT** end with a period `.`

**Good Example:** `feat(auth): add JWT token refresh`
**Bad Example:** `feat(auth): Added JWT Token Refresh.`

---

## 📄 Part 2 — Body (OPTIONAL)

> **Explain WHY the change was made, not just WHAT.**

- Separate from the header with **one blank line**
- Write using **bullet points** (`-` or `*`)
- Keep each line under **72 characters**
- Use present tense (same as subject)

**Example:**
```
feat(auth): implement JWT token refresh mechanism

- Add interceptor to detect 401 Unauthorized responses
- Automatically refresh JWT using refresh token in cookies
- Replay the original request if refresh is successful
```

---

## 🔗 Part 3 — Footer (OPTIONAL)

> **Use for breaking changes or linking to issues/tickets.**

### Breaking Changes
Start with `BREAKING CHANGE:` followed by what changed:
```
BREAKING CHANGE: /api/v1/users/profile renamed to /api/v1/profiles
```

### Issue References
Close or reference tickets directly:
```
Closes #123
Fixes JIRA-456
```

---

## 💡 Quick Examples

### ✅ Simple Chore (no body, no footer)
```
chore: update dev dependencies in package.json
```

### ✅ Bug Fix with Issue Reference
```
fix(ui): resolve overflow issue on mobile navbar

Fixes #42
```

### ✅ Feature with Body
```
feat(auth): implement JWT token refresh mechanism

- Add interceptor for 401 responses
- Refresh token stored in HTTP-only cookies
- Replay original request on success
```

### ✅ Breaking Change
```
refactor(api): rename base endpoint for user profiles

BREAKING CHANGE: /api/v1/users/profile renamed to /api/v1/profiles.
All clients must update to use the new route.
```

---

## 💻 How to Write the Commit in Terminal

### Option 1 — Multiple `-m` flags (Recommended)
Each `-m` becomes a new paragraph:
```bash
git commit -m "feat(scope): subject" -m "- first point" -m "- second point"
```

### Option 2 — Open in Editor
Run this to open your default editor (VS Code, Vim, etc.):
```bash
git commit
```

---

## 🤖 AI Assistant Rules

When the AI is asked to write a commit message, it **MUST**:

1. Write the **full message** — Header + Body (as bullet points) + Footer
2. Output the **complete ready-to-run** `git commit` command in a code block
3. Use **multiple `-m` flags** for multi-line messages

---

## 🛠️ Helpful Tools

| Tool | What It Does |
|------|-------------|
| `commitizen` | Interactive CLI prompt to guide your commit message |
| `commitlint` | Lints commit messages against these rules |
| `husky` | Runs `commitlint` automatically as a Git hook |

---

## ✅ Quick Checklist Before You Commit

- [ ] Header is under **50 characters**
- [ ] `type` is one of the valid types (`feat`, `fix`, `docs`, etc.)
- [ ] `subject` is in **present tense**, **no period**, **no capital first letter**
- [ ] Body uses **bullet points** and explains **why** (if needed)
- [ ] Footer references **issues** or declares **BREAKING CHANGE** (if needed)
- [ ] Full command is **ready to copy-paste** in terminal

---

*📁 Source: `.agent/rules/commit-structure.md` | Standard: [Conventional Commits](https://www.conventionalcommits.org/)*
