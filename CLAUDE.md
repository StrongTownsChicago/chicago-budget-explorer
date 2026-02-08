# Chicago Budget Tool - Engineering Guide

This document contains engineering standards and best practices for the Chicago Budget Tool project.

## Core Architectural Principles

### Entity-Agnostic Design

**Critical**: This tool is designed to be used for multiple government entities (City of Chicago, Chicago Public Schools, Park District, CTA, etc.), not just the City of Chicago budget. All code must be entity-agnostic.

**Rules:**

- **Never hardcode Chicago-specific logic** in core pipeline code (extractors, transformers, validators, schema)
- **Use configuration for entity-specific details** (`pipeline/config/entities.yaml`)
- **Schema must accommodate all entities** - avoid fields that only make sense for one entity
- **Test with multiple entities in mind** - if your code only works for Chicago, it's wrong

### Configuration Over Code

Entity-specific details belong in `pipeline/config/entities.yaml`, not in code. This includes dataset IDs, column mappings, fund categorizations, department rules, and transformation logic.

**When adding a new entity**: Update config, potentially add entity-specific transformer. Never modify core schema or validation logic to accommodate one entity.

### Schema as Contract

The Pydantic schema (`pipeline/src/models/schema.py`) is the contract between backend and frontend. Changes must be:

- **Backward compatible** (add optional fields, never remove required fields without migration)
- **Entity-agnostic** (works for all entities, not just Chicago)
- **Well-documented** (docstrings explain what fields mean across entities)

### Strategy Pattern for Extensibility

Use strategy pattern for entity-specific behavior. Different entities may need different extractors (SocrataExtractor, PDFExtractor) or transformers (CityOfChicagoTransformer, CPSTransformer). The pipeline dispatches to the right strategy based on configuration, not hardcoded if/else chains.

## Engineering Best Practices

When writing or refactoring code in this repository, follow these core principles:

### Single Responsibility Principle (SRP)

Each function should do one thing well. Separate data extraction from transformation from validation. If a function has "and" in its description, it probably does too much.

**Bad**: `extract_and_transform_budget()` - fetches Socrata data, transforms it, AND validates hierarchy
**Good**: Separate functions for extracting (SocrataExtractor), transforming (CityOfChicagoTransformer), validating (BudgetValidator)

### DRY (Don't Repeat Yourself)

Never duplicate logic. If you're extracting/formatting the same data in multiple places, create a shared helper function. Process data once, pass the result to consumers.

**Bad**: Formatting currency amounts in multiple components
**Good**: One `formatCurrency()` function in `frontend/src/lib/format.ts` used everywhere

### Separation of Concerns

Data access, business logic, and presentation should be separate layers. Extractors shouldn't know about validation rules. Frontend components shouldn't contain transformation logic.

**Example**: Extractor fetches data → Transformer normalizes it → Validator checks it → Frontend renders it (separate files, clear boundaries)

### Performance Matters

Fetch what you need efficiently. Group operations. Avoid processing the same data multiple times. Use vectorized operations (pandas) instead of loops.

**Bad**: Loop over 5000 line items, calculate totals one-by-one
**Good**: Use pandas `groupby()` to aggregate all departments at once

### Testability First

Write code that's easy to test. Pure functions (same input = same output) are ideal. Extract business logic from I/O operations so you can test without APIs or file systems.

**Testable**: `validate_hierarchical_sums(budget_data)` - pure function that takes BudgetData model
**Hard to test**: Function that fetches from Socrata, validates, and writes JSON all in one

### Testing & Validation Requirements

All new features must have clear, useful tests that validate correctness. Tests are not optional - they're part of the feature. Always run tests to validate changes before considering work complete.

**Pipeline**: Write unit tests for business logic (transformers, validators), integration tests for data flows. Tests live in `pipeline/tests/`. Run `make test` before committing.

**Frontend**: Write unit tests for logic (utilities, simulation engine, formatting). Use Vitest for unit tests, Playwright for E2E tests. Run `npm test` and `npm run lint` to validate code quality.

**Pattern**: Feature isn't done until tests prove it works. Use tests to prevent regressions, not just to check boxes.

### Production-Grade Code Quality

Code must be maintainable, readable, and understandable. Always choose production-grade patterns over quick hacks. Code is read far more than it's written - optimize for the next developer.

**Python Code Quality**: After making any Python changes, run `uv run ruff check --fix` and `uv run ruff format`. Fix any issues flagged by the checker before considering work complete.

**Frontend Code Quality**: After making any frontend changes, run `npm run lint`. Fix any issues flagged by ESLint before considering work complete.

**Never**:

- Ship hacky solutions or temporary workarounds
- Leave TODOs or commented-out code in production
- Use magic numbers or unclear abbreviations
- Write code only you can understand
- Don't overengineer things when a cleaner pattern exists

**Always**:

- Use clear, self-documenting code with meaningful names
- Follow established patterns in the codebase
- Write code that's easy to debug and modify
- Consider maintainability and long-term consequences

**Standard**: Every line of code should be production-ready. No shortcuts, no "fix it later", no clever tricks that obscure intent.

### Meaningful Names

Function names should be verbs. Variables should describe their content. Be specific.

**Good**: `aggregate_by_department()`, `department_totals`, `appropriations_amount`
**Bad**: `process()`, `data`, `temp`, `x`

### Import Path Discipline

Always use proper Python module execution patterns. Never manipulate sys.path.

### Modern Python Type Hints

Use modern Python 3.10+ type hint syntax. Never use legacy typing module imports when built-in types are available.

**Always use**:

- Pipe union: `str | None` instead of `Optional[str]`
- Built-in types: `list[str]`, `dict[str, int]` instead of `List[str]`, `Dict[str, int]`
- Remove unused typing imports: Don't import `Optional`, `List`, `Dict`

### Declarative Over Imperative

Use declarative patterns when they improve clarity. Strategy pattern over if/else chains. List comprehensions over loops with append. Pydantic models over manual validation.

**Example**: Extractors use strategy pattern - entity config determines extractor class (SocrataExtractor, PDFExtractor), not a long if/elif chain checking source types.

### Error Handling

Catch exceptions at appropriate boundaries. Log errors with context for debugging. Don't let one failure break the entire pipeline. Return meaningful errors, not generic "failed" messages.

**Pattern**: Validator catches errors per check (hierarchical sums, cross-year consistency), logs details with specific amounts/departments, continues validating remaining rules.

### Documentation Maintainability

Documentation should be concise and point to source code instead of duplicating implementation details.

**Avoid**:

- Specific counts that change ("50 departments", "40+ tests", "5000 line items")
- Implementation details duplicated from code (department lists, field names, exact tolerance values)
- File-by-file structure listings

**Prefer**:

- High-level descriptions with references ("See `schema.py:Department` for department model")
- Directory-level structure explanations
- Links to actual code files for details
- Focus on concepts and patterns, not specifics

**Good**: "Validator checks hierarchical sums defined in `pipeline/src/validators/budget.py`"
**Bad**: "Validator checks that 50 departments sum to $16.6B with $1 tolerance using these 5 validation rules"

**Reason**: Numbers and implementation details go stale. References to actual code always stay accurate.

### Documentation Updates

Update documentation when making significant changes. Be concise - only document what's necessary, avoid redundant explanations.

**Files to update:**

- **CLAUDE.md** (root) - Engineering standards and cross-cutting concerns
- **pipeline/CLAUDE.md** - Pipeline architecture changes, new entity types, validation rules
- **frontend/CLAUDE.md** - Frontend patterns, component architecture, data loading
- **README.md** - User-facing setup/feature changes
- **pipeline/src/models/schema.py** - Docstrings for Pydantic models (these ARE the schema docs)

**Principle**: Keep docs synchronized with reality. Update immediately after changes while context is fresh. Don't add fluff - if it doesn't add clarity, don't write it.
