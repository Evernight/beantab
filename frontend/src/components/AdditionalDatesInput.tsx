import React from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";

function isValidISODate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return false;
    // Guard against JS Date normalizing invalid dates (e.g. 2025-02-31).
    const yyyy = d.getFullYear().toString().padStart(4, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    return `${yyyy}-${mm}-${dd}` === value;
}

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
    const invalid = dates.filter((d) => !isValidISODate(d.trim()));
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
                    const isInvalid = !isValidISODate(date.trim());
                    return (
                        <Chip
                            {...getTagProps({ index })}
                            key={`${date}-${index}`}
                            label={date}
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
                    label="Additional dates"
                    placeholder="YYYY-MM-DD"
                    error={invalid.length > 0}
                    helperText={
                        invalid.length > 0
                            ? `Invalid date: ${firstInvalid}`
                            : "Extra date columns to show (use to add new balance entries)"
                    }
                    size="small"
                />
            )}
        />
    );
};


