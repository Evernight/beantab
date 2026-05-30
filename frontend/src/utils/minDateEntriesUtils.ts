export function clampMinDateEntries(n: number): number {
    return Math.max(0, Math.floor(n));
}

export function parseMinDateEntriesInput(raw: string): number {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return 0;
    return clampMinDateEntries(parsed);
}
