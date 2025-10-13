"""CSV validation utilities for batch request creation."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from io import StringIO
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models


@dataclass
class CSVRow:
    """Represents a validated CSV row for request creation."""

    row_number: int
    title: str
    feature_name: str
    context_description: Optional[str] = None
    source_text: Optional[str] = None
    tone: Optional[str] = None
    style_preferences: Optional[str] = None
    device: Optional[str] = None


@dataclass
class CSVValidationError:
    """Represents a validation error for a specific CSV row."""

    row_number: int
    field: Optional[str]
    error: str


@dataclass
class CSVValidationResult:
    """Contains validation results for an entire CSV file."""

    is_valid: bool
    total_rows: int
    valid_rows: List[CSVRow]
    errors: List[CSVValidationError]


# Maximum number of requests allowed in a single batch
MAX_BATCH_SIZE = 30

# Required CSV columns
REQUIRED_FIELDS = {"title", "feature_name"}

# Optional CSV columns
OPTIONAL_FIELDS = {
    "context_description",
    "source_text",
    "tone",
    "style_preferences",
    "device",
}

# All allowed columns
ALL_FIELDS = REQUIRED_FIELDS | OPTIONAL_FIELDS


def validate_csv_file(
    session: Session,
    csv_content: str,
) -> CSVValidationResult:
    """
    Validate CSV file content for batch request creation.

    Args:
        session: Database session for device validation
        csv_content: Raw CSV file content as string

    Returns:
        CSVValidationResult with validation status, valid rows, and errors
    """
    errors: List[CSVValidationError] = []
    valid_rows: List[CSVRow] = []

    try:
        # Parse CSV content
        csv_file = StringIO(csv_content)
        reader = csv.DictReader(csv_file)

        # Validate CSV headers
        if not reader.fieldnames:
            errors.append(
                CSVValidationError(
                    row_number=0,
                    field=None,
                    error="CSV file is empty or has no headers",
                )
            )
            return CSVValidationResult(
                is_valid=False,
                total_rows=0,
                valid_rows=[],
                errors=errors,
            )

        # Check for required fields in headers
        missing_fields = REQUIRED_FIELDS - set(reader.fieldnames)
        if missing_fields:
            errors.append(
                CSVValidationError(
                    row_number=0,
                    field=None,
                    error=f"Missing required columns: {', '.join(missing_fields)}",
                )
            )
            return CSVValidationResult(
                is_valid=False,
                total_rows=0,
                valid_rows=[],
                errors=errors,
            )

        # Check for unknown fields in headers
        unknown_fields = set(reader.fieldnames) - ALL_FIELDS
        if unknown_fields:
            errors.append(
                CSVValidationError(
                    row_number=0,
                    field=None,
                    error=f"Unknown columns (will be ignored): {', '.join(unknown_fields)}",
                )
            )

        # Get valid device IDs from database for validation
        valid_device_ids = _get_valid_device_ids(session)

        # Process each row
        row_count = 0
        for row_idx, row in enumerate(reader, start=1):
            row_number = row_idx + 1  # +1 for header row

            # Skip empty rows
            if _is_empty_row(row):
                continue

            row_count += 1

            # Check max batch size
            if row_count > MAX_BATCH_SIZE:
                errors.append(
                    CSVValidationError(
                        row_number=row_number,
                        field=None,
                        error=f"Maximum batch size of {MAX_BATCH_SIZE} requests exceeded",
                    )
                )
                break

            # Validate individual row
            row_errors = _validate_row(
                row=row,
                row_number=row_number,
                valid_device_ids=valid_device_ids,
            )

            if row_errors:
                errors.extend(row_errors)
            else:
                # Create validated CSVRow object
                csv_row = CSVRow(
                    row_number=row_number,
                    title=row["title"].strip(),
                    feature_name=row["feature_name"].strip(),
                    context_description=_get_optional_field(row, "context_description"),
                    source_text=_get_optional_field(row, "source_text"),
                    tone=_get_optional_field(row, "tone"),
                    style_preferences=_get_optional_field(row, "style_preferences"),
                    device=_get_optional_field(row, "device"),
                )
                valid_rows.append(csv_row)

        # Check if we have any valid rows
        if row_count == 0:
            errors.append(
                CSVValidationError(
                    row_number=0,
                    field=None,
                    error="CSV file contains no data rows",
                )
            )

    except csv.Error as e:
        errors.append(
            CSVValidationError(
                row_number=0,
                field=None,
                error=f"CSV parsing error: {str(e)}",
            )
        )
    except Exception as e:
        errors.append(
            CSVValidationError(
                row_number=0,
                field=None,
                error=f"Unexpected error: {str(e)}",
            )
        )

    # Determine if validation passed
    # Only fail if there are critical errors (not warnings about unknown fields)
    critical_errors = [
        err for err in errors
        if not err.error.startswith("Unknown columns")
    ]
    is_valid = len(critical_errors) == 0 and len(valid_rows) > 0

    return CSVValidationResult(
        is_valid=is_valid,
        total_rows=len(valid_rows),
        valid_rows=valid_rows,
        errors=errors,
    )


def _get_valid_device_ids(session: Session) -> set[str]:
    """Fetch all active device IDs from the database."""
    stmt = select(models.DeviceTaxonomy.id).where(
        models.DeviceTaxonomy.active == True
    )
    result = session.execute(stmt)
    return {row[0] for row in result}


def _is_empty_row(row: dict) -> bool:
    """Check if a CSV row is empty (all fields are blank)."""
    return all(not str(value).strip() for value in row.values())


def _get_optional_field(row: dict, field_name: str) -> Optional[str]:
    """Get an optional field value from a row, returning None if empty."""
    value = row.get(field_name, "").strip()
    return value if value else None


def _validate_row(
    row: dict,
    row_number: int,
    valid_device_ids: set[str],
) -> List[CSVValidationError]:
    """
    Validate a single CSV row.

    Returns:
        List of validation errors (empty if row is valid)
    """
    errors: List[CSVValidationError] = []

    # Validate required fields
    title = row.get("title", "").strip()
    if not title:
        errors.append(
            CSVValidationError(
                row_number=row_number,
                field="title",
                error="Title is required",
            )
        )
    elif len(title) > 255:
        errors.append(
            CSVValidationError(
                row_number=row_number,
                field="title",
                error=f"Title exceeds maximum length of 255 characters (current: {len(title)})",
            )
        )

    feature_name = row.get("feature_name", "").strip()
    if not feature_name:
        errors.append(
            CSVValidationError(
                row_number=row_number,
                field="feature_name",
                error="Feature name is required",
            )
        )
    elif len(feature_name) > 255:
        errors.append(
            CSVValidationError(
                row_number=row_number,
                field="feature_name",
                error=f"Feature name exceeds maximum length of 255 characters (current: {len(feature_name)})",
            )
        )

    # Validate optional fields
    tone = row.get("tone", "").strip()
    if tone and len(tone) > 255:
        errors.append(
            CSVValidationError(
                row_number=row_number,
                field="tone",
                error=f"Tone exceeds maximum length of 255 characters (current: {len(tone)})",
            )
        )

    # Validate device ID if provided
    device = row.get("device", "").strip()
    if device and device not in valid_device_ids:
        errors.append(
            CSVValidationError(
                row_number=row_number,
                field="device",
                error=f"Invalid device ID: '{device}'. Must be one of the active devices in the taxonomy.",
            )
        )

    return errors


__all__ = [
    "CSVRow",
    "CSVValidationError",
    "CSVValidationResult",
    "validate_csv_file",
    "MAX_BATCH_SIZE",
]
