const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function bdt(amount: number) {
  return `BDT ${Math.round(amount).toLocaleString('en-US')}`;
}

export function longDate(iso: string) {
  const [, month, day] = iso.split('-').map(Number);
  const year = iso.slice(0, 4);
  return `${day} ${months[(month || 1) - 1]} ${year}`;
}

export function rangeLabel(start: string, end: string) {
  if (start === end) return longDate(start);
  return `${longDate(start)} – ${longDate(end)}`;
}

export function daysBetween(start: string, end: string) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.max(Math.round((b - a) / 86_400_000), 1);
}

export function greetingWord(language: 'EN' | 'BN', date = new Date()) {
  const hour = date.getHours();
  if (language === 'BN') {
    if (hour < 12) return 'শুভ সকাল';
    if (hour < 17) return 'শুভ অপরাহ্ন';
    return 'শুভ সন্ধ্যা';
  }
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
