import React from "react";
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    List,
    ListItem,
    ListItemText,
    TextField,
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
}>;

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
    open,
    onClose,
    groupByAccount,
    setGroupByAccount,
    hideDatesWithLessThanEntries,
    setHideDatesWithLessThanEntries,
    hideAccountsWithNoEntries,
    setHideAccountsWithNoEntries,
}) => {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
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
                    <Divider component="li" />
                    <ListItem alignItems="flex-start">
                        <TextField
                            label="Only show dates with X or more entries"
                            type="number"
                            inputProps={{ min: 0, step: 1 }}
                            fullWidth
                            value={hideDatesWithLessThanEntries}
                            onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = Number.parseInt(raw, 10);
                                if (Number.isNaN(parsed)) {
                                    setHideDatesWithLessThanEntries(0);
                                    return;
                                }
                                setHideDatesWithLessThanEntries(Math.max(0, parsed));
                            }}
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
                    </ListItem>
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};


