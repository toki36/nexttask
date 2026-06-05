export function toRFC3339(value: string) {
  return new Date(value).toISOString();
}

export function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRange(start: string, end: string) {
  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

export function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
  }).format(date);
}

export function isValidDateRange(start: string, end: string) {
  return Boolean(start && end && new Date(end).getTime() > new Date(start).getTime());
}

export function datePart(value: string) {
  return value.split("T")[0] ?? "";
}

export function dateKey(date: Date) {
  return toDateInputValue(date);
}

export function timePart(value: string) {
  return value.split("T")[1]?.slice(0, 5) ?? "";
}

export function withDatePart(value: string, date: string, fallbackTime: string) {
  if (!date) return "";
  return `${date}T${timePart(value) || fallbackTime}`;
}

export function withTimePart(value: string, time: string) {
  const date = datePart(value);
  if (!date || !time) return value;
  return `${date}T${time}`;
}

export function startOfAllDay(date: string) {
  return date ? `${date}T00:00` : "";
}

export function endOfAllDay(date: string) {
  if (!date) return "";
  const end = new Date(`${date}T00:00`);
  end.setDate(end.getDate() + 1);
  return `${toDateInputValue(end)}T00:00`;
}

export function isAllDayRange(start: string, end: string) {
  if (!start || !end || timePart(start) !== "00:00" || timePart(end) !== "00:00") return false;

  const startDate = datePart(start);
  const expectedEnd = endOfAllDay(startDate);
  return end === expectedEnd;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
