export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: unknown;
  };
};

export class ClearError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    options: { retryable?: boolean; status?: number; details?: unknown } = {},
  ) {
    super(message);
    this.name = "ClearError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? 400;
    this.details = options.details;
  }
}

export function toErrorBody(error: ClearError): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
    },
  };
}
