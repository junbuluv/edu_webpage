// Calibrated bond presets. Coupons and maturities are illustrative,
// not real-time security data. Yields are recent-history representative.

export interface BondSnapshot {
  coupon: number; // annual coupon rate (e.g. 0.05 = 5%)
  face: number; // face value in dollars
  maturity: number; // integer years
  yieldRate: number; // yield to maturity (e.g. 0.045 = 4.5%)
  zero: boolean; // zero-coupon bond
}

export interface BondPreset {
  id: string;
  label: string;
  state: BondSnapshot;
  blurb: string;
}

export const BOND_BASELINE: BondSnapshot = {
  coupon: 0.05,
  face: 1000,
  maturity: 10,
  yieldRate: 0.05,
  zero: false,
};

export const BOND_PRESETS: BondPreset[] = [
  {
    id: 'baseline',
    label: 'Baseline (5% coupon, 10y, par)',
    state: { ...BOND_BASELINE },
    blurb: 'Trading at par because coupon = YTM. Anchor for comparison.',
  },
  {
    id: 'treasury-10y',
    label: '10-year Treasury (~4.2% yield)',
    state: {
      coupon: 0.04,
      face: 1000,
      maturity: 10,
      yieldRate: 0.042,
      zero: false,
    },
    blurb:
      'Default-risk-free benchmark. Coupon is 4%; YTM 4.2% so it trades slightly below par.',
  },
  {
    id: 'treasury-30y',
    label: '30-year Treasury (~4.5% yield)',
    state: {
      coupon: 0.04,
      face: 1000,
      maturity: 30,
      yieldRate: 0.045,
      zero: false,
    },
    blurb:
      'Long-duration sovereign. Very sensitive to yield moves — try nudging YTM and watch the price react.',
  },
  {
    id: 'ig-corp',
    label: 'Investment-grade corporate (5.8% YTM)',
    state: {
      coupon: 0.055,
      face: 1000,
      maturity: 10,
      yieldRate: 0.058,
      zero: false,
    },
    blurb:
      'IBM-style A-rated 10-year. Credit spread over Treasury reflects modest default risk.',
  },
  {
    id: 'high-yield',
    label: 'High-yield (junk) corporate (10% YTM)',
    state: {
      coupon: 0.08,
      face: 1000,
      maturity: 7,
      yieldRate: 0.1,
      zero: false,
    },
    blurb:
      'Speculative-grade. Big coupon, even bigger YTM. Trades below par to compensate for credit risk.',
  },
  {
    id: 'tbill-zero',
    label: '1-year T-bill (zero-coupon)',
    state: {
      coupon: 0,
      face: 1000,
      maturity: 1,
      yieldRate: 0.05,
      zero: true,
    },
    blurb:
      'Short, default-risk-free zero-coupon. Macaulay duration ≈ maturity since there are no intermediate cash flows.',
  },
];
