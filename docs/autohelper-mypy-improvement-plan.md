# AutoHelper MyPy Incremental Improvement Plan

## Current State

| Metric | Value |
|--------|-------|
| Total Errors | **120** |
| Files Affected | 33 |
| Files Checked | 104 |
| Previous Count | 174 → 120 (31% reduction this session) |
| Original Count | 441 (73% total reduction achieved) |

---

## Progress Log

### 2026-01-24: Bug Risks + High Impact Files Fixed

**Completed:**
- [x] **Tier 0: Bug Risks** - All 6 errors fixed
  - `modules/storage/router.py:69-71` - Added assert guards for nullable SharePoint creds
  - `modules/runner/ssrf/validation.py:46` - Added explicit `str()` conversion for IP addresses
  - `tests/test_index_renames.py:127,136` - Added None checks before `.lower()` access

- [x] **Tier 2a: mail/service.py** - 20 errors → 0 errors
  - Added class variable annotations (`_instance`, `initialized`, `running`, `thread`)
  - Added return types to singleton methods (`__new__`, `__init__`)
  - Added return types to all public/private methods
  - Added parameter types to callback methods

- [x] **Tier 2b: sharepoint_backend.py** - 23 errors → 2 errors
  - Added return type to `_lazy_import_office365() -> tuple[type, type]`
  - Added return type to `_get_context() -> Any`
  - Added return types to all inner functions in async methods
  - 2 remaining `no-any-return` errors (returning SharePoint item properties)

**Tests:** All 73 tests pass ✓

---

## Implications of Remaining Errors

### Runtime Impact: **None**
Python is dynamically typed - these errors do not prevent the code from running. All 73 tests pass.

### Developer Experience Impact: **Medium**
- IDE autocomplete may be less accurate in untyped functions
- Refactoring tools (rename, find usages) may miss references in untyped code
- Type-based documentation is incomplete

### CI/CD Impact: **Depends on Configuration**
- Currently MyPy is not enforced in CI (no blocking)
- If enforced, PRs touching affected files would need type fixes first

### Actual Bug Risk: **Low to Medium**
Only 6 errors indicate potential runtime issues:
- 3× `[arg-type]` - passing `str | None` where `str` expected (could cause AttributeError)
- 2× `[union-attr]` - accessing `.lower()` on potentially None value
- 1× `[return-value]` - returning `list[str | int]` instead of `list[str]`

---

## Error Categories

| Category | Count | Severity | Fix Effort |
|----------|-------|----------|------------|
| `[no-untyped-def]` - Missing return/param annotations | 65 | Low | Easy |
| `[no-untyped-call]` - Calling untyped function | 30 | Low | Depends on callee |
| `[type-arg]` - Missing dict type parameters | 25 | Low | Easy |
| `[no-any-return]` - Returning Any | 12 | Low | Medium |
| `[has-type]` - Cannot determine type | 4 | Medium | Easy |
| `[arg-type]` - Wrong argument type | 3 | **High** | Easy |
| `[union-attr]` - Attribute access on union | 2 | **High** | Easy |
| `[import-untyped]` - Missing stubs | 2 | Low | Trivial |
| `[override]` - Async iterator override | 1 | Medium | Medium |
| `[return-value]` - Incompatible return | 1 | **High** | Easy |
| `[unused-ignore]` - Dead type:ignore | 1 | None | Trivial |
| `[var-annotated]` - Missing variable annotation | 2 | Low | Trivial |

---

## Prioritized Fix Tiers

### ~~Tier 0: Actual Bug Risks (6 errors)~~ ✅ COMPLETED

~~These could cause runtime errors under certain conditions:~~

All 6 bug risk errors have been fixed:
- ✅ `modules/storage/router.py:69-71` - Added assert guards
- ✅ `modules/runner/ssrf/validation.py:46` - Added `str()` conversion
- ✅ `tests/test_index_renames.py:127,136` - Added None checks

---

### Tier 1: Quick Wins (31 errors) - 15 min effort

#### 1a. Install missing type stubs (2 errors)
```bash
cd apps/autohelper
pip install types-requests
# Add to pyproject.toml dev dependencies (already done)
```

#### 1b. Remove unused type:ignore (1 error)
File: `infra/fs/onedrive.py:37`

#### 1c. Add variable annotations (2 errors)
```python
# modules/mail/service.py:84
VIP_DOMAINS: list[str] = [...]

# modules/index/service.py:319
missing_by_size: dict[int, list[str]] = {}
```

#### 1d. Add dict type parameters (25 errors)
Replace `dict` with `dict[str, Any]` in:
- `db/repos/root_repo.py` (4 errors)
- `db/repos/index_run_repo.py` (4 errors)
- `db/repos/file_repo.py` (4 errors)
- `modules/filetree/service.py` (2 errors)
- `modules/export/schemas.py` (1 error)
- `modules/index/service.py` (2 errors)
- `modules/runner/service.py` (2 errors)
- `modules/runner/autocollector.py` (2 errors)
- `db/migrate.py` (1 error)
- `modules/context/monday.py` (1 error)
- `modules/mail/service.py` (1 error)
- `modules/runner/naming.py` (1 error)

---

### Tier 2: Service Layer Type Annotations - Partially Complete

#### ~~2a. `modules/mail/service.py` (20 errors)~~ ✅ COMPLETED
All type annotations added - 0 errors remaining.

#### ~~2b. `modules/storage/sharepoint_backend.py` (23 errors)~~ ✅ MOSTLY COMPLETED
21 of 23 errors fixed. 2 remaining `no-any-return` errors (SharePoint item properties).

#### 2c. `modules/context/service.py` (6 errors) - Remaining
```python
def ContextService() -> "ContextServiceClass": ...
def _ensure_initialized() -> None: ...
```
Plus class variable typing for `_initialized`

#### 2d. `modules/runner/collectors/` (4 errors)
- `folder.py:46` - `__init__` should have `-> None`
- `web.py:44` - `_get_bs4()` needs return type

#### 2e. `modules/runner/ssrf/client.py` (3 errors)
```python
def _get_httpx() -> Any: ...  # httpx module
```

---

### Tier 3: Test File Annotations (50 errors) - 30 min effort

All test functions need `-> None` return type and fixture parameter types.

Pattern to apply across all test files:
```python
# Before
def test_something(tmp_path):
    ...

# After
def test_something(tmp_path: Path) -> None:
    ...
```

Files to update:
- `tests/test_search.py` (5 errors)
- `tests/test_onedrive.py` (2 errors)
- `tests/test_indexer.py` (13 errors)
- `tests/test_index_renames.py` (4 errors)
- `tests/test_filetree.py` (10 errors)
- `tests/test_export.py` (7 errors)
- `tests/test_reference.py` (5 errors)
- `tests/conftest.py` (2 errors)

Common fixture types:
```python
from pathlib import Path
from typing import Generator
import pytest

tmp_path: Path
monkeypatch: pytest.MonkeyPatch
```

---

### Tier 4: Complex Type Issues (8 errors) - 1 hour effort

#### 4a. Async iterator override issue (2 errors)
`modules/runner/autocollector.py:95` and `service.py:184`

The issue is `async def invoke_stream()` returning `AsyncIterator` but base class signature mismatch.

**Fix**: Change base class signature:
```python
# service.py - BaseRunner
def invoke_stream(self, ...) -> AsyncIterator[RunnerProgress]:
    ...

# Not async def - just returns the iterator directly
```

#### 4b. `no-any-return` errors (12 errors)
These occur when returning results from JSON parsing or external libraries.

**Fix**: Use `cast()` or proper type narrowing:
```python
from typing import cast

# Instead of:
return response.json()

# Use:
return cast(dict[str, Any], response.json())
```

---

## Recommended Fix Order

### Sprint 1: Safety First (1 day)
1. Fix Tier 0 (actual bug risks) - **6 errors**
2. Fix Tier 1 quick wins - **31 errors**

**Expected result: 137 errors remaining**

### Sprint 2: Core Services (2 days)
3. Fix `mail/service.py` - **20 errors**
4. Fix `sharepoint_backend.py` - **23 errors**

**Expected result: 94 errors remaining**

### Sprint 3: Test Infrastructure (1 day)
5. Fix all test file annotations - **50 errors**

**Expected result: 44 errors remaining**

### Sprint 4: Complex Fixes (1 day)
6. Fix async iterator issues - **2 errors**
7. Fix remaining `no-any-return` - **12 errors**
8. Fix remaining scattered errors - **30 errors**

**Expected result: 0 errors**

---

## Configuration Changes to Consider

### Option A: Relax strictness further (quick, less clean)
Add to `pyproject.toml`:
```toml
[[tool.mypy.overrides]]
module = "autohelper.modules.mail.*"
disallow_untyped_defs = false
```

### Option B: Per-file ignores (targeted)
```toml
[[tool.mypy.overrides]]
module = [
    "autohelper.modules.mail.service",
    "autohelper.modules.storage.sharepoint_backend"
]
disallow_untyped_defs = false
disallow_untyped_calls = false
```

### Option C: Full strict (recommended long-term)
Keep current settings, fix all errors over time.

---

## Verification Commands

```bash
# After each tier of fixes
cd apps/autohelper
mypy . --ignore-missing-imports

# Ensure no regressions
pytest

# Full lint check
ruff check .
```

---

## Files Reference

### Highest Impact (fix first)
| File | Errors | Category | Status |
|------|--------|----------|--------|
| [modules/mail/service.py](../apps/autohelper/autohelper/modules/mail/service.py) | ~~20~~ 0 | Service | ✅ Done |
| [modules/storage/sharepoint_backend.py](../apps/autohelper/autohelper/modules/storage/sharepoint_backend.py) | ~~23~~ 2 | Storage | ✅ Mostly Done |
| [tests/test_indexer.py](../apps/autohelper/tests/test_indexer.py) | 13 | Tests | Pending |
| [tests/test_filetree.py](../apps/autohelper/tests/test_filetree.py) | 10 | Tests | Pending |

### Bug Risk Files ✅ ALL FIXED
| File | Line | Issue | Status |
|------|------|-------|--------|
| [modules/storage/router.py](../apps/autohelper/autohelper/modules/storage/router.py) | 69-71 | Nullable SharePoint creds | ✅ Fixed |
| [modules/runner/ssrf/validation.py](../apps/autohelper/autohelper/modules/runner/ssrf/validation.py) | 46 | Mixed type list | ✅ Fixed |
| [tests/test_index_renames.py](../apps/autohelper/tests/test_index_renames.py) | 127,136 | None.lower() access | ✅ Fixed |
