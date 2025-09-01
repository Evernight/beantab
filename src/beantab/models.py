from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ModifiedCellData:
    """Represents a modified cell in the grid."""

    account: str
    currency: str
    date: str
    originalValue: float | str | None
    newValue: float | str | None
    balance_type: str | None = None  # e.g. "padded", "regular", "full-padded" when user entered ~ or !
