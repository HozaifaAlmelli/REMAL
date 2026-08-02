export class ApiError extends Error {
  public readonly status: number;
  public readonly errors: string[];
  public readonly code: string | null;
  public readonly metadata: Record<string, unknown> | null;

  constructor(
    status: number,
    message: string,
    errors: string[] = [],
    code: string | null = null,
    metadata: Record<string, unknown> | null = null
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.code = code;
    this.metadata = metadata;
  }

  // helper: is this a validation error with field details?
  hasFieldErrors(): boolean {
    return this.status === 422 && this.errors.length > 0;
  }
}
