from __future__ import annotations

from collections import defaultdict
from decimal import Decimal, MAX_EMAX
import logging
import os
from pathlib import Path
from typing import Sequence

from beancount.parser import parser
from beancount.core import data
from beancount_lazy_plugins.balance_extended.common import (
    BalanceType,
    BalanceExtendedError,
    get_directives_defined_config,
    parse_balance_extended_entry,
)
from .models import ModifiedCellData
from .utils import is_original_entry

logger = logging.getLogger(__name__)


class BeantabFileManager:
    """Manages file-based operations for the BeanTab extension."""

    def __init__(self, ledger) -> None:
        self.ledger = ledger

    def _filename_for_balance(self, account: str, currency: str, date: str) -> str:
        return f'balances/balances-{date}.bean'

    def _generate_balance_entry(self, modified_cell: ModifiedCellData) -> str:
        # balance-ext format: date custom "balance-ext" [balance_type] account amount currency
        parts = [modified_cell.date, 'custom', '"balance-ext"']
        if modified_cell.balance_type:
            parts.append(f'"{modified_cell.balance_type}"')
        parts.extend([modified_cell.account, str(modified_cell.newValue), modified_cell.currency])
        return " ".join(parts) + "\n"

    def _get_all_entry_lines(self, lines: list[str], initial_start_line: int) -> list[str]:
        first_line = initial_start_line
        last_line = initial_start_line
        while last_line < len(lines) - 1:
            entry_candidate = "\n".join(lines[first_line:last_line+1])
            try:
                entries, errors, options = parser.parse_string(entry_candidate)
            except Exception:
                logger.error("Error parsing entry candidate: %s", entry_candidate)
                break
            if len(entries) > 1:
                break
            last_line += 1
        last_line -= 1

        # Ignore all whitespace or comment lines in the end
        while last_line > first_line:
            if lines[last_line].strip() == "" or lines[last_line].strip().startswith(";"):
                last_line -= 1            
            else:
                break
        entry_candidate = "\n".join(lines[first_line:last_line+1])
        try:
            entries, errors, options = parser.parse_string(entry_candidate)
        except Exception:
            logger.error("Error parsing entry candidate: %s", entry_candidate)
            return None
        entry = entries[0]
        assert len(entries) == 1, "Expected exactly one entry"
        
        return (first_line, last_line, entry)


    def _apply_changes_to_lines(
        self,
        lines: list[str],
        changes: list[tuple[data.Directive | None, ModifiedCellData]],
    ) -> tuple[list[str], int, int, list[ModifiedCellData]]:
        """Apply a sorted list of changes to file lines.

        Each change is a ``(original_entry, modified_cell)`` pair.
        When *original_entry* is not ``None`` the existing entry is replaced
        (or removed when ``modified_cell.newValue`` is ``None``).
        Otherwise a new line is appended.

        Returns:
            A tuple of ``(modified_lines, updated_count, new_count, applied_cells)``.
        """
        lines = list(lines)  # work on a copy
        lines_to_remove: list[int] = []
        updated_count, new_count = 0, 0
        applied_cells: list[ModifiedCellData] = []

        for original_entry, modified_cell in changes:
            if original_entry is not None:
                start_line, end_line, _parsed = self._get_all_entry_lines(
                    lines, original_entry.meta["lineno"] - 1,
                )
                logger.info("Entry spans lines %d–%d", start_line, end_line)

                if not self._current_value_matches_original(_parsed, modified_cell):
                    logger.info(
                        "Skipping update for %s %s %s: value mismatch",
                        modified_cell.account,
                        modified_cell.currency,
                        modified_cell.date,
                    )
                    continue

                # The new generated entry is a one-liner
                if modified_cell.newValue is not None:
                    lines[start_line] = self._generate_balance_entry(modified_cell)
                else:
                    lines_to_remove.append(start_line)
                # Schedule remaining lines of the (possibly multi-line) entry for removal
                for line_idx in range(start_line + 1, end_line + 1):
                    lines_to_remove.append(line_idx)

                updated_count += 1
                applied_cells.append(modified_cell)
            else:
                lines.append(self._generate_balance_entry(modified_cell))
                new_count += 1
                applied_cells.append(modified_cell)

        lines = [line for i, line in enumerate(lines) if i not in lines_to_remove]
        return lines, updated_count, new_count, applied_cells

    def _current_value_matches_original(
        self,
        parsed_entry: data.Directive,
        modified_cell: ModifiedCellData,
    ) -> bool:
        if modified_cell.originalValue is None:
            return False

        current_amount = None
        if isinstance(parsed_entry, data.Balance):
            if parsed_entry.amount.currency != modified_cell.currency:
                return False
            current_amount = parsed_entry.amount.number
        elif isinstance(parsed_entry, data.Custom) and parsed_entry.type == "balance-ext":
            try:
                parsed = parse_balance_extended_entry(parsed_entry)
            except BalanceExtendedError:
                return False
            for amount_obj in parsed.amount_values:
                if amount_obj.currency == modified_cell.currency:
                    current_amount = amount_obj.number
                    break
            if current_amount is None:
                return False
        else:
            return False

        original_value = modified_cell.originalValue
        if original_value is None:
            return False
        if not isinstance(original_value, Decimal):
            original_value = Decimal(str(original_value))
        return self._values_equal(current_amount, original_value)

    def _values_equal(self, current_amount: Decimal, original_value: Decimal | None) -> bool:
        if original_value is None:
            return False
        return current_amount == original_value

    def update_balances(
        self,
        entries: Sequence[data.Entry],
        modified_cells: Sequence[ModifiedCellData],
    ) -> tuple[list[ModifiedCellData], list[str]]:
        """Apply balance updates to the ledger.

        Returns:
            A tuple of (saved_cells, errors).
        """
        logger.info(
            "BeantabFileManager.update_balances called with %d cells and %d ledger entries",
            len(modified_cells),
            len(entries),
        )

        existing_balances = {}
        errors: list[str] = []
        config_errors: list[BalanceExtendedError] = []
        balance_type_config = get_directives_defined_config(entries, config_errors)
        if config_errors:
            for err in config_errors:
                logger.warning("balance-ext config error: %s", err.message)
        account_to_type_mapping: dict[str, str] = {}
        default_balance_type = BalanceType.REGULAR.value
        for entry in entries:
            if not isinstance(entry, data.Balance) and not isinstance(entry, data.Custom):
                continue

            if isinstance(entry, data.Custom) and entry.type != "balance-ext":
                continue

            if not is_original_entry(entry):
                continue

            if isinstance(entry, data.Balance):
                account = entry.account
                currency = entry.amount.currency
                date = entry.date.isoformat()
                key = (account, currency, date)
                if key in existing_balances:
                    errors.append(
                        f"Duplicate balance entry found: {account} {currency} {date}"
                    )
                    continue
                existing_balances[key] = entry
            elif isinstance(entry, data.Custom) and entry.type == "balance-ext":
                try:
                    parsed = parse_balance_extended_entry(
                        entry,
                        account_to_type_mapping,
                        balance_type_config,
                        default_balance_type,
                    )
                except BalanceExtendedError:
                    continue
                date = entry.date.isoformat()
                for amount_obj in parsed.amount_values:
                    key = (parsed.account, amount_obj.currency, date)
                    if key in existing_balances:
                        errors.append(
                            f"Duplicate balance entry found: {parsed.account} {amount_obj.currency} {date}"
                        )
                        continue
                    existing_balances[key] = entry

        changes_by_file =  defaultdict(list)
        saved_cells: list[ModifiedCellData] = []
        for modified_cell in modified_cells:
            account = modified_cell.account
            currency = modified_cell.currency
            date = modified_cell.date

            if (account, currency, date) in existing_balances:
                filename = existing_balances[(account, currency, date)].meta["filename"]
                changes_by_file[filename].append(
                    (existing_balances[(account, currency, date)], modified_cell)
                )
            else:
                filename = self._filename_for_balance(account, currency, date)
                changes_by_file[filename].append((None, modified_cell))

        for filename, changes in changes_by_file.items():
            changes.sort(key=lambda c: (c[0].meta["lineno"] if c[0] else MAX_EMAX, c[1].date))
            if os.path.exists(filename):
                with open(filename, 'r') as f:
                    lines = f.readlines()
            else:
                lines = []

            lines, updated_entry_count, new_entry_count, applied_cells = self._apply_changes_to_lines(lines, changes)
            saved_cells.extend(applied_cells)

            logger.info(f'Updating {updated_entry_count} entries and adding {new_entry_count} new entries to {filename}')

            os.makedirs(os.path.dirname(filename), exist_ok=True)
            with open(filename, 'w') as f:
                f.writelines(lines)
            
            self.ledger.watcher.notify(Path(filename))
            logger.info("Notified watcher of change to %s", filename)
        logger.info(
            "Saved %d out of %d cells%s",
            len(saved_cells),
            len(modified_cells),
            f"; {len(errors)} error(s)" if errors else "",
        )
        return saved_cells, errors
