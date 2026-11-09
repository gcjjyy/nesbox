// Arcade framebuffer pixels are often non-square (for example 1943 is 224x256,
// displayed at 3:4). Match the core's display aspect to avoid a second letterbox.
export function arcadeDisplaySize(width: number, height: number, aspect: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const displayAspect = Number.isFinite(aspect) && aspect >= 0.5 && aspect <= 2.5 ? aspect : width / height;
  if (displayAspect < 0.5 || displayAspect > 2.5) return null;
  return { width: height * displayAspect, height };
}
