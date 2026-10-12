# Backend Test Suites

Test suites verifying the Django REST Framework backend against [`docs/API_CONTRACT.md`](../../docs/API_CONTRACT.md).

---

## Tests Included

1. **`tests/test_backend_contract.py`**:
   - `test_01_health_endpoint_liveness`: Liveness probe against `GET /api/health/`.
   - `test_02_contract_trailing_slashes`: Validates all 16 endpoints strictly end with trailing slashes.
   - `test_03_catalogue_data_file`: Validates `data/catalogue.csv` contains all required columns, 600+ parts, and money string formatting.
   - `test_04_dealers_data_file`: Validates `data/dealers.csv` contains all required dealer fields and 25 seeded records.
   - `test_05_lead_times_data_file`: Validates `data/lead_times.csv` contains exactly 40 monitored forecast SKUs.
   - `test_06_error_code_invariants`: Validates standard error code enumeration.

2. **`smoke_test.py`** (Assignment Smoke Test):
   - Provided by the assignment grader to check endpoints, pagination, DRAFT order creation, status transitions, supplier sync, assistant, and ML forecasts.

---

## How to Run Backend Tests

```bash
# Run backend contract verification
python backend/tests/test_backend_contract.py

# Or using the helper script
powershell backend/scripts/run-tests.ps1

# Run the full assignment smoke test (with Django running on port 8000)
python backend/smoke_test.py --base-url http://localhost:8000 --all
```
