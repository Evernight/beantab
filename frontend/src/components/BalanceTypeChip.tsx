import React from "react";
import Chip from "@mui/material/Chip";
import { BALANCE_TYPE_DISPLAY_MAPPING } from "../constants/balanceTypes";

interface BalanceTypeChipProps {
  /** Balance type key, e.g. "padded", "regular", "full-padded" */
  balanceType?: string;
  size?: "small" | "medium";
}

/** Reusable chip for displaying balance type modifier (~, !, F, etc.) */
export const BalanceTypeChip: React.FC<BalanceTypeChipProps> = ({
  balanceType,
  size = "small",
}) => {
  if (!balanceType) return null;

  const display = BALANCE_TYPE_DISPLAY_MAPPING[balanceType];
  if (!display) return null;

  return (
    <Chip
      size={size}
      variant="outlined"
      label={display.symbol}
      sx={{
        height: size === "small" ? 18 : 24,
        fontSize: size === "small" ? "0.75rem" : "0.8125rem",
        color: display.color,
        borderColor: display.color,
      }}
    />
  );
};
