export const POLICY_VERSION = '2026-10-02';

export const CANCELLATION_RULES = [
  'More than 7 days before pickup: the amount already paid is refunded in full, after OVYK finance confirms it.',
  'From 2 to 7 days before pickup: 50% of the amount already paid is refunded.',
  'Less than 2 days before pickup: the amount already paid is retained.',
  'A change to the stay is priced first and is confirmed only after you accept it.',
];

export const INCLUDED_SERVICES = [
  'Dedicated vehicle and vetted driver for the booked period',
  'Fuel within the included kilometre allowance',
  'Airport pickup when the pickup is an airport',
  'Air conditioning',
];

export const EXCLUDED_COSTS = [
  'Tolls, parking and ferry charges',
  'Kilometres or hours beyond the package allowance',
  'Travel outside the booked city, unless agreed in advance',
  'Overnight accommodation and meals for the driver when a stay requires them',
];

export type Estimate = {
  usd: number;
  gbp: number;
  asOf: string;
  disclaimer: string;
};

export function estimates(totalBdt: number, usdPerBdt: number, gbpPerBdt: number, asOf: Date): Estimate {
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    usd: round(totalBdt / usdPerBdt),
    gbp: round(totalBdt / gbpPerBdt),
    asOf: asOf.toISOString(),
    disclaimer: 'GBP and USD figures are estimates. BDT is the booking and settlement currency.',
  };
}

export function bdt(amount: number): string {
  return `BDT ${amount.toLocaleString('en-US')}`;
}

export function simplePdf(title: string, lines: string[]): Buffer {
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const commands = ['BT', '/F1 18 Tf', '48 760 Td', `(${escape(title)}) Tj`];
  commands.push('/F1 11 Tf');
  lines.forEach((line) => {
    commands.push('0 -18 Td', `(${escape(line)}) Tj`);
  });
  commands.push('ET');
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += xref;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(body, 'utf8');
}
