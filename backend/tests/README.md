# Backend Test Suites

Test suites verifying the Django REST Framework backend against [`docs/API_CONTRACT.md`](../../docs/API_CONTRACT.md).

---

## Test Suites Included

1. **`tests/test_backend_contract.py`**:
   - `test_01_health_endpoint_liveness`: Liveness probe against `GET /api/health/`.
   - `test_02_contract_trailing_slashes`: Validates all 16 endpoints strictly end with trailing slashes.
   - `test_03_catalogue_data_file`: Validates `data/catalogue.csv` contains all required columns, 600+ parts, and money string formatting.
   - `test_04_dealers_data_file`: Validates `data/dealers.csv` contains all required dealer fields and 25 seeded records.
   - `test_05_lead_times_data_file`: Validates `data/lead_times.csv` contains exactly 40 monitored forecast SKUs.
   - `test_06_error_code_invariants`: Validates standard error code enumeration.

2. **`tests/test_unit_track1.py`**:
   - `test_money_field_two_decimal_places`: Validates 2 decimal places money formatting.
   - `test_product_create_serializer_validations`: Validates positive price, 2 decimals, and required catalogue fields.
   - `test_order_create_serializer_validations`: Validates positive integer quantities, non-empty items, and duplicate SKU rejection.
   - `test_contract_error_codes`: Validates API_CONTRACT error code definitions.

3. **`tests/test_django_track.py`**:
   - Full Django TestCase integration suite testing products, inventory adjustments, dealer onboarding, transactional order lifecycle, `409 INSUFFICIENT_STOCK` short-line details, and mocked supplier sync.

4. **`smoke_test.py`** (Assignment Official Smoke Test):
   - Provided by the assignment grader to check endpoints, pagination, DRAFT order creation, status transitions, supplier sync, assistant, and ML forecasts.

---

## How to Run Backend Tests

```bash
# Run automated test suites (contract + unit tests)
powershell backend/scripts/run-tests.ps1

# Or via bash
./backend/scripts/run-tests.sh

# Run full Django TestCase suite (requires running PostgreSQL)
python manage.py test tests

# Run the official assignment smoke test (with Django running on port 8000)
python backend/smoke_test.py --base-url http://localhost:8000 --track django
```
