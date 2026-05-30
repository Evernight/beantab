import React, { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  ButtonGroup,
  Box,
  Alert,
  CircularProgress,
  Badge,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import MultipleStopIcon from "@mui/icons-material/MultipleStop";
import {
  DELTA_KEY_LABEL,
  DELTA_KEY_LABEL_SHORT,
  DELTA_NEGATIVE,
  DELTA_POSITIVE,
} from "../constants/deltas";
import RestoreIcon from "@mui/icons-material/Restore";
import SaveIcon from "@mui/icons-material/Save";
import { beanTabStore } from "../stores/beanTabStore";
import { saveModifiedCells, safetyCheck, reloadLedger } from "../api/save";
import SaveChangesDialog from "./SaveChangesDialog";
import { getCurrencySymbol, getCurrencyDisplayLabel } from "../utils/currencyDisplayUtils";
import { MinDateEntriesControl } from "./MinDateEntriesControl";

function scaleCurrencyButtonLabel(currency: string): string {
  if (currency === "none" || !currency) return "—";
  return getCurrencySymbol(currency) ?? currency;
}

interface TableEditControlsProps {
  onSave?: () => void;
  onRevert?: () => void;
  showDeltas?: boolean;
  onToggleShowDeltas?: () => void;
  /** Account rows with no balance entries on shown dates */
  emptyAccountsCount?: number;
  hideAccountsWithNoEntries?: boolean;
  onToggleHideAccountsWithNoEntries?: () => void;
  hideDatesWithLessThanEntries?: number;
  setHideDatesWithLessThanEntries?: (value: number) => void;
  hiddenDatesCount?: number;
  conversionCurrency?: string;
  setConversionCurrency?: (value: string) => void;
  operatingCurrencies?: string[];
}

const CHANGED_POLL_INTERVAL_MS = 1000;
const CHANGED_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const TOO_LONG_TO_SAVE_INTERVAL_MS = 15000;

function parseMtime(text: string): bigint {
  const normalized = text.startsWith("X") ? text.replaceAll("X", "1") : text;
  return BigInt(normalized);
}

function getChangedApiUrl(): string {
  const extensionSegment = "/extension/";
  const path = window.location.pathname;
  const index = path.indexOf(extensionSegment);
  const base =
    index >= 0 ? path.slice(0, index) : path.endsWith("/") ? path : `${path}/`;
  return `${base}/api/changed`;
}

const TableEditControls: React.FC<TableEditControlsProps> = ({
  onSave,
  onRevert,
  showDeltas = false,
  onToggleShowDeltas,
  emptyAccountsCount = 0,
  hideAccountsWithNoEntries = false,
  onToggleHideAccountsWithNoEntries,
  hideDatesWithLessThanEntries = 0,
  setHideDatesWithLessThanEntries,
  hiddenDatesCount = 0,
  conversionCurrency = "none",
  setConversionCurrency,
  operatingCurrencies = [],
}) => {
  const [saving, setSaving] = useState(false);
  const [waitingForReload, setWaitingForReload] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  const [saveTakingTooLongWarning, setSaveTakingTooLongWarning] = useState<string | null>(null);
  const [currencyMenuAnchor, setCurrencyMenuAnchor] = useState<null | HTMLElement>(null);
  const hasChanges = beanTabStore.hasModifiedCells;

  useEffect(() => {
    if (!saveDialogOpen) return;
    let cancelled = false;
    safetyCheck()
      .then((res) => {
        if (cancelled) return;
        setSafetyWarning(res.ok ? null : res.reason ?? "Pre-save check failed.");
      })
      .catch(() => {
        if (cancelled) return;
        setSafetyWarning(null);
      });
    return () => {
      cancelled = true;
    };
  }, [saveDialogOpen]);

  const busy = saving || waitingForReload;

  const handleRevert = () => {
    beanTabStore.revertAllChanges();
    onRevert?.();
  };

  const saveAndwaitForLedgerChange = async (
    saveCallback: () => Promise<void>,
    onTakingTooLong: () => void,
  ) => {
    const url = getChangedApiUrl();
    console.log("Polling for changed API at", url);
    const deadline = Date.now() + CHANGED_TIMEOUT_MS;
    let initialMtime: bigint | null = null;
    let saveCalledAt: number | null = null;
    let tookTooLongNotified = false;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const json = await response.json();
          console.log("Fava response:", json);
          if (typeof json?.mtime === "string") {
            const currentMtime = parseMtime(json.mtime);
            if (initialMtime === null) {
              initialMtime = currentMtime;
              console.log("Saving modified cells and waiting for ledger change (mtime:", currentMtime, ")");
              await saveCallback();
              console.log("Saved");  
              saveCalledAt = Date.now();
            } else if (currentMtime > initialMtime) {
              console.log("Fava detected a file change");
              return;
            } else if (
              saveCalledAt !== null &&
              Date.now() - saveCalledAt >= TOO_LONG_TO_SAVE_INTERVAL_MS &&
              !tookTooLongNotified
            ) {
              tookTooLongNotified = true;
              onTakingTooLong();
            }
          }
        }
      } catch (error) {
        console.error("Failed to poll /api/changed", error);
      }
      await new Promise((resolve) => setTimeout(resolve, CHANGED_POLL_INTERVAL_MS));
    }
    throw new Error("Timed out waiting for Fava to detect the file change.");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveTakingTooLongWarning(null);
    try {
      const modifiedCells = beanTabStore.getAllModifiedCells();
      setWaitingForReload(true);
      await saveAndwaitForLedgerChange(
        async () => { saveModifiedCells(modifiedCells); },
        () => {
          setSaveTakingTooLongWarning(
            `It's taking longer than expected for Fava to detect the file change. Is the folder with new files ("balances/") included in your ledger?`
          );
        },
      );
      beanTabStore.clearModifiedCells();
      onSave?.();
      window.location.reload();
    } catch (error) {
      console.error("Save error:", error);
      setSaveError(error instanceof Error ? error.message : "Failed to save changes");
    } finally {
      setSaving(false);
      setWaitingForReload(false);
    }
  };

  return (
    <Box>
      {saveError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {saveError}
        </Alert>
      )}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          paddingTop: 2,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
            {setHideDatesWithLessThanEntries && (
              <MinDateEntriesControl
                value={hideDatesWithLessThanEntries}
                onChange={setHideDatesWithLessThanEntries}
                hiddenDatesCount={hiddenDatesCount}
              />
            )}
            {onToggleShowDeltas && (
              <Tooltip title={showDeltas ? "Hide deltas" : "Show deltas"}>
                <IconButton
                  size="small"
                  onClick={onToggleShowDeltas}
                  color={showDeltas ? "primary" : "default"}
                  aria-label={showDeltas ? "Hide deltas" : "Show deltas"}
                >
                  <MultipleStopIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {showDeltas && setConversionCurrency && (
              <>
                <Tooltip title="Delta bar scale currency">
                  <IconButton
                    size="small"
                    onClick={(e) => setCurrencyMenuAnchor(e.currentTarget)}
                    color={conversionCurrency !== "none" ? "primary" : "default"}
                    aria-label="Delta bar scale currency"
                    aria-haspopup="listbox"
                    aria-expanded={Boolean(currencyMenuAnchor)}
                  >
                    <Typography
                      component="span"
                      sx={{
                        fontSize: "0.875rem",
                        fontWeight: conversionCurrency !== "none" ? 600 : 400,
                        lineHeight: 1,
                        opacity: conversionCurrency !== "none" ? 1 : 0.55,
                      }}
                    >
                      {scaleCurrencyButtonLabel(conversionCurrency)}
                    </Typography>
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={currencyMenuAnchor}
                  open={Boolean(currencyMenuAnchor)}
                  onClose={() => setCurrencyMenuAnchor(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                  transformOrigin={{ vertical: "top", horizontal: "left" }}
                >
                  <MenuItem
                    selected={conversionCurrency === "none"}
                    onClick={() => {
                      setConversionCurrency("none");
                      setCurrencyMenuAnchor(null);
                    }}
                    sx={{ fontSize: "0.85rem" }}
                  >
                    —
                  </MenuItem>
                  {operatingCurrencies.map((ccy) => (
                    <MenuItem
                      key={ccy}
                      selected={conversionCurrency === ccy}
                      onClick={() => {
                        setConversionCurrency(ccy);
                        setCurrencyMenuAnchor(null);
                      }}
                      sx={{ fontSize: "0.85rem" }}
                    >
                      {getCurrencyDisplayLabel(ccy)}
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )}
            {showDeltas && (
              <ButtonGroup size="small">
                {[...DELTA_NEGATIVE, ...DELTA_POSITIVE].map(({ key, color, textColor }) => (
                  <Tooltip key={key} title={DELTA_KEY_LABEL[key]}>
                    <Button
                      component="span"
                      sx={{
                        backgroundColor: color,
                        color: textColor,
                        fontSize: "0.7rem",
                        py: 0.25,
                        px: 0.5,
                        minWidth: "auto",
                      }}
                    >
                      {DELTA_KEY_LABEL_SHORT[key]}
                    </Button>
                  </Tooltip>
                ))}
              </ButtonGroup>
            )}
            {onToggleHideAccountsWithNoEntries && emptyAccountsCount > 0 && (
              <Tooltip
                title={
                  hideAccountsWithNoEntries
                    ? "Click to show hidden accounts"
                    : `Hide ${emptyAccountsCount} account row${emptyAccountsCount !== 1 ? "s" : ""} with no balance entries on shown dates`
                }
              >
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={onToggleHideAccountsWithNoEntries}
                  sx={{
                    color: "text.secondary",
                    opacity: 0.8,
                    fontSize: "0.8rem",
                    verticalAlign: "baseline",
                    textDecorationColor: "inherit",
                  }}
                >
                  {hideAccountsWithNoEntries
                    ? `${emptyAccountsCount} account${emptyAccountsCount !== 1 ? "s" : ""} hidden`
                    : "Hide empty rows"}
                </Link>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Badge
              badgeContent={beanTabStore.modifiedCellsCount}
              color="primary"
              showZero={false}
            >
              <Button
                color="inherit"
                size="medium"
                onClick={handleRevert}
                disabled={busy || !hasChanges}
                startIcon={<RestoreIcon />}
              >
                Revert
              </Button>
            </Badge>
            <Button
              color="inherit"
              size="medium"
              onClick={() => setSaveDialogOpen(true)}
              disabled={busy || !hasChanges}
              startIcon={busy ? <CircularProgress size={16} /> : <SaveIcon />}
            >
              Save
            </Button>
          </Box>
      </Box>

        <SaveChangesDialog
          open={saveDialogOpen}
          saving={busy}
          saveError={saveError}
          safetyWarning={safetyWarning}
          saveTakingTooLongWarning={saveTakingTooLongWarning}
          onClose={() => setSaveDialogOpen(false)}
          onRevertAll={handleRevert}
          onSave={handleSave}
        />
    </Box>
  );
};

export default observer(TableEditControls);
