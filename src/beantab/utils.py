"""Shared utilities for the BeanTab extension."""


def is_original_entry(entry):
    """Return True if the entry is from a file (not generated)."""
    return bool(
        getattr(entry, "meta", None)
        and entry.meta.get("filename")
        and "generated_by" not in entry.meta
    )
