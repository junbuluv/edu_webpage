// Easing functions for value tweening. All map t in [0, 1] -> [0, 1].
// Reference: https://easings.net

export type EasingFn = (t: number) => number;

export const linear: EasingFn = (t) => t;

export const easeOutCubic: EasingFn = (t) => 1 - Math.pow(1 - t, 3);

export const easeInOutQuad: EasingFn = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// Slight overshoot at the end, useful for value labels snapping into place.
export const easeOutBack: EasingFn = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
