# SQLAlchemy Circular Foreign Key Relationship Issue Report

## Summary

Attempted to add a `selected_version_id` foreign key column to the `Draft` model to track which `DraftVersion` was selected by the writer. This created a circular foreign key relationship between `Draft` and `DraftVersion` tables, causing SQLAlchemy to raise `AmbiguousForeignKeysError`.

## Problem Description

### Objective
Implement a feature where writers can select one of multiple AI-generated draft versions as the final version for designer review.

### Initial Schema
```python
class Draft(Base):
    __tablename__ = "drafts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    request_id: Mapped[str] = mapped_column(String(36), ForeignKey("requests.id"))
    # ... other fields

    versions: Mapped[List["DraftVersion"]] = relationship(
        back_populates="draft",
        cascade="all, delete-orphan"
    )

class DraftVersion(Base):
    __tablename__ = "draft_versions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    draft_id: Mapped[str] = mapped_column(String(36), ForeignKey("drafts.id"))
    # ... other fields

    draft: Mapped[Draft] = relationship(back_populates="versions")
```

### Attempted Change
Added `selected_version_id` to `Draft`:
```python
class Draft(Base):
    __tablename__ = "drafts"
    # ... existing fields
    selected_version_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("draft_versions.id")
    )

    selected_version: Mapped[Optional["DraftVersion"]] = relationship()
    versions: Mapped[List["DraftVersion"]] = relationship(
        back_populates="draft",
        cascade="all, delete-orphan"
    )
```

### Error Encountered
```
sqlalchemy.exc.AmbiguousForeignKeysError: Can't determine join between
'drafts' and 'draft_versions'; tables have more than one foreign key
constraint relationship between them. Please specify a 'foreign_keys'
argument, providing a list of those columns which should be counted
as containing a foreign key reference to the parent table.
```

## Root Cause

The circular foreign key relationship creates ambiguity:
- `Draft.selected_version_id` → `DraftVersion.id` (new FK)
- `DraftVersion.draft_id` → `Draft.id` (existing FK)

SQLAlchemy cannot automatically determine which foreign key to use when joining between these two tables, especially for the `versions` relationship.

## Attempted Solutions

All attempts failed to resolve the ambiguity:

### 1. Using `foreign_keys` parameter (string format)
```python
versions: Mapped[List["DraftVersion"]] = relationship(
    back_populates="draft",
    cascade="all, delete-orphan",
    foreign_keys="[DraftVersion.draft_id]"  # ❌ Still failed
)
```

### 2. Using `foreign_keys` parameter (list format)
```python
versions: Mapped[List["DraftVersion"]] = relationship(
    back_populates="draft",
    cascade="all, delete-orphan",
    foreign_keys=[draft_id]  # ❌ Still failed
)
```

### 3. Using `overlaps` parameter
```python
selected_version: Mapped[Optional["DraftVersion"]] = relationship(
    overlaps="selected_version"  # ❌ Still failed
)
```

### 4. Using `primaryjoin` parameter
```python
versions: Mapped[List["DraftVersion"]] = relationship(
    back_populates="draft",
    cascade="all, delete-orphan",
    primaryjoin="Draft.id==DraftVersion.draft_id"  # ❌ Still failed
)
```

### 5. Using `viewonly=True`
```python
selected_version: Mapped[Optional["DraftVersion"]] = relationship(
    viewonly=True  # ❌ Still failed
)
```

## Why Solutions Failed

SQLAlchemy 2.0's new typing system with `Mapped[]` appears to be more strict about relationship configuration. The ambiguity exists because:

1. Both `Draft → DraftVersion` relationships (`selected_version` and `versions`) need to know which FK to use
2. The `DraftVersion.draft` back-reference doesn't know which FK relationship it's part of
3. Circular dependencies make it impossible for SQLAlchemy to auto-detect the correct join path

## Alternative Solutions Considered

### Option A: Remove selected_version_id (Chosen)
**Pros:**
- Avoids circular FK complexity
- Simpler schema
- No SQLAlchemy relationship ambiguity

**Cons:**
- Loses database-level tracking of selected version
- Must implement selection logic in application layer

**Implementation:** Remove `selected_version_id` column and relationship, track selection via separate table or application state.

### Option B: Separate SelectedDraft Table
**Pros:**
- Breaks circular dependency
- Database-level integrity maintained
- Clear separation of concerns

**Cons:**
- Additional table adds complexity
- Requires joins for common queries

**Schema:**
```python
class SelectedDraftVersion(Base):
    __tablename__ = "selected_draft_versions"
    draft_id: Mapped[str] = mapped_column(String(36), ForeignKey("drafts.id"), primary_key=True)
    version_id: Mapped[str] = mapped_column(String(36), ForeignKey("draft_versions.id"))
```

### Option C: Use Self-Referential Integer Index
**Pros:**
- Avoids FK altogether
- Simple to implement

**Cons:**
- No referential integrity
- Could point to deleted/invalid version

**Schema:**
```python
class Draft(Base):
    selected_version_index: Mapped[Optional[int]]  # Just store version_index
```

## Decision & Implementation

**Chose Option A**: Remove `selected_version_id` to unblock development.

### Changes Made:
1. Reverted `backend/app/db/models.py` to remove `selected_version_id` and `selected_version` relationship
2. Removed `select_draft_version()` endpoint from `backend/app/api/v1/drafts.py`
3. Removed `selected_version_id` from `DraftResponse` schema
4. Removed `selectDraftVersion()` from `fe-test/src/lib/api.ts`
5. Removed version selection UI from `fe-test/src/pages/RequestDetail.tsx` and `fe-test/src/components/DraftList.tsx`
6. Removed `selected_version_id` from `fe-test/src/lib/types.ts`

### What Works Now:
- `source_text` field successfully added to `Request` model ✅
- Request creation with source_text ✅
- AI draft generation with multiple versions ✅
- Draft display in frontend ✅

## Recommendations for Future

If version selection is required, implement **Option B (Separate Table)**:

```python
class SelectedDraftVersion(Base):
    """Tracks which draft version was selected by the writer."""
    __tablename__ = "selected_draft_versions"

    draft_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("drafts.id"),
        primary_key=True
    )
    version_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("draft_versions.id"),
        nullable=False
    )
    selected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    draft: Mapped["Draft"] = relationship()
    version: Mapped["DraftVersion"] = relationship()
```

This approach:
- Breaks the circular FK dependency
- Maintains referential integrity
- Provides audit trail (selected_at timestamp)
- Allows easy querying of selected versions

## Lessons Learned

1. **Circular FKs are problematic**: SQLAlchemy 2.0's strict typing makes circular foreign keys very difficult to configure
2. **Relationship ambiguity**: Multiple FKs between same tables require explicit configuration that may not always work
3. **Alternative designs**: Sometimes the simplest solution is to avoid the complexity entirely
4. **Normalization trade-offs**: Perfectly normalized schemas can create implementation challenges

## References

- SQLAlchemy 2.0 Documentation: https://docs.sqlalchemy.org/en/20/
- AmbiguousForeignKeysError: https://docs.sqlalchemy.org/en/20/errors.html#error-ambiguous-fks
- Relationship Configuration: https://docs.sqlalchemy.org/en/20/orm/relationship_api.html

## Date & Author

- **Date**: 2025-10-11
- **Author**: Claude Code (Sonnet 4.5)
- **Migration**: Reverted ef45aa7f9f2f (attempted), then created new ef45aa7f9f2f (source_text only)
