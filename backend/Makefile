.PHONY: up down logs build seed-data test smoke clean restart status

# Default: start the full stack
up:
	docker compose -f backend/docker-compose.yml up -d --build

# Stop and remove all containers
down:
	docker compose -f backend/docker-compose.yml down -v

# Show logs for all services
logs:
	docker compose -f backend/docker-compose.yml logs -f --tail=100

# Build all service images
build:
	docker compose -f backend/docker-compose.yml build

# Seed the database with sample data
seed-data:
	@echo "Seeding databases..."
	docker compose -f backend/docker-compose.yml exec -T postgres psql -U aisena -d case_management -c "INSERT INTO cases (case_id, transaction_id, screening_id, status, assigned_to, assigned_type, reason, risk_score, created_at, updated_at) VALUES ('00000000-0000-0000-0000-000000000001', 'txn-seed-001', '00000000-0000-0000-0000-000000000002', 'OPEN', 'ai-triage-001', 'AI', 'Seed case for testing', 75, NOW(), NOW()) ON CONFLICT DO NOTHING;" || true
	docker compose -f backend/docker-compose.yml exec -T postgres psql -U aisena -d audit_log -c "INSERT INTO audit_log (id, event_type, transaction_id, case_id, screening_id, actor, action, outcome, details, timestamp) VALUES ('00000000-0000-0000-0000-000000000003', 'screening.requested', 'txn-seed-001', NULL, NULL, 'system', 'screening.requested', 'submitted', '{}', NOW()) ON CONFLICT DO NOTHING;" || true
	@echo "Seed data inserted."

# Run integration tests
test:
	docker build -f backend/temporal/Dockerfile --target test -t aisena-temporal-tests backend
	docker run --rm aisena-temporal-tests

# Submit a flagged transaction and verify screening, case, and audit events
smoke:
	powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/smoke.ps1

# Clean up all data
clean: down
	rm -rf backend/services/*/dist backend/temporal/dist
	docker volume prune -f

# Restart the full stack
restart: down up

# Show service status
status:
	docker compose -f backend/docker-compose.yml ps
