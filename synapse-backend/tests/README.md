# Tests Directory

This directory contains automated tests for the Synapse backend.

## Running Tests

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=src

# Run specific test file
pytest tests/test_storage.py
```

## Test Categories

- `test_storage.py` - Storage backend tests (local, S3)
- `test_processing.py` - File processing tests (PDF, OCR, thumbnails)
- `test_api.py` - API endpoint tests (coming soon)
