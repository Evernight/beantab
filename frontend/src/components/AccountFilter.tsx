import React from "react";
import Autocomplete, {
    AutocompleteChangeDetails,
    AutocompleteChangeReason,
    AutocompleteInputChangeReason,
} from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** If the user commits a full account name, store an exact-match regex. */
function patternOnCommit(raw: string, accountOptions: string[]): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    if (accountOptions.includes(trimmed)) {
        return `^${escapeRegExp(trimmed)}$`;
    }
    return trimmed;
}

function dedupePatterns(patterns: string[]): string[] {
    return Array.from(new Set(patterns.map((v) => v.trim()).filter((v) => v.length > 0)));
}

export type CompiledAccountRegexes = Readonly<{
    valid: RegExp[];
    invalid: Array<{ pattern: string; error: string }>;
}>;

export type AccountFilterProps = Readonly<{
    accountOptions: string[];
    patterns: string[];
    inputValue: string;
    compiledAccountRegexes: CompiledAccountRegexes;
    setPatterns: (patterns: string[]) => void;
    setInputValue: (inputValue: string) => void;
}>;

export const AccountFilter: React.FC<AccountFilterProps> = ({
    accountOptions,
    patterns,
    inputValue,
    compiledAccountRegexes,
    setPatterns,
    setInputValue,
}) => {
    const commitDraft = (draft: string) => {
        const pattern = patternOnCommit(draft, accountOptions);
        if (!pattern) return;
        setPatterns(dedupePatterns([...patterns, pattern]));
        setInputValue("");
    };

    return (
        <Autocomplete<string, true, false, true>
            freeSolo
            multiple
            clearOnBlur={false}
            options={accountOptions}
            value={patterns}
            inputValue={inputValue}
            onInputChange={(
                _event,
                newInputValue,
                reason: AutocompleteInputChangeReason
            ) => {
                // MUI clears the input after picking a list option; keep the draft we set in onChange.
                if (reason === "reset") return;
                setInputValue(newInputValue);
            }}
            onChange={(
                _event,
                newValue,
                reason: AutocompleteChangeReason,
                details?: AutocompleteChangeDetails<string>
            ) => {
                if (reason === "selectOption" && details?.option) {
                    setInputValue(details.option.trim());
                    return;
                }

                if (reason === "createOption") {
                    const draft = inputValue.trim();
                    if (draft) {
                        commitDraft(draft);
                    }
                    return;
                }

                if (reason === "removeOption" || reason === "clear") {
                    setPatterns(dedupePatterns(newValue));
                    return;
                }

                setPatterns(dedupePatterns(newValue));
            }}
            renderTags={(value, getTagProps) =>
                value.map((pattern, index) => {
                    const isInvalid = compiledAccountRegexes.invalid.some(
                        (i) => i.pattern === pattern.trim()
                    );
                    return (
                        <Chip
                            {...getTagProps({ index })}
                            key={`${pattern}-${index}`}
                            label={pattern}
                            size="small"
                            color={isInvalid ? "error" : "default"}
                            variant={isInvalid ? "outlined" : "filled"}
                        />
                    );
                })
            }
            renderInput={(params) => (
                <TextField
                    {...params}
                    label="Account filter"
                    placeholder="Pick or type a selector, edit, then press Enter"
                    error={compiledAccountRegexes.invalid.length > 0}
                    helperText={
                        compiledAccountRegexes.invalid.length > 0
                            ? `Invalid regex: ${compiledAccountRegexes.invalid[0]!.pattern}`
                            : "Specify one or more selectors (as regular expressions) to filter displayed accounts"
                    }
                    size="small"
                />
            )}
        />
    );
};
