import React, { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { parseMinDateEntriesInput } from "../utils/minDateEntriesUtils";

export type MinDateEntriesControlProps = Readonly<{
    value: number;
    onChange: (value: number) => void;
    hiddenDatesCount?: number;
}>;

export const MinDateEntriesControl: React.FC<MinDateEntriesControlProps> = ({
    value,
    onChange,
    hiddenDatesCount = 0,
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const active = value > 0;

    let tooltip =
        "Only show dates with X or more entries. Counts distinct accounts with a balance on the date (multiple currencies count as one). Use 0 to show all dates.";
    if (active && hiddenDatesCount > 0) {
        tooltip += ` (${hiddenDatesCount} date${hiddenDatesCount !== 1 ? "s" : ""} not shown)`;
    }

    return (
        <>
            <Tooltip title={tooltip}>
                <IconButton
                    size="small"
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                    color={active ? "primary" : "default"}
                    aria-label="Minimum entries per date"
                    aria-haspopup="dialog"
                    aria-expanded={open}
                >
                    <Typography
                        component="span"
                        sx={{
                            fontSize: "0.875rem",
                            fontWeight: active ? 600 : 400,
                            lineHeight: 1,
                            opacity: active ? 1 : 0.55,
                        }}
                    >
                        {value}+
                    </Typography>
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: { px: 1.5, py: 1.5 },
                    },
                }}
            >
                <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 260 }}>
                        Only show dates with this many account entries or more (0 = all dates).
                    </Typography>
                    <TextField
                        size="small"
                        type="number"
                        value={value}
                        onChange={(e) => onChange(parseMinDateEntriesInput(e.target.value))}
                        onBlur={(e) => onChange(parseMinDateEntriesInput(e.target.value))}
                        inputProps={{
                            min: 0,
                            step: 1,
                            "aria-label": "Minimum entries per date to show column",
                        }}
                        sx={{ width: 88, alignSelf: "flex-start" }}
                        color={active ? "primary" : undefined}
                    />
                    {active && hiddenDatesCount > 0 ? (
                        <Typography variant="caption" color="text.secondary">
                            {hiddenDatesCount} date{hiddenDatesCount !== 1 ? "s" : ""} not shown
                        </Typography>
                    ) : null}
                </Box>
            </Menu>
        </>
    );
};
