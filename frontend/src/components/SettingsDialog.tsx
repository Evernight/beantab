import React from "react";
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    List,
    ListItem,
    ListItemText,
    Typography,
} from "@mui/material";

export type SettingsDialogProps = Readonly<{
    open: boolean;
    onClose: () => void;
    groupByAccount: boolean;
    setGroupByAccount: (value: boolean) => void;
    hideDatesWithLessThanEntries: number;
    setHideDatesWithLessThanEntries: (value: number) => void;
    hideAccountsWithNoEntries: boolean;
    setHideAccountsWithNoEntries: (value: boolean) => void;
    conversionCurrency: string;
    setConversionCurrency: (value: string) => void;
    convertTransactionsAtCost: boolean;
    setConvertTransactionsAtCost: (value: boolean) => void;
    operatingCurrencies: string[];
    showDeltas: boolean;
    setShowDeltas: (value: boolean) => void;
    showEstimatedBalances: boolean;
    setShowEstimatedBalances: (value: boolean) => void;
    invertSign: boolean;
    setInvertSign: (value: boolean) => void;
}>;

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
    open,
    onClose,
    groupByAccount,
    setGroupByAccount,
    hideDatesWithLessThanEntries: _hideDatesWithLessThanEntries,
    setHideDatesWithLessThanEntries: _setHideDatesWithLessThanEntries,
    hideAccountsWithNoEntries: _hideAccountsWithNoEntries,
    setHideAccountsWithNoEntries: _setHideAccountsWithNoEntries,
    conversionCurrency: _conversionCurrency,
    setConversionCurrency: _setConversionCurrency,
    convertTransactionsAtCost,
    setConvertTransactionsAtCost,
    operatingCurrencies: _operatingCurrencies,
    showDeltas: _showDeltas,
    setShowDeltas: _setShowDeltas,
    showEstimatedBalances,
    setShowEstimatedBalances,
    invertSign,
    setInvertSign,
}) => {
    return (
        <Dialog open={open} onClose={onClose} PaperProps={{ sx: { width: 640, maxWidth: "90vw" } }}>
            <DialogTitle>Settings</DialogTitle>
            <DialogContent dividers>
                <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <ListItem
                        alignItems="flex-start"
                        secondaryAction={
                            <Checkbox
                                checked={groupByAccount}
                                onChange={(e) => setGroupByAccount(e.target.checked)}
                                inputProps={{ "aria-label": "Group by account" }}
                            />
                        }
                    >
                        <ListItemText
                            primary="Group by account"
                            secondary={
                                <Typography variant="body2" color="text.secondary">
                                    When enabled, the table is grouped by the account column showing multiple currencies per account.
                                </Typography>
                            }
                        />
                    </ListItem>
                    {/* Min entries, hide empty accounts: toolbar under the table (N+ button, hide empty rows link) */}
                    {/* <Divider component="li" />
                    <ListItem alignItems="flex-start">
                        <TextField
                            label="Only show dates with X or more entries"
                            type="number"
                            inputProps={{ min: 0, step: 1 }}
                            fullWidth
                            value={hideDatesWithLessThanEntries}
                            onChange={(e) =>
                                setHideDatesWithLessThanEntries(parseMinDateEntriesInput(e.target.value))
                            }
                            helperText="Counts distinct accounts with a non-empty value on the date (multiple currencies count as one). Use 0 to show all dates."
                        />
                    </ListItem>
                    <Divider component="li" />
                    <ListItem
                        alignItems="flex-start"
                        secondaryAction={
                            <Checkbox
                                checked={hideAccountsWithNoEntries}
                                onChange={(e) => setHideAccountsWithNoEntries(e.target.checked)}
                                inputProps={{ "aria-label": "Hide accounts with no entries" }}
                            />
                        }
                    >
                        <ListItemText
                            primary="Hide accounts with no entries"
                            secondary={
                                <Typography variant="body2" color="text.secondary">
                                    When enabled, accounts that have no balances specified on any of the dates, are hidden.
                                </Typography>
                            }
                        />
                    </ListItem> */}
                    {/* Show deltas: toolbar under the table */}
                    {/* <Divider component="li" />
                    <ListItem
                        alignItems="flex-start"
                        secondaryAction={
                            <Checkbox
                                checked={showDeltas}
                                onChange={(e) => setShowDeltas(e.target.checked)}
                                inputProps={{ "aria-label": "Show deltas" }}
                            />
                        }
                    >
                        <ListItemText
                            primary="Show Deltas"
                            secondary={
                                <Typography variant="body2" color="text.secondary">
                                    When enabled, show changes in balances from transactions classified by account types.
                                </Typography>
                            }
                        />
                    </ListItem> */}
                    <Divider component="li" />
                    <ListItem
                        alignItems="flex-start"
                        secondaryAction={
                            <Checkbox
                                checked={showEstimatedBalances}
                                onChange={(e) => setShowEstimatedBalances(e.target.checked)}
                                inputProps={{ "aria-label": "Show estimated balances" }}
                            />
                        }
                    >
                        <ListItemText
                            primary="Show estimated balances"
                            secondary={
                                <Typography variant="body2" color="text.secondary">
                                    When enabled, shows computed balances (from transactions) in gray for cells without explicit Balance directives.
                                </Typography>
                            }
                        />
                    </ListItem>
                    <Divider component="li" />
                    {/* Delta bar scale currency: toolbar when deltas are visible */}
                    {/* <ListItem alignItems="flex-start">
                        <FormControl fullWidth size="small">
                            <InputLabel id="conversion-currency-label">Delta Bar Scale Currency</InputLabel>
                            <Select
                                labelId="conversion-currency-label"
                                label="Delta Bar Scale Currency"
                                value={conversionCurrency}
                                onChange={(e: SelectChangeEvent<string>) =>
                                    setConversionCurrency(e.target.value)
                                }
                                displayEmpty
                            >
                                <MenuItem value="none">
                                    Don&apos;t convert
                                </MenuItem>
                                {operatingCurrencies.length === 0 ? (
                                    <MenuItem value="" disabled>No operating currencies</MenuItem>
                                ) : null}
                                {operatingCurrencies.map((ccy) => (
                                    <MenuItem key={ccy} value={ccy}>
                                        {ccy}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <ListItemText
                            sx={{ mt: 1.5 }}
                            secondary={
                                <Typography variant="body2" color="text.secondary">
                                    When set, delta bar widths are normalized to values converted to this currency. Enables cross-account and cross-currency comparison.
                                </Typography>
                            }
                        />
                    </ListItem> */}
                    <ListItem
                        alignItems="flex-start"
                        secondaryAction={
                            <Checkbox
                                checked={convertTransactionsAtCost}
                                onChange={(e) => setConvertTransactionsAtCost(e.target.checked)}
                                inputProps={{ "aria-label": "Convert transactions at cost" }}
                            />
                        }
                    >
                        <ListItemText
                            primary="Convert transactions at cost"
                            secondary={
                                <Typography variant="body2" color="text.secondary">
                                    When converting postings to the delta bar scale currency, postings with a cost basis are converted at cost. When disabled, market price conversion is used for all postings.
                                </Typography>
                            }
                        />
                    </ListItem>
                    <Divider component="li" />
                    <ListItem
                        alignItems="flex-start"
                        secondaryAction={
                            <Checkbox
                                checked={invertSign}
                                onChange={(e) => setInvertSign(e.target.checked)}
                                inputProps={{ "aria-label": "Invert sign for deltas" }}
                            />
                        }
                    >
                        <ListItemText
                            primary="Invert Sign for Deltas"
                            secondary={
                                <Typography variant="body2" color="text.secondary">
                                    When enabled, multiplies displayed delta values by -1 (so Income becomes positive and Expenses become negative)
                                </Typography>
                            }
                        />
                    </ListItem>
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};


