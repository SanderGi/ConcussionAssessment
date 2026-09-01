export function mergeTestsByUpdatedAt(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const incomingUpdatedAt = Number(value.test_updated_at ?? 0);
    const existingUpdatedAt = Number(target[key]?.test_updated_at ?? 0);
    if (!target[key] || existingUpdatedAt < incomingUpdatedAt) {
      target[key] = value;
    }
  }
  return target;
}

export function parseStoredTests(value) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
