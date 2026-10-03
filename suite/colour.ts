/** Channels 0-255 from a computed colour: rgb()/rgba(), or color(srgb …) with 0-1 channels (e.g. from color-mix()). */
export const rgb = (c: string) => {
  const n = (c.replace(/^color\(\s*srgb/i, '').match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  return /^color\(\s*srgb/i.test(c) ? n.map(v => Math.round(v * 255)) : n;
};
