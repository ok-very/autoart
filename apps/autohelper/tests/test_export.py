"""Tests for the export module."""

import csv
from pathlib import Path

from fastapi.testclient import TestClient

from autohelper.modules.export.schemas import IntakeSubmissionData
from autohelper.modules.export.service import ExportService


class TestExportService:
    """Test export service logic."""

    def test_export_creates_csv_file(self, client: TestClient, temp_dir: Path, test_db) -> None:
        """export_intake_csv should create a CSV file."""
        service = ExportService()

        submissions = [
            IntakeSubmissionData(
                id="sub-1",
                form_id="form-1",
                upload_code="UC001",
                metadata={"name": "Test User", "email": "test@example.com"},
                created_at="2024-01-20T10:00:00Z",
            )
        ]

        file_path, row_count, columns = service.export_intake_csv(
            form_id="form-1",
            form_title="Test Form",
            submissions=submissions,
            output_dir=str(temp_dir),
        )

        assert Path(file_path).exists()
        assert row_count == 1
        assert "upload_code" in columns
        assert "name" in columns
        assert "email" in columns

    def test_export_flattens_metadata(self, client: TestClient, temp_dir: Path, test_db) -> None:
        """export_intake_csv should flatten metadata into columns."""
        service = ExportService()

        submissions = [
            IntakeSubmissionData(
                id="sub-1",
                form_id="form-1",
                upload_code="UC001",
                metadata={"field_a": "value_a", "field_b": "value_b"},
                created_at="2024-01-20T10:00:00Z",
            ),
            IntakeSubmissionData(
                id="sub-2",
                form_id="form-1",
                upload_code="UC002",
                metadata={"field_a": "value_a2", "field_c": "value_c"},
                created_at="2024-01-20T11:00:00Z",
            ),
        ]

        file_path, row_count, columns = service.export_intake_csv(
            form_id="form-1",
            form_title="Test Form",
            submissions=submissions,
            output_dir=str(temp_dir),
        )

        # Should have union of all metadata keys
        assert "field_a" in columns
        assert "field_b" in columns
        assert "field_c" in columns

        # Read CSV and verify content
        with open(file_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        assert len(rows) == 2
        assert rows[0]["field_a"] == "value_a"
        assert rows[1]["field_c"] == "value_c"
        # field_b should be empty for row 2
        assert rows[1]["field_b"] == ""

    def test_export_includes_headers(self, client: TestClient, temp_dir: Path, test_db) -> None:
        """CSV should have correct headers."""
        service = ExportService()

        submissions = [
            IntakeSubmissionData(
                id="sub-1",
                form_id="form-1",
                upload_code="UC001",
                metadata={"custom_field": "value"},
                created_at="2024-01-20T10:00:00Z",
            )
        ]

        file_path, _, _ = service.export_intake_csv(
            form_id="form-1",
            form_title="Header Test",
            submissions=submissions,
            output_dir=str(temp_dir),
        )

        with open(file_path, encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader)

        assert "id" in headers
        assert "upload_code" in headers
        assert "created_at" in headers
        assert "custom_field" in headers

    def test_export_handles_empty_submissions(
        self, client: TestClient, temp_dir: Path, test_db
    ) -> None:
        """Empty submissions list should produce headers-only file."""
        service = ExportService()

        file_path, row_count, columns = service.export_intake_csv(
            form_id="form-1",
            form_title="Empty Form",
            submissions=[],
            output_dir=str(temp_dir),
        )

        assert Path(file_path).exists()
        assert row_count == 0
        # Should have fixed columns at minimum
        assert "id" in columns
        assert "upload_code" in columns

    def test_export_sanitizes_filename(self, client: TestClient, temp_dir: Path, test_db) -> None:
        """Filename should be sanitized for special characters."""
        service = ExportService()

        file_path, _, _ = service.export_intake_csv(
            form_id="form-1",
            form_title="Test/Form:With*Special<>Chars",
            submissions=[],
            output_dir=str(temp_dir),
        )

        filename = Path(file_path).name
        # Should not contain special chars
        assert "/" not in filename
        assert ":" not in filename
        assert "*" not in filename


class TestExportEndpoint:
    """Test export API endpoints."""

    def test_intake_csv_endpoint_returns_200(
        self, client: TestClient, temp_dir: Path, test_db
    ) -> None:
        """POST /export/intake-csv should return 200."""
        response = client.post(
            "/export/intake-csv",
            json={
                "form_id": "form-1",
                "form_title": "Test Form",
                "submissions": [
                    {
                        "id": "sub-1",
                        "form_id": "form-1",
                        "upload_code": "UC001",
                        "metadata": {"name": "Test"},
                        "created_at": "2024-01-20T10:00:00Z",
                    }
                ],
                "output_dir": str(temp_dir),
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "file_path" in data
        assert "row_count" in data
        assert data["row_count"] == 1

    def test_intake_csv_endpoint_validates_request(
        self, client: TestClient, temp_dir: Path, test_db
    ) -> None:
        """POST /export/intake-csv should validate required fields."""
        # Missing form_id
        response = client.post(
            "/export/intake-csv",
            json={
                "form_title": "Test",
                "submissions": [],
            },
        )

        assert response.status_code == 422  # Validation error
