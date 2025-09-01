import React from "react";
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from "@mui/material";
import { BALANCE_TYPE_DISPLAY_MAPPING } from "../constants/balanceTypes";

export type HelpDialogProps = Readonly<{
    open: boolean;
    onClose: () => void;
}>;

export const HelpDialog: React.FC<HelpDialogProps> = ({ open, onClose }) => {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Help</DialogTitle>
            <DialogContent dividers>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                    Balance types
                </Typography>
                <Typography variant="body2" color="text.secondary" component="p" sx={{ marginBottom: "8px" }}>
                    Cells show balances from your ledger, from balance, valuation and balance-ext directives. 
                    Beantab generates only "balance-ext" on save with provided balance type. Default balance type is defined by the "balance-ext" plugin configuration.
                    You can override it per cell by appending a suffix to the number when editing.
                </Typography>
                <Typography variant="body2" color="text.secondary" component="p" sx={{ marginBottom: "8px" }}>
                    Overriden balance types appear in the table as:
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
                        {Object.entries(BALANCE_TYPE_DISPLAY_MAPPING).map(([key, { symbol, color }]) => (
                            <Chip
                                key={key}
                                size="small"
                                variant="outlined"
                                label={symbol}
                                sx={{
                                    color,
                                    borderColor: color,
                                }}
                            />
                        ))}
                    </Stack>
                </Box>
                <Typography variant="body2" color="text.secondary" component="p" sx={{ marginBottom: "16px" }}>
                    When editing a cell, append the symbol after the amount (e.g. <code>100~</code> for
                    padded, <code>100!</code> for regular) if you want to ovverride the default balance type for this date.
                </Typography>

                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                    Table behavior
                </Typography>
                <Typography variant="body2" color="text.secondary" component="p" sx={{ marginBottom: '16px' }}>
                    Use the column headers to sort. In Settings you can group by account (one row
                    per account with multiple currency columns), hide dates with few entries, or
                    hide accounts that have no balances on any of the selected dates.
                </Typography>
                <Typography variant="body2" color="text.secondary" component="p" sx={{ marginBottom: '16px' }}>
                    All of these settings are preserved in the URL, so you can bookmark any
                    particular configuration or add it to Fava side link using
                    &quot;fava-sidebar-link&quot; directive.
                </Typography>

                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                    Editing
                </Typography>
                <Typography variant="body2" color="text.secondary" component="p" sx={{ marginBottom: '16px' }}>
                    You can edit cells to add or change balance entries. Changes are applied when
                    you save; the table reflects existing entries in your Beancount files.
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};
