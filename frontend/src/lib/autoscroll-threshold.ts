/** Decide whether the feed should auto-scroll to bottom. */
export function shouldAutoScroll(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  thresholdPx = 120,
): boolean {
  const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
  return distanceFromBottom <= thresholdPx;
}
