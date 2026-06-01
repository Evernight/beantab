from __future__ import annotations

from dataclasses import asdict
from dataclasses import dataclass

from beancount_lazy_plugins.balance_extended.common import BalanceType


@dataclass
class BeanTabBalance:
    """Represents a balance statement for an account."""

    account: str
    currency: str
    date: str
    number: float
    type: BalanceType
    filename: str | None = None
    lineno: int | None = None

    def to_dict(self) -> dict:
        data_dict = asdict(self)
        data_dict["type"] = self.type.value
        if data_dict.get("filename") is None:
            data_dict.pop("filename", None)
        if data_dict.get("lineno") is None:
            data_dict.pop("lineno", None)
        return data_dict


@dataclass
class BeanTabAccount:
    account: str
    defaultBalanceType: str
    currencies: list[str]

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ModifiedCellData:
    """Represents a modified cell in the grid."""

    account: str
    currency: str
    date: str
    originalValue: float | str | None
    newValue: float | str | None
    balance_type: str | None = None  # e.g. "padded", "regular", "full-padded" when user entered ~ or !
