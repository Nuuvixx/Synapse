.PHONY: help install dev test lint format build docker-up docker-down clean

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Installation
install: ## Install all dependencies
	cd synapse-backend && pip install -r requirements.txt
	cd synapse-frontend && npm install

install-dev: ## Install development dependencies
	cd synapse-backend && pip install -r requirements.txt -r requirements-dev.txt
	cd synapse-frontend && npm install

# Development
dev-backend: ## Run backend in development mode
	cd synapse-backend && python main.py

dev-frontend: ## Run frontend in development mode
	cd synapse-frontend && npm run dev

dev: ## Run both backend and frontend (requires two terminals)
	@echo "Run 'make dev-backend' in one terminal"
	@echo "Run 'make dev-frontend' in another terminal"

# Testing
test: ## Run all tests
	cd synapse-backend && pytest
	cd synapse-frontend && npm test

test-backend: ## Run backend tests
	cd synapse-backend && pytest

test-frontend: ## Run frontend tests
	cd synapse-frontend && npm test

# Linting & Formatting
lint: ## Run linters
	cd synapse-backend && flake8 src/
	cd synapse-frontend && npm run lint

format: ## Format code
	cd synapse-backend && black . && isort .
	cd synapse-frontend && npm run format

# Build
build: ## Build for production
	cd synapse-frontend && npm run build

# Docker
docker-up: ## Start all services with Docker
	docker-compose up -d

docker-down: ## Stop all Docker services
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

docker-build: ## Rebuild Docker images
	docker-compose build --no-cache

# Database
db-migrate: ## Run database migrations
	cd synapse-backend && alembic upgrade head

db-revision: ## Create new migration
	cd synapse-backend && alembic revision --autogenerate -m "$(msg)"

db-downgrade: ## Rollback last migration
	cd synapse-backend && alembic downgrade -1

# Cleanup
clean: ## Clean build artifacts
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
