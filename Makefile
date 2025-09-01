default: run

# Customizable uv run command (e.g. make dev UV_RUN="uv run --python /path/to/python")
UV_RUN ?= uv run

## Dependencies
deps-js:
	cd frontend; npm install

deps-js-update:
	cd frontend; npx npm-check-updates -i

deps-py:
	uv sync

deps-py-update:
	uv pip list --outdated
	uv lock --upgrade

deps: deps-js deps-py

## Build and Test
build-js:
	cd frontend; npm run build

build: build-js

test-js:
	cd frontend; LANG=en npm run test

test-py:
	$(UV_RUN) pytest

test: test-py test-js

## Utils
run:
	cd example; $(UV_RUN) fava example.beancount

# Development with live reload (parametrizable beancount file path)
# Usage: make dev LEDGER_PATH=path/to/file.LEDGER_PATH
LEDGER_FILE ?= example/example.beancount
dev:
	npx concurrently --names fava,esbuild "cd $$(dirname $(LEDGER_FILE)) && PYTHONUNBUFFERED=1 $(UV_RUN) fava --debug $$(basename $(LEDGER_FILE))" "cd frontend; npm run watch"

# Usage: make dev-debug LEDGER_FILE=path/to/file.LEDGER_FILE
dev-debug:
	npx concurrently --names fava,esbuild "cd $$(dirname $(LEDGER_FILE)) && PYTHONUNBUFFERED=1 LOGLEVEL=DEBUG $(UV_RUN) fava --debug $$(basename $(LEDGER_FILE))" "cd frontend; npm run watch"

lint:
	cd frontend; npx tsc --noEmit
	cd frontend; npm run lint
	$(UV_RUN) mypy src/beantab
	$(UV_RUN) pylint src/beantab

format:
	-cd frontend; npm run lint:fix
	cd frontend; npx prettier -w ../src/beantab/templates/*.css
	-$(UV_RUN) ruff check --fix
	$(UV_RUN) ruff format .
