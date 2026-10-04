export function parseIsoDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    throw new Error('Use a date in YYYY-MM-DD form');
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function daysBetween(startIso: string, endIso: string): number {
  const ms = parseIsoDate(endIso).getTime() - parseIsoDate(startIso).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function eachDate(startIso: string, endIso: string): string[] {
  const days = Math.max(daysBetween(startIso, endIso), 1);
  const dates: string[] = [];
  for (let i = 0; i < days; i += 1) dates.push(addDaysIso(startIso, i));
  return dates;
}

/** Absolute start and end in Asia/Dhaka for allocation checks. */
export function stayWindow(startIso: string, endIso: string, pickupTime: string, type: 'DAY' | 'STAY') {
  const startAt = new Date(`${startIso}T${pickupTime}:00+06:00`);
  if (Number.isNaN(startAt.getTime())) {
    throw new Error('Pickup time must look like 14:00');
  }
  if (type === 'DAY') {
    return { startAt, endAt: new Date(startAt.getTime() + 10 * 60 * 60 * 1000), days: 1 };
  }
  const days = Math.max(daysBetween(startIso, endIso), 1);
  const endAt = new Date(`${endIso}T${pickupTime}:00+06:00`);
  return { startAt, endAt, days };
}

export function periodFor(days: number, type: 'DAY' | 'STAY') {
  if (type === 'DAY' || days <= 1) return 'DAILY' as const;
  if (days === 7) return 'WEEKLY' as const;
  if (days === 14) return 'FOURTEEN' as const;
  if (days === 21) return 'TWENTY_ONE' as const;
  if (days >= 28 && days <= 31) return 'MONTHLY' as const;
  return 'CUSTOM' as const;
}

export function formatLongDate(iso: string): string {
  const date = parseIsoDate(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
