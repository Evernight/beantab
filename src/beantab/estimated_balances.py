"""Compute estimated balances from transactions via realization.

Uses two-pointers optimization with incremental balance updates:
- Dates and entries are sorted by date.
- A single RealAccount tree is maintained; for each new entry we add postings
  via real_account.balance.add_position(posting) (O(1) per posting).
- Each posting is processed exactly once. Total complexity O(entries + dates).
"""

import datetime
from typing import Any
from typing import List

from beancount.core import data
from beancount.core import realization


def _add_entry_to_realization(real_root: realization.RealAccount, entry: Any) -> None:
    """Add a single entry's postings to the realization tree (like ops.balance)."""
    if isinstance(entry, data.Transaction):
        for posting in entry.postings:
            real_account = realization.get_or_create(real_root, posting.account)
            real_account.balance.add_position(posting)


def compute_estimated_balances(
    entries: List[Any],
    dates: List[datetime.date],
) -> List[dict]:
    """Compute estimated balances for given dates using incremental realization.

    Args:
        entries: Beancount entries (from ledger.all_entries).
        dates: Target dates to compute balances for.

    Returns:
        List of dicts: { account, currency, date, number } for each non-zero balance.
    """
    if not dates:
        return []

    # Sort dates ascending for two-pointers scan
    dates_sorted = sorted(dates)

    # Entries with dates, sorted by date
    dated_entries = [e for e in entries if getattr(e, "date", None) is not None]
    dated_entries.sort(key=lambda e: e.date)

    estimated: List[dict] = []
    real_root = realization.RealAccount("")
    entries_ptr = 0

    for target_date in dates_sorted:
        # Two-pointers: incrementally add entries with date <= target_date
        while entries_ptr < len(dated_entries) and dated_entries[entries_ptr].date <= target_date:
            _add_entry_to_realization(real_root, dated_entries[entries_ptr])
            entries_ptr += 1

        for real_account in realization.iter_children(real_root, leaf_only=False):
            subtree = realization.compute_balance(real_account, leaf_only=False)
            for currency in subtree.currencies():
                amt = subtree.get_currency_units(currency)
                if amt is not None and amt.number != 0:
                    estimated.append({
                        "account": real_account.account,
                        "currency": currency,
                        "date": target_date.isoformat(),
                        "number": float(amt.number),
                    })

    return estimated
