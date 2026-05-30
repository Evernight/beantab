import React, { useEffect, useMemo } from "react";
import { observer } from "mobx-react-lite";
import {
  ColumnDataSchemaModel,
  ColumnTemplateProp,
  ColumnGrouping,
  ColumnRegular,
  RevoGrid,
  Template,
} from "@revolist/react-datagrid";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TuneIcon from "@mui/icons-material/Tune";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ViewListIcon from "@mui/icons-material/ViewList";
import RestoreIcon from "@mui/icons-material/Restore";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { amber, blue, blueGrey, brown, cyan, green, lime, orange, pink, red, teal } from "@mui/material/colors";
import type { BalancesData } from "../api/balances";
import { useEstimatedBalances } from "../api/estimatedBalances";
import type { Transaction } from "../api/transactions";
import { BALANCE_COLOR_NEGATIVE, BALANCE_COLOR_POSITIVE } from "../constants/balanceColors";
import { BALANCE_TYPE_DISPLAY_MAPPING } from "../constants/balanceTypes";
import {
  DELTA_KEY_LABEL,
  DELTA_NEGATIVE,
  DELTA_POSITIVE,
} from "../constants/deltas";
import type { AccountDelta, AccountDeltaCell } from "../types/deltas";
import { BalanceTypeChip } from "./BalanceTypeChip";
import {
  getColorFromHashString,
  getCurrencyColor,
  getCurrencyDisplayLabel,
} from "../utils/currencyDisplayUtils";
import {
  buildAccountUrl,
  buildEditorUrl,
  buildExpensesDashboardUrl,
  buildJournalUrl,
  PADDING_NARRATION,
} from "../utils/favaTools";
import { splitAdditionalDates } from "../utils/additionalDatesUtils";
import {
  beanTabStore,
  BeanTabStore,
  type GridRow,
  type ModifiedCell,
} from "../stores/beanTabStore";

interface BeanTabGridProps {
  balancesData?: BalancesData;
  isLoading?: boolean;
  error?: Error | null;
  accountsFilter?: RegExp[];
  additionalDates?: string[];
  sortedDates: string[];
  showDeltas?: boolean;
  transactions?: Transaction[];
  convertedTransactions?: Transaction[];
  conversionCurrency?: string;
  groupByAccount?: boolean;
  hideDatesWithLessThanEntries?: number;
  hideAccountsWithNoEntries?: boolean;
  showEstimatedBalances?: boolean;
  invertSign?: boolean;
  sortingConfig?: { prop: string | null, order: "asc" | "desc" | undefined };
  onSortingChange?: (prop: string | null, order?: "asc" | "desc") => void;
  onFilterStatsChange?: (stats: {
    emptyAccountsCount: number;
    hiddenDatesCount: number;
  }) => void;
  /** When provided, clicking account name sets filter to this account instead of navigating to journal */
  onAccountClick: (account: string) => void;
}

function gridRowHasBalanceEntry(
  row: GridRow,
  effectiveDates: string[],
  estimatedCellValues: Record<string, number>,
): boolean {
  return effectiveDates.some((date) => {
    const val = row[date];
    if (val === null || val === undefined) return false;
    const key = `${row.account}|${row.currency}|${date}`;
    if (key in estimatedCellValues) return false;
    return true;
  });
}

function createEmptyAccountDelta(): AccountDelta {
  return {
    assetsPositive: 0,
    liabilitiesPositive: 0,
    expensesPositive: 0,
    incomePositive: 0,
    assetsNegative: 0,
    liabilitiesNegative: 0,
    expensesNegative: 0,
    incomeNegative: 0,
    padPositive: 0,
    padNegative: 0,
  };
}

function addToDelta(delta: AccountDelta, account: string, amount: number): void {
  const top = account.split(":")[0];
  const isPositive = amount >= 0;
  const suffix = isPositive ? "Positive" : "Negative";
  const key = `${top.toLowerCase()}${suffix}` as keyof AccountDelta;
  if (key in delta) {
    delta[key] += amount;
  }
}

function computePairedDeltasByAccount(
  nativeTransactions: Transaction[],
  convertedTransactions: Transaction[] | null,
  sortedDates: string[],
): Record<string, Record<string, AccountDeltaCell>> {
  const result: Record<string, Record<string, AccountDeltaCell>> = {};

  for (let di = 0; di < sortedDates.length; di++) {
    const date = sortedDates[di];
    const prevDate = di > 0 ? sortedDates[di - 1] : "";

    for (let ti = 0; ti < nativeTransactions.length; ti++) {
      const nativeTxn = nativeTransactions[ti];
      const convertedTxn = convertedTransactions?.[ti] ?? null;
      const txnDate = nativeTxn.date;
      const inRange =
        (prevDate === "" || txnDate > prevDate) && txnDate <= date;
      if (!inRange) continue;

      // Group by account|nativeCurrency, accumulating both native and converted amounts
      const byKey = new Map<string, { account: string; nativeAmount: number; convertedAmount: number }>();
      for (let pi = 0; pi < nativeTxn.postings.length; pi++) {
        const np = nativeTxn.postings[pi];
        const cp = convertedTxn?.postings[pi] ?? np;
        const key = `${np.account}|${np.units.currency}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.nativeAmount += np.units.number;
          existing.convertedAmount += cp.units.number;
        } else {
          byKey.set(key, { account: np.account, nativeAmount: np.units.number, convertedAmount: cp.units.number });
        }
      }

      for (const [key] of byKey) {
        if (!result[key]) result[key] = {};
        if (!result[key][date]) {
          result[key][date] = {
            native: createEmptyAccountDelta(),
            converted: convertedTransactions !== null ? createEmptyAccountDelta() : null,
          };
        }
        const keyCurrency = key.split("|")[1];
        const isPadTxn = nativeTxn.narration?.includes(PADDING_NARRATION) ?? false;
        for (const [otherKey, other] of byKey) {
          const otherCurrency = otherKey.split("|")[1];
          // Currency matching uses native currencies — cross-currency transactions stay excluded
          if (otherKey !== key && otherCurrency === keyCurrency) {
            const cell = result[key][date];
            if (isPadTxn) {
              if (other.nativeAmount >= 0) cell.native.padPositive += other.nativeAmount;
              else cell.native.padNegative += other.nativeAmount;
              if (cell.converted !== null) {
                if (other.convertedAmount >= 0) cell.converted.padPositive += other.convertedAmount;
                else cell.converted.padNegative += other.convertedAmount;
              }
            } else {
              addToDelta(cell.native, other.account, other.nativeAmount);
              if (cell.converted !== null) {
                addToDelta(cell.converted, other.account, other.convertedAmount);
              }
            }
          }
        }
      }
    }
  }
  return result;
}

function transactionAbsSum(txn: Transaction): number {
  return txn.postings.reduce((sum, p) => sum + Math.abs(p.units.number), 0);
}

function percentile95(values: number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = 0.95 * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return Math.max(sorted[lo], 1);
  const frac = idx - lo;
  return Math.max(sorted[lo] * (1 - frac) + sorted[hi] * frac, 1);
}

function filterTransactionsForPeriod(
  transactions: Transaction[],
  account: string,
  currency: string,
  date: string,
  prevDate: string,
): Transaction[] {
  return transactions.filter((txn) => {
    const inRange =
      (prevDate === "" || txn.date > prevDate) && txn.date <= date;
    if (!inRange) return false;
    return txn.postings.some(
      (p) => p.account === account && p.units.currency === currency,
    );
  });
}

function transactionHasPostingForSegment(
  txn: Transaction,
  currency: string,
  segmentKey: keyof AccountDelta,
): boolean {
  const wantsPositive = segmentKey.endsWith("Positive");
  if (segmentKey === "padNegative" || segmentKey === "padPositive") {
    if (!txn.narration?.includes(PADDING_NARRATION)) return false;
    return txn.postings.some((p) => {
      if (p.units.currency !== currency) return false;
      const isPositive = p.units.number > 0;
      return wantsPositive ? isPositive : !isPositive;
    });
  }
  const typeMatch = segmentKey.replace(/Positive|Negative$/, "");
  return txn.postings.some((p) => {
    if (p.units.currency !== currency) return false;
    const topLevel = p.account.split(":")[0].toLowerCase();
    if (topLevel !== typeMatch) return false;
    const isPositive = p.units.number > 0;
    return wantsPositive ? isPositive : !isPositive;
  });
}

const DeltaBarSegment: React.FC<{
  delta: AccountDelta;
  segments: { key: keyof AccountDelta; color: string; textColor: string }[];
  total: number;
  maxSum: number;
  direction: "left" | "right";
  currency?: string;
  account?: string;
  date?: string;
  prevDate?: string;
  transactions?: Transaction[];
  invertSign?: boolean;
  convertedDelta?: AccountDelta;
  conversionCurrency?: string;
}> = ({ delta, segments, total, maxSum, direction, currency, account = "", date: periodDate = "", prevDate = "", transactions = [], invertSign = false, convertedDelta, conversionCurrency }) => {
  if (total <= 0) return null;
  const barWidthPct = Math.min(100, (total / maxSum) * 100);
  return (
    <Box
      sx={{
        flex: 1,
        height: 20,
        display: "flex",
        flexDirection: direction === "left" ? "row-reverse" : "row",
        justifyContent: "flex-start",
        alignItems: "stretch",
        overflow: "hidden",
      }}
    >
      <ButtonGroup
        sx={{
          width: `${barWidthPct}%`,
          minWidth: 4,
          display: "flex",
          height: "100%",
          "& .MuiButtonGroup-grouped": {
            minWidth: 0,
            border: "none",
          },
        }}
      >
        {segments.map(({ key, color, textColor }) => {
          const val = delta[key];
          const widthVal = convertedDelta ? convertedDelta[key] : val;
          if (widthVal === 0 && val === 0) return null;
          const pct = (Math.abs(widthVal) / total) * 100;
          const showText = pct >= 15;
          const baseTxns =
            account && periodDate
              ? filterTransactionsForPeriod(
                  transactions,
                  account,
                  currency ?? "",
                  periodDate,
                  prevDate ?? "",
                )
              : [];
          const filteredTxns = baseTxns.filter((txn) =>
            transactionHasPostingForSegment(txn, currency ?? "", key),
          );
          const displayVal = invertSign ? -val : val;
          const convertedSegVal = convertedDelta ? convertedDelta[key] : null;
          const displayConvertedVal = convertedSegVal !== null ? (invertSign ? -convertedSegVal : convertedSegVal) : null;
          const segmentJournalUrl =
            account && periodDate && currency
              ? buildJournalUrl(account, periodDate, prevDate ?? "", {
                  segmentKey: key,
                  currency,
                })
              : undefined;
          const tooltipContent = (
            <Box sx={{ p: 0.5, maxWidth: 450, maxHeight: 360, overflow: "auto" }}>
              <Typography variant="caption" component="div" sx={{ fontWeight: 600, mb: 0.25 }}>
                {DELTA_KEY_LABEL[key]}: {displayVal.toFixed(2)}
                {currency ? ` ${currency}` : ""}
              </Typography>
              {displayConvertedVal !== null && conversionCurrency && (
                <Typography variant="caption" component="div" sx={{ opacity: 0.7, mb: 0.5 }}>
                  ≈ {displayConvertedVal.toFixed(2)} {conversionCurrency}
                </Typography>
              )}
              {filteredTxns.length > 0 && (
                <>
                  <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                    Transactions ({filteredTxns.length} total):
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2, fontSize: "0.75rem" }}>
                    {filteredTxns.slice(0, 10).map((txn, i) => (
                      <li key={i}>
                        <span style={{ fontSize: "0.7rem" }}>
                          <strong>{txn.date}</strong>
                          {txn.narration ? (
                            <>
                              {" — "}
                              <strong style={{ fontStyle: "italic" }}>{txn.narration}</strong>
                            </>
                          ) : null}
                        </span>
                        <Box component="ul" sx={{ m: 0, pl: 1.5, listStyle: "none" }}>
                          {txn.postings.map((p, j) => (
                            <li key={j}>
                              {p.account}: {p.units.number.toFixed(2)} {p.units.currency}
                            </li>
                          ))}
                        </Box>
                      </li>
                    ))}
                    {filteredTxns.length > 10 && (
                      <li>…and {filteredTxns.length - 10} more transaction{filteredTxns.length - 10 !== 1 ? "s" : ""}</li>
                    )}
                  </Box>
                </>
              )}
              {segmentJournalUrl && (
                <Link
                  href={segmentJournalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ fontSize: "0.75rem", display: "block", mt: 0.5 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Open in journal
                </Link>
              )}
            </Box>
          );
          return (
            <Tooltip
              key={key}
              arrow
              title={tooltipContent}
              leaveDelay={400}
              slotProps={{
                popper: { sx: { pointerEvents: "auto" } },
              }}
            >
              <Button
                component="span"
                variant="contained"
                onClick={
                  segmentJournalUrl
                    ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(segmentJournalUrl, "_blank", "noopener,noreferrer");
                      }
                    : undefined
                }
                sx={{
                  flex: `${pct} 1 0`,
                  minWidth: Math.abs(val) > 0 ? 2 : 0,
                  minHeight: 0,
                  height: "100%",
                  backgroundColor: color,
                  color: `${textColor} !important`,
                  "&:hover": {
                    backgroundColor: color,
                    color: `${textColor} !important`,
                    filter: "brightness(0.9)",
                  },
                  padding: "0 4px",
                  fontSize: "0.7rem",
                  overflow: "hidden",
                }}
              >
                {showText ? displayVal.toFixed(0) : null}
              </Button>
            </Tooltip>
          );
        })}
      </ButtonGroup>
    </Box>
  );
};

type DeltaBarCellProps = (ColumnDataSchemaModel | ColumnTemplateProp) & {
  date?: string;
  prevDate?: string;
  addition?: {
    transactions?: Transaction[];
    invertSign?: boolean;
    deltaBarScaleMax?: number;
    conversionCurrency?: string;
  };
};

const DeltaBarCell: React.FC<DeltaBarCellProps> = (props) => {
  const cellValue = props.value as AccountDeltaCell | null;
  if (!cellValue) return null;
  const delta = cellValue.native;

  const model = props.model as { account?: string; currency?: string } | undefined;
  const account = model?.account ?? "";
  const currency = model?.currency ?? "";
  const date = props.date ?? "";
  const prevDate = props.prevDate ?? "";
  const transactions = props.addition?.transactions ?? [];
  const invertSign = props.addition?.invertSign ?? false;
  const deltaBarScaleMax = props.addition?.deltaBarScaleMax;
  const conversionCurrency = props.addition?.conversionCurrency;
  const journalUrl =
    account && date ? buildJournalUrl(account, date, prevDate) : undefined;

  // Converted delta comes directly from the cell value (paired during computation)
  const convertedDelta = cellValue.converted;

  // Use converted delta for width totals when available, else fall back to native
  const widthDelta = convertedDelta ?? delta;
  const totalNeg = DELTA_NEGATIVE.reduce((sum, { key }) => sum + Math.abs(widthDelta[key]), 0);
  const totalPos = DELTA_POSITIVE.reduce((sum, { key }) => sum + Math.abs(widthDelta[key]), 0);
  const maxSum = convertedDelta && deltaBarScaleMax
    ? deltaBarScaleMax
    : Math.max(totalNeg, totalPos, 1);
  if (totalNeg <= 0 && totalPos <= 0) return null;

  const filteredTxns = filterTransactionsForPeriod(
    transactions,
    account,
    currency,
    date,
    prevDate,
  );
  const txnCount = filteredTxns.length;
  const lastTxnDate =
    filteredTxns.length > 0
      ? filteredTxns.reduce((max, t) => (t.date > max ? t.date : max), "")
      : null;

  const segmentProps = {
    account,
    date,
    prevDate,
    transactions,
    currency,
    invertSign,
    convertedDelta: convertedDelta ?? undefined,
    conversionCurrency,
  };
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        flexDirection: "row",
        gap: 0,
      }}
    >
      <Box sx={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "flex-end" }}>
        <DeltaBarSegment
          delta={delta}
          segments={DELTA_NEGATIVE}
          total={totalNeg}
          maxSum={maxSum}
          direction="left"
          {...segmentProps}
        />
      </Box>
      <Tooltip
        arrow
        title={
          <Box component="span" sx={{ display: "block", fontSize: "0.75rem" }}>
            {[...DELTA_NEGATIVE, ...DELTA_POSITIVE].map(({ key }) => {
              const val = delta[key];
              if (val === 0) return null;
              const displayVal = invertSign ? -val : val;
              const convertedSegVal = convertedDelta ? convertedDelta[key] : null;
              const displayConvertedVal = convertedSegVal !== null ? (invertSign ? -convertedSegVal : convertedSegVal) : null;
              return (
                <div key={key}>
                  {DELTA_KEY_LABEL[key]}: {displayVal.toFixed(2)}
                  {currency ? ` ${currency}` : ""}
                  {displayConvertedVal !== null && conversionCurrency && (
                    <span style={{ opacity: 0.7, marginLeft: 4 }}>
                      (≈ {displayConvertedVal.toFixed(2)} {conversionCurrency})
                    </span>
                  )}
                </div>
              );
            })}
            {lastTxnDate && (
              <div style={{ marginTop: 4, opacity: 0.9 }}>
                Most recent transaction on {lastTxnDate}
              </div>
            )}
          </Box>
        }
      >
        <Box sx={{ display: "flex", alignItems: "center", mx: 0.1, alignSelf: "center", gap: 0 }}>
          <ChevronRightIcon sx={{ fontSize: 18, color: "grey.500", opacity: 0.6 }} />
          <Badge
            badgeContent={txnCount}
            showZero={false}
            color="default"
            sx={{
              "& .MuiBadge-badge": {
                fontSize: "0.6rem",
                minWidth: 14,
                height: 14,
              },
            }}
          >
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                if (journalUrl) window.open(journalUrl, "_blank", "noopener,noreferrer");
              }}
              sx={{
                p: 0.25,
                ml: -0.5,
                "&:hover": { backgroundColor: "action.hover" },
              }}
            >
              <ViewListIcon sx={{ fontSize: 18, color: "grey.500", opacity: 0.6 }} />
            </IconButton>
          </Badge>
          <ChevronRightIcon sx={{ fontSize: 18, color: "grey.500", opacity: 0.6, ml: -0.5 }} />
        </Box>
      </Tooltip>
      <Box sx={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "flex-start" }}>
        <DeltaBarSegment
          delta={delta}
          segments={DELTA_POSITIVE}
          total={totalPos}
          maxSum={maxSum}
          direction="right"
          {...segmentProps}
        />
      </Box>
    </Box>
  );
};

const StatusContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "400px",
      gap: 2,
      padding: 2,
      textAlign: "center",
    }}
  >
    {children}
  </Box>
);

const IconColumnHeader: React.FC<{
  icon?: React.ReactElement;
  label: string;
  title?: string;
}> = ({ icon, label, title }) => {
  const content = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: label ? undefined : "center",
        gap: "4px",
        width: label ? undefined : "100%",
      }}
    >
      {icon}
      {label}
    </span>
  );

  if (!title) return content;
  return <Tooltip title={title}>{content}</Tooltip>;
};

const CalendarColumnHeader: React.FC<
  (ColumnDataSchemaModel | ColumnTemplateProp) & { date?: string; onHide?: () => void }
> = (props) => {
  const label = "name" in props ? props.name : "";
  const { onHide } = props;
  const header = (
    <IconColumnHeader
      icon={<CalendarTodayIcon style={{ fontSize: "14px" }} />}
      label={label}
    />
  );

  const centered = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {header}
    </Box>
  );

  if (!onHide) return centered;

  return (
    <Tooltip
      arrow
      leaveDelay={400}
      slotProps={{ popper: { sx: { pointerEvents: "auto" } } }}
      title={
        <Button
          size="small"
          color="inherit"
          aria-label="Hide this date column"
          startIcon={<VisibilityOffIcon sx={{ fontSize: 16 }} />}
          onClick={(e) => {
            e.stopPropagation();
            onHide();
          }}
          sx={{
            textTransform: "none",
            color: "grey.300",
            minWidth: 0,
            py: 0.25,
            "&:hover": { color: "common.white", backgroundColor: "rgba(255,255,255,0.08)" },
          }}
        >
          Hide column
        </Button>
      }
    >
      {centered}
    </Tooltip>
  );
};

const DeltaColumnHeader: React.FC<
  (ColumnDataSchemaModel | ColumnTemplateProp) & { date?: string; prevDate?: string }
> = ({ date = "", prevDate = "" }) => {
  const href = date ? buildExpensesDashboardUrl(date, prevDate) : undefined;
  const content = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
      }}
    >
      {prevDate ? (
        <Typography component="span" variant="caption" sx={{ fontSize: "0.65rem", lineHeight: 1.1 }}>
          {prevDate}
        </Typography>
      ) : null}
      <Typography component="span" variant="body2">↔</Typography>
      {date ? (
        <Typography component="span" variant="caption" sx={{ fontSize: "0.65rem", lineHeight: 1.1 }}>
          {date}
        </Typography>
      ) : null}
    </Box>
  );
  return href ? (
    <Link href={href} target="_blank" rel="noopener noreferrer" sx={{ color: "inherit", textDecoration: "none" }}>
      {content}
    </Link>
  ) : (
    content
  );
};

const AccountColumnHeader: React.FC<ColumnDataSchemaModel | ColumnTemplateProp> = () => (
  <IconColumnHeader
    icon={<AccountTreeIcon style={{ fontSize: "14px" }} />}
    label="Account"
    title="Account"
  />
);

const CurrencyColumnHeader: React.FC<ColumnDataSchemaModel | ColumnTemplateProp> = () => (
  <IconColumnHeader label="€$£¥" title="Currency" />
);

const CurrencyCell: React.FC<ColumnDataSchemaModel | ColumnTemplateProp> = (props) => {
  const value =
    "value" in props
      ? props.value
      : "model" in props && "prop" in props
        ? props.model?.[props.prop]
        : "";
  const label = value === null || value === undefined ? "" : String(value);
  const displayLabel = label ? getCurrencyDisplayLabel(label) : "";

  return (
    <div
      style={{
        color: getCurrencyColor(label),
        fontWeight: "bold",
      }}
    >
      {displayLabel}
    </div>
  );
};

const DefaultBalanceTypeHeader: React.FC<ColumnDataSchemaModel | ColumnTemplateProp> = () => (
  <IconColumnHeader
    icon={<TuneIcon style={{ fontSize: "14px" }} />}
    label=""
    title="Default balance type"
  />
);

type AccountCellProps = (ColumnDataSchemaModel | ColumnTemplateProp) & {
  onAccountClick: (account: string) => void;
};

const AccountCell: React.FC<AccountCellProps> = (props) => {
  const value = props.value;
  const accountName = value != null ? String(value) : "";
  const iconColor = getColorFromHashString(accountName);
  const onAccountClick = props.onAccountClick;
  const accountHref = !onAccountClick && accountName ? buildAccountUrl(accountName) : "";
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAccountClick && accountName) {
      e.preventDefault();
      onAccountClick(accountName);
    }
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <AccountBalanceWalletIcon style={{ fontSize: "14px", color: iconColor }} />
      {accountName ? (
        onAccountClick ? (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAccountClick(accountName);
              }
            }}
            style={{ color: "inherit", textDecoration: "none", cursor: "pointer" }}
          >
            {value}
          </span>
        ) : (
          <a
            href={accountHref}
            onClick={handleClick}
            style={{ color: "inherit", textDecoration: "none" }}
          >
            {value}
          </a>
        )
      ) : (
        value
      )}
    </span>
  );
};

const RevertButton: React.FC<{ model: any; prop: string }> = ({ model, prop }) => (
  <IconButton
    size="small"
    sx={{
      position: "absolute",
      right: "1px",
      top: "1px",
      // transform: "translateY(-50%)",
      color: "#AAA",
      width: "12px",
      height: "12px",
    }}
    onClick={(e) => {
      e.stopPropagation();
      beanTabStore.revertCell(model.account, model.currency, prop);
    }}
    title="Revert this cell"
  >
    <RestoreIcon fontSize="inherit" />
  </IconButton>
);

type BalanceCellProps = (ColumnDataSchemaModel | ColumnTemplateProp) & {
  addition?: {
    balanceErrorKeys?: Set<string>;
    balanceErrorMessages?: Record<string, string>;
    estimatedCellValues?: Record<string, number>;
    balanceSources?: Record<string, { filename: string; lineno: number }>;
  };
};

const BALANCE_SOURCE_TOOLTIP_ENTER_DELAY_MS = 1000;

type BalanceSourceTooltipProps = {
  source?: { filename: string; lineno: number };
  children: React.ReactNode;
};

const BalanceSourceTooltip: React.FC<BalanceSourceTooltipProps> = ({ source, children }) => {
  if (!source?.filename || source.lineno == null) return <>{children}</>;
  const editorUrl = buildEditorUrl(source.filename, source.lineno);
  const label = `${source.filename}:${source.lineno}`;
  return (
    <Tooltip
      arrow
      enterDelay={BALANCE_SOURCE_TOOLTIP_ENTER_DELAY_MS}
      enterNextDelay={BALANCE_SOURCE_TOOLTIP_ENTER_DELAY_MS}
      leaveDelay={400}
      slotProps={{ popper: { sx: { pointerEvents: "auto" } } }}
      title={
        <Box sx={{ p: 0.5, maxWidth: 420 }}>
          <Link
            href={editorUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontSize: "0.75rem", wordBreak: "break-all" }}
            onClick={(e) => e.stopPropagation()}
          >
            {label}
          </Link>
        </Box>
      }
    >
      <Box component="span" sx={{ display: "inline-flex", width: "100%", height: "100%", alignItems: "center" }}>
        {children}
      </Box>
    </Tooltip>
  );
};

const BalanceCell: React.FC<BalanceCellProps> = (props) => {
  const balanceErrorKeys = props.addition?.balanceErrorKeys ?? new Set<string>();
  const balanceErrorMessages = props.addition?.balanceErrorMessages ?? {};
  const estimatedCellValues = props.addition?.estimatedCellValues ?? {};
  const balanceSources = props.addition?.balanceSources ?? {};
  if (!("model" in props) || !("prop" in props)) return null;

  const rawValue = props.model?.[props.prop];
  const parsed = BeanTabStore.parseBalanceType(rawValue);
  const value =
    typeof parsed.value === "number"
      ? parsed.value
      : Number.parseFloat(String(parsed.value));
  const balanceTypeKey = parsed.balanceType;

  const propKey = String(props.prop);
  const sourceKey =
    props.model?.account && props.model?.currency
      ? `${props.model.account}|${props.model.currency}|${propKey}`
      : "";
  const balanceSource = sourceKey ? balanceSources[sourceKey] : undefined;
  const errorKey = sourceKey;
  const hasModified =
    props.model?.account &&
    props.model?.currency &&
    beanTabStore.isModifiedCell(props.model.account, props.model.currency, propKey);
  const isEstimated = !!errorKey && errorKey in estimatedCellValues && !hasModified;

  let valueNode: React.ReactNode;
  if (Number.isNaN(value)) {
    valueNode = <span>·</span>;
  } else {
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));
    valueNode = (
      <span
        style={{
          color: isEstimated ? "rgba(128, 128, 128, 0.4)" : (value >= 0 ? BALANCE_COLOR_POSITIVE : BALANCE_COLOR_NEGATIVE),
          fontWeight: isEstimated ? "normal" : "bold",
        }}
      >
        {value >= 0 ? formatted : `(${formatted})`}
      </span>
    );
  }

  const badge = balanceTypeKey ? (
    <BalanceTypeChip balanceType={balanceTypeKey} />
  ) : null;

  const content = badge ? (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      {valueNode}
      {badge}
    </span>
  ) : (
    valueNode
  );

  const hasBalanceError = !!errorKey && balanceErrorKeys.has(errorKey);
  const balanceErrorMessage = errorKey ? balanceErrorMessages[errorKey] : undefined;

  const cellWrapperStyle: React.CSSProperties = {
    height: "100%",
    width: "100%",
    paddingLeft: hasBalanceError ? "4px" : "5px",
    paddingRight: hasModified ? "15px" : "5px",
    position: "relative",
    display: "flex",
    alignItems: "center",
    ...(hasModified ? { border: "3px dotted #AAA" } : {}),
  };

  const errorIndicator = hasBalanceError ? (
    <Tooltip title={balanceErrorMessage ?? "Balance check failed"}>
      <Button
        disableRipple
        disableFocusRipple
        sx={{
          minWidth: 3,
          width: 3,
          height: "80%",
          marginRight: 1,
          flexShrink: 0,
          backgroundColor: BALANCE_COLOR_NEGATIVE,
          "&:hover": { backgroundColor: BALANCE_COLOR_NEGATIVE, opacity: 0.9 },
          padding: 0,
        }}
        aria-label="Balance error"
      />
    </Tooltip>
  ) : null;

  if (!hasModified) {
    if (!hasBalanceError) {
      return <BalanceSourceTooltip source={balanceSource}>{content}</BalanceSourceTooltip>;
    }
    return (
      <BalanceSourceTooltip source={balanceSource}>
        <div style={cellWrapperStyle}>
          {errorIndicator}
          {content}
        </div>
      </BalanceSourceTooltip>
    );
  }

  return (
    <BalanceSourceTooltip source={balanceSource}>
      <div style={cellWrapperStyle}>
        {errorIndicator}
        {content}
        <RevertButton model={props.model} prop={propKey} />
      </div>
    </BalanceSourceTooltip>
  );
};

const BeanTabGrid: React.FC<BeanTabGridProps> = ({
  balancesData,
  isLoading,
  error,
  accountsFilter,
  additionalDates,
  sortedDates,
  showDeltas = false,
  transactions = [],
  convertedTransactions,
  conversionCurrency,
  groupByAccount = true,
  hideDatesWithLessThanEntries = 0,
  hideAccountsWithNoEntries = false,
  showEstimatedBalances = true,
  invertSign = false,
  sortingConfig,
  onSortingChange,
  onFilterStatsChange,
  onAccountClick,
}) => {
  let transformedData: GridRow[] = [];
  let emptyAccountsCount = 0;
  let columns: (ColumnRegular | ColumnGrouping)[] = [];
  let estimatedCellValues: Record<string, number> = {};
  const { balanceErrorKeys, balanceErrorMessages } = useMemo(() => {
    const errors = balancesData?.balanceErrors ?? [];
    const keys = new Set(errors.map((e) => `${e.account}|${e.currency}|${e.date}`));
    const messages: Record<string, string> = {};
    for (const e of errors) {
      const key = `${e.account}|${e.currency}|${e.date}`;
      if (!(key in messages)) messages[key] = e.message;
    }
    return { balanceErrorKeys: keys, balanceErrorMessages: messages };
  }, [balancesData?.balanceErrors]);

  const balanceSources = useMemo(() => {
    const map: Record<string, { filename: string; lineno: number }> = {};
    for (const b of balancesData?.balances ?? []) {
      if (b.filename && b.lineno != null) {
        map[`${b.account}|${b.currency}|${b.date}`] = {
          filename: b.filename,
          lineno: b.lineno,
        };
      }
    }
    return map;
  }, [balancesData?.balances]);

  const { effectiveDates, hiddenDatesCount } = useMemo(() => {
    if (!balancesData) return { effectiveDates: [] as string[], hiddenDatesCount: 0 };
    const { balances } = balancesData;
    const filtered =
      accountsFilter && accountsFilter.length > 0
        ? balances.filter((b) => accountsFilter.some((re) => re.test(b.account)))
        : balances;
    const { showDates, hideDates } = splitAdditionalDates(additionalDates ?? []);
    const additionalShowDatesSet = new Set(showDates);
    const hideDatesSet = new Set(hideDates);
    const accountsByDate = new Map<string, Set<string>>();
    for (const b of filtered) {
      if (b.number === null || b.number === undefined) continue;
      let s = accountsByDate.get(b.date);
      if (!s) {
        s = new Set<string>();
        accountsByDate.set(b.date, s);
      }
      s.add(b.account);
    }
    const candidateDates = sortedDates.filter((date) => !hideDatesSet.has(date));
    const effective =
      hideDatesWithLessThanEntries <= 0
        ? candidateDates
        : sortedDates.filter((date) => {
            if (hideDatesSet.has(date)) return false;
            if (additionalShowDatesSet.has(date)) return true;
            const entryCount = accountsByDate.get(date)?.size ?? 0;
            return entryCount >= hideDatesWithLessThanEntries;
          });
    const hiddenDatesCount =
      hideDatesWithLessThanEntries > 0 ? candidateDates.length - effective.length : 0;
    return { effectiveDates: effective, hiddenDatesCount };
  }, [
    balancesData,
    accountsFilter,
    additionalDates,
    sortedDates,
    hideDatesWithLessThanEntries,
  ]);

  const pairedDeltasByAccount = useMemo(() => {
    if (!showDeltas || !transactions.length || effectiveDates.length === 0) {
      return {};
    }
    return computePairedDeltasByAccount(
      transactions,
      convertedTransactions?.length ? convertedTransactions : null,
      effectiveDates,
    );
  }, [showDeltas, transactions, convertedTransactions, effectiveDates]);

  const deltaBarScaleMax = useMemo(() => {
    if (!convertedTransactions?.length || !conversionCurrency || effectiveDates.length === 0) {
      return undefined;
    }
    const lastDate = effectiveDates[effectiveDates.length - 1];
    const values = convertedTransactions
      .filter((txn) => txn.date <= lastDate)
      .map(transactionAbsSum);
    return percentile95(values);
  }, [convertedTransactions, conversionCurrency, effectiveDates]);

  const { data: estimatedBalancesData } = useEstimatedBalances(effectiveDates, {
    enabled: showEstimatedBalances && !!balancesData && effectiveDates.length > 0,
  });

  const estimatedBalancesLookup = useMemo(() => {
    const list = estimatedBalancesData?.estimatedBalances ?? [];
    const lookup = new Map<string, number>();
    for (const b of list) {
      lookup.set(`${b.account}|${b.currency}|${b.date}`, b.number);
    }
    return lookup;
  }, [estimatedBalancesData?.estimatedBalances]);

  useEffect(() => {
    onFilterStatsChange?.({ emptyAccountsCount, hiddenDatesCount });
  }, [onFilterStatsChange, emptyAccountsCount, hiddenDatesCount]);

  if (balancesData) {
    const { balances, accounts } = balancesData;
    const filteredBalancesData =
      accountsFilter && accountsFilter.length > 0
        ? balances.filter((b) => accountsFilter.some((re) => re.test(b.account)))
        : balances;

    const defaultBalanceTypeByAccount = new Map(
      accounts.map((account) => [account.account, account.defaultBalanceType]),
    );

    // Group balances by (account, currency) pairs
    const groupedBalances = new Map<string, typeof balances>();
    filteredBalancesData.forEach((balance) => {
      const key = `${balance.account}|${balance.currency}`;
      if (!groupedBalances.has(key)) {
        groupedBalances.set(key, []);
      }
      groupedBalances.get(key)!.push(balance);
    });

    // Transform data for RevoGrid from balances
    transformedData = Array.from(groupedBalances.entries()).map(([key, balList]) => {
      const [account, currency] = key.split("|");
      const row: GridRow = {
        account,
        currency,
        defaultBalanceType: defaultBalanceTypeByAccount.get(account) || "",
      };

      effectiveDates.forEach((date) => {
        if (showDeltas) {
          const key = `${account}|${currency}`;
          row[`deltas-${date}`] = pairedDeltasByAccount[key]?.[date] ?? null;
        }
        const balance = balList.find((b) => b.date === date);
        if (!balance) {
          row[date] = null;
          return;
        }

        const typeKey = balance.type;
        const defaultType = defaultBalanceTypeByAccount.get(account);
        const symbol = typeKey ? BALANCE_TYPE_DISPLAY_MAPPING[typeKey]?.symbol : null;
        const shouldAnnotate = symbol && defaultType && typeKey !== defaultType;

        row[date] = shouldAnnotate ? `${balance.number}${symbol}` : balance.number;
      });

      return row;
    });

    // Extend with rows from accounts (each account × each currency) not already present
    const existingKeys = new Set(transformedData.map((r) => `${r.account}|${r.currency}`));
    for (const acc of accounts) {
      if (accountsFilter?.length && !accountsFilter.some((re) => re.test(acc.account))) continue;
      const currencies = acc.currencies ?? [];
      for (const currency of currencies) {
        const key = `${acc.account}|${currency}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        const row: GridRow = {
          account: acc.account,
          currency,
          defaultBalanceType: defaultBalanceTypeByAccount.get(acc.account) || "",
        };
        effectiveDates.forEach((date) => {
          if (showDeltas) {
            const key = `${acc.account}|${currency}`;
            row[`deltas-${date}`] = pairedDeltasByAccount[key]?.[date] ?? null;
          }
          row[date] = null;
        });
        transformedData.push(row);
      }
    }

    // Overlay estimated balances (from realization) where no asserted balance exists
    estimatedCellValues = {};
    if (showEstimatedBalances && estimatedBalancesLookup.size > 0) {
      for (const row of transformedData) {
        for (const date of effectiveDates) {
          if (row[date] === null || row[date] === undefined) {
            const key = `${row.account}|${row.currency}|${date}`;
            const est = estimatedBalancesLookup.get(key);
            if (est !== undefined) {
              row[date] = est;
              estimatedCellValues[key] = est;
            }
          }
        }
      }
    }

    // Overlay any pending edited values
    const modifiedCells = beanTabStore.getAllModifiedCells();

    const rowLookup = new Map<string, GridRow>();
    transformedData.forEach((row) => {
      rowLookup.set(`${row.account}|${row.currency}`, row);
    });

    for (const cell of modifiedCells) {
      const row = rowLookup.get(`${cell.account}|${cell.currency}`);
      if (!row) continue;
      const symbol = cell.balanceType ? BALANCE_TYPE_DISPLAY_MAPPING[cell.balanceType]?.symbol : null;
      row[cell.date] = symbol ? `${cell.newValue}${symbol}` : cell.newValue;
    }
    emptyAccountsCount = transformedData.filter(
      (row) => !gridRowHasBalanceEntry(row, effectiveDates, estimatedCellValues),
    ).length;
    if (hideAccountsWithNoEntries) {
      transformedData = transformedData.filter((row) =>
        gridRowHasBalanceEntry(row, effectiveDates, estimatedCellValues),
      );
    }

    const accountColumn = {
      prop: "account",
      name: "Account",
      size: 300,
      sortable: true,
      pin: "colPinStart" as const,
      readonly: true,
      rowDrag: false,
      autoSize: true,
      columnTemplate: Template(AccountColumnHeader),
      cellTemplate: Template((p: AccountCellProps) => <AccountCell {...p} onAccountClick={onAccountClick} />),
      ...(sortingConfig && sortingConfig.prop === "account" ? { order: sortingConfig.order } : {}),
    };

    columns = [
      accountColumn,
      {
        prop: "defaultBalanceType",
        name: "",
        size: 70,
        sortable: true,
        pin: "colPinStart" as const,
        readonly: true,
        autoSize: true,
        columnTemplate: Template(DefaultBalanceTypeHeader),
        cellTemplate: (h: any, { value }: any) => {
          const typeStr = String(value || "");
          const displayMapping = BALANCE_TYPE_DISPLAY_MAPPING[typeStr];
          const symbol = displayMapping?.symbol || "";
          const color = displayMapping?.color || "#666";
          return h(
            "span",
            {
              style: {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                color,
                fontWeight: "bold",
              },
              title: typeStr,
            },
            symbol,
          );
        },
        ...(sortingConfig && sortingConfig.prop === "defaultBalanceType" ? { order: sortingConfig.order } : {}),
      },
      {
        prop: "currency",
        // €$£¥
        name: "€$£¥",
        size: 90,
        sortable: true,
        pin: "colPinStart" as const,
        autoSize: true,
        columnTemplate: Template(CurrencyColumnHeader),
        cellTemplate: Template(CurrencyCell),
        readonly: true,
        ...(sortingConfig && sortingConfig.prop === "currency" ? { order: sortingConfig.order } : {}),
      },
      ...effectiveDates.flatMap((date, dateIndex) => {
        const prevDate = dateIndex > 0 ? effectiveDates[dateIndex - 1] : "";
        const cols: (ColumnRegular | ColumnGrouping)[] = [];
        if (showDeltas && Object.keys(pairedDeltasByAccount).length > 0) {
          const DeltaBarCellWithDate = (p: ColumnDataSchemaModel | ColumnTemplateProp) => (
            <DeltaBarCell {...p} date={date} prevDate={prevDate} />
          );
          const DeltaColumnHeaderWithDate = (p: ColumnDataSchemaModel | ColumnTemplateProp) => (
            <DeltaColumnHeader {...p} date={date} prevDate={prevDate} />
          );
          cols.push({
            prop: `deltas-${date}`,
            name: `Δ ${date}`,
            size: 240,
            sortable: false,
            readonly: true,
            columnTemplate: Template(DeltaColumnHeaderWithDate),
            cellTemplate: Template(DeltaBarCellWithDate),
          });
        }
        cols.push({
          prop: date,
          name: date,
          size: 140,
          sortable: false,
          columnTemplate: Template((p: ColumnDataSchemaModel | ColumnTemplateProp) => (
            <CalendarColumnHeader
              {...p}
              date={date}
              onHide={() => beanTabStore.hideAdditionalDate(date)}
            />
          )),
          cellTemplate: Template(BalanceCell),
        });
        return cols;
      }),
    ];
  }
  
  if (isLoading) {
    return (
      <StatusContainer>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading data...
        </Typography>
      </StatusContainer>
    );
  }

  if (error) {
    return (
      <StatusContainer>
        <Alert severity="error">
          Error loading balance data: {error.message}
        </Alert>
      </StatusContainer>
    );
  }

  if (!transformedData.length) {
    return (
      <StatusContainer>
        <Typography>No balance data found</Typography>
      </StatusContainer>
    );
  }

  const storedThemeSetting = document.documentElement.style.colorScheme;
  const isDarkMode =
    storedThemeSetting == "dark" ||
    (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches && storedThemeSetting != "light");

  return (
      <Box sx={{ position: "relative", height: "700px", width: "100%" }}>
        <Box sx={{ height: "100%", width: "100%", padding: 1 }}>
          <RevoGrid
          grouping={
            groupByAccount
              ? {
                  props: ["account"],
                  expandedAll: true,
                  preserveGroupingOnUpdate: true,
                }
              : undefined
          }
          source={transformedData}
          columns={columns}
          additionalData={{ balanceErrorKeys, balanceErrorMessages, estimatedCellValues, balanceSources, transactions, invertSign, deltaBarScaleMax, conversionCurrency }}
          hideAttribution={true}
          theme={isDarkMode ? "darkCompact" : "compact"}
          resize={true}
          canFocus={true}
          useClipboard={true}
          autoSizeColumn={true}
          rowHeaders={false}
          range={true}
          // exporting={true}
          canDrag={false}
          filter={false}
          // sorting={sortingConfig}
          onBeforesortingapply={(e: any) => {
            const detail = e?.detail;
            const prop = detail?.column?.prop;
            const order = detail?.order;
            onSortingChange?.(prop, order);
          }}
          onBeforerangeedit={(e: any) => {
            // Handles copy-paste events and range edits
            // Not sure what happens in this implementation, maybe will clean up later
            const { data, models } = e.detail as {
              data: Record<number, Record<string, unknown>>;
              models: Partial<Record<number, GridRow>>;
            };
            if (!data || !models) return;
            const readonlyProps = new Set(["account", "currency", "defaultBalanceType"]);
            for (const rowIndexStr of Object.keys(data)) {
              const rowIndex = Number(rowIndexStr);
              const model = models[rowIndex];
              if (!model?.account || !model?.currency) continue;
              const rowChanges = data[rowIndex];
              if (!rowChanges) continue;
              for (const prop of Object.keys(rowChanges)) {
                if (readonlyProps.has(prop) || String(prop).startsWith("deltas-")) continue;
                const oldVal = model[prop] ?? null;
                const newVal = rowChanges[prop] ?? null;
                const key = `${model.account}|${model.currency}|${prop}`;
                beanTabStore.addModifiedCell(
                  model.account,
                  model.currency,
                  prop,
                  oldVal as string | number | null,
                  newVal as string | number | null,
                  { originalValueIsEstimated: key in estimatedCellValues },
                );
              }
            }
          }}
          onAfteredit={(e: any) => {
            // Handles regular cell edits
            if (e?.detail?.value === undefined) return;
            const { prop, model, val, value: oldVal } = e.detail;
            
            const newValue = val ?? null;
            const key = model.account && model.currency ? `${model.account}|${model.currency}|${prop}` : "";
            const valueChanged = val?.toString()?.trim() !== oldVal?.toString()?.trim();
            const wasEstimated = !!key && key in estimatedCellValues;
            if (model.account && model.currency && (valueChanged || wasEstimated)) {
              beanTabStore.addModifiedCell(model.account, model.currency, prop, oldVal, newValue, {
                originalValueIsEstimated: wasEstimated,
              });
            }
          }}
          onAftergridinit={(e: any) => {
            e.target.scrollToColumnIndex(columns.length-1);
          }}
        />
        </Box>
      </Box>
  );
};

export default observer(BeanTabGrid);
