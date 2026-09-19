import { describe, expect, it } from 'vitest';
import { calculateServerPrice } from '../src/pricing.js';

describe('pricing engine', () => {
  it('computes total server-side and rounds at end', () => {
    const result = calculateServerPrice(
      [
        {
          selectedPagesAfterEdit: 6,
          copies: 2,
          paper: 'A4',
          type: 'normal',
          color: 'bw',
          quality: 'normal',
        },
      ],
      {
        currency: 'INR',
        gst_percent: 18,
        platform_fee: 2,
        rounding: 'nearest_rupee',
        base: [{ paper: 'A4', type: 'normal', color: 'bw', slabs: [{ from: 1, to: 100, rate: 2 }] }],
      },
    );

    expect(result.subtotal).toBe(24);
    expect(result.tax).toBe(4.68);
    expect(result.total).toBe(31);
  });
});
