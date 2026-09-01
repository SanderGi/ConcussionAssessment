export function localDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localMidnight(dateValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return NaN;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return NaN;
  }
  return date.getTime();
}

export function localDateRange(startValue, endValue) {
  const start = localMidnight(startValue);
  const endStart = localMidnight(endValue);
  if (!Number.isFinite(start) || !Number.isFinite(endStart) || start > endStart) {
    throw new Error("Invalid export date range.");
  }
  const endDate = new Date(endStart);
  endDate.setDate(endDate.getDate() + 1);
  return [start, endDate.getTime()];
}

export function safeFilenameSegment(value, fallback = "item") {
  const segment = String(value ?? "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80);
  return segment || fallback;
}

export function localTimestampFilename(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "unknown-date";
  return `${localDateInputValue(date)}_${String(date.getHours()).padStart(
    2,
    "0"
  )}-${String(date.getMinutes()).padStart(2, "0")}-${String(
    date.getSeconds()
  ).padStart(2, "0")}`;
}
