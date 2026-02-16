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
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TuneIcon from "@mui/icons-material/Tune";
import RestoreIcon from "@mui/icons-material/Restore";
import type { BalancesData } from "../api/balances";
import { BALANCE_TYPE_DISPLAY_MAPPING } from "../constants/balanceTypes";
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
  groupByAccount?: boolean;
  hideDatesWithLessThanEntries?: number;
  hideAccountsWithNoEntries?: boolean;
  sortingConfig?: { prop: string | null, order: "asc" | "desc" | undefined };
  onSortingChange?: (prop: string | null, order?: "asc" | "desc") => void;
}

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
  };
};

const BalanceCell: React.FC<BalanceCellProps> = (props) => {
  const balanceErrorKeys = props.addition?.balanceErrorKeys ?? new Set<string>();
  const balanceErrorMessages = props.addition?.balanceErrorMessages ?? {};
  if (!("model" in props) || !("prop" in props)) return null;

  const rawValue = props.model?.[props.prop];
  const parsed = BeanTabStore.parseBalanceType(rawValue);
  const value =
    typeof parsed.value === "number"
      ? parsed.value
      : Number.parseFloat(String(parsed.value));
  const balanceTypeKey = parsed.balanceType;

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
          color: value >= 0 ? "#2e7d32" : "#d32f2f",
          fontWeight: "bold",
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

  const propKey = String(props.prop);
  const errorKey = props.model?.account && props.model?.currency
    ? `${props.model.account}|${props.model.currency}|${propKey}`
    : "";
  const hasBalanceError = !!errorKey && balanceErrorKeys.has(errorKey);
  const balanceErrorMessage = errorKey ? balanceErrorMessages[errorKey] : undefined;
  const hasModified =
    props.model?.account &&
    props.model?.currency &&
    beanTabStore.isModifiedCell(props.model.account, props.model.currency, propKey);

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
  groupByAccount = true,
  hideDatesWithLessThanEntries = 0,
  hideAccountsWithNoEntries = false,
  sortingConfig,
  onSortingChange,
}) => {
  let transformedData: GridRow[] = [];
  let columns: (ColumnRegular | ColumnGrouping)[] = [];
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

  if (balancesData) {
    const { balances, accounts } = balancesData;
    const additionalDatesSet = new Set(
      (additionalDates ?? []).map((d) => d.trim()).filter((d) => d.length > 0),
    );

    const filteredBalancesData =
      accountsFilter && accountsFilter.length > 0
        ? balances.filter((b) => accountsFilter.some((re) => re.test(b.account)))
        : balances;

    // Collect all unique dates and sort them
    const allDates = new Set<string>();
    filteredBalancesData.forEach((balance) => {
      allDates.add(balance.date);
    });
    beanTabStore.getAllModifiedCells().forEach((cell) => {
      allDates.add(cell.date);
    });
    additionalDatesSet.forEach((d) => allDates.add(d));
    const sortedDates = Array.from(allDates).sort();

    // Compute number of distinct accounts with a value per date (dedupe currencies)
    const accountsByDate = new Map<string, Set<string>>();
    for (const b of filteredBalancesData) {
      if (b.number === null || b.number === undefined) continue;
      let s = accountsByDate.get(b.date);
      if (!s) {
        s = new Set<string>();
        accountsByDate.set(b.date, s);
      }
      s.add(b.account);
    }

    const effectiveDates =
      hideDatesWithLessThanEntries <= 0
        ? sortedDates
        : sortedDates.filter((date) => {
            if (additionalDatesSet.has(date)) return true;
            const entryCount = accountsByDate.get(date)?.size ?? 0;
            return entryCount >= hideDatesWithLessThanEntries;
          });

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

    // Transform data for RevoGrid
    transformedData = Array.from(groupedBalances.entries()).map(([key, balances]) => {
      const [account, currency] = key.split("|");
      const row: GridRow = {
        account,
        currency,
        defaultBalanceType: defaultBalanceTypeByAccount.get(account) || "",
      };

      effectiveDates.forEach((date) => {
        const balance = balances.find((b) => b.date === date);
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
        effectiveDates.some((date) => row[date] !== null && row[date] !== undefined),
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
      ...effectiveDates.map((date) => ({
        prop: date,
        name: date,
        size: 140,
        sortable: false,
        // columnType: "number",
        columnTemplate: Template(CalendarColumnHeader),
        cellTemplate: Template(BalanceCell),
      })),
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
          additionalData={{ balanceErrorKeys, balanceErrorMessages }}
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
                if (readonlyProps.has(prop)) continue;
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
