import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { StudentSubjectAnalytics } from './entities/student-subject-analytics.entity';
import { StudentDailyAnalytics } from './entities/student-daily-analytics.entity';
import { StudentStreak } from './entities/student-streak.entity';
import { PlatformDailyAnalytics } from './entities/platform-daily-analytics.entity';
import { AffiliateDailyAnalytics } from './entities/affiliate-daily-analytics.entity';

/**
 * Get the calendar date parts (year, month-0indexed, day, day-of-week)
 * for `now` expressed in the given IANA timezone.
 */
function getLocalDateParts(
  now: Date,
  timezone: string,
): { year: number; month: number; day: number; dow: number } {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const year = parseInt(parts.year, 10);
  const month = parseInt(parts.month, 10) - 1; // 0-indexed
  const day = parseInt(parts.day, 10);
  const dow = new Date(Date.UTC(year, month, day)).getUTCDay(); // 0=Sun
  return { year, month, day, dow };
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(StudentSubjectAnalytics)
    private studentSubjectAnalyticsRepo: Repository<StudentSubjectAnalytics>,
    @InjectRepository(StudentDailyAnalytics)
    private studentDailyAnalyticsRepo: Repository<StudentDailyAnalytics>,
    @InjectRepository(StudentStreak)
    private studentStreakRepo: Repository<StudentStreak>,
    @InjectRepository(PlatformDailyAnalytics)
    private platformDailyAnalyticsRepo: Repository<PlatformDailyAnalytics>,
    @InjectRepository(AffiliateDailyAnalytics)
    private affiliateDailyAnalyticsRepo: Repository<AffiliateDailyAnalytics>,
  ) {}

  /**
   * Returns per-subject accuracy scores for a student, grouped by date for chart rendering.
   * Follows CHART_DATA_RULES: timezone-aware skeleton, zero-filling, returns [] when all zero.
   *
   * Output format matches recharts AreaChart expectations:
   *   data: [{ name: "2024-01-07", "Mathematics": 75, "English": 82 }, ...]
   *   subjects: [{ id, name }, ...]
   *   period: the resolved granularity string ("day" | "week" | "month")
   */
  async getSubjectScoresForChart(
    studentId: string,
    examTypeId: string,
    options: {
      granularity?: 'day' | 'week' | 'month';
      timezone?: string;
    } = {},
  ): Promise<{
    data: Record<string, string | number>[];
    subjects: { id: string; name: string }[];
    granularity: string;
  }> {
    const granularity = options.granularity ?? 'month';
    const timezone = options.timezone ?? 'UTC';

    const now = new Date();
    const {
      year: localYear,
      month: localMonth,
      day: localDay,
      dow: localDow,
    } = getLocalDateParts(now, timezone);

    const fmtDay = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    // ── 1. Query window with ±2-day buffer ───────────────────────────────────
    // Calendar windows per CHART_DATA_RULES:
    //   day   = Sunday of current week → today (max 7 points)
    //   week  = first Sunday on/before 1st of current month → today (≤5 points)
    //   month = Jan 1 of current year → today (≤12 points)
    const DAY_MS = 24 * 60 * 60 * 1000;
    const today = new Date(Date.UTC(localYear, localMonth, localDay));
    let localWindowStart: Date;
    if (granularity === 'day') {
      // Sunday of current week
      localWindowStart = new Date(
        Date.UTC(localYear, localMonth, localDay - localDow),
      );
    } else if (granularity === 'week') {
      // First Sunday on or before the 1st of the current month
      const monthFirst = new Date(Date.UTC(localYear, localMonth, 1));
      const firstDow = monthFirst.getUTCDay();
      localWindowStart = new Date(monthFirst.getTime() - firstDow * DAY_MS);
    } else {
      // Jan 1 of current year
      localWindowStart = new Date(Date.UTC(localYear, 0, 1));
    }
    const localWindowEnd = today;
    const queryStart = new Date(localWindowStart.getTime() - 2 * DAY_MS);
    const queryEnd = new Date(localWindowEnd.getTime() + 2 * DAY_MS);

    // ── 2. Fetch records in window ───────────────────────────────────────────
    // StudentSubjectAnalytics.date is a plain DATE column (server UTC date).
    // The ±2-day buffer ensures timezone-edge records are captured.
    const records = await this.studentSubjectAnalyticsRepo.find({
      where: {
        studentId,
        examTypeId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        date: Between(queryStart, queryEnd) as any,
      },
      relations: ['subject'],
      order: { date: 'ASC' },
    });

    // ── 3. Collect unique subjects ───────────────────────────────────────────
    const subjectMap = new Map<string, string>(); // subjectId → name
    records.forEach((r) => {
      if (r.subject) subjectMap.set(r.subjectId, r.subject.name);
    });
    const subjects = Array.from(subjectMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));

    if (records.length === 0) {
      return { data: [], subjects: [], granularity };
    }

    // ── 4. Group by local date (day-level) ───────────────────────────────────
    // Convert the stored UTC DATE value to the student's local calendar date.
    const toLocalDateStr = (d: Date): string => {
      try {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d);
      } catch {
        return fmtDay(d);
      }
    };

    const dayMap = new Map<
      string,
      Map<string, { correct: number; total: number }>
    >();
    for (const record of records) {
      if (!record.subject) continue;
      const dayKey = toLocalDateStr(new Date(record.date));
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Map());
      const subjectStats = dayMap.get(dayKey)!;
      const subjectName = record.subject.name;
      const prev = subjectStats.get(subjectName) ?? { correct: 0, total: 0 };
      prev.total += record.questionsAttempted;
      prev.correct += record.questionsCorrect;
      subjectStats.set(subjectName, prev);
    }

    // ── 5. Bucket by granularity (week → Sunday key; month → YYYY-MM key) ───
    type SubjectStats = Map<string, { correct: number; total: number }>;
    let bucketMap: Map<string, SubjectStats>;

    if (granularity === 'week') {
      bucketMap = new Map();
      for (const [dayKey, subjectStats] of dayMap) {
        const [dy, dm, dd] = dayKey.split('-').map(Number);
        const d = new Date(Date.UTC(dy, dm - 1, dd));
        const sun = new Date(Date.UTC(dy, dm - 1, dd - d.getUTCDay()));
        const wk = fmtDay(sun);
        if (!bucketMap.has(wk)) bucketMap.set(wk, new Map());
        const wkMap = bucketMap.get(wk)!;
        for (const [subjectName, stats] of subjectStats) {
          const prev = wkMap.get(subjectName) ?? { correct: 0, total: 0 };
          prev.correct += stats.correct;
          prev.total += stats.total;
          wkMap.set(subjectName, prev);
        }
      }
    } else if (granularity === 'month') {
      bucketMap = new Map();
      for (const [dayKey, subjectStats] of dayMap) {
        const mk = dayKey.slice(0, 7); // 'YYYY-MM'
        if (!bucketMap.has(mk)) bucketMap.set(mk, new Map());
        const mMap = bucketMap.get(mk)!;
        for (const [subjectName, stats] of subjectStats) {
          const prev = mMap.get(subjectName) ?? { correct: 0, total: 0 };
          prev.correct += stats.correct;
          prev.total += stats.total;
          mMap.set(subjectName, prev);
        }
      }
    } else {
      bucketMap = dayMap;
    }

    // ── 6. Build skeleton + zero-fill ────────────────────────────────────────
    const result: Record<string, string | number>[] = [];
    let hasNonZero = false;

    const buildPoint = (
      periodStr: string,
      bucketKey: string,
    ): Record<string, string | number> => {
      const point: Record<string, string | number> = { name: periodStr };
      const slotStats = bucketMap.get(bucketKey);
      for (const subjectName of subjectMap.values()) {
        const stats = slotStats?.get(subjectName);
        const accuracy =
          stats && stats.total > 0
            ? Math.round((stats.correct / stats.total) * 1000) / 10
            : 0;
        point[subjectName] = accuracy;
        if (accuracy > 0) hasNonZero = true;
      }
      return point;
    };

    if (granularity === 'day') {
      // Sunday of current week → today (max 7 points)
      const cur = new Date(
        Date.UTC(localYear, localMonth, localDay - localDow),
      );
      while (cur <= today) {
        const key = fmtDay(cur);
        result.push(buildPoint(key, key));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    } else if (granularity === 'week') {
      // Weeks of current month (Sunday-anchored, ≤5 points)
      const monthFirst = new Date(Date.UTC(localYear, localMonth, 1));
      const firstDow = monthFirst.getUTCDay();
      const cur = new Date(monthFirst.getTime() - firstDow * DAY_MS);
      while (cur <= today) {
        const key = fmtDay(cur);
        result.push(buildPoint(key, key));
        cur.setUTCDate(cur.getUTCDate() + 7);
      }
    } else {
      // Months of current year Jan → current month (≤12 points)
      for (let m = 0; m <= localMonth; m++) {
        const mm = String(m + 1).padStart(2, '0');
        const key = `${localYear}-${mm}`;
        const periodStr = `${localYear}-${mm}-01`;
        result.push(buildPoint(periodStr, key));
      }
    }

    // Return [] when all slots are zero (signals "no data yet" to frontend)
    if (!hasNonZero) return { data: [], subjects: [], granularity };

    return { data: result, subjects, granularity };
  }

  /**
   * Returns the student's streak data, or defaults if no record exists.
   */
  async getStudentStreak(studentId: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    lastActivityDate: string | null;
  }> {
    const streak = await this.studentStreakRepo.findOne({
      where: { studentId },
    });

    if (!streak) {
      return { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
    }

    const lastActivityDate = streak.lastActivityDate
      ? new Date(streak.lastActivityDate as unknown as string)
          .toISOString()
          .split('T')[0]
      : null;

    // Pull-model reset: if the student hasn't checked in today, their active
    // streak is broken for display purposes. We return 0 without touching the DB —
    // the push model (interceptor) will write the correct value on next login.
    const todayISO = new Date().toISOString().split('T')[0];
    const effectiveStreak =
      lastActivityDate === todayISO ? streak.currentStreak : 0;

    return {
      currentStreak: effectiveStreak,
      longestStreak: streak.longestStreak,
      lastActivityDate,
    };
  }

  /**
   * Returns this-month vs last-month accuracy for the stat card delta display.
   * Weighted accuracy = SUM(questionsCorrect) / SUM(questionsAttempted) per calendar month.
   */
  async getMonthlyAccuracyDelta(
    studentId: string,
    examTypeId: string,
  ): Promise<{
    thisMonth: number | null;
    lastMonth: number | null;
    delta: number | null;
  }> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month

    const [thisRow, lastRow] = await Promise.all([
      this.studentDailyAnalyticsRepo
        .createQueryBuilder('sda')
        .select('SUM(sda."questionsCorrect")', 'correct')
        .addSelect('SUM(sda."questionsAttempted")', 'attempted')
        .where('sda."studentId" = :studentId', { studentId })
        .andWhere('sda."examTypeId" = :examTypeId', { examTypeId })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        .andWhere('sda.date BETWEEN :start AND :end', {
          start: thisMonthStart,
          end: now,
        } as any)
        .getRawOne<{ correct: string; attempted: string }>(),
      this.studentDailyAnalyticsRepo
        .createQueryBuilder('sda')
        .select('SUM(sda."questionsCorrect")', 'correct')
        .addSelect('SUM(sda."questionsAttempted")', 'attempted')
        .where('sda."studentId" = :studentId', { studentId })
        .andWhere('sda."examTypeId" = :examTypeId', { examTypeId })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        .andWhere('sda.date BETWEEN :start AND :end', {
          start: lastMonthStart,
          end: lastMonthEnd,
        } as any)
        .getRawOne<{ correct: string; attempted: string }>(),
    ]);

    const calc = (row: { correct: string; attempted: string } | undefined) => {
      const a = parseInt(row?.attempted ?? '0', 10);
      const c = parseInt(row?.correct ?? '0', 10);
      return a > 0 ? Math.round((c / a) * 100) : null;
    };

    const thisMonth = calc(thisRow ?? undefined);
    const lastMonth = calc(lastRow ?? undefined);
    let delta: number | null;
    if (thisMonth !== null && lastMonth !== null) {
      delta = thisMonth - lastMonth;
    } else if (thisMonth !== null && (lastMonth === null || lastMonth === 0)) {
      // No last-month data but we have this month — full improvement from nothing
      delta = 100;
    } else {
      delta = null;
    }
    return { thisMonth, lastMonth, delta };
  }

  // ─── Analytics Read Methods (for Analytics Page) ─────────────────

  /**
   * Helper: derive UTC query window from a reference period string + granularity.
   * period: ISO date string (e.g. "2026-01-15"). Defaults to now.
   */
  private getPeriodWindow(
    period: string | undefined,
    granularity: 'day' | 'week' | 'month',
    timezone: string,
  ): {
    queryStart: Date;
    queryEnd: Date;
    localYear: number;
    localMonth: number;
    localDay: number;
    localDow: number;
  } {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const refDate = period ? new Date(period + 'T12:00:00Z') : new Date();
    const { year, month, day, dow } = getLocalDateParts(refDate, timezone);

    let windowStart: Date;
    let windowEnd: Date;
    if (granularity === 'month') {
      windowStart = new Date(Date.UTC(year, month, 1));
      windowEnd = new Date(Date.UTC(year, month + 1, 0));
    } else {
      // week or day → show the full week containing the reference date
      windowStart = new Date(Date.UTC(year, month, day - dow));
      windowEnd = new Date(Date.UTC(year, month, day - dow + 6));
    }
    return {
      queryStart: new Date(windowStart.getTime() - 2 * DAY_MS),
      queryEnd: new Date(windowEnd.getTime() + 2 * DAY_MS),
      localYear: year,
      localMonth: month,
      localDay: day,
      localDow: dow,
    };
  }

  /**
   * Analytics Chart 1 — Time-series accuracy per subject for a custom date range.
   * Returns same structure as getSubjectScoresForChart (for recharts AreaChart).
   * Granularity is auto-determined from the range length:
   *   range ≤ 14 days → day  |  ≤ 90 days → week  |  > 90 days → month
   */
  async getAnalyticsSubjectScoresForRange(
    studentId: string,
    examTypeId: string,
    startDate: string | undefined,
    endDate: string | undefined,
    timezone: string,
  ): Promise<{
    data: Record<string, string | number>[];
    subjects: { id: string; name: string }[];
    granularity: string;
  }> {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = new Date();
    const {
      year: localYear,
      month: localMonth,
      day: localDay,
    } = getLocalDateParts(now, timezone);
    const today = new Date(Date.UTC(localYear, localMonth, localDay));

    const fmtDay = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    // Resolve start/end dates (fake UTC)
    const rangeStart = startDate
      ? new Date(startDate + 'T00:00:00Z')
      : new Date(Date.UTC(localYear, localMonth, 1)); // default: start of current month
    const rangeEnd = endDate ? new Date(endDate + 'T00:00:00Z') : today;

    const rangeDays =
      Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS) + 1;
    const granularity: 'day' | 'week' | 'month' =
      rangeDays <= 14 ? 'day' : rangeDays <= 90 ? 'week' : 'month';

    // Query with ±2-day buffer
    const queryStart = new Date(rangeStart.getTime() - 2 * DAY_MS);
    const queryEnd = new Date(rangeEnd.getTime() + 2 * DAY_MS);

    const allRecords = await this.studentSubjectAnalyticsRepo
      .createQueryBuilder('ssa')
      .leftJoinAndSelect('ssa.subject', 'subject')
      .where('ssa."studentId" = :studentId', { studentId })
      .andWhere('ssa."examTypeId" = :examTypeId', { examTypeId })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      .andWhere('ssa.date BETWEEN :start AND :end', {
        start: queryStart,
        end: queryEnd,
      } as any)
      .orderBy('ssa.date', 'ASC')
      .getMany()
      .catch(() => []);

    // Collect subjects
    const subjectMap = new Map<string, string>();
    allRecords.forEach((r) => {
      if (r.subject) subjectMap.set(r.subjectId, r.subject.name);
    });
    const subjects = Array.from(subjectMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));

    if (allRecords.length === 0) return { data: [], subjects: [], granularity };

    // Convert to local date string
    const toLocalDateStr = (d: Date): string => {
      try {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d);
      } catch {
        return fmtDay(d);
      }
    };

    // Day-level map
    const dayMap = new Map<
      string,
      Map<string, { correct: number; total: number }>
    >();
    for (const record of allRecords) {
      if (!record.subject) continue;
      const dayKey = toLocalDateStr(new Date(record.date));
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Map());
      const subjectStats = dayMap.get(dayKey)!;
      const subjectName = record.subject.name;
      const prev = subjectStats.get(subjectName) ?? { correct: 0, total: 0 };
      prev.total += record.questionsAttempted;
      prev.correct += record.questionsCorrect;
      subjectStats.set(subjectName, prev);
    }

    // Bucket by granularity
    type SubjectStats = Map<string, { correct: number; total: number }>;
    let bucketMap: Map<string, SubjectStats>;

    if (granularity === 'week') {
      bucketMap = new Map();
      for (const [dayKey, subjectStats] of dayMap) {
        const [dy, dm, dd] = dayKey.split('-').map(Number);
        const d = new Date(Date.UTC(dy, dm - 1, dd));
        const sun = new Date(Date.UTC(dy, dm - 1, dd - d.getUTCDay()));
        const wk = fmtDay(sun);
        if (!bucketMap.has(wk)) bucketMap.set(wk, new Map());
        const wkMap = bucketMap.get(wk)!;
        for (const [subjectName, stats] of subjectStats) {
          const prev = wkMap.get(subjectName) ?? { correct: 0, total: 0 };
          prev.correct += stats.correct;
          prev.total += stats.total;
          wkMap.set(subjectName, prev);
        }
      }
    } else if (granularity === 'month') {
      bucketMap = new Map();
      for (const [dayKey, subjectStats] of dayMap) {
        const mk = dayKey.slice(0, 7);
        if (!bucketMap.has(mk)) bucketMap.set(mk, new Map());
        const mMap = bucketMap.get(mk)!;
        for (const [subjectName, stats] of subjectStats) {
          const prev = mMap.get(subjectName) ?? { correct: 0, total: 0 };
          prev.correct += stats.correct;
          prev.total += stats.total;
          mMap.set(subjectName, prev);
        }
      }
    } else {
      bucketMap = dayMap;
    }

    // Build skeleton
    const result: Record<string, string | number>[] = [];
    let hasNonZero = false;

    const buildPoint = (
      periodStr: string,
      bucketKey: string,
    ): Record<string, string | number> => {
      const point: Record<string, string | number> = { name: periodStr };
      const slotStats = bucketMap.get(bucketKey);
      for (const subjectName of subjectMap.values()) {
        const stats = slotStats?.get(subjectName);
        const accuracy =
          stats && stats.total > 0
            ? Math.round((stats.correct / stats.total) * 1000) / 10
            : 0;
        point[subjectName] = accuracy;
        if (accuracy > 0) hasNonZero = true;
      }
      return point;
    };

    if (granularity === 'day') {
      const cur = new Date(rangeStart);
      while (cur <= rangeEnd) {
        const key = fmtDay(cur);
        result.push(buildPoint(key, key));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    } else if (granularity === 'week') {
      // First Sunday on or before rangeStart
      const dow = rangeStart.getUTCDay();
      const cur = new Date(rangeStart.getTime() - dow * DAY_MS);
      while (cur <= rangeEnd) {
        const key = fmtDay(cur);
        result.push(buildPoint(key, key));
        cur.setUTCDate(cur.getUTCDate() + 7);
      }
    } else {
      // Monthly
      const cur = new Date(
        Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1),
      );
      const endMonth = new Date(
        Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), 1),
      );
      while (cur <= endMonth) {
        const yr = cur.getUTCFullYear();
        const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
        const key = `${yr}-${mm}`;
        result.push(buildPoint(`${yr}-${mm}-01`, key));
        cur.setUTCMonth(cur.getUTCMonth() + 1);
      }
    }

    if (!hasNonZero) return { data: [], subjects: [], granularity };
    return { data: result, subjects, granularity };
  }

  /**
   * Chart 2 — Accuracy over time (progress chart).
   * Always calendar-relative to "now" per CHART_DATA_RULES:
   *   day   → days of the current week (Sunday → today, max 7 points)
   *   week  → weeks of the current month (1st Sunday → today, ≤5 points)
   *   month → months of the current year (Jan → current month, ≤12 points)
   */
  async getAnalyticsProgressOverTime(
    studentId: string,
    examTypeId: string,
    granularity: 'day' | 'week' | 'month',
    timezone: string,
  ): Promise<{
    data: { period: string; accuracy: number }[];
    granularity: string;
  }> {
    const DAY_MS = 24 * 60 * 60 * 1000;

    const {
      year: localYear,
      month: localMonth,
      day: localDay,
      dow: localDow,
    } = getLocalDateParts(new Date(), timezone);
    const today = new Date(Date.UTC(localYear, localMonth, localDay));

    const fmtDay = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    // ── 1. Calendar query window ─────────────────────────────────────────────
    let queryStart: Date;
    const queryEnd = new Date(today.getTime() + 2 * DAY_MS);

    if (granularity === 'day') {
      const weekStart = new Date(
        Date.UTC(localYear, localMonth, localDay - localDow),
      );
      queryStart = new Date(weekStart.getTime() - 2 * DAY_MS);
    } else if (granularity === 'week') {
      const monthStart = new Date(Date.UTC(localYear, localMonth, 1));
      const firstDow = monthStart.getUTCDay();
      const weekAnchor = new Date(monthStart.getTime() - firstDow * DAY_MS);
      queryStart = new Date(weekAnchor.getTime() - 2 * DAY_MS);
    } else {
      queryStart = new Date(
        new Date(Date.UTC(localYear, 0, 1)).getTime() - 2 * DAY_MS,
      );
    }

    // ── 2. Fetch records ─────────────────────────────────────────────────────
    const records = await this.studentDailyAnalyticsRepo.find({
      where: {
        studentId,
        examTypeId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        date: Between(queryStart, queryEnd) as any,
      },
      order: { date: 'ASC' },
    });

    // ── 3. Build day-level dataMap ───────────────────────────────────────────
    const dataMap = new Map<string, { correct: number; attempted: number }>();
    for (const r of records) {
      const d = r.date instanceof Date ? r.date : new Date(r.date);
      let dayKey: string;
      try {
        dayKey = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d);
      } catch {
        dayKey = fmtDay(d);
      }
      const prev = dataMap.get(dayKey) ?? { correct: 0, attempted: 0 };
      prev.correct += r.questionsCorrect ?? 0;
      prev.attempted += r.questionsAttempted ?? 0;
      dataMap.set(dayKey, prev);
    }

    // ── 4. Accuracy helpers ──────────────────────────────────────────────────
    const dayAccuracy = (key: string): number => {
      const s = dataMap.get(key);
      return s && s.attempted > 0
        ? Math.round((s.correct / s.attempted) * 1000) / 10
        : 0;
    };
    const weekAccuracy = (sunKey: string): number => {
      let correct = 0,
        attempted = 0;
      const sunDate = new Date(sunKey + 'T12:00:00Z');
      for (let i = 0; i < 7; i++) {
        const k = fmtDay(new Date(sunDate.getTime() + i * DAY_MS));
        const s = dataMap.get(k);
        if (s) {
          correct += s.correct;
          attempted += s.attempted;
        }
      }
      return attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;
    };
    const monthAccuracy = (yr: number, mo: number): number => {
      let correct = 0,
        attempted = 0;
      const mm = String(mo + 1).padStart(2, '0');
      const daysInMonth = new Date(Date.UTC(yr, mo + 1, 0)).getUTCDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const k = `${yr}-${mm}-${String(d).padStart(2, '0')}`;
        const s = dataMap.get(k);
        if (s) {
          correct += s.correct;
          attempted += s.attempted;
        }
      }
      return attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;
    };

    // ── 5. Build calendar skeleton ────────────────────────────────────────────
    const result: { period: string; accuracy: number }[] = [];

    if (granularity === 'month') {
      for (let m = 0; m <= localMonth; m++) {
        const mm = String(m + 1).padStart(2, '0');
        result.push({
          period: `${localYear}-${mm}-01`,
          accuracy: monthAccuracy(localYear, m),
        });
      }
    } else if (granularity === 'week') {
      const monthStart = new Date(Date.UTC(localYear, localMonth, 1));
      const firstDow = monthStart.getUTCDay();
      const cur = new Date(monthStart.getTime() - firstDow * DAY_MS);
      while (cur <= today) {
        result.push({
          period: fmtDay(cur),
          accuracy: weekAccuracy(fmtDay(cur)),
        });
        cur.setUTCDate(cur.getUTCDate() + 7);
      }
    } else {
      // day: Sunday through today
      const cur = new Date(
        Date.UTC(localYear, localMonth, localDay - localDow),
      );
      while (cur <= today) {
        const key = fmtDay(cur);
        result.push({ period: key, accuracy: dayAccuracy(key) });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    const hasData = result.some((r) => r.accuracy > 0);
    return { data: hasData ? result : [], granularity };
  }

  /**
   * Analytics Chart 1 — Simple per-subject average accuracy for a date range.
   * Queries student_subject_analytics, groups by subject, returns avg accuracy.
   * Output: [{ name: subjectName, Score: avgAccuracy }]
   */
  async getAnalyticsSubjectScoresBySubject(
    studentId: string,
    examTypeId: string,
    startDate: string | undefined,
    endDate: string | undefined,
  ): Promise<{ name: string; Score: number }[]> {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = new Date();
    const rangeStart = startDate
      ? new Date(startDate + 'T00:00:00Z')
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rangeEnd = endDate ? new Date(endDate + 'T23:59:59Z') : now;

    const queryStart = new Date(rangeStart.getTime() - 2 * DAY_MS);
    const queryEnd = new Date(rangeEnd.getTime() + 2 * DAY_MS);

    const rows = await this.studentSubjectAnalyticsRepo
      .createQueryBuilder('ssa')
      .select('sub.name', 'subjectName')
      .addSelect('SUM(ssa."questionsCorrect")', 'totalCorrect')
      .addSelect('SUM(ssa."questionsAttempted")', 'totalAttempted')
      .innerJoin('subjects', 'sub', 'sub.id = ssa."subjectId"')
      .where('ssa."studentId" = :studentId', { studentId })
      .andWhere('ssa."examTypeId" = :examTypeId', { examTypeId })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      .andWhere('ssa.date BETWEEN :start AND :end', {
        start: queryStart,
        end: queryEnd,
      } as any)
      .groupBy('ssa."subjectId"')
      .addGroupBy('sub.name')
      .orderBy('sub.name', 'ASC')
      .getRawMany<{
        subjectName: string;
        totalCorrect: string;
        totalAttempted: string;
      }>()
      .catch(
        () =>
          [] as {
            subjectName: string;
            totalCorrect: string;
            totalAttempted: string;
          }[],
      );

    return rows
      .filter((r) => parseInt(r.totalAttempted, 10) > 0)
      .map((r) => {
        const attempted = parseInt(r.totalAttempted, 10);
        const correct = parseInt(r.totalCorrect, 10);
        return {
          name: r.subjectName,
          Score:
            attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0,
        };
      });
  }

  /**
   * Chart 5 — Questions attempted per subject for a selected period.
   * For day granularity: filters strictly to the specific date (period param).
   * For week/month: uses the window containing the period date.
   * Returns [{ subjectId, subjectName, questionsAttempted }]
   */
  async getAnalyticsSubjectAttempts(
    studentId: string,
    examTypeId: string,
    granularity: 'day' | 'week' | 'month',
    period: string | undefined,
    timezone: string,
  ): Promise<
    { subjectId: string; subjectName: string; questionsAttempted: number }[]
  > {
    const DAY_MS = 24 * 60 * 60 * 1000;
    let queryStart: Date;
    let queryEnd: Date;

    if (granularity === 'day') {
      // Strict single-day filter with ±2-day buffer for timezone safety
      const dayDate = period ? new Date(period + 'T00:00:00Z') : new Date();
      queryStart = new Date(dayDate.getTime() - 2 * DAY_MS);
      queryEnd = new Date(dayDate.getTime() + 2 * DAY_MS);
    } else {
      const w = this.getPeriodWindow(period, granularity, timezone);
      queryStart = w.queryStart;
      queryEnd = w.queryEnd;
    }

    const rows = await this.studentSubjectAnalyticsRepo
      .createQueryBuilder('ssa')
      .select('ssa."subjectId"', 'subjectId')
      .addSelect('sub.name', 'subjectName')
      .addSelect('SUM(ssa."questionsAttempted")', 'questionsAttempted')
      .innerJoin('subjects', 'sub', 'sub.id = ssa."subjectId"')
      .where('ssa."studentId" = :studentId', { studentId })
      .andWhere('ssa."examTypeId" = :examTypeId', { examTypeId })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      .andWhere('ssa.date BETWEEN :start AND :end', {
        start: queryStart,
        end: queryEnd,
      } as any)
      .groupBy('ssa."subjectId"')
      .addGroupBy('sub.name')
      .orderBy('sub.name', 'ASC')
      .getRawMany<{
        subjectId: string;
        subjectName: string;
        questionsAttempted: string;
      }>()
      .catch(() => []);

    return rows.map((r) => ({
      subjectId: r.subjectId,
      subjectName: r.subjectName,
      questionsAttempted: parseInt(r.questionsAttempted, 10),
    }));
  }

  // ─── Analytics Write Methods ─────────────────────────────────────
  // Note: Callers should mark these with TODO for async migration

  /**
   * Updates daily analytics when a student answers questions.
   * Called from exams service when questions are answered.
   * Callers should mark with: TODO: Move to RabbitMQ/Kafka - non-blocking
   */
  async updateDailyAnalytics(
    studentId: string,
    examTypeId: string,
    data: {
      questionsAttempted?: number;
      questionsCorrect?: number;
      questionsWrong?: number;
      questionsUnanswered?: number;
      timeSpentSeconds?: number;
      scorePercentage?: number;
    },
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upsert daily record
    let record = await this.studentDailyAnalyticsRepo.findOne({
      where: { studentId, examTypeId, date: today },
    });

    if (!record) {
      record = this.studentDailyAnalyticsRepo.create({
        studentId,
        examTypeId,
        date: today,
      });
    }

    record.questionsAttempted =
      (record.questionsAttempted ?? 0) + (data.questionsAttempted ?? 0);
    record.questionsCorrect =
      (record.questionsCorrect ?? 0) + (data.questionsCorrect ?? 0);
    record.questionsWrong =
      (record.questionsWrong ?? 0) + (data.questionsWrong ?? 0);
    record.questionsUnanswered =
      (record.questionsUnanswered ?? 0) + (data.questionsUnanswered ?? 0);
    record.totalTimeSpentSeconds =
      (record.totalTimeSpentSeconds ?? 0) + (data.timeSpentSeconds ?? 0);

    if (record.questionsAttempted > 0) {
      record.accuracyPercentage =
        (record.questionsCorrect / record.questionsAttempted) * 100;
    }

    // Running mean for averageScore: (prev_avg * prev_count + new_score) / new_count
    const prevExams = record.examsCompleted ?? 0;
    record.examsCompleted = prevExams + 1;
    record.averageScore =
      (prevExams * (record.averageScore ?? 0) + (data.scorePercentage ?? 0)) /
      record.examsCompleted;

    await this.studentDailyAnalyticsRepo.save(record);
  }

  /**
   * Updates subject-specific analytics when questions are answered.
   * Callers should mark with: TODO: Move to RabbitMQ/Kafka - non-blocking
   */
  async updateSubjectAnalytics(
    studentId: string,
    examTypeId: string,
    subjectId: string,
    data: {
      questionsAttempted?: number;
      questionsCorrect?: number;
      questionsWrong?: number;
      essayQuestionsAttempted?: number;
    },
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let record = await this.studentSubjectAnalyticsRepo.findOne({
      where: { studentId, examTypeId, subjectId, date: today },
    });

    if (!record) {
      record = this.studentSubjectAnalyticsRepo.create({
        studentId,
        examTypeId,
        subjectId,
        date: today,
      });
    }

    record.questionsAttempted =
      (record.questionsAttempted ?? 0) + (data.questionsAttempted ?? 0);
    record.questionsCorrect =
      (record.questionsCorrect ?? 0) + (data.questionsCorrect ?? 0);
    record.questionsWrong =
      (record.questionsWrong ?? 0) + (data.questionsWrong ?? 0);
    record.essayQuestionsAttempted =
      (record.essayQuestionsAttempted ?? 0) +
      (data.essayQuestionsAttempted ?? 0);

    if (record.questionsAttempted > 0) {
      record.accuracyPercentage =
        (record.questionsCorrect / record.questionsAttempted) * 100;
    }

    await this.studentSubjectAnalyticsRepo.save(record);
  }

  /**
   * Updates student streak on login/activity.
   * Called from students service via interceptor.
   * Callers should mark with: TODO: Move to RabbitMQ/Kafka - non-blocking
   */
  async updateStudentStreak(studentId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = await this.studentStreakRepo.findOne({
      where: { studentId },
    });

    if (!streak) {
      streak = this.studentStreakRepo.create({
        studentId,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: today,
      });
      await this.studentStreakRepo.save(streak);
      return;
    }

    const lastActivity = streak.lastActivityDate
      ? new Date(streak.lastActivityDate)
      : null;

    if (lastActivity) {
      lastActivity.setHours(0, 0, 0, 0);
      const diffDays = Math.floor(
        (today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 0) {
        // Same day, no update needed
        return;
      } else if (diffDays === 1) {
        // Consecutive day, increment streak
        streak.currentStreak += 1;
        if (streak.currentStreak > streak.longestStreak) {
          streak.longestStreak = streak.currentStreak;
        }
      } else {
        // Gap > 1 day, reset streak
        streak.currentStreak = 1;
      }
    } else {
      streak.currentStreak = 1;
    }

    streak.lastActivityDate = today;
    await this.studentStreakRepo.save(streak);
  }

  // ─── Platform Analytics ─────────────────────────────────────────

  /**
   * Tracks platform-level daily analytics.
   * Use this for revenue, subscriptions, user signups, etc.
   * Callers should mark with: TODO: Move to RabbitMQ/Kafka - non-blocking
   *
   * @param data - Partial data to increment. All fields are optional and additive.
   */
  async trackPlatformAnalytics(data: {
    newStudents?: number;
    newSponsors?: number;
    newAffiliates?: number;
    activeStudents?: number;
    activeSponsors?: number;
    activeAffiliates?: number;
    totalRevenue?: number;
    totalExpenses?: number;
    newSubscriptions?: number;
    cancelledSubscriptions?: number;
    demoUsers?: number;
    premiumUsers?: number;
  }): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upsert today's platform analytics record
    let record = await this.platformDailyAnalyticsRepo.findOne({
      where: { date: today },
    });

    if (!record) {
      // TypeORM create() does NOT apply column defaults — initialize to 0
      record = this.platformDailyAnalyticsRepo.create({
        date: today,
        newStudents: 0,
        newSponsors: 0,
        newAffiliates: 0,
        activeStudents: 0,
        activeSponsors: 0,
        activeAffiliates: 0,
        totalRevenue: 0,
        totalExpenses: 0,
        totalProfit: 0,
        newSubscriptions: 0,
        cancelledSubscriptions: 0,
        demoUsers: 0,
        premiumUsers: 0,
      });
    }

    // Increment each provided field
    if (data.newStudents) record.newStudents += data.newStudents;
    if (data.newSponsors) record.newSponsors += data.newSponsors;
    if (data.newAffiliates) record.newAffiliates += data.newAffiliates;
    if (data.activeStudents) record.activeStudents += data.activeStudents;
    if (data.activeSponsors) record.activeSponsors += data.activeSponsors;
    if (data.activeAffiliates) record.activeAffiliates += data.activeAffiliates;
    if (data.totalRevenue) record.totalRevenue += data.totalRevenue;
    if (data.totalExpenses) record.totalExpenses += data.totalExpenses;
    if (data.newSubscriptions) record.newSubscriptions += data.newSubscriptions;
    if (data.cancelledSubscriptions)
      record.cancelledSubscriptions += data.cancelledSubscriptions;
    if (data.demoUsers) record.demoUsers += data.demoUsers;
    if (data.premiumUsers) record.premiumUsers += data.premiumUsers;

    // Recalculate profit
    record.totalProfit = record.totalRevenue - record.totalExpenses;

    await this.platformDailyAnalyticsRepo.save(record);
  }

  // ─── Affiliate Daily Analytics ─────────────────────────────────

  /**
   * Tracks affiliate-level daily analytics (referrals, conversions).
   * Currency-specific earnings are derived from Commission table at query time.
   * Callers should mark with: TODO: Move to Kafka/message queue for async processing
   */
  async trackAffiliateDailyAnalytics(
    affiliateId: string,
    data: {
      newReferrals?: number;
      conversions?: number;
    },
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let record = await this.affiliateDailyAnalyticsRepo.findOne({
      where: { affiliateId, date: today },
    });

    if (!record) {
      // TypeORM create() does NOT apply column defaults — initialize to 0
      record = this.affiliateDailyAnalyticsRepo.create({
        affiliateId,
        date: today,
        newReferrals: 0,
        conversions: 0,
      });
    }

    if (data.newReferrals) record.newReferrals += data.newReferrals;
    if (data.conversions) record.conversions += data.conversions;

    await this.affiliateDailyAnalyticsRepo.save(record);
  }
}
