# Chicago Budget Explorer

An interactive, open-source tool for exploring and simulating the City of Chicago's operating budget. Built for [Strong Towns Chicago](https://www.strongtownschicago.org/chicago-budget-explorer).

## Overview

The Chicago Budget Explorer is a civic tech project that makes Chicago's budget transparent and interactive. Residents, journalists, advocacy organizations, and policymakers can:

- **Explore** budget allocations by department with interactive visualizations
- **Analyze** revenue sources and spending breakdowns
- **Compare** spending across fiscal years with historical trend charts
- **Simulate** budget changes to understand trade-offs
- **Visualize** data with charts, treemaps, and breakdowns

## Project Structure

```
chicago-budget-explorer/
├── pipeline/          # Python data pipeline
│   ├── src/          # Source code (extractors, transformers, validators)
│   ├── config/       # Entity and dataset configuration
│   ├── tests/        # Pipeline tests
│   └── output/       # Generated JSON (copied to frontend)
├── frontend/         # Astro + React frontend
│   ├── src/          # Source code (components, pages, utilities)
│   ├── public/       # Static assets
│   └── dist/         # Build output
└── docs/             # Documentation
```

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- uv (Python package manager): `pip install uv`

### Setup

1. **Install pipeline dependencies:**

   ```bash
   cd pipeline
   make install
   ```

2. **Install frontend dependencies:**

   ```bash
   cd frontend
   npm install
   ```

3. **Run the data pipeline:**

   ```bash
   cd pipeline
   make all
   ```

   This fetches data from the Socrata API, transforms it, validates it, and copies JSON to the frontend.

4. **Start the development server:**

   ```bash
   cd frontend
   npm run dev
   ```

5. **Open http://localhost:4321** in your browser.

### Building for Production

```bash
cd frontend
npm run build
```

The static site is output to `frontend/dist/`.

## Architecture

**Monorepo**: Pipeline and frontend in one repository for easier schema consistency.

**Data Pipeline (Python)**:

- Extracts budget data from Chicago's Socrata portal (appropriations + revenue)
- Transforms into normalized JSON schema
- Enriches with cross-year trend data
- Validates hierarchical sums, revenue, and cross-year consistency
- Static JSON files committed to repository

**Frontend (Astro + React)**:

- Static-first for zero-cost hosting (Cloudflare Pages)
- Islands architecture: mostly static HTML, interactive components hydrate on-demand
- Client-side simulation (no backend needed)
- Recharts for standard charts, D3 for custom visualizations

**Key decisions**:

- Static JSON (fast, versionable, zero infrastructure)
- Client-side simulation (instant response, scales infinitely)
- Strict type safety (Pydantic for Python, TypeScript for frontend)

## Testing

**Pipeline:**

```bash
cd pipeline
make test       # Unit tests with coverage
make lint       # Ruff + mypy
```

**Frontend:**

```bash
cd frontend
npm test        # Unit tests (Vitest)
npm run test:e2e # E2E tests (Playwright)
npm run lint    # ESLint
```

## Contributing

Contributions welcome! Key areas:

- Adding historical fiscal years
- Adding new entities (CPS, Park District, CTA)
- Visualization improvements
- Accessibility enhancements
- Documentation

## Data Sources

All budget data comes from the **City of Chicago Open Data Portal** (data.cityofchicago.org).

Dataset mappings are configured in `pipeline/config/entities.yaml`.

## License

MIT License

**Built with**:

- Python (pandas, Pydantic, sodapy)
- Astro
- React
- Recharts & D3
- Tailwind CSS
- Hosted on Cloudflare Pages
