/** Public hosting is a synthetic browser sandbox until live-service gates are implemented. */
export function isHostedDemo(): boolean {
  return process.env.VERCEL === "1" || process.env.CCR_HOSTED_DEMO === "1";
}
export function assertLocalStore(): void {
  if (isHostedDemo()) throw new Error("Server storage is disabled in the hosted demo.");
}
