import { calculateOrderPrintPages, type FilePageSelection } from './page-count.js';

export type PricingSlab = { from: number; to: number; rate: number };
export type PricingBaseRule = {
  paper: string;
  type: string;
  color: 'bw' | 'color';
  slabs: PricingSlab[];
};

export type PricingConfig = {
  currency: 'INR';
  gst_percent: number;
  platform_fee: number;
  rounding: 'nearest_rupee';
  base: PricingBaseRule[];
  multipliers?: {
    duplex?: number;
    quality_best?: number;
    quality_draft?: number;
  };
};

export type PricingFileInput = FilePageSelection & {
  paper: string;
  type: string;
  color: 'bw' | 'color';
  quality?: 'draft' | 'normal' | 'best';
};

const getRate = (qty: number, slabs: PricingSlab[]): number => {
  const slab = slabs.find((s) => qty >= s.from && qty <= s.to) ?? slabs[slabs.length - 1];
  return slab?.rate ?? 0;
};

export const calculateServerPrice = (files: PricingFileInput[], config: PricingConfig) => {
  const subtotal = files.reduce((sum, file) => {
    const rule = config.base.find(
      (r) => r.paper === file.paper && r.type === file.type && r.color === file.color,
    );
    if (!rule) {
      throw new Error(`Missing pricing rule for ${file.paper}/${file.type}/${file.color}`);
    }

    const sheetQty = calculateOrderPrintPages([file]);
    let amount = getRate(sheetQty, rule.slabs) * sheetQty;

    if (file.duplex && config.multipliers?.duplex) {
      amount *= config.multipliers.duplex;
    }
    if (file.quality === 'best' && config.multipliers?.quality_best) {
      amount *= config.multipliers.quality_best;
    }
    if (file.quality === 'draft' && config.multipliers?.quality_draft) {
      amount *= config.multipliers.quality_draft;
    }

    return sum + amount;
  }, 0);

  const tax = (subtotal + config.platform_fee) * (config.gst_percent / 100);
  const total = Math.round(subtotal + config.platform_fee + tax);

  return {
    subtotal: Number(subtotal.toFixed(2)),
    platformFee: config.platform_fee,
    tax: Number(tax.toFixed(2)),
    total,
    currency: config.currency,
  };
};
