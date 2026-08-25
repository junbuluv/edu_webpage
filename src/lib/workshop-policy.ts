export const WORKSHOP_TIME_ZONE = 'America/New_York';
export const WORKSHOP_SECTIONS = ['CML', 'CTL', 'CWL', 'CRL'] as const;
export type WorkshopSection = (typeof WORKSHOP_SECTIONS)[number];
export type WorkshopWindowStatus = 'upcoming' | 'open' | 'closed' | 'cancelled';

export function canUseStudentWorkshopAttendance(
  role: string | null | undefined,
): boolean {
  return role === 'student';
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SECTION_WEEKDAY: Record<WorkshopSection, number> = {
  CML: 1,
  CTL: 2,
  CWL: 3,
  CRL: 4,
};

interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export type WallTimeResult =
  | {
      ok: true;
      date: Date;
      iso: string;
      weekOf: string;
      weekday: number;
    }
  | { ok: false; reason: 'invalid' | 'nonexistent' | 'ambiguous' };

const wallFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: WORKSHOP_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const displayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: WORKSHOP_TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const weekFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  dateStyle: 'medium',
});

function readPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  return Number(parts.find((part) => part.type === type)?.value ?? NaN);
}

function wallPartsAt(date: Date): WallParts {
  const parts = wallFormatter.formatToParts(date);
  return {
    year: readPart(parts, 'year'),
    month: readPart(parts, 'month'),
    day: readPart(parts, 'day'),
    hour: readPart(parts, 'hour'),
    minute: readPart(parts, 'minute'),
  };
}

function parseWallParts(raw: string): WallParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const parts: WallParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  if (
    parts.month < 1 ||
    parts.month > 12 ||
    parts.day < 1 ||
    parts.day > 31 ||
    parts.hour < 0 ||
    parts.hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59
  ) {
    return null;
  }
  const calendarCheck = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day),
  );
  if (
    calendarCheck.getUTCFullYear() !== parts.year ||
    calendarCheck.getUTCMonth() !== parts.month - 1 ||
    calendarCheck.getUTCDate() !== parts.day
  ) {
    return null;
  }
  return parts;
}

function sameWallParts(a: WallParts, b: WallParts): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute
  );
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function mondayFor(parts: WallParts): string {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (isoWeekday - 1));
  return isoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

export function parseNewYorkWallTime(raw: string): WallTimeResult {
  const target = parseWallParts(raw);
  if (!target) return { ok: false, reason: 'invalid' };

  const naiveUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
  );
  const matches: number[] = [];
  for (
    let offsetMinutes = -14 * 60;
    offsetMinutes <= 14 * 60;
    offsetMinutes += 15
  ) {
    const candidate = naiveUtc - offsetMinutes * 60_000;
    if (sameWallParts(wallPartsAt(new Date(candidate)), target)) {
      matches.push(candidate);
    }
  }
  const unique = [...new Set(matches)];
  if (unique.length === 0) return { ok: false, reason: 'nonexistent' };
  if (unique.length > 1) return { ok: false, reason: 'ambiguous' };

  const date = new Date(unique[0]);
  const weekdayDate = new Date(
    Date.UTC(target.year, target.month - 1, target.day),
  );
  return {
    ok: true,
    date,
    iso: date.toISOString(),
    weekOf: mondayFor(target),
    weekday: weekdayDate.getUTCDay() === 0 ? 7 : weekdayDate.getUTCDay(),
  };
}

export function newYorkDateTimeInputValue(date: Date): string {
  const parts = wallPartsAt(date);
  return `${isoDate(parts.year, parts.month, parts.day)}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function formatNewYorkDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : displayFormatter.format(date);
}

export function formatWeekOf(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isNaN(date.getTime()) ? value : weekFormatter.format(date);
}

export type NewYorkReportingRange = 'week' | 'month';

export function newYorkReportingRangeStartISO(
  range: NewYorkReportingRange,
  now = new Date(),
): string {
  const current = wallPartsAt(now);
  const startDate =
    range === 'week'
      ? mondayFor(current)
      : isoDate(current.year, current.month, 1);
  const parsed = parseNewYorkWallTime(`${startDate}T00:00`);
  if (!parsed.ok) {
    throw new Error(`Could not resolve New York ${range} boundary`);
  }
  return parsed.iso;
}

export function sectionMatchesWeekday(
  section: WorkshopSection,
  isoWeekday: number,
): boolean {
  return SECTION_WEEKDAY[section] === isoWeekday;
}

export function validWorkshopWindow(opensAt: Date, closesAt: Date): boolean {
  const duration = closesAt.getTime() - opensAt.getTime();
  return duration > 0 && duration <= 24 * 60 * 60 * 1000;
}

export function validCoordinates(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function validRadiusMeters(radius: number): boolean {
  return (
    Number.isFinite(radius) &&
    Number.isInteger(radius) &&
    radius >= 10 &&
    radius <= 50_000
  );
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function workshopDeviceDedupeInput(
  administrationId: string,
  deviceId: string,
): string {
  return `workshop-device-v1:${administrationId}:${deviceId}`;
}

export function workshopWindowStatus(
  opensAt: string,
  closesAt: string,
  cancelledAt: string | null,
  nowMs = Date.now(),
): WorkshopWindowStatus {
  if (cancelledAt) return 'cancelled';
  if (nowMs < Date.parse(opensAt)) return 'upcoming';
  if (nowMs > Date.parse(closesAt)) return 'closed';
  return 'open';
}

export interface WorkshopEnrollment {
  courseSlug: string;
  semester: string;
  section: string | null;
  instructorId: string;
}

export interface WorkshopAdministrationScope {
  courseSlug: string;
  semester: string;
  section: string | null;
  instructorId: string;
}

export type EnrollmentMatch =
  | 'ok'
  | 'not_enrolled'
  | 'wrong_instructor'
  | 'section_assignment_required'
  | 'wrong_section';

export function matchWorkshopEnrollment(
  enrollment: WorkshopEnrollment | null,
  administration: WorkshopAdministrationScope,
): EnrollmentMatch {
  if (
    !enrollment ||
    enrollment.courseSlug !== administration.courseSlug ||
    enrollment.semester !== administration.semester
  ) {
    return 'not_enrolled';
  }
  if (enrollment.instructorId !== administration.instructorId) {
    return 'wrong_instructor';
  }
  if (administration.section == null) return 'ok';
  if (enrollment.section == null) return 'section_assignment_required';
  return enrollment.section === administration.section ? 'ok' : 'wrong_section';
}

export interface WorkshopQuestion {
  id: string;
  prompt: string;
  notes?: string;
}

export function publicWorkshopQuestions(
  questions: WorkshopQuestion[],
): Array<Pick<WorkshopQuestion, 'id' | 'prompt'>> {
  return questions.map(({ id, prompt }) => ({ id, prompt }));
}

export function canRevealWorkshopQuestions(
  stamped: boolean,
  revealedAt: string | null,
): boolean {
  return stamped && revealedAt != null;
}
