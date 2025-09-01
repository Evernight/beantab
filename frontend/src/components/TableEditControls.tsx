import React, { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  Box,
  Alert,
  CircularProgress,
  Badge,
} from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import SaveIcon from "@mui/icons-material/Save";
import { beanTabStore } from "../stores/beanTabStore";
import { saveModifiedCells, safetyCheck, reloadLedger } from "../api/save";
import SaveChangesDialog from "./SaveChangesDialog";
interface TableEditControlsProps {
  onSave?: () => void;
  onRevert?: () => void;
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
}) => {
  const [saving, setSaving] = useState(false);
  const [waitingForReload, setWaitingForReload] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  const [saveTakingTooLongWarning, setSaveTakingTooLongWarning] = useState<string | null>(null);
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
          <Box sx={{ flex: 1 }}>
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
