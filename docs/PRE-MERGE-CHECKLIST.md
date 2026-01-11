# Pre-Merge Checklist: Foundational Model Refactor v1

This checklist must be completed before merging the `testing-infrastructure-merge` branch to `main`.

## Issue References
- **#18** - Milestone: Foundational Model Refactor v1 - Merge to Main
- **#19** - Establish testing baseline before v1 merge
- **#20** - Standardize error handling and logging

---

## Code Quality

### Build & Typecheck
- [ ] `npm run build:shared` - Shared package builds successfully
- [ ] `npm run build:backend` - Backend builds successfully  
- [ ] `npm run build:frontend` - Frontend builds successfully
- [ ] `npm run typecheck` - All TypeScript compilation passes

### Linting
- [ ] `npm run lint` - No ESLint errors (warnings OK)

### Testing
- [ ] `npm run test:backend` - All backend tests pass
- [ ] Manual testing of critical flows completed

---

## Architecture Validation

### Error Handling (#20)
- [x] Shared `ApiErrorResponse` type created in `@autoart/shared`
- [x] Backend error classes (`AppError`, `NotFoundError`, etc.) standardized
- [x] Global Fastify error handler implemented
- [x] Structured Pino logging configured
- [x] Frontend error utilities created
- [x] Toast notification system implemented
- [x] TanStack Query error handling configured

### Testing Infrastructure (#19)
- [x] Vitest configuration for backend
- [x] Test setup utilities and fixtures
- [x] Events service tests
- [x] Error classes tests
- [x] Test commands in package.json

### Module Boundaries
- [ ] No circular dependencies (verify with imports)
- [ ] Clean module exports
- [ ] Path aliases working correctly

---

## Critical Path Manual Testing

### Authentication
- [ ] Login with username/password works
- [ ] Google OAuth login flow works (if implemented)
- [ ] Session persists across page refresh
- [ ] Logout clears session

### Project Navigation
- [ ] Select project from sidebar
- [ ] Navigate through hierarchy (Process → Stage → Subprocess → Task)
- [ ] Breadcrumb navigation works
- [ ] View tabs only appear on project pages

### Actions & Events
- [ ] Create action via Composer
- [ ] Record field values
- [ ] Events appear in Execution Log
- [ ] Toggle "Show system events" works

### Error Handling
- [ ] 404 errors show friendly message
- [ ] 401 redirects to login
- [ ] Network errors show toast notification
- [ ] Validation errors display inline

---

## Pre-Merge Actions

1. **Update version** (if needed)
   ```bash
   npm version patch  # or minor/major
   ```

2. **Final commit message format**
   ```
   feat: merge foundational refactor v1 (#18)
   
   Includes:
   - Error handling standardization (#20)
   - Testing infrastructure (#19)
   - [Other changes]
   ```

3. **Merge strategy**: Merge commit (Option B) to preserve history

---

## Post-Merge Actions

- [ ] Tag release: `git tag v1.0.0-foundational-refactor`
- [ ] Close issues #18, #19, #20
- [ ] Create Phase 2 milestone for UI improvements
- [ ] Monitor for regressions (48 hours)

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Developer | | | ☐ |
| Reviewer | | | ☐ |
