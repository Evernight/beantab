import React from "react";
import Autocomplete, {
    AutocompleteChangeDetails,
    AutocompleteChangeReason,
} from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    return (
        <Autocomplete<string, true, false, true>
            freeSolo
            multiple
            options={accountOptions}
            value={patterns}
            inputValue={inputValue}
            onInputChange={(_event, newInputValue) => setInputValue(newInputValue)}
            onChange={(
                _event,
                newValue,
                reason: AutocompleteChangeReason,
                details?: AutocompleteChangeDetails<string>
            ) => {
                const deduped = Array.from(
                    new Set(newValue.map((v) => v.trim()).filter((v) => v.length > 0))
                );

                // If the user picked an account from the dropdown, convert it to an exact-match regex.
                if (reason === "selectOption" && details?.option) {
                    const selected = details.option.trim();
                    const exact = `^${escapeRegExp(selected)}$`;
                    setPatterns(deduped.map((v) => (v === selected ? exact : v)));
                    return;
                }

                setPatterns(deduped);
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
                    placeholder="Add regex and press Enter (e.g. ^Assets:.*)"
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


