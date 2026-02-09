# Chicago Budget Explorer - Frontend

Astro + React frontend for the Chicago Budget Explorer.

## Overview

Static-first website with interactive React islands for charts and simulation.

**Architecture:**

- **Astro 5**: Static site generation, islands architecture
- **React 19**: Interactive components (charts, simulator)
- **Tailwind CSS 4**: Utility-first styling
- **Recharts**: Standard charts (bar, pie, line)
- **D3**: Custom visualizations (treemap)
- **TypeScript**: Strict type safety

## Commands

```bash
npm install      # Install dependencies
npm run dev      # Start development server (http://localhost:4321)
npm run build    # Build for production
npm run preview  # Preview production build locally
npm test         # Run unit tests (Vitest)
npm run test:e2e # Run E2E tests (Playwright)
npm run lint     # Run ESLint
npm run format   # Format code (Prettier)
```

## Project Structure

```
src/
├── data/              # Generated JSON from pipeline (committed)
│   ├── manifest.json
│   └── city-of-chicago/
│       ├── fy2026.json
│       ├── fy2025.json
│       ├── fy2024.json
│       └── fy2023.json
├── lib/               # Utilities
│   ├── types.ts       # TypeScript types (derived from JSON)
│   ├── data-loader.ts # Data loading utilities
│   ├── simulation-engine.ts # Pure function simulation logic
│   ├── format.ts      # Formatting utilities
│   └── colors.ts      # Color palette
├── components/        # React and Astro components
│   ├── BudgetExplorer.tsx  # Main budget explorer with year selection
│   ├── BudgetSummary.tsx   # Budget overview with metadata
│   ├── layout/        # Header, Footer, Nav
│   ├── charts/        # Chart components (Recharts + D3)
│   │   ├── EntityPicker, DepartmentBar, FundPie, BudgetTreemap
│   │   ├── TrendChart, RevenueBreakdown, RevenueVsSpending
│   │   ├── AppropriationBreakdown, TransparencyCallout
│   ├── simulator/     # Simulation components (SimulatorPanel, DepartmentSlider, etc.)
│   └── ui/            # Shared UI components (YearSelector)
├── layouts/           # Page layouts
│   └── BaseLayout.astro
├── pages/             # Routes (file-based routing)
│   ├── index.astro    # Landing page
│   ├── about.astro    # About page
│   └── entity/
│       └── [entityId]/
│           ├── index.astro    # Entity overview
│           └── simulate.astro # Simulator
└── styles/
    └── global.css     # Global styles
```

## Data Loading

Data is loaded at build time (static) using `data-loader.ts`:

```typescript
import { loadBudgetData } from "@/lib/data-loader";

const data = await loadBudgetData("city-of-chicago", "fy2025");
```

Types are derived from the JSON files for type safety:

```typescript
import type { BudgetData, Department } from "@/lib/types";
```

## Component Hydration

Astro components are static HTML by default. React components need hydration directives:

- `client:load` - Hydrate immediately (simulator)
- `client:visible` - Hydrate when scrolled into view (charts below fold)
- `client:idle` - Hydrate when browser idle (treemap)

Example:

```astro
<DepartmentBar data={departments} client:visible />
<SimulatorPanel data={data} client:load />
```

## Styling

Uses Tailwind CSS with custom color palette:

```css
bg-chicago-blue     # #0051A5 (Chicago flag blue)
text-chicago-red    # #CE1126 (Chicago flag red)
```

Responsive breakpoints:

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## Testing

**Unit tests** (Vitest):

- `lib/__tests__/simulation-engine.test.ts` - Simulation calculations
- `lib/__tests__/format.test.ts` - Formatting utilities
- `components/__tests__/BudgetExplorer.test.tsx` - Budget explorer component
- `components/ui/__tests__/YearSelector.test.tsx` - Year selector component
- `components/charts/__tests__/*.test.tsx` - Chart component tests (Treemap, DepartmentBar, RevenueBreakdown, RevenueVsSpending, TransparencyCallout, TrendChart)

**E2E tests** (Playwright):

- Landing page, navigation, accessibility
- Budget data display and filtering
- Year selector functionality
- Simulator interaction

Run tests:

```bash
npm test         # Unit tests
npm run test:e2e # E2E tests
```

## Accessibility

**Guidelines:**

- Semantic HTML (nav, main, footer, etc.)
- ARIA labels on interactive elements
- Keyboard navigation support
- Skip to main content link
- Color contrast WCAG AA (4.5:1)

**Accessibility testing included in E2E tests** (`accessibility.spec.ts`).

## Performance

**Targets:**

- Largest Contentful Paint < 2s
- Total JavaScript < 200KB gzipped
- Lighthouse Performance score >= 90

**Optimization strategies:**

- Islands architecture (minimal JS by default)
- Code splitting per entity/year
- Lazy loading below-fold charts (`client:visible`)
- Image optimization (WebP, dimensions)

## Deployment

**Cloudflare Pages**:

- Build command: `npm run build`
- Output directory: `dist`
- Node.js version: 20

**Environment variables**: None needed for v1

**Automatic deployments:**

- Push to `main` → production
- Pull requests → preview deployments

## Development Tips

**Hot reload**: Changes to `.astro` and `.tsx` files hot reload automatically

**Type checking**: Run `astro check` to type-check Astro files

**Debugging React**: React DevTools work with hydrated components

**Debugging Astro**: Use `<Debug value={data} />` component for inspection

## Troubleshooting

**"Cannot find module '@/lib/types'"**

- Path aliases configured in `tsconfig.json`. Restart TypeScript server.

**"Chart not interactive"**

- Missing `client:*` directive. Add `client:load` or `client:visible`.

**"Type error in JSON import"**

- Add `"resolveJsonModule": true` to `tsconfig.json`.

**"Build fails with type errors"**

- Run `npm run build` which includes `astro check`.

**"Lighthouse score low"**

- Check bundle size with `npx vite-bundle-visualizer`.
- Ensure charts use `client:visible` not `client:load`.
