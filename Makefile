check:
	python3 scripts/check_repository.py
	npm run typecheck
	npm test

.PHONY: check
