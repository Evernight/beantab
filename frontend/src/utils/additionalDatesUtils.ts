function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const yyyy = d.getFullYear().toString().padStart(4, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}` === value;
}

export function isValidAdditionalDateEntry(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith("-")) {
    return isValidISODate(trimmed.slice(1));
  }
  return isValidISODate(trimmed);
}

export function parseAdditionalDateEntry(
  raw: string,
): { kind: "show" | "hide"; date: string } | null {
  const trimmed = raw.trim();
  if (!isValidAdditionalDateEntry(trimmed)) return null;
  if (trimmed.startsWith("-")) {
    return { kind: "hide", date: trimmed.slice(1) };
  }
  return { kind: "show", date: trimmed };
}

export function splitAdditionalDates(entries: string[]): {
  showDates: string[];
  hideDates: string[];
} {
  const showDates: string[] = [];
  const hideDates: string[] = [];
  for (const entry of entries) {
    const parsed = parseAdditionalDateEntry(entry);
    if (!parsed) continue;
    if (parsed.kind === "hide") hideDates.push(parsed.date);
    else showDates.push(parsed.date);
  }
  return { showDates, hideDates };
}

export function applyHideToDateList(entries: string[], date: string): string[] {
  const hideToken = `-${date}`;
  const withoutShow = entries.filter((e) => e.trim() !== date);
  if (withoutShow.some((e) => e.trim() === hideToken)) {
    return [...new Set(withoutShow.map((v) => v.trim()).filter((v) => v.length > 0))].sort();
  }
  return [...new Set([...withoutShow.map((v) => v.trim()).filter((v) => v.length > 0), hideToken])].sort();
}
