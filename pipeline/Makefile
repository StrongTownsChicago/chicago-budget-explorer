.PHONY: enrich validate manifest all clean test lint format install help copy

help:
	@echo "Chicago Budget Pipeline"
	@echo ""
	@echo "Commands:"
	@echo "  make install   - Install dependencies"
	@echo "  make all       - Run full pipeline (fetch + transform + enrich + manifest + validate + copy)"
	@echo "  make enrich    - Enrich JSON with cross-year trend data"
	@echo "  make validate  - Validate transformed data"
	@echo "  make manifest  - Generate manifest.json"
	@echo "  make copy      - Copy generated JSON to frontend"
	@echo "  make clean     - Remove generated files"
	@echo "  make test      - Run tests with coverage"
	@echo "  make lint      - Run linting (ruff + mypy)"
	@echo "  make format    - Format code with ruff"
	@echo ""
	@echo "Individual year commands (for development):"
	@echo "  uv run python -m src.cli fetch city-of-chicago --year fy2025"
	@echo "  uv run python -m src.cli transform city-of-chicago --year fy2025 --prior-year fy2024"

install:
	uv pip install -e ".[dev]"

all:
	uv run python -m src.cli all
	$(MAKE) copy

enrich:
	uv run python -m src.cli enrich city-of-chicago

manifest:
	uv run python -m src.cli manifest

validate:
	uv run python -m src.cli validate

copy:
	mkdir -p ../frontend/src/data
	rsync -av output/ ../frontend/src/data/

clean:
	rm -rf output/*
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf htmlcov/ .coverage

test:
	uv run pytest tests/ -v --cov

lint:
	uv run ruff check src/ tests/
	uv run mypy src/

format:
	uv run ruff format src/ tests/
	uv run ruff check --fix src/ tests/
