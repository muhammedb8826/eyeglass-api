/** Preset windows are computed in the server local timezone (calendar day / week / month). */
export type OrderDatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_week'
  | 'last_month';

export type OrderListDateField = 'orderDate' | 'createdAt' | 'deliveryDate';

export type OrderListSortField = 'createdAt' | 'orderDate' | 'deliveryDate' | 'grandTotal';

const PRESET_VALUES: OrderDatePreset[] = [
  'today',
  'this_week',
  'this_month',
  'last_week',
  'last_month',
];

export function isValidDatePreset(v: string): v is OrderDatePreset {
  return PRESET_VALUES.includes(v as OrderDatePreset);
}

export function parseStatusQuery(status?: string): string[] | undefined {
  if (!status || !String(status).trim()) return undefined;
  const parts = String(status)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

export function dateFieldToColumn(field: OrderListDateField): string {
  switch (field) {
    case 'createdAt':
      return 'order.createdAt';
    case 'deliveryDate':
      return 'order.deliveryDate';
    case 'orderDate':
    default:
      return 'order.orderDate';
  }
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function mondayStartWeekContaining(ref: Date): { start: Date; end: Date } {
  const d = new Date(ref);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

/** ISO date-only YYYY-MM-DD → local start/end of that calendar day. */
export function parseQueryDateStart(s: string): Date {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  return new Date(t);
}

export function parseQueryDateEnd(s: string): Date {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  return new Date(t);
}

export function resolvePresetRange(preset: OrderDatePreset, now = new Date()): { start: Date; end: Date } {
  switch (preset) {
    case 'today':
      return { start: startOfLocalDay(now), end: endOfLocalDay(now) };
    case 'this_week':
      return mondayStartWeekContaining(now);
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'last_week': {
      const tw = mondayStartWeekContaining(now);
      const start = new Date(tw.start);
      start.setDate(start.getDate() - 7);
      const end = new Date(tw.end);
      end.setDate(end.getDate() - 7);
      return { start, end };
    }
    case 'last_month': {
      const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastPrev = new Date(firstThis);
      lastPrev.setDate(0);
      const start = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(lastPrev.getFullYear(), lastPrev.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
  }
}

export type ResolvedOrderDateFilter = {
  columnSql: string;
  start?: Date;
  end?: Date;
};

/**
 * Custom range wins over datePreset when startDate or endDate is provided.
 * Returns null when no date constraint applies.
 */
export function resolveOrderDateFilter(input: {
  dateField: OrderListDateField;
  startDate?: string;
  endDate?: string;
  datePreset?: OrderDatePreset;
}): ResolvedOrderDateFilter | null {
  const columnSql = dateFieldToColumn(input.dateField);
  const hasCustom = !!(input.startDate?.trim() || input.endDate?.trim());

  if (hasCustom) {
    let start: Date | undefined;
    let end: Date | undefined;
    if (input.startDate?.trim()) {
      start = parseQueryDateStart(input.startDate);
    }
    if (input.endDate?.trim()) {
      end = parseQueryDateEnd(input.endDate);
    }
    if (start && end && start > end) {
      return { columnSql, start: end, end: start };
    }
    if (start || end) {
      return { columnSql, start, end };
    }
    return null;
  }

  if (input.datePreset) {
    const { start, end } = resolvePresetRange(input.datePreset);
    return { columnSql, start, end };
  }

  return null;
}
