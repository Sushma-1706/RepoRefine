# Contributing to RepoRefine

Thank you for your interest in contributing to RepoRefine!

## Continuous Integration (CI)

To ensure code quality and prevent regressions, this repository uses GitHub Actions for automated validation.

### What validations are executed?

Our CI pipeline (`.github/workflows/ci.yml`) runs the following checks automatically:
1. **Linting**: Runs `npm run lint` (ESLint) to ensure code style and catch static errors.
2. **Type Checking**: Runs `npx tsc --noEmit` to verify TypeScript types across the codebase.
3. **Frontend Tests**: Runs `npm run test` (Vitest) to execute the frontend test suite.
4. **Backend Tests**: Runs `python -m unittest discover` to execute the Python backend test suite.
5. **Build Generation**: Runs `npm run build` (Next.js build) to verify that the application compiles successfully for production.

These tasks run in parallel to provide you with faster feedback.

### When does the workflow run?

The CI workflow triggers automatically on:
- **Pull Requests** targeting the `main` branch.
- **Pushes** directly to the `main` branch (and other protected branches).

*Note: Changes made exclusively to Markdown files (`*.md`) or the `docs/` folder will bypass the CI workflow to save resources.*

### How to reproduce CI checks locally

Before submitting a Pull Request, please ensure all checks pass on your local machine. You can run the exact same commands the CI uses:

```bash
# 1. Install dependencies
npm ci

# 2. Run Linting
npm run lint

# 3. Run Type Checking
npx tsc --noEmit

# 4. Run Frontend Tests
npm run test

# 5. Run Backend Tests
cd backend
python -m unittest discover -s tests
cd ..

# 6. Verify Build
npm run build
```

If any of these commands fail locally, they will also fail in the CI pipeline. Please fix any errors before pushing your code.
