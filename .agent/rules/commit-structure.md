---
trigger: model_decision
description: use when user want's to write commit message for the changes he made
---

# Team Commit Message Guidelines

To ensure our project's history remains readable, consistent, and easy to traverse, we follow a strict commit message convention based on [Conventional Commits](https://www.conventionalcommits.org/). This standard allows us to generate changelogs automatically and easily understand the context of any change.

## Rule for AI Assistant
When asked to write or suggest a commit message, the AI MUST:
1.  **Draft the full message** (Header, Body in points, Footer).
2.  **Output the entire git commit command** in a code block using the `git commit -m` format, ensuring it is ready for the user to copy and run in their terminal. Use multiple `-m` flags for multi-line messages and backticks (`` ` ``) for line continuation if the command is long.

## Commit Message Format

Each commit message consists of a **header**, an optional **body**, and an optional **footer**.

```text
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

### 1. Header (Mandatory)
The header is the first line of the commit message. It must not exceed **50 characters**.

*   **`type`**: Must be one of the following:
    *   `feat`: A new feature
    *   `fix`: A bug fix
    *   `docs`: Documentation only changes (README, swagger, inline comments)
    *   `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
    *   `refactor`: A code change that neither fixes a bug nor adds a feature
    *   `perf`: A code change that improves performance
    *   `test`: Adding missing tests or correcting existing tests
    *   `build`: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
    *   `ci`: Changes to our CI configuration files and scripts (example scopes: Travis, Circle, GitHub Actions)
    *   `chore`: Other changes that don't modify src or test files (e.g., updating dependencies)
    *   `revert`: Reverts a previous commit
*   **`scope` (optional but recommended)**: A noun describing the section of the codebase that changed (e.g., `api`, `auth`, `ui`, `components`, `readme`).
*   **`subject`**: A short description of the change.
    *   Use the **imperative, present tense**: "change" not "changed" nor "changes".
    *   **Do not** capitalize the first letter.
    *   **Do not** place a period `.` at the end.

### 2. Body (Optional)
The body should include the motivation for the change and contrast this with previous behavior.
*   Separate it from the header with a single blank line.
*   **Write the body using bullet points** (`- ` or `* `) to clearly itemize the specific changes made.
*   Wrap the body at **72 characters**.
*   Use the imperative, present tense: "change" not "changed" nor "changes".

### 3. Footer (Optional)
The footer is used to reference issues/tickets related to the commit or to declare Breaking Changes.
*   **Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.
*   **Issue References**: Use the footer to reference issues this commit closes (e.g., `Closes #123`, `Fixes JIRA-456`).

---

## Examples

**Feature with a scope and a body:**
```text
feat(auth): implement JWT token refresh mechanism

- Add an interceptor to detect 401 Unauthorized responses
- Automatically attempt to refresh the JWT token using the refresh
  token stored in HTTP-only cookies
- Replay the original request if the refresh is successful
```

**Bug fix with an issue reference:**
```text
fix(ui): resolve overflow issue on mobile navbar

Fixes #42
```

**A commit with a Breaking Change:**
```text
refactor(api): rename base endpoint for user profiles

BREAKING CHANGE: The endpoint `/api/v1/users/profile` has been renamed
to `/api/v1/profiles`. Any clients consuming the old endpoint will
need to be updated to use the new route.
```

**Chore with no scope, body, or footer:**
```text
chore: update dev dependencies in package.json
```

## How to Commit

To write a multi-line commit message in the terminal, use multiple `-m` flags or use your default editor.

### Using Terminal Command
Each `-m` flag treats the input as a new paragraph:
```bash
git commit -m "feat(scope): subject" -m "- first point" -m "- second point"
```

### Using Git Editor
Alternatively, run `git commit` (without `-m`) to open your system's default editor (e.g., VS Code, Vim, Nano) where you can write the full message:
```bash
git commit
```

## Tools
To help follow these conventions, consider using tools like:
- `commitizen`: Provides an interactive prompt for committing.
- `commitlint`: Lints your commit messages against these rules (often set up as a git hook via `husky`).
