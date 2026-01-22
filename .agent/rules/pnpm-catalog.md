# pnpm Catalog & Dependency Management

## Centralized Versions via Catalog

The monorepo uses a **pnpm catalog** to avoid updating every `package.json` when bumping versions.

### Location
`pnpm-workspace.yaml` contains the `catalog:` section with centralized versions.

### Usage in package.json

```json
// Instead of hardcoding versions:
{
  "devDependencies": {
    "typescript": "~5.9.3"   // ❌ Hardcoded - must update everywhere
  }
}

// Use catalog reference:
{
  "devDependencies": {
    "typescript": "catalog:"  // ✅ Pulls from pnpm-workspace.yaml
  }
}
```

### Current Catalog (pnpm-workspace.yaml)

```yaml
catalog:
  # Core
  typescript: "~5.9.3"
  zod: "^4.3.5"
  
  # React
  react: "^19.0.0"
  react-dom: "^19.0.0"
  "@types/react": "^19.2.5"
  "@types/react-dom": "^19.2.3"
  
  # Tailwind v4
  tailwindcss: "^4.1.18"
  "@tailwindcss/vite": "^4.1.18"
  tailwind-merge: "^2.4.0"
  
  # Tooling
  "@types/node": "^24.10.1"
  tsx: "^4.21.0"
  vite: "^7.3.0"
  "@vitejs/plugin-react": "^5.1.1"
  vitest: "^4.0.16"
  
  # Linting
  eslint: "^9.39.1"
  "@eslint/js": "^9.39.1"
  typescript-eslint: "^8.46.4"
  eslint-plugin-react-hooks: "^7.0.1"
  
  # UI
  lucide-react: "^0.562.0"
  clsx: "^2.1.1"
```

### Updating Dependencies

1. **Update the catalog** in `pnpm-workspace.yaml`
2. Run `pnpm install` to update lockfile
3. All packages using `catalog:` automatically get the new version

### When to Add to Catalog

Add a dependency to the catalog when:
- It's used by 2+ packages
- It's a core tooling dep (TypeScript, ESLint, Vite)
- Version alignment is critical (React, Zod)

### Reference
- https://pnpm.io/catalogs

---

## Tailwind v4 Configuration

This project uses **Tailwind CSS v4** with the Vite plugin approach.

### Setup Pattern

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

### CSS Import

```css
/* index.css */
@import "tailwindcss";
```

### Key Differences from v3
- No `tailwind.config.js` needed (uses CSS-first config)
- No PostCSS config needed (Vite plugin handles it)
- Uses `@tailwindcss/vite` instead of `tailwindcss` as PostCSS plugin
- See: https://tailwindcss.com/blog/tailwindcss-v4

---

## Zod v4

This project uses **Zod v4.3.5** for schema validation.

### Key v4 Features
- Smaller bundle size
- Improved TypeScript inference
- `z.string().email()` and other built-in validators improved

### Shared Schemas Location
All Zod schemas live in `shared/src/schemas/` and are exported from `@autoart/shared`.
