"""Build BeanTab balances API payload from ledger entries."""

from __future__ import annotations

import logging
from typing import Dict
from typing import List

from beancount.core import data
from beancount.core.getters import get_account_open_close
from beancount_lazy_plugins.balance_extended.common import BalanceExtendedError
from beancount_lazy_plugins.balance_extended.common import BalanceType
from beancount_lazy_plugins.balance_extended.common import ensure_account_balance_type
from beancount_lazy_plugins.balance_extended.common import get_directives_defined_config
from beancount_lazy_plugins.balance_extended.common import parse_balance_extended_entry
from beancount_lazy_plugins.valuation.common import ValuationError
from beancount_lazy_plugins.valuation.common import parse_valuation_entry

from .models import BeanTabAccount
from .models import BeanTabBalance
from .utils import is_original_entry

logger = logging.getLogger(__name__)


def build_currencies_from_postings(entries: data.Entries) -> dict[str, set[str]]:
    """Map account names to currencies seen on transaction postings."""
    result: dict[str, set[str]] = {}
    for entry in entries:
        if not isinstance(entry, data.Transaction):
            continue
        for posting in entry.postings:
            if posting.units is None:
                continue
            result.setdefault(posting.account, set()).add(posting.units.currency)
    return result


def build_open_declared_currencies(entries: data.Entries) -> dict[str, set[str]]:
    """Accounts with an explicit non-empty currencies list on their Open directive."""
    declared: dict[str, set[str]] = {}
    for entry in entries:
        if isinstance(entry, data.Open) and entry.currencies:
            declared[entry.account] = set(entry.currencies)
    return declared


def resolve_account_currencies(
    account: str,
    balances: List[dict],
    open_declared: dict[str, set[str]],
    posting_currencies: dict[str, set[str]],
    operating_currencies: List[str],
) -> List[str]:
    """Resolve display currencies: open constraint > balances > postings > operating."""
    if account in open_declared:
        return sorted(open_declared[account])
    from_balances = {b["currency"] for b in balances if b["account"] == account}
    if from_balances:
        return sorted(from_balances)
    from_postings = posting_currencies.get(account, set())
    if from_postings:
        return sorted(from_postings)
    return sorted(operating_currencies)


def _entry_source(entry) -> tuple[str | None, int | None]:
    meta = entry.meta or {}
    return meta.get("filename"), meta.get("lineno")


def build_balances_payload(
    entries: data.Entries,
    options: dict,
    balance_errors: List[dict] | None = None,
) -> dict:
    """Build balances API data from ledger entries and options.

    ``accounts`` includes every account with an Open directive (including closed),
    plus any account seen on balance-like entries without Open. Per-account
    ``currencies`` are resolved: declared on Open, else balances, else postings,
    else operating_currency.
    """
    balances: List[dict] = []
    config_errors: List[BalanceExtendedError] = []
    balance_type_config = get_directives_defined_config(entries, config_errors)
    if config_errors:
        for err in config_errors:
            logger.warning("balance-ext config error: %s", err.message)
    account_to_type_mapping: dict[str, str] = {}
    default_balance_type = BalanceType.REGULAR.value

    open_close_map = get_account_open_close(entries)
    for account, (open_entry, _close_entry) in open_close_map.items():
        if open_entry is not None:
            ensure_account_balance_type(
                account,
                account_to_type_mapping,
                balance_type_config,
                default_balance_type,
            )

    for entry in entries:
        if isinstance(entry, data.Open):
            ensure_account_balance_type(
                entry.account,
                account_to_type_mapping,
                balance_type_config,
                default_balance_type,
            )
        elif isinstance(entry, data.Balance):
            if not is_original_entry(entry):
                continue
            ensure_account_balance_type(
                entry.account,
                account_to_type_mapping,
                balance_type_config,
                default_balance_type,
            )
            filename, lineno = _entry_source(entry)
            bean_tab_balance = BeanTabBalance(
                account=entry.account,
                currency=entry.amount.currency,
                date=entry.date.isoformat(),
                number=float(entry.amount.number),
                type=BalanceType.REGULAR,
                filename=filename,
                lineno=lineno,
            )
            balances.append(bean_tab_balance.to_dict())

        elif isinstance(entry, data.Custom) and entry.type == "valuation":
            if not is_original_entry(entry):
                continue
            try:
                parsed = parse_valuation_entry(entry)
            except ValuationError:
                continue

            ensure_account_balance_type(
                parsed.account,
                account_to_type_mapping,
                balance_type_config,
                default_balance_type,
            )
            filename, lineno = _entry_source(entry)
            bean_tab_balance = BeanTabBalance(
                account=parsed.account,
                currency=parsed.amount.currency,
                date=entry.date.isoformat(),
                number=float(parsed.amount.number),
                type=BalanceType.VALUATION,
                filename=filename,
                lineno=lineno,
            )
            balances.append(bean_tab_balance.to_dict())

        elif isinstance(entry, data.Custom) and entry.type == "balance-ext":
            if not is_original_entry(entry):
                continue
            try:
                parsed = parse_balance_extended_entry(
                    entry,
                    account_to_type_mapping,
                    balance_type_config,
                    default_balance_type,
                )
            except BalanceExtendedError:
                continue

            balance_type_map = {
                BalanceType.REGULAR: BalanceType.REGULAR,
                BalanceType.FULL: BalanceType.REGULAR,
                BalanceType.PADDED: BalanceType.PADDED,
                BalanceType.FULL_PADDED: BalanceType.PADDED,
                BalanceType.VALUATION: BalanceType.VALUATION,
            }
            balance_type_for_display = balance_type_map.get(parsed.balance_type, BalanceType.PADDED)
            asserted_amounts = parsed.amount_values
            if parsed.balance_type in (BalanceType.FULL, BalanceType.FULL_PADDED):
                continue

            filename, lineno = _entry_source(entry)
            for amount_obj in asserted_amounts:
                bean_tab_balance = BeanTabBalance(
                    account=parsed.account,
                    currency=amount_obj.currency,
                    date=entry.date.isoformat(),
                    number=float(amount_obj.number),
                    type=balance_type_for_display,
                    filename=filename,
                    lineno=lineno,
                )
                balances.append(bean_tab_balance.to_dict())

    open_declared = build_open_declared_currencies(entries)
    posting_currencies = build_currencies_from_postings(entries)
    operating_currencies = list(options.get("operating_currency", []) or [])

    account_currencies_list: Dict[str, List[str]] = {}
    for account in account_to_type_mapping:
        account_currencies_list[account] = resolve_account_currencies(
            account,
            balances,
            open_declared,
            posting_currencies,
            operating_currencies,
        )

    accounts = [
        BeanTabAccount(
            account=account,
            defaultBalanceType=balance_type,
            currencies=account_currencies_list.get(account, []),
        ).to_dict()
        for account, balance_type in sorted(account_to_type_mapping.items())
    ]

    return {
        "balances": balances,
        "accounts": accounts,
        "balanceErrors": balance_errors or [],
        "operatingCurrencies": operating_currencies,
    }
