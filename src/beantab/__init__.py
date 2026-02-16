from collections import defaultdict
import functools
import logging
import subprocess
import traceback
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, NamedTuple, Optional

from beancount import Amount
from beancount.core import data
from beancount.core.interpolate import BalanceError as BeancountBalanceError
from beancount_lazy_plugins.balance_extended.common import (
    BalanceType,
    BalanceExtendedError,
    build_account_currencies_mapping,
    ensure_account_balance_type,
    get_directives_defined_config,
    parse_balance_extended_entry,
)
from beancount_lazy_plugins.valuation.common import (
    ValuationError,
    parse_valuation_entry,
)
from fava.ext import FavaExtensionBase
from fava.ext import extension_endpoint
from fava.helpers import FavaAPIError
from flask import request
from .BeantabFileManager import BeantabFileManager
from .models import ModifiedCellData
from .utils import is_original_entry

logger = logging.getLogger(__name__)


@dataclass
class BeanTabBalance:
    """Represents a balance statement for an account."""
    account: str  # account name
    currency: str  # currency from the amount
    date: str  # date in ISO format
    number: float  # number from the amount
    type: BalanceType

    def to_dict(self) -> dict:
        data_dict = asdict(self)
        data_dict["type"] = self.type.value
        return data_dict


@dataclass
class BeanTabAccount:
    account: str
    defaultBalanceType: str
    currencies: List[str]

    def to_dict(self) -> dict:
        return asdict(self)

class ExtConfig(NamedTuple):
    """Configuration for the Beantab extension."""

    # Add configuration options here as needed
    pass


def api_response(func):
    """Return {success: true, data: ...} or {success: false, error: ...}"""

    @functools.wraps(func)
    def decorator(*args, **kwargs):
        try:
            data = func(*args, **kwargs)
            return {"success": True, "data": data}
        except FavaAPIError as e:
            return {"success": False, "error": e.message}, 500
        except Exception as e:  # pylint: disable=broad-exception-caught
            traceback.print_exception(e)
            return {"success": False, "error": str(e)}, 500

    return decorator


class BeanTab(FavaExtensionBase):
    """BeanTab Fava extension for enhanced ledger interface."""

    report_title = "BeanTab"
    has_js_module = True

    def after_load_file(self) -> None:
        """Fava hook which runs after a ledger file has been (re-)loaded"""
        # Clear any cached data here
        pass

    def read_ext_config(self) -> ExtConfig:
        """Read extension configuration from the ledger file."""
        cfg = self.config if isinstance(self.config, dict) else {}
        return ExtConfig()


    @extension_endpoint("reload")
    @api_response
    def api_reload(self):
        """Force Fava to reload the ledger (e.g. to pick up new files from wildcard includes)."""
        logger.info("BeanTab reload: forcing ledger reload for %s", self.ledger.beancount_file_path)
        self.ledger.load_file()
        logger.info("BeanTab reload: ledger reload complete")
        return {"reloaded": True}

    @extension_endpoint("safety_check")
    @api_response
    def api_safety_check(self):
        """Check that git is available, cwd is a git repo, and working tree is clean."""
        cwd = Path(self.ledger.beancount_file_path).resolve().parent
        try:
            subprocess.run(
                ["git", "--version"],
                cwd=cwd,
                capture_output=True,
                check=True,
                timeout=5,
            )
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            return {"ok": False, "reason": "Git is not available."}
        try:
            subprocess.run(
                ["git", "rev-parse", "--is-inside-work-tree"],
                cwd=cwd,
                capture_output=True,
                check=True,
                text=True,
                timeout=5,
            )
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            return {"ok": False, "reason": "Working directory is not a git repository."}
        try:
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=cwd,
                capture_output=True,
                text=True,
                check=True,
                timeout=5,
            )
            if result.stdout.strip():
                return {"ok": False, "reason": "There are uncommitted changes in the working directory."}
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            return {"ok": False, "reason": "Could not check git status."}
        return {"ok": True}

    @extension_endpoint("balances")
    @api_response
    def api_balances(self):
        """Get balance statements as a flat list.
        Include regular Balance entries, and special balance-like Custom directives
        created/used by plugins (balance-ext, valuation).
        """
        entries = self.ledger.all_entries
        
        # Convert to flat list of BeanTabBalance objects
        balances: List[BeanTabBalance] = []
        config_errors: List[BalanceExtendedError] = []
        balance_type_config = get_directives_defined_config(entries, config_errors)
        if config_errors:
            for err in config_errors:
                logger.warning("balance-ext config error: %s", err.message)
        account_to_type_mapping: dict[str, str] = {}
        default_balance_type = BalanceType.REGULAR.value
        account_currencies = build_account_currencies_mapping(self.ledger.all_entries)
        
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
                bean_tab_balance = BeanTabBalance(
                    account=entry.account,
                    currency=entry.amount.currency,
                    date=entry.date.isoformat(),
                    number=float(entry.amount.number),
                    type=BalanceType.REGULAR,
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
                bean_tab_balance = BeanTabBalance(
                    account=parsed.account,
                    currency=parsed.amount.currency,
                    date=entry.date.isoformat(),
                    number=float(parsed.amount.number),
                    type=BalanceType.VALUATION,
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
                balance_type_for_display = balance_type_map.get(
                    parsed.balance_type, BalanceType.PADDED
                )
                asserted_amounts = parsed.amount_values
                if parsed.balance_type in (BalanceType.FULL, BalanceType.FULL_PADDED):
                    # TODO: proper implementation will need more consideration
                    continue
                    # all_currencies = account_currencies.get(parsed.account, set())
                    # asserted_amounts.extend([Amount(0.0, currency) for currency in all_currencies - set(asserted_amounts)])
                    
                for amount_obj in asserted_amounts:
                    bean_tab_balance = BeanTabBalance(
                        account=parsed.account,
                        currency=amount_obj.currency,
                        date=entry.date.isoformat(),
                        number=float(amount_obj.number),
                        type=balance_type_for_display,
                    )
                    balances.append(bean_tab_balance.to_dict())

        # Per-account currencies: from Open directive when declared, else from balances
        account_currencies_list: Dict[str, List[str]] = {}
        for account in account_to_type_mapping:
            currencies = account_currencies.get(account, set())
            if currencies:
                account_currencies_list[account] = sorted(currencies)
            else:
                from_balances = {
                    b["currency"]
                    for b in balances
                    if b["account"] == account
                }
                account_currencies_list[account] = sorted(from_balances)

        accounts = [
            BeanTabAccount(
                account=account,
                defaultBalanceType=balance_type,
                currencies=account_currencies_list.get(account, []),
            ).to_dict()
            for account, balance_type in sorted(account_to_type_mapping.items())
        ]

        # Collect BalanceErrors from ledger (balance check failures) for table highlighting
        balance_errors: List[dict] = []
        for err in self.ledger.errors:
            if isinstance(err, BeancountBalanceError) and getattr(err, "entry", None):
                entry = err.entry
                balance_errors.append({
                    "account": entry.account,
                    "date": entry.date.isoformat(),
                    "currency": entry.amount.currency if entry.amount else None,
                    "message": err.message,
                })

        return {
            "balances": balances,
            "accounts": accounts,
            "balanceErrors": balance_errors,
        }

    @extension_endpoint("updateBalances", methods=["POST"])
    @api_response
    def api_update_balances(self):
        """Log updateBalances payload without applying any changes."""
        if request.method != "POST":
            raise FavaAPIError("Only POST method allowed for updateBalances endpoint")

        payload = request.get_json()
        if not payload:
            raise FavaAPIError("No JSON data provided")

        raw_cells = payload.get("modifiedCells")
        if raw_cells is None:
            raise FavaAPIError("No modifiedCells in payload")
        if not isinstance(raw_cells, list):
            raise FavaAPIError("modifiedCells must be a list")

        modified_cells: List[ModifiedCellData] = []
        for idx, cell_data in enumerate(raw_cells):
            if not isinstance(cell_data, dict):
                raise FavaAPIError(f"modifiedCells[{idx}] must be an object")

            try:
                modified_cell = ModifiedCellData(
                    account=cell_data["account"],
                    currency=cell_data["currency"],
                    date=cell_data["date"],
                    originalValue=cell_data.get("originalValue"),
                    newValue=cell_data.get("newValue"),
                    balance_type=cell_data.get("balanceType"),
                )
            except KeyError as exc:
                raise FavaAPIError(
                    f"Missing {exc.args[0]} in modifiedCells[{idx}]"
                ) from exc

            modified_cells.append(modified_cell)

        entries = self.ledger.all_entries
        file_manager = BeantabFileManager(self.ledger)
        saved_cells, errors = file_manager.update_balances(entries, modified_cells)
        processed_cells = [asdict(cell) for cell in saved_cells]

        logger.info(
            "updateBalances processed %d cells%s",
            len(processed_cells),
            f"; {len(errors)} error(s)" if errors else "",
        )
        return {
            "message": f"updateBalances payload logged ({len(processed_cells)} cells)",
            "changes": processed_cells,
            "errors": errors,
        }

