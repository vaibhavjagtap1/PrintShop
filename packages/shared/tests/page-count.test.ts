import { describe, expect, it } from 'vitest';
import { calculateOrderPrintPages, evaluatePageLimit } from '../src/page-count.js';

describe('page cap enforcement', () => {
  it('allows exactly 100 pages', () => {
    const usage = evaluatePageLimit([{ selectedPagesAfterEdit: 50, copies: 2 }], 100);

    expect(usage.usedPages).toBe(100);
    expect(usage.blocked).toBe(false);
  });

  it('blocks 101 pages with required message', () => {
    const usage = evaluatePageLimit([{ selectedPagesAfterEdit: 101, copies: 1 }], 100);

    expect(usage.blocked).toBe(true);
    expect(usage.message).toBe(
      'Max 100 pages per order. Remove pages, reduce copies, or split into two orders.',
    );
  });

  it('applies n-up and duplex before counting', () => {
    const pages = calculateOrderPrintPages([
      { selectedPagesAfterEdit: 12, copies: 1, pagesPerSheet: 2, duplex: true },
    ]);

    expect(pages).toBe(3);
  });
});
