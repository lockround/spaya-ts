# Pre-Publish Checklist

Before publishing to npm, ensure you've completed the following:

## 🔍 Pre-Publish Verification

### Code Quality
- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] All source files are properly typed

### Documentation
- [ ] README.md is up to date with current API
- [ ] CHANGELOG.md includes new changes
- [ ] JSDoc comments are complete for public APIs
- [ ] Version number reflects the scope of changes

### Package Configuration
- [ ] package.json metadata is correct (name, description, keywords, etc.)
- [ ] Main entry point exists (`dist/index.js`)
- [ ] Type definitions exist (`dist/index.d.ts`)
- [ ] All necessary files are included in `files` array
- [ ] Dependencies are up to date and secure

### Repository
- [ ] Working directory is clean (no uncommitted changes)
- [ ] All changes are pushed to main branch
- [ ] CI/CD builds are passing (if applicable)

### npm Configuration
- [ ] Logged into npm (`npm whoami`)
- [ ] Have publish permissions for the package
- [ ] Correct npm registry configured

## 🚀 Publishing Steps

### Automated (Recommended)
```bash
# Dry run first to check everything
npm run publish:dry-run

# Then publish with appropriate version bump
npm run publish:patch    # For bug fixes
npm run publish:minor    # For new features
npm run publish:major    # For breaking changes
```

### Manual (If needed)
```bash
# 1. Run all checks
npm run lint
npm test
npm run build

# 2. Bump version
npm run version:bump patch

# 3. Check package contents
npm pack --dry-run

# 4. Publish
npm publish

# 5. Tag and push
git add package.json package-lock.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
git tag -a v$(node -p "require('./package.json').version") -m "Release version $(node -p "require('./package.json').version")"
git push origin main --tags
```

## 🔧 Troubleshooting

### Common Issues
- **Authentication errors**: Run `npm login` again
- **Version conflicts**: Check existing versions with `npm view spaya-ts versions`
- **Build failures**: Check TypeScript errors and fix before publishing
- **Test failures**: All tests must pass before publishing

### Recovery
If publishing fails:
1. Check what was completed successfully
2. Fix any issues
3. Resume from the appropriate step
4. Use `--skip-git` flag if git operations were already completed

## 📋 Post-Publish

After successful publishing:
- [ ] Verify package appears on npm: https://www.npmjs.com/package/spaya-ts
- [ ] Test installation in a clean environment: `npm install spaya-ts`
- [ ] Update any dependent projects
- [ ] Announce release (if significant changes)
