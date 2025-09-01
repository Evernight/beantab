from __future__ import annotations

from textwrap import dedent

from beancount.core import data
from beancount.loader import load_string

from beantab.BeantabFileManager import BeantabFileManager
from beantab.models import ModifiedCellData


class TestBeantabFileManager:
    def _apply_changes_from_ledger(
        self,
        ledger: str,
        changes: list[tuple[data.Directive | None, ModifiedCellData]],
    ) -> tuple[list[str], int, int, list[ModifiedCellData]]:
        manager = BeantabFileManager(None)
        lines = dedent(ledger).splitlines(keepends=True)
        return manager._apply_changes_to_lines(lines, changes)

    def test_apply_changes_replaces_multiline_entry(self) -> None:
        ledger = """
        2015-01-01 custom "balance-ext" "full" Assets:Checking 100 USD
          pad_account: "Equity:Opening-Balances"
        """
        entries, _errors, _options = load_string(dedent(ledger))
        original_entry = next(e for e in entries if isinstance(e, data.Custom))

        changes = [
            (
                original_entry,
                ModifiedCellData(
                    account="Assets:Checking",
                    currency="USD",
                    date="2015-01-01",
                    originalValue=100,
                    newValue=250,
                ),
            )
        ]

        updated_lines, updated_count, new_count, _applied = self._apply_changes_from_ledger(ledger, changes)

        assert updated_count == 1
        assert new_count == 0
        assert 'pad_account: "Equity:Opening-Balances"' not in "".join(updated_lines)
        assert updated_lines[0] == '2015-01-01 custom "balance-ext" Assets:Checking 250 USD\n'

    def test_apply_changes_appends_new_entry(self) -> None:
        ledger = """
        2015-01-01 balance Assets:Cash 1 USD
        """
        changes = [
            (
                None,
                ModifiedCellData(
                    account="Assets:Cash",
                    currency="USD",
                    date="2015-01-02",
                    originalValue=None,
                    newValue=10,
                ),
            )
        ]

        updated_lines, updated_count, new_count, _applied = self._apply_changes_from_ledger(ledger, changes)

        assert updated_count == 0
        assert new_count == 1
        assert updated_lines[-1] == '2015-01-02 custom "balance-ext" Assets:Cash 10 USD\n'

    def test_apply_changes_updates_single_entry_among_many(self) -> None:
        ledger = """
        2015-01-01 balance Assets:Cash 1 USD
        2015-01-02 balance Assets:Cash 2 USD
        2015-01-03 balance Assets:Cash 3 USD
        2015-01-04 balance Assets:Cash 4 USD
        """
        entries, _errors, _options = load_string(dedent(ledger))
        original_entry = next(
            e for e in entries
            if isinstance(e, data.Balance) and e.date.isoformat() == "2015-01-03"
        )

        changes = [
            (
                original_entry,
                ModifiedCellData(
                    account="Assets:Cash",
                    currency="USD",
                    date="2015-01-03",
                    originalValue=3,
                    newValue=30,
                ),
            )
        ]

        updated_lines, updated_count, new_count, _applied = self._apply_changes_from_ledger(ledger, changes)

        assert updated_count == 1
        assert new_count == 0
        assert updated_lines[2] == '2015-01-03 custom "balance-ext" Assets:Cash 30 USD\n'
