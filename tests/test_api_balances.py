from __future__ import annotations

from textwrap import dedent

from beancount.loader import load_string

from beantab.balances_data import build_balances_payload


def _accounts_by_name(payload: dict) -> dict[str, dict]:
    return {a["account"]: a for a in payload["accounts"]}


class TestBuildBalancesPayload:
    def test_open_only_uses_operating_currency(self) -> None:
        ledger = """
        option "operating_currency" "USD"

        2020-01-01 open Assets:Cash

        2020-01-02 open Equity:Opening-Balances
        """
        entries, _errors, options = load_string(dedent(ledger))
        payload = build_balances_payload(entries, options)
        by_name = _accounts_by_name(payload)
        assert "Assets:Cash" in by_name
        assert by_name["Assets:Cash"]["currencies"] == ["USD"]

    def test_open_with_transaction_uses_posting_currency(self) -> None:
        ledger = """
        option "operating_currency" "USD"

        2020-01-01 open Assets:Bank

        2020-01-02 *
          Assets:Bank     100 EUR
          Equity:Opening-Balances
        """
        entries, _errors, options = load_string(dedent(ledger))
        payload = build_balances_payload(entries, options)
        by_name = _accounts_by_name(payload)
        assert by_name["Assets:Bank"]["currencies"] == ["EUR"]

    def test_open_with_declared_currencies_only(self) -> None:
        ledger = """
        option "operating_currency" "USD"

        2020-01-01 open Assets:Savings GBP, USD

        2020-01-02 *
          Assets:Savings    50 GBP
          Equity:Opening-Balances
        """
        entries, _errors, options = load_string(dedent(ledger))
        payload = build_balances_payload(entries, options)
        by_name = _accounts_by_name(payload)
        assert set(by_name["Assets:Savings"]["currencies"]) == {"GBP", "USD"}

    def test_closed_open_account_still_listed(self) -> None:
        ledger = """
        option "operating_currency" "USD"

        2020-01-01 open Assets:Old
        2021-01-01 close Assets:Old
        """
        entries, _errors, options = load_string(dedent(ledger))
        payload = build_balances_payload(entries, options)
        by_name = _accounts_by_name(payload)
        assert "Assets:Old" in by_name
        assert by_name["Assets:Old"]["currencies"] == ["USD"]
