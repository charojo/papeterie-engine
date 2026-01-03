---
description: Run full project validation (linting, testing, coverage)
---
1. Run the validation script (auto-fixes formatting by default)
// turbo
./scripts/validate.sh

2. (Faster) Run Smart Validation (only tests affected by changes):
// turbo
./scripts/smart_validate.sh

3. To skip auto-fixing (e.g., for CI), use:
./scripts/validate.sh --nofix
