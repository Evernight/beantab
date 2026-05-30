import React from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import {
    isValidAdditionalDateEntry,
    parseAdditionalDateEntry,
} from "../utils/additionalDatesUtils";

export type AdditionalDatesInputProps = Readonly<{
    dates: string[];
    inputValue: string;
    setDates: (dates: string[]) => void;
    setInputValue: (inputValue: string) => void;
}>;

export const AdditionalDatesInput: React.FC<AdditionalDatesInputProps> = ({
    dates,
    inputValue,
    setDates,
    setInputValue,
}) => {
    const invalid = dates.filter((d) => !isValidAdditionalDateEntry(d.trim()));
    const firstInvalid = invalid[0]?.trim();

    return (
        <Autocomplete<string, true, false, true>
            freeSolo
            multiple
            options={[]}
            value={dates}
            inputValue={inputValue}
            onInputChange={(_event, newInputValue) => setInputValue(newInputValue)}
            onChange={(_event, newValue) => {
                const deduped = Array.from(
                    new Set(newValue.map((v) => v.trim()).filter((v) => v.length > 0))
                ).sort();
                setDates(deduped);
            }}
            renderTags={(value, getTagProps) =>
                value.map((date, index) => {
                    const isInvalid = !isValidAdditionalDateEntry(date.trim());
                    const parsed = parseAdditionalDateEntry(date);
                    const isHide = parsed?.kind === "hide";
                    return (
                        <Chip
                            {...getTagProps({ index })}
                            key={`${date}-${index}`}
                            label={date}
                            size="small"
                            color={isInvalid ? "error" : isHide ? "warning" : "default"}
                            variant={isInvalid || isHide ? "outlined" : "filled"}
                        />
                    );
                })
            }
            renderInput={(params) => (
                <TextField
                    {...params}
                    label="Additional dates"
                    placeholder="YYYY-MM-DD or -YYYY-MM-DD"
                    error={invalid.length > 0}
                    helperText={
                        invalid.length > 0
                            ? `Invalid date: ${firstInvalid}`
                            : "YYYY-MM-DD adds columns; -YYYY-MM-DD hides a date from the grid"
                    }
                    size="small"
                />
            )}
        />
    );
};

