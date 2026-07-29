# Hooks

Shared React hooks used across the application.

## Naming Convention

- Files: `use{Feature}.ts` (e.g., `useAuth.ts`, `useDebounce.ts`)
- Exports: Named export of the hook function

## Guidelines

- Each hook should have a single responsibility.
- Prefix with `use` per React convention.
- Include TypeScript types for parameters and return values.
- Keep hooks reusable — avoid coupling to specific pages or modules.

---

*This directory is ready for hooks to be added as modules are implemented.*
