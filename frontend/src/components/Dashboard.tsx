import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useNavigate, useSearch } from "@tanstack/react-router";
import BeanTabGrid from "./BeanTabGrid";
import TableEditControls from "./TableEditControls";
import { AccountFilter } from "./AccountFilter";
import { AdditionalDatesInput } from "./AdditionalDatesInput";
import { useBalances } from "../api/balances";
import { HelpDialog } from "./HelpDialog";
import { SettingsDialog } from "./SettingsDialog";

function formatLocalISODate(d: Date): string {
    const yyyy = d.getFullYear().toString().padStart(4, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function getDefaultAdditionalDates(): string[] {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return [formatLocalISODate(today), formatLocalISODate(tomorrow)];
}

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
    additionalDates?: unknown;
    sortProp?: unknown;
    sortOrder?: unknown;
    groupByAccount?: unknown;
    hideDatesWithLessThanEntries?: unknown;
    hideAccountsWithNoEntries?: unknown;
};

const DEFAULT_GROUP_BY_ACCOUNT = false;
const DEFAULT_HIDE_DATES_WITH_LESS_THAN_ENTRIES = 0;
const DEFAULT_HIDE_ACCOUNTS_WITH_NO_ENTRIES = false;

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
    const {
        accountFilter,
        additionalDates: additionalDatesParam,
        sortProp,
        sortOrder,
    } = searchParams;
    const { data: balancesData, isLoading, error } = useBalances();
    const [accountFilterInput, setAccountFilterInput] = useState<string>("");
    const [additionalDatesInput, setAdditionalDatesInput] = useState<string>("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const groupByAccount = useMemo(
        () => readBooleanParam(searchParams.groupByAccount, DEFAULT_GROUP_BY_ACCOUNT),
        [searchParams.groupByAccount],
    );
    const hideDatesWithLessThanEntries = useMemo(
        () =>
            readNumberParam(
                searchParams.hideDatesWithLessThanEntries,
                DEFAULT_HIDE_DATES_WITH_LESS_THAN_ENTRIES,
            ),
        [searchParams.hideDatesWithLessThanEntries],
    );
    const hideAccountsWithNoEntries = useMemo(
        () =>
            readBooleanParam(
                searchParams.hideAccountsWithNoEntries,
                DEFAULT_HIDE_ACCOUNTS_WITH_NO_ENTRIES,
            ),
        [searchParams.hideAccountsWithNoEntries],
    );

    const defaultAdditionalDates = useMemo(() => getDefaultAdditionalDates(), []);

    // Source of truth: URL query params.
    const accountFilterPatterns = useMemo(() => {
        return readStringListValue(accountFilter);
    }, [accountFilter]);

    const additionalDates = useMemo(() => {
        if (additionalDatesParam === undefined) return defaultAdditionalDates;
        const rawDates = readStringListValue(additionalDatesParam);
        const expanded =
            rawDates.length === 1 && rawDates[0] && rawDates[0].includes(",")
                ? rawDates[0].split(",").map((v) => v.trim())
                : rawDates;
        return normalizeList(expanded).sort();
    }, [additionalDatesParam, defaultAdditionalDates]);

    const sortingConfig = {prop: sortProp, order: sortOrder};

    // Persist default additional dates into the URL so the state is shareable/bookmarkable.
    useEffect(() => {
        if (additionalDatesParam !== undefined) return;
        navigate({
            to: ".",
            search: (prev: SearchState) => ({
                ...prev,
                additionalDates: defaultAdditionalDates,
            }),
            replace: true,
        });
    }, [additionalDatesParam, navigate, defaultAdditionalDates]);

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

    const setAdditionalDates = useCallback(
        (dates: string[]) => {
            const normalized = normalizeList(dates).sort();
            navigate({
                to: ".",
                search: (prev: SearchState) => ({
                    ...prev,
                    additionalDates: normalized.length === 0 ? [] : normalized,
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
                    groupByAccount: value === DEFAULT_GROUP_BY_ACCOUNT ? undefined : value,
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
                        normalized === DEFAULT_HIDE_DATES_WITH_LESS_THAN_ENTRIES ? undefined : normalized,
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
                        value === DEFAULT_HIDE_ACCOUNTS_WITH_NO_ENTRIES ? undefined : value,
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
                                dates={additionalDates}
                                inputValue={additionalDatesInput}
                                setInputValue={setAdditionalDatesInput}
                                setDates={setAdditionalDates}
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
                        additionalDates={additionalDates}
                        groupByAccount={groupByAccount}
                        hideDatesWithLessThanEntries={hideDatesWithLessThanEntries}
                        hideAccountsWithNoEntries={hideAccountsWithNoEntries}
                        sortingConfig={sortingConfig}
                        onSortingChange={setSorting}
                    />

                    <TableEditControls />
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
            />
        </Box>
    );
};

export default observer(Dashboard);
