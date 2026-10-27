# Mela Desk — GitHub Collaboration Guidelines

## 1. Golden Rules
- Never push directly to `main`.
- Create a separate branch for every task.
- Submit changes through a Pull Request (PR).
- Test your code before submitting a PR.

## 2. Clone the Repository (First Time Only)

Copy the repository URL from GitHub, then run:

```bash
git clone https://github.com/Musharraf-Mahad/mela-desk ```

## 3. Create a Branch

Before starting a task, update `main` and create your own branch:

```bash
git switch main
git pull origin main
git switch -c feature/your-task
```

Branch naming examples:
- `feature/ticket-creation`
- `fix/login-error`
- `docs/update-readme`
- `test/ticket-api`

## 4. Code, Test, Commit, and Push

Make your changes, then test your code. When ready, run:

```bash
git status
git add .
git commit -m "feat: add ticket creation"
git push -u origin feature/your-task
```

Use a meaningful commit message, such as `fix: correct login validation`.

**Note:** Replace `feature/your-task` with your actual branch name.

## 5. Create a Pull Request

1. Open the repository on GitHub.
2. Click **Compare & pull request** (or open a new PR).
3. Set the base branch to `main` and the compare branch to your feature branch.
4. Describe your changes and testing.
5. Request a review from at least one teammate.
6. Address feedback and merge only after approval.

## 6. Before Starting Another Task

After your PR is merged:

```bash
git switch main
git pull origin main
git switch -c feature/next-task
```
