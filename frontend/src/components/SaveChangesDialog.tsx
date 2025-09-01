import React from "react";
import { observer } from "mobx-react-lite";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RestoreIcon from "@mui/icons-material/Restore";
import SaveIcon from "@mui/icons-material/Save";
import { BalanceTypeChip } from "./BalanceTypeChip";
import { beanTabStore, BeanTabStore } from "../stores/beanTabStore";

export interface SaveChangesDialogProps {
  open: boolean;
  saving: boolean;
  saveError: string | null;
  /** When set, show a warning recommending to commit existing changes before saving. */
  safetyWarning: string | null;
  /** When set, show a warning that save is taking too long and Fava has not detected the file change. */
  saveTakingTooLongWarning: string | null;
  onClose: () => void;
  onRevertAll: () => void;
  onSave: () => Promise<void>;
}

function formatValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "·";
  if (typeof v === "number") {
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(v));
    return v >= 0 ? formatted : `(${formatted})`;
  }
  return String(v);
}

interface FormattedValueWithChipProps {
  value: string | number | null | undefined;
  balanceType?: string;
}

const FormattedValueWithChip: React.FC<FormattedValueWithChipProps> = ({
  value,
  balanceType,
}) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
    {formatValue(value)}
    <BalanceTypeChip balanceType={balanceType} />
  </span>
);

const SaveChangesDialog: React.FC<SaveChangesDialogProps> = ({
  open,
  saving,
  saveError,
  safetyWarning,
  saveTakingTooLongWarning,
  onClose,
  onRevertAll,
  onSave,
}) => {
    const modifiedCells = beanTabStore
    .getAllModifiedCells()
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.account !== b.account) return a.account.localeCompare(b.account);
      if (a.currency !== b.currency) return a.currency.localeCompare(b.currency);
      return 0;
    });

  return (
    <Dialog open={open} onClose={() => (saving ? null : onClose())} maxWidth="lg" fullWidth>
      <DialogTitle>Save changes</DialogTitle>
      <DialogContent dividers>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}

        {safetyWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {safetyWarning} Please make sure you track files in git and commit existing changes before saving for additional safety.
          </Alert>
        )}

        {saveTakingTooLongWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {saveTakingTooLongWarning}
          </Alert>
        )}

        <Typography variant="body2" sx={{ mb: 1 }}>
          Review the changes below. You can revert individual changes before saving.
        </Typography>

        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Account</TableCell>
              <TableCell>Currency</TableCell>
              <TableCell align="right">Original value</TableCell>
              <TableCell align="right">New value</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {modifiedCells.map((c) => {
              const originalParsed = BeanTabStore.parseBalanceType(c.originalValue);
              return (
                <TableRow key={`${c.account}|${c.currency}-${c.date}`} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{c.date}</TableCell>
                  <TableCell sx={{ maxWidth: 520, wordBreak: "break-word" }}>{c.account}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{c.currency}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: "monospace" }}>
                    <FormattedValueWithChip
                      value={originalParsed.value}
                      balanceType={originalParsed.balanceType}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: "monospace" }}>
                    <FormattedValueWithChip value={c.newValue} balanceType={c.balanceType} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => {
                        beanTabStore.revertCell(c.account, c.currency, c.date);
                        if (!beanTabStore.hasModifiedCells) onClose();
                      }}
                      disabled={saving}
                      startIcon={<RestoreIcon />}
                    >
                      Revert
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {modifiedCells.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    No changes to save.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} startIcon={<CloseIcon />}>
          Close
        </Button>
        <Button color="inherit" onClick={onRevertAll} disabled={saving} startIcon={<RestoreIcon />}>
          Revert all
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={saving || modifiedCells.length === 0}
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
        >
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default observer(SaveChangesDialog);


