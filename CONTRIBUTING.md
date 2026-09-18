# Contributing to RepoRefine

## Prerequisites

Use Node.js 20+ and npm. Copy `.env.example` to `.env.local`; `GITHUB_TOKEN` is needed for GitHub-backed audits. Do not commit `.env.local`, tokens, or private repository contents.

## Local development

```bash
npm install
npm run dev
```

Before opening a pull request, run `npm run lint`, `npx tsc --noEmit`, and `npm run build`.

## Workflow

Create focused branches such as `feat/repository-context` or `fix/repo-url-validation`. Use Conventional Commit-style messages (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`, `chore:`). Explain user-visible changes and include screenshots for UI changes.

## Repository assistant conventions

Assistant behavior must retrieve repository context before making repository-specific claims. Preserve the distinction between facts, inferences, and recommendations. Do not invent file paths, dependencies, commands, secrets, vulnerabilities, or scanner findings. Keep GitHub requests centralized and respect cache/rate-limit behavior.

## Issues and pull requests

Use the issue forms and pull request template. Include reproducible steps, redacted logs, and relevant repository evidence. Reviewers may request tests or a cache/rate-limit impact assessment for API changes.
