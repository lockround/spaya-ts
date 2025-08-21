# Publishing Scripts

This directory contains scripts to help with package publishing and version management.

## Scripts

### publish.js
Main publishing script that handles the complete publish workflow.

**Usage:**
```bash
npm run publish                    # Bump patch version and publish
npm run publish:patch              # Bump patch version and publish
npm run publish:minor              # Bump minor version and publish  
npm run publish:major              # Bump major version and publish
npm run publish:beta               # Publish to beta tag
npm run publish:dry-run            # Dry run without actually publishing
```

**Manual usage:**
```bash
node scripts/publish.js [version-type] [npm-tag] [options]
```

**Options:**
- `--dry-run`: Run all steps except actual publishing
- `--skip-tests`: Skip running tests
- `--skip-lint`: Skip running linter
- `--skip-git`: Skip git operations (commit, tag, push)

**What it does:**
1. Checks git status (working directory must be clean)
2. Runs linter and tests
3. Builds the package
4. Validates the build output
5. Bumps version in package.json
6. Runs npm pack --dry-run to preview
7. Publishes to npm
8. Creates git tag and pushes to repository

### version.js
Version management utility script.

**Usage:**
```bash
npm run version current            # Show current version
npm run version:current            # Show current version
npm run version next patch         # Show what next patch version would be
npm run version bump minor         # Bump minor version
npm run version set 2.0.0          # Set specific version
```

## Prerequisites

Before publishing, make sure you have:

1. **npm account**: Create an account at https://www.npmjs.com/
2. **npm login**: Run `npm login` to authenticate
3. **Package scope**: If publishing a scoped package, ensure you have access
4. **Git repository**: Remote repository should be set up for tagging

## Publishing Workflow

### First time setup:
```bash
# Login to npm
npm login

# Verify your credentials
npm whoami
```

### Regular publishing:
```bash
# For patch releases (bug fixes)
npm run publish:patch

# For minor releases (new features)
npm run publish:minor

# For major releases (breaking changes)
npm run publish:major

# For beta releases
npm run publish:beta
```

### Pre-release testing:
```bash
# Always test with dry-run first
npm run publish:dry-run

# Check what files will be included
npm pack --dry-run
```

## Environment Variables

You can set these environment variables to customize the publishing process:

- `NPM_TAG`: Default npm tag (default: "latest")
- `SKIP_TESTS`: Set to "true" to skip tests
- `SKIP_LINT`: Set to "true" to skip linting

## Troubleshooting

### Common issues:

1. **"Working directory not clean"**: Commit or stash your changes first
2. **"Package already exists"**: The version already exists on npm, bump version first
3. **"Authentication failed"**: Run `npm login` again
4. **"Tests failed"**: Fix failing tests before publishing
5. **"Build failed"**: Check TypeScript compilation errors

### Manual recovery:

If publishing fails partway through:

1. Check current version: `npm run version:current`
2. Check npm package: `npm view spaya-ts versions --json`
3. If version was bumped but not published, you can:
   - Publish manually: `npm publish`
   - Or reset version and try again

### Rollback:

If you need to rollback a published version:

```bash
# Deprecate a version (don't unpublish unless absolutely necessary)
npm deprecate spaya-ts@1.2.3 "This version has critical bugs, please upgrade"
```

Note: npm doesn't allow unpublishing versions older than 24 hours without contacting support.
