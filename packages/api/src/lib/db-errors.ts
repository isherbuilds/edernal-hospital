export function isUniqueConstraintError(error: unknown, constraintName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (
    "code" in error &&
    "constraint_name" in error &&
    error.code === "23505" &&
    error.constraint_name === constraintName
  );
}
