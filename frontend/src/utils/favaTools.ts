/** Base path for the current Fava ledger (e.g. /main). Works from extension and report pages. */
export function getFavaBasePath(): string {
  const withoutExtension =
    window.location.pathname.replace(/\/extension\/[^/]+(\/.*)?$/, "") || "/";
  const segment = withoutExtension.split("/").filter(Boolean)[0];
  return segment ? `/${segment}` : "";
}

function addDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function buildTimeFilter(date: string, prevDate: string): string {
  return prevDate === ""
    ? `1000-01-01 to ${date}`
    : `${addDay(prevDate)} to ${date}`;
}

export function buildEditorUrl(filename: string, lineno: number): string {
  const params = new URLSearchParams();
  params.set("file_path", filename);
  params.set("line", String(lineno));
  return `${window.location.origin}${getFavaBasePath()}/editor/?${params}`;
}

export function buildJournalUrl(account: string, date: string, prevDate: string): string {
  const params = new URLSearchParams();
  params.set("account", account);
  params.set("time", buildTimeFilter(date, prevDate));
  return `${window.location.origin}${getFavaBasePath()}/journal?${params}`;
}

export function buildExpensesDashboardUrl(date: string, prevDate: string): string {
  const params = new URLSearchParams();
  params.set("dashboard", "expenses-detailed");
  params.set("time", buildTimeFilter(date, prevDate));
  return `${window.location.origin}${getFavaBasePath()}/extension/FavaDashboards/?${params}`;
}

export function buildAccountUrl(account: string): string {
  return `${getFavaBasePath()}/account/${account}/`;
}
