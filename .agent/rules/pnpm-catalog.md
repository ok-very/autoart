# pnpm Catalog

## Usage

```json
// ❌ Hardcoded
{ "typescript": "~5.9.3" }

// ✅ Catalog reference
{ "typescript": "catalog:" }
```

Versions defined in `pnpm-workspace.yaml` under `catalog:`.

## Current Versions

```yaml
catalog:
  # Core
  typescript: "~5.9.3"
  zod: "^4.3.5"

  # React 19
  react: "^19.0.0"
  react-dom: "^19.0.0"
  "@types/react": "^19.2.5"

  # Tailwind v4
  tailwindcss: "^4.1.18"
  "@tailwindcss/vite": "^4.1.18"

  # Tooling
  vite: "^7.3.0"
  vitest: "^4.0.16"
  eslint: "^9.39.1"

  # UI
  lucide-react: "^0.562.0"
  clsx: "^2.1.1"
```

## Updating

1. Edit `pnpm-workspace.yaml`
2. Run `pnpm install`
3. All `catalog:` refs auto-update

## When to Add

- Used by 2+ packages
- Core tooling (TypeScript, Vite, ESLint)
- Version alignment critical (React, Zod)

## Tailwind v4

No config file needed. Uses Vite plugin:

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
plugins: [react(), tailwindcss()]
```

```css
/* index.css */
@import "tailwindcss";
```
