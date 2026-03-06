import React, { useMemo } from "react";
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
import RestoreIcon from "@mui/icons-material/Restore";
import { amber, blue, blueGrey, brown, cyan, green, lime, orange, pink, red, teal } from "@mui/material/colors";
import type { BalancesData } from "../api/balances";
import { useEstimatedBalances } from "../api/estimatedBalances";
import type { Transaction } from "../api/transactions";
import { BALANCE_TYPE_DISPLAY_MAPPING } from "../constants/balanceTypes";
import type { AccountDelta } from "../types/deltas";
import { BalanceTypeChip } from "./BalanceTypeChip";
import {
  getColorFromHashString,
  getCurrencyColor,
  getCurrencyDisplayLabel,
} from "../utils/currencyDisplayUtils";
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
  groupByAccount?: boolean;
  hideDatesWithLessThanEntries?: number;
  hideAccountsWithNoEntries?: boolean;
  showEstimatedBalances?: boolean;
  invertSign?: boolean;
  sortingConfig?: { prop: string | null, order: "asc" | "desc" | undefined };
  onSortingChange?: (prop: string | null, order?: "asc" | "desc") => void;
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

function computeDeltasByAccount(
  transactions: Transaction[],
  sortedDates: string[],
): Record<string, Record<string, AccountDelta>> {
  const deltasByAccount: Record<string, Record<string, AccountDelta>> = {};

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    const prevDate = i > 0 ? sortedDates[i - 1] : "";

    for (const txn of transactions) {
      const txnDate = txn.date;
      const inRange =
        (prevDate === "" || txnDate > prevDate) && txnDate <= date;
      if (!inRange) continue;

      const byAccountAndCurrency = new Map<string, { account: string; amount: number }>();
      for (const p of txn.postings) {
        const key = `${p.account}|${p.units.currency}`;
        const current = byAccountAndCurrency.get(key);
        const amount = p.units.number;
        if (current) {
          byAccountAndCurrency.set(key, { account: p.account, amount: current.amount + amount });
        } else {
          byAccountAndCurrency.set(key, { account: p.account, amount });
        }
      }

      for (const [key] of byAccountAndCurrency) {
        if (!deltasByAccount[key]) {
          deltasByAccount[key] = {};
        }
        if (!deltasByAccount[key][date]) {
          deltasByAccount[key][date] = createEmptyAccountDelta();
        }
        const keyCurrency = key.split("|")[1];
        const isPadTxn = txn.narration?.includes(PADDING_NARRATION) ?? false;
        for (const [otherKey, other] of byAccountAndCurrency) {
          const otherCurrency = otherKey.split("|")[1];
          if (otherKey !== key && otherCurrency === keyCurrency) {
            if (isPadTxn) {
              const d = deltasByAccount[key][date];
              if (other.amount >= 0) {
                d.padPositive += other.amount;
              } else {
                d.padNegative += other.amount;
              }
            } else {
              addToDelta(deltasByAccount[key][date], other.account, other.amount);
            }
          }
        }
      }
    }
  }
  return deltasByAccount;
}

function addDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function buildJournalUrl(account: string, date: string, prevDate: string): string {
  const basePath = window.location.pathname.replace(/\/extension\/[^/]+(\/.*)?$/, "") || "/";
  const timeFilter =
    prevDate === ""
      ? `1000-01-01 to ${date}`
      : `${addDay(prevDate)} to ${date}`;
  const params = new URLSearchParams();
  params.set("account", account);
  params.set("time", timeFilter);
  return `${window.location.origin}${basePath}/journal?${params}`;
}

function buildExpensesDashboardUrl(date: string, prevDate: string): string {
  const basePath = window.location.pathname.replace(/\/extension\/[^/]+(\/.*)?$/, "") || "/";
  const timeFilter =
    prevDate === ""
      ? `1000-01-01 to ${date}`
      : `${addDay(prevDate)} to ${date}`;
  const params = new URLSearchParams();
  params.set("dashboard", "expenses-detailed");
  params.set("time", timeFilter);
  return `${window.location.origin}${basePath}/extension/FavaDashboards/?${params}`;
}

const DELTA_KEY_LABEL: Record<keyof AccountDelta, string> = {
  assetsPositive: "Assets (Transfers Out)",
  assetsNegative: "Assets (Transfers In)",
  liabilitiesPositive: "Liabilities (Transfers Out)",
  liabilitiesNegative: "Liabilities (Transfers In)",
  expensesPositive: "Expenses",
  expensesNegative: "Expenses (Negative)",
  incomePositive: "Income (Positive)",
  incomeNegative: "Income",
  padPositive: "Padding (Positive)",
  padNegative: "Padding (Negative)",
};

const DELTA_NEGATIVE: { key: keyof AccountDelta; color: string; textColor: string }[] = [
  { key: "assetsNegative", color: blue[300], textColor: blue[700] },
  { key: "liabilitiesNegative", color: teal[300], textColor: teal[700] },
  { key: "expensesNegative", color: lime[200], textColor: lime[700] },
  { key: "incomeNegative", color: green[300], textColor: green[700] },
  { key: "padNegative", color: pink[300], textColor: pink[700] },
];

const DELTA_POSITIVE: { key: keyof AccountDelta; color: string; textColor: string }[] = [
  { key: "assetsPositive", color: blue[600], textColor: blue[900] },
  { key: "liabilitiesPositive", color: teal[500], textColor: teal[900] },
  { key: "expensesPositive", color: lime[600], textColor: lime[900] },
  { key: "incomePositive", color: green[600], textColor: green[900] },
  { key: "padPositive", color: pink[600], textColor: pink[900] },
];

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

const PADDING_NARRATION = "Padding";

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
  journalUrl?: string;
  account?: string;
  date?: string;
  prevDate?: string;
  transactions?: Transaction[];
  invertSign?: boolean;
}> = ({ delta, segments, total, maxSum, direction, currency, journalUrl, account = "", date: periodDate = "", prevDate = "", transactions = [], invertSign = false }) => {
  if (total <= 0) return null;
  const barWidthPct = (total / maxSum) * 100;
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
          if (val === 0) return null;
          const pct = (Math.abs(val) / total) * 100;
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
          const tooltipContent = (
            <Box sx={{ p: 0.5, maxWidth: 450, maxHeight: 360, overflow: "auto" }}>
              <Typography variant="caption" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                {DELTA_KEY_LABEL[key]}: {displayVal.toFixed(2)}
                {currency ? ` ${currency}` : ""}
              </Typography>
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
              {journalUrl && (
                <Link
                  href={journalUrl}
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
  addition?: { transactions?: Transaction[]; invertSign?: boolean };
};

const DeltaBarCell: React.FC<DeltaBarCellProps> = (props) => {
  const delta = props.value as AccountDelta;
  if (!delta) return null;

  const model = props.model as { account?: string; currency?: string } | undefined;
  const account = model?.account ?? "";
  const currency = model?.currency ?? "";
  const date = props.date ?? "";
  const prevDate = props.prevDate ?? "";
  const transactions = props.addition?.transactions ?? [];
  const invertSign = props.addition?.invertSign ?? false;
  const journalUrl =
    account && date ? buildJournalUrl(account, date, prevDate) : undefined;

  const totalNeg = DELTA_NEGATIVE.reduce((sum, { key }) => sum + Math.abs(delta[key]), 0);
  const totalPos = DELTA_POSITIVE.reduce((sum, { key }) => sum + Math.abs(delta[key]), 0);
  const maxSum = Math.max(totalNeg, totalPos, 1);
  if (totalNeg <= 0 && totalPos <= 0) return null;

  const segmentProps = {
    account,
    date,
    prevDate,
    transactions,
    currency,
    journalUrl,
    invertSign,
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
              return (
                <div key={key}>
                  {DELTA_KEY_LABEL[key]}: {displayVal.toFixed(2)}
                  {currency ? ` ${currency}` : ""}
                </div>
              );
            })}
          </Box>
        }
      >
        <Divider orientation="vertical" flexItem sx={{ height: "80%", alignSelf: "center", mx: 1 }} />
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

const CalendarColumnHeader: React.FC<ColumnDataSchemaModel | ColumnTemplateProp> = (props) => {
  const label = "name" in props ? props.name : "";
  return (
    <IconColumnHeader
      icon={<CalendarTodayIcon style={{ fontSize: "14px" }} />}
      label={label}
    />
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

/** Base path for the current Fava ledger (e.g. /main). Used to build links to account pages. */
function getBeancountBasePath(): string {
  const segment = location.pathname.split("/")[1];
  return segment ? `/${segment}` : "";
}

const AccountCell: React.FC<ColumnDataSchemaModel | ColumnTemplateProp> = ({ value }) => {
  const accountName = value != null ? String(value) : "";
  const iconColor = getColorFromHashString(accountName);
  const accountHref = accountName
    ? `${getBeancountBasePath()}/account/${accountName}/`
    : "";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <AccountBalanceWalletIcon style={{ fontSize: "14px", color: iconColor }} />
      {accountHref ? (
        <a
          href={accountHref}
          onClick={(e) => e.stopPropagation()}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          {value}
        </a>
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
    estimatedCellKeys?: Set<string>;
  };
};

const BalanceCell: React.FC<BalanceCellProps> = (props) => {
  const balanceErrorKeys = props.addition?.balanceErrorKeys ?? new Set<string>();
  const balanceErrorMessages = props.addition?.balanceErrorMessages ?? {};
  const estimatedCellKeys = props.addition?.estimatedCellKeys ?? new Set<string>();
  if (!("model" in props) || !("prop" in props)) return null;

  const rawValue = props.model?.[props.prop];
  const parsed = BeanTabStore.parseBalanceType(rawValue);
  const value =
    typeof parsed.value === "number"
      ? parsed.value
      : Number.parseFloat(String(parsed.value));
  const balanceTypeKey = parsed.balanceType;

  const propKey = String(props.prop);
  const errorKey = props.model?.account && props.model?.currency
    ? `${props.model.account}|${props.model.currency}|${propKey}`
    : "";
  const hasModified =
    props.model?.account &&
    props.model?.currency &&
    beanTabStore.isModifiedCell(props.model.account, props.model.currency, propKey);
  const isEstimated = !!errorKey && estimatedCellKeys.has(errorKey) && !hasModified;

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
          color: isEstimated ? "rgba(128, 128, 128, 0.4)" : (value >= 0 ? "#2e7d32" : "#d32f2f"),
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
          backgroundColor: "#d32f2f",
          "&:hover": { backgroundColor: "#b71c1c" },
          padding: 0,
        }}
        aria-label="Balance error"
      />
    </Tooltip>
  ) : null;

  if (!hasModified) {
    if (!hasBalanceError) return content;
    return (
      <div style={cellWrapperStyle}>
        {errorIndicator}
        {content}
      </div>
    );
  }

  return (
    <div style={cellWrapperStyle}>
      {errorIndicator}
      {content}
      <RevertButton model={props.model} prop={propKey} />
    </div>
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
  groupByAccount = true,
  hideDatesWithLessThanEntries = 0,
  hideAccountsWithNoEntries = false,
  showEstimatedBalances = true,
  invertSign = false,
  sortingConfig,
  onSortingChange,
}) => {
  let transformedData: GridRow[] = [];
  let columns: (ColumnRegular | ColumnGrouping)[] = [];
  let usedEstimatedKeys = new Set<string>();
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

  const effectiveDates = useMemo(() => {
    if (!balancesData) return [];
    const { balances } = balancesData;
    const filtered =
      accountsFilter && accountsFilter.length > 0
        ? balances.filter((b) => accountsFilter.some((re) => re.test(b.account)))
        : balances;
    const additionalDatesSet = new Set(
      (additionalDates ?? []).map((d) => d.trim()).filter((d) => d.length > 0),
    );
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
    return hideDatesWithLessThanEntries <= 0
      ? sortedDates
      : sortedDates.filter((date) => {
          if (additionalDatesSet.has(date)) return true;
          const entryCount = accountsByDate.get(date)?.size ?? 0;
          return entryCount >= hideDatesWithLessThanEntries;
        });
  }, [
    balancesData,
    accountsFilter,
    additionalDates,
    sortedDates,
    hideDatesWithLessThanEntries,
  ]);

  const deltasByAccount = useMemo(() => {
    if (!showDeltas || !transactions.length || effectiveDates.length === 0) {
      return {};
    }
    return computeDeltasByAccount(transactions, effectiveDates);
  }, [showDeltas, transactions, effectiveDates]);

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
        if (showDeltas && deltasByAccount) {
          const key = `${account}|${currency}`;
          row[`deltas-${date}`] = deltasByAccount[key]?.[date] ?? null;
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
          if (showDeltas && deltasByAccount) {
            const key = `${acc.account}|${currency}`;
            row[`deltas-${date}`] = deltasByAccount[key]?.[date] ?? null;
          }
          row[date] = null;
        });
        transformedData.push(row);
      }
    }

    // Overlay estimated balances (from realization) where no asserted balance exists
    usedEstimatedKeys.clear();
    if (showEstimatedBalances && estimatedBalancesLookup.size > 0) {
      for (const row of transformedData) {
        for (const date of effectiveDates) {
          if (row[date] === null || row[date] === undefined) {
            const key = `${row.account}|${row.currency}|${date}`;
            const est = estimatedBalancesLookup.get(key);
            if (est !== undefined) {
              row[date] = est;
              usedEstimatedKeys.add(key);
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
    if (hideAccountsWithNoEntries) {
      transformedData = transformedData.filter((row) =>
        effectiveDates.some((date) => {
          const val = row[date];
          if (val === null || val === undefined) return false;
          const key = `${row.account}|${row.currency}|${date}`;
          if (usedEstimatedKeys.has(key)) return false; // estimated doesn't count as "entry"
          return true; // actual Balance directive
        }),
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
      cellTemplate: Template(AccountCell),
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
        if (showDeltas && deltasByAccount) {
          const DeltaBarCellWithDate = (p: ColumnDataSchemaModel | ColumnTemplateProp) => (
            <DeltaBarCell {...p} date={date} prevDate={prevDate} />
          );
          const DeltaColumnHeaderWithDate = (p: ColumnDataSchemaModel | ColumnTemplateProp) => (
            <DeltaColumnHeader {...p} date={date} prevDate={prevDate} />
          );
          cols.push({
            prop: `deltas-${date}`,
            name: `Δ ${date}`,
            size: 180,
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
          columnTemplate: Template(CalendarColumnHeader),
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
          additionalData={{ balanceErrorKeys, balanceErrorMessages, estimatedCellKeys: usedEstimatedKeys, transactions, invertSign }}
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
                beanTabStore.addModifiedCell(
                  model.account,
                  model.currency,
                  prop,
                  oldVal as string | number | null,
                  newVal as string | number | null,
                );
              }
            }
          }}
          onAfteredit={(e: any) => {
            // Handles regular cell edits
            if (e?.detail?.value === undefined) return;
            const { prop, model, val, value: oldVal } = e.detail;
            
            const newValue = val ?? null;
            if (val?.toString()?.trim() !== oldVal?.toString()?.trim() && model.account && model.currency) {
              beanTabStore.addModifiedCell(model.account, model.currency, prop, oldVal, newValue);
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
