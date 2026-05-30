import React, { useCallback, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
    Box,
    Card,
    CardContent,
    IconButton,
    Stack,
    Tooltip,
} from "@mui/material";
import HelpOutlinedIcon from "@mui/icons-material/HelpOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import BeanTabGrid from "./BeanTabGrid";
import { beanTabStore } from "../stores/beanTabStore";
import TableEditControls from "./TableEditControls";
import { AccountFilter } from "./AccountFilter";
import { AdditionalDatesInput } from "./AdditionalDatesInput";
import { useBalances } from "../api/balances";
import { useTransactions } from "../api/transactions";
import { HelpDialog } from "./HelpDialog";
import { SettingsDialog } from "./SettingsDialog";
import { splitAdditionalDates } from "../utils/additionalDatesUtils";

function normalizeList(values: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of values) {
        const v = raw.trim();
        if (v.length === 0) continue;
        if (seen.has(v)) continue;
        seen.add(v);
        out.push(v);
    }
    return out;
}

function readStringListValue(value: unknown): string[] {
    if (Array.isArray(value)) {
        return normalizeList(value.filter((v): v is string => typeof v === "string"));
    }
    if (typeof value !== "string") return [];
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[")) {
        try {
            const parsed: unknown = JSON.parse(trimmed);
            if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
                return normalizeList(parsed);
            }
        } catch {
            // ignore parse errors; fall back to treating as plain string
        }
    }

    // For safety we don't split accountFilter (it may contain commas). For additionalDates,
    // users might have an older comma-separated format; that can be handled by the caller.
    return normalizeList([trimmed]);
}

type SearchState = Record<string, unknown>;
type SearchParams = {
    accountFilter?: unknown;
    sortProp?: string;
    sortOrder?: "asc" | "desc";
    groupByAccount?: unknown;
    hideDatesWithLessThanEntries?: unknown;
    hideAccountsWithNoEntries?: unknown;
    conversionCurrency?: unknown;
    convertTransactionsAtCost?: unknown;
    showDeltas?: unknown;
    showEstimatedBalances?: unknown;
    invertSign?: unknown;
};

const SETTINGS_DEFAULTS = {
    groupByAccount: false,
    hideDatesWithLessThanEntries: 0,
    hideAccountsWithNoEntries: false,
    convertTransactionsAtCost: true,
    showDeltas: false,
    showEstimatedBalances: true,
    invertSign: false,
} as const;

function readBooleanParam(value: unknown, fallback: boolean): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
        if (value === "true") return true;
        if (value === "false") return false;
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed)) return parsed !== 0;
    }
    return fallback;
}

function readNumberParam(value: unknown, fallback: number): number {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
    if (typeof value === "string") {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isNaN(parsed)) return Math.max(0, parsed);
    }
    return fallback;
}

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const searchParams = useSearch({ strict: false }) as SearchParams;
    const { accountFilter, sortProp, sortOrder, conversionCurrency: conversionCurrencyParam, convertTransactionsAtCost: convertTransactionsAtCostParam, showDeltas: showDeltasParam, showEstimatedBalances: showEstimatedBalancesParam, invertSign: invertSignParam } =
        searchParams;
    const { data: balancesData, isLoading, error } = useBalances();
    const [accountFilterInput, setAccountFilterInput] = useState<string>("");
    const [additionalDatesInput, setAdditionalDatesInput] = useState<string>("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [filterStats, setFilterStats] = useState<{ hiddenAccountsCount: number }>({ hiddenAccountsCount: 0 });
    const groupByAccount = useMemo(
        () => readBooleanParam(searchParams.groupByAccount, SETTINGS_DEFAULTS.groupByAccount),
        [searchParams.groupByAccount],
    );
    const hideDatesWithLessThanEntries = useMemo(
        () =>
            readNumberParam(
                searchParams.hideDatesWithLessThanEntries,
                SETTINGS_DEFAULTS.hideDatesWithLessThanEntries,
            ),
        [searchParams.hideDatesWithLessThanEntries],
    );
    const hideAccountsWithNoEntries = useMemo(
        () =>
            readBooleanParam(
                searchParams.hideAccountsWithNoEntries,
                SETTINGS_DEFAULTS.hideAccountsWithNoEntries,
            ),
        [searchParams.hideAccountsWithNoEntries],
    );

    const operatingCurrencies = balancesData?.operatingCurrencies ?? [];
    const defaultConversionCurrency = "none";

    const rawCcy = conversionCurrencyParam;
    const conversionCurrency =
        rawCcy === "none"
            ? "none"
            : typeof rawCcy === "string" && rawCcy.trim().length > 0 && operatingCurrencies.includes(rawCcy)
                ? rawCcy
                : defaultConversionCurrency;
    const conversionCurrencyForApi = conversionCurrency === "none" ? "" : conversionCurrency;

    const convertTransactionsAtCost = readBooleanParam(
        convertTransactionsAtCostParam,
        SETTINGS_DEFAULTS.convertTransactionsAtCost,
    );
    const showDeltas = readBooleanParam(showDeltasParam, SETTINGS_DEFAULTS.showDeltas);
    const showEstimatedBalances = readBooleanParam(showEstimatedBalancesParam, SETTINGS_DEFAULTS.showEstimatedBalances);
    const invertSign = readBooleanParam(invertSignParam, SETTINGS_DEFAULTS.invertSign);

    // Primary: native currency (drives delta values and transaction tooltips)
    const { data: transactionsData } = useTransactions("", {
        enabled: showDeltas,
        convertTransactionsAtCost,
    });
    // Secondary: converted currency (drives bar-width scale and converted tooltip lines)
    const { data: convertedTransactionsData } = useTransactions(conversionCurrencyForApi, {
        enabled: showDeltas && conversionCurrency !== "none",
        convertTransactionsAtCost,
    });

    // Source of truth: URL query params.
    const accountFilterPatterns = useMemo(() => {
        return readStringListValue(accountFilter);
    }, [accountFilter]);

    const sortingConfig = {
        prop: sortProp || null,
        order: sortOrder,
    };

    const setAccountFilterPatterns = useCallback(
        (patterns: string[]) => {
            const normalized = normalizeList(patterns);
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    accountFilter: normalized.length > 0 ? normalized : undefined,
                }),
                replace: true,
            });
        },
        [navigate],
    );

    const setGroupByAccount = useCallback(
        (value: boolean) => {
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    groupByAccount: value === SETTINGS_DEFAULTS.groupByAccount ? undefined : value,
                }),
                replace: true,
            });
        },
        [navigate],
    );

    const setHideDatesWithLessThanEntries = useCallback(
        (value: number) => {
            const normalized = Math.max(0, value);
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    hideDatesWithLessThanEntries:
                        normalized === SETTINGS_DEFAULTS.hideDatesWithLessThanEntries ? undefined : normalized,
                }),
                replace: true,
            });
        },
        [navigate],
    );

    const setHideAccountsWithNoEntries = useCallback(
        (value: boolean) => {
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    hideAccountsWithNoEntries:
                        value === SETTINGS_DEFAULTS.hideAccountsWithNoEntries ? undefined : value,
                }),
                replace: true,
            });
        },
        [navigate],
    );

    const handleAccountClick = useCallback(
        (account: string) => {
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    accountFilter: [account],
                    hideAccountsWithNoEntries: undefined,
                }),
                replace: false,
            });
        },
        [navigate],
    );

    const setConversionCurrency = useCallback(
        (value: string) => {
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    conversionCurrency:
                        value === "none" || (value && value !== defaultConversionCurrency)
                            ? value
                            : undefined,
                }),
                replace: true,
            });
        },
        [navigate, defaultConversionCurrency],
    );

    const setConvertTransactionsAtCost = useCallback(
        (value: boolean) => {
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    convertTransactionsAtCost:
                        value === SETTINGS_DEFAULTS.convertTransactionsAtCost ? undefined : value,
                }),
                replace: true,
            });
        },
        [navigate],
    );

    const setShowDeltas = useCallback(
        (value: boolean) => {
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    showDeltas: value === SETTINGS_DEFAULTS.showDeltas ? undefined : value,
                }),
                replace: true,
            });
        },
        [navigate],
    );

    const setShowEstimatedBalances = useCallback(
        (value: boolean) => {
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    showEstimatedBalances: value === SETTINGS_DEFAULTS.showEstimatedBalances ? undefined : value,
                }),
                replace: true,
            });
        },
        [navigate],
    );

    const setInvertSign = useCallback(
        (value: boolean) => {
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    invertSign: value === SETTINGS_DEFAULTS.invertSign ? undefined : value,
                }),
                replace: true,
            });
        },
        [navigate],
    );

    const setSorting = useCallback(
        (prop: string | null, order?: "asc" | "desc") => {
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    sortProp: prop ? prop : undefined,
                    sortOrder: order ? order : undefined,
                }),
                replace: true,
            });
        },
        [navigate],
    );

    const accountOptions = useMemo(() => {
        if (!balancesData) return [];
        return balancesData.accounts.map((a) => a.account).sort();
    }, [balancesData]);

    const compiledAccountRegexes = useMemo(() => {
        const items = accountFilterPatterns
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

        const compiled = items.map((pattern) => {
            try {
                return { pattern, regex: new RegExp(pattern), error: null as string | null };
            } catch (e) {
                return {
                    pattern,
                    regex: null as RegExp | null,
                    error: e instanceof Error ? e.message : "Invalid regular expression",
                };
            }
        });

        const valid = compiled.flatMap((c) => (c.regex ? [c.regex] : []));
        const invalid = compiled.filter((c) => !c.regex);
        return { compiled, valid, invalid };
    }, [accountFilterPatterns]);

    const sortedDates = (() => {
        if (!balancesData) return [];
        const { balances } = balancesData;
        const filtered =
            compiledAccountRegexes.valid?.length > 0
                ? balances.filter((b) =>
                      compiledAccountRegexes.valid.some((re) => re.test(b.account)),
                  )
                : balances;
        const { showDates, hideDates } = splitAdditionalDates(beanTabStore.additionalDates ?? []);
        const hideDatesSet = new Set(hideDates);
        const allDates = new Set<string>();
        filtered.forEach((b) => allDates.add(b.date));
        beanTabStore.getAllModifiedCells().forEach((c) => allDates.add(c.date));
        showDates.forEach((d) => allDates.add(d));
        return Array.from(allDates)
            .filter((d) => !hideDatesSet.has(d))
            .sort();
    })();

    return (
        <Box>
            <Card>
                <CardContent sx={{ padding: 0 }}>
                    <Stack
                        sx={{ p: 1, verticalAlign: 'middle' }}
                        direction="row"
                        spacing={1}
                        alignItems="flex-start"
                        flexWrap="wrap"
                    >
                        <Box sx={{ flex: "0 0 60%", minWidth: 220 }}>
                            <AccountFilter
                                accountOptions={accountOptions}
                                patterns={accountFilterPatterns}
                                inputValue={accountFilterInput}
                                setInputValue={setAccountFilterInput}
                                setPatterns={setAccountFilterPatterns}
                                compiledAccountRegexes={{
                                    valid: compiledAccountRegexes.valid,
                                    invalid: compiledAccountRegexes.invalid.map((i) => ({
                                        pattern: i.pattern,
                                        error: i.error ?? "Invalid regular expression",
                                    })),
                                }}
                            />
                        </Box>
                        <Box sx={{ flex: "1 1 0", minWidth: 260 }}>
                            <AdditionalDatesInput
                                dates={beanTabStore.additionalDates}
                                inputValue={additionalDatesInput}
                                setInputValue={setAdditionalDatesInput}
                                setDates={(dates) => beanTabStore.setAdditionalDates(dates)}
                            />
                        </Box>
                        <Stack direction="row" spacing={0} sx={{ pt: 0.75 }} alignItems="center">
                            <Tooltip title="Help">
                                <IconButton
                                    aria-label="Help"
                                    size="small"
                                    onClick={() => setHelpOpen(true)}
                                >
                                    <HelpOutlinedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Settings">
                                <IconButton
                                    aria-label="Settings"
                                    size="small"
                                    onClick={() => setSettingsOpen(true)}
                                >
                                    <SettingsOutlinedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    </Stack>

                    <BeanTabGrid
                        balancesData={balancesData}
                        isLoading={isLoading}
                        error={error}
                        accountsFilter={compiledAccountRegexes.valid}
                        additionalDates={beanTabStore.additionalDates}
                        sortedDates={sortedDates}
                        showDeltas={showDeltas}
                        showEstimatedBalances={showEstimatedBalances}
                        transactions={transactionsData?.transactions}
                        convertedTransactions={convertedTransactionsData?.transactions}
                        conversionCurrency={conversionCurrency !== "none" ? conversionCurrency : undefined}
                        groupByAccount={groupByAccount}
                        hideDatesWithLessThanEntries={hideDatesWithLessThanEntries}
                        hideAccountsWithNoEntries={hideAccountsWithNoEntries}
                        invertSign={invertSign}
                        sortingConfig={sortingConfig}
                        onSortingChange={setSorting}
                        onFilterStatsChange={(stats) =>
                            setFilterStats((prev) =>
                                prev.hiddenAccountsCount === stats.hiddenAccountsCount ? prev : stats,
                            )
                        }
                        onAccountClick={handleAccountClick}
                    />

                    <TableEditControls
                      showDeltas={showDeltas}
                      onToggleShowDeltas={() => setShowDeltas(!showDeltas)}
                      hiddenAccountsCount={filterStats.hiddenAccountsCount}
                      hideAccountsWithNoEntries={hideAccountsWithNoEntries}
                      onToggleHideAccountsWithNoEntries={() =>
                        setHideAccountsWithNoEntries(!hideAccountsWithNoEntries)
                      }
                      conversionCurrency={conversionCurrency}
                      setConversionCurrency={setConversionCurrency}
                      operatingCurrencies={operatingCurrencies}
                    />
                </CardContent>
            </Card>

            <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
            <SettingsDialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                groupByAccount={groupByAccount}
                setGroupByAccount={setGroupByAccount}
                hideDatesWithLessThanEntries={hideDatesWithLessThanEntries}
                setHideDatesWithLessThanEntries={setHideDatesWithLessThanEntries}
                hideAccountsWithNoEntries={hideAccountsWithNoEntries}
                setHideAccountsWithNoEntries={setHideAccountsWithNoEntries}
                conversionCurrency={conversionCurrency}
                setConversionCurrency={setConversionCurrency}
                convertTransactionsAtCost={convertTransactionsAtCost}
                setConvertTransactionsAtCost={setConvertTransactionsAtCost}
                operatingCurrencies={operatingCurrencies}
                showDeltas={showDeltas}
                setShowDeltas={setShowDeltas}
                showEstimatedBalances={showEstimatedBalances}
                setShowEstimatedBalances={setShowEstimatedBalances}
                invertSign={invertSign}
                setInvertSign={setInvertSign}
            />
        </Box>
    );
};

export default observer(Dashboard);
