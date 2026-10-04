import { bdt, rangeLabel } from '../src/format';

test('concept stay prices and dates', () => {
  expect(bdt(84000)).toBe('BDT 84,000');
  expect(bdt(21000)).toBe('BDT 21,000');
  expect(bdt(56000)).toBe('BDT 56,000');
  expect(rangeLabel('2025-10-21', '2025-11-04')).toBe('21 Oct 2025 – 4 Nov 2025');
});
