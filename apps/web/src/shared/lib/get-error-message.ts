import { isDefinedError, ORPCError } from "@tsu-stack/api/client/tanstack-start/orpc";

export function getErrorMessage<TError>(
  error: TError,
  fallback: string,
  definedErrorMessages: Partial<Record<string, string>> = {}
) {
  if (isDefinedError(error)) {
    return error.message ?? definedErrorMessages[error.code] ?? fallback;
  }

  if (error instanceof ORPCError) {
    return error.message ?? definedErrorMessages[error.code] ?? fallback;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}
