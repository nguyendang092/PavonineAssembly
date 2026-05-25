# CSS Structure

Use Tailwind utilities for component-local styling by default. Keep plain CSS only for shared browser concerns, animation names, third-party/table overrides, or large scoped components such as the navbar and auth form.

## Global Files

- `index.css`: single global entry imported by `src/main.jsx`.
- `tokens.css`: app-wide CSS variables such as z-index and shell sizing.
- `fonts.css`: font-face declarations.
- `animations.css`: reusable keyframes and animation utility classes.

## Feature CSS

- `components/layout/navbar.css`: navbar-specific layout and responsive rules.
- `features/dashboard/dashboard.css`: shared dashboard/print/report rules.
- `features/payroll/payrollTableCompact.css`: scoped payroll table density overrides.
- `components/ui/NotificationBell.css`: scoped notification bell styles.
- `public/css/auth.css`: auth modal styles loaded only with the lazy `SignIn` chunk.

When adding new CSS, prefer a narrowly scoped class prefix for the feature. Avoid adding generic selectors to `index.css`.

