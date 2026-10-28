const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function isRealDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function formatDateInput(value) {
  const raw = String(value ?? '');
  const match = raw.match(ISO_DATE_PATTERN);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
}

// Returns an ISO date, an empty string for an optional blank date, or null
// when the user has entered an incomplete or impossible date.
export function parseDateInput(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const isoMatch = raw.match(ISO_DATE_PATTERN);
  const localMatch = raw.match(LOCAL_DATE_PATTERN);
  const year = Number(isoMatch?.[1] || localMatch?.[3]);
  const month = Number(isoMatch?.[2] || localMatch?.[2]);
  const day = Number(isoMatch?.[3] || localMatch?.[1]);

  if (!year || !month || !day || !isRealDate(year, month, day)) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
