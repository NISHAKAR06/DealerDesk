# VIKMO DealerDesk — Backend Automation Scripts

This directory contains cross-platform helper scripts for running, testing, and developing the Django REST Framework backend.

---

## Script Inventory

| Script (Windows) | Script (Linux/macOS) | Description |
|---|---|---|
| `start-backend.ps1` | `start-backend.sh` | Runs Django database migrations, seeds catalogue/dealers, and starts server on port 8000 |
| `start-supplier-mock.ps1` | `start-supplier-mock.sh` | Launches the local supplier mock server for sync testing |
| `run-tests.ps1` | `run-tests.sh` | Runs backend contract and data integrity test suite |
| `run-smoke-test.ps1` | `run-smoke-test.sh` | Runs assignment official `smoke_test.py` against running backend |

---

## Usage Examples

### 1. Start Backend Server
```powershell
# Windows
.\backend\scripts\start-backend.ps1

# Linux / macOS
./backend/scripts/start-backend.sh
```

### 2. Run Backend Contract Tests
```powershell
# Windows
.\backend\scripts\run-tests.ps1

# Linux / macOS
./backend/scripts/run-tests.sh
```

### 3. Start Mock Supplier Service
```powershell
# Windows
.\backend\scripts\start-supplier-mock.ps1

# Linux / macOS
./backend/scripts/start-supplier-mock.sh
```

### 4. Run Assignment Smoke Test
```powershell
# Windows
.\backend\scripts\run-smoke-test.ps1

# Linux / macOS
./backend/scripts/run-smoke-test.sh
```
