import { autorun, makeAutoObservable } from "mobx";
import { BALANCE_TYPE_SYMBOLS } from "../constants/balanceTypes";

const STORAGE_KEY = "beantab.modifiedCells";

function loadFromStorage(): Map<string, ModifiedCell> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as ModifiedCell[];
    const map = new Map<string, ModifiedCell>();
    for (const c of arr) {
      const key = `${c.account}|${c.currency}|${c.date}`;
      map.set(key, c);
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveToStorage(map: Map<string, ModifiedCell>): void {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(map.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // Ignore quota / privacy errors
  }
}

export interface GridRow {
  account: string;
  currency: string;
  [date: string]: string | number | null; // Date columns will have balance values
}

export interface ModifiedCell {
  account: string;
  currency: string;
  date: string;
  originalValue: string | number | null;
  newValue: string | number | null;
  /** Balance type when user entered a modifier (~ or ! etc.). e.g. "padded", "regular", "full-padded" */
  balanceType?: string;
}

export class BeanTabStore {
  modifiedCells = new Map<string, ModifiedCell>(loadFromStorage());

  constructor() {
    makeAutoObservable(this);
    autorun(() => {
      saveToStorage(this.modifiedCells);
    });
  }

  /**
   * Parse balance type modifier from a cell value (e.g. "123.45~" -> { value: 123.45, balanceType: "padded" }).
   * Uses BALANCE_TYPE_SYMBOLS (longest-first) so e.g. "F~" is matched before "~".
   */
  static parseBalanceType(
    raw: string | number | null,
  ): { value: string | number | null; balanceType?: string } {
    if (raw === null || raw === undefined) return { value: raw, balanceType: undefined };
    const s = String(raw).trim();
    if (s === "") return { value: null, balanceType: undefined };
    for (const { key, symbol } of BALANCE_TYPE_SYMBOLS) {
      if (symbol && s.endsWith(symbol)) {
        const numericPart = s.slice(0, -symbol.length).trim();
        const num = Number.parseFloat(numericPart);
        if (!Number.isNaN(num)) {
          return { value: num, balanceType: key };
        }
      }
    }
    const num = Number.parseFloat(s);
    return { value: Number.isNaN(num) ? raw : num, balanceType: undefined };
  }

  addModifiedCell(
    account: string,
    currency: string,
    date: string,
    originalValue: string | number | null,
    newValue: string | number | null,
  ) {
    const key = `${account}|${currency}|${date}`;

    // If a cell is edited multiple times, keep the very first original value.
    const existing = this.modifiedCells.get(key);
    const stableOriginal = existing ? existing.originalValue : originalValue;

    // Parse balance type modifier from new value (~ or !)
    const parsed = BeanTabStore.parseBalanceType(newValue);
    const valueToStore = parsed.value;
    const balanceType = parsed.balanceType;

    // If user edited the cell back to its original value, treat it as "not modified".
    const originalCompare = existing ? existing.originalValue : originalValue;
    if (valueToStore === originalCompare && !balanceType) {
      this.modifiedCells.delete(key);
      return;
    }

    this.modifiedCells.set(key, {
      account,
      currency,
      date,
      originalValue: stableOriginal,
      newValue: valueToStore,
      ...(balanceType ? { balanceType } : {}),
    });
  }

  isModifiedCell(account: string, currency: string, date: string) {
    const key = `${account}|${currency}|${date}`;
    return this.modifiedCells.has(key);
  }

  removeModifiedCell(account: string, currency: string, date: string) {
    const key = `${account}|${currency}|${date}`;
    this.modifiedCells.delete(key);
  }

  getModifiedCell(account: string, currency: string, date: string): ModifiedCell | undefined {
    const key = `${account}|${currency}|${date}`;
    return this.modifiedCells.get(key);
  }

  revertCell(account: string, currency: string, date: string) {
    const modified = this.getModifiedCell(account, currency, date);
    if (!modified) return;

    this.removeModifiedCell(account, currency, date);
  }

  clearModifiedCells() {
    // clears without reverting values
    this.modifiedCells.clear();
  }

  get modifiedCellsCount() {
    return this.modifiedCells.size;
  }

  get hasModifiedCells() {
    return this.modifiedCells.size > 0;
  }

  revertAllChanges() {
    // Copy first: revertCell mutates the map.
    const all = Array.from(this.modifiedCells.values());
    for (const c of all) {
      this.revertCell(c.account, c.currency, c.date);
    }
  }

  getAllModifiedCells(): ModifiedCell[] {
    return Array.from(this.modifiedCells.values());
  }
}

// Singleton store instance
export const beanTabStore = new BeanTabStore();