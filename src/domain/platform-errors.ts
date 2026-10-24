/** Shared error identity without pulling schema initialization into simple browser hints. */
export class PlatformError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code);
    this.name = "PlatformError";
  }
}
export function invariant(
  condition: unknown,
  code: string,
  status = 400,
): asserts condition {
  if (!condition) throw new PlatformError(code, status);
}
