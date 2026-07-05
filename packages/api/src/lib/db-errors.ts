function matchesUniqueConstraint(error: unknown, constraintName: string): boolean {
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

export function isUniqueConstraintError(error: unknown, constraintName: string) {
  if (matchesUniqueConstraint(error, constraintName)) {
    return true;
  }

  const cause =
    error && typeof error === "object" && "cause" in error
      ? (error as { cause: unknown }).cause
      : null;

  return matchesUniqueConstraint(cause, constraintName);
}
