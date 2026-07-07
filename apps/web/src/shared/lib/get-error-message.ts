import { isDefinedError, ORPCError } from "@tsu-stack/api/client/tanstack-start/orpc";

export function getErrorMessage<TError>(
  error: TError,
  fallback: string,
  definedErrorMessages: Partial<Record<string, string>> = {}
) {
  if (isDefinedError(error)) {
    return definedErrorMessages[error.code] ?? error.message ?? fallback;
  }

  if (error instanceof ORPCError) {
    return definedErrorMessages[error.code] ?? error.message ?? fallback;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}
