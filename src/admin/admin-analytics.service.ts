import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamAttempt } from '../students/entities/exam-attempt.entity';
import { PlatformDailyAnalytics } from '../analytics/entities/platform-daily-analytics.entity';
import { StudentSubjectAnalytics } from '../analytics/entities/student-subject-analytics.entity';
import { ExamAttemptStatus } from '../../types';

const COMPLETED_STATUSES = [
  ExamAttemptStatus.COMPLETED,
  ExamAttemptStatus.AUTO_SUBMITTED,
];

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectRepository(ExamAttempt)
    private examAttemptRepo: Repository<ExamAttempt>,
    @InjectRepository(PlatformDailyAnalytics)
    private platformAnalyticsRepo: Repository<PlatformDailyAnalytics>,
    @InjectRepository(StudentSubjectAnalytics)
    private subjectAnalyticsRepo: Repository<StudentSubjectAnalytics>,
  ) {}

  async getPlatformKpis() {
    const [completionsResult, avgResult, questionsResult] = await Promise.all([
      this.examAttemptRepo.count({
        where: COMPLETED_STATUSES.map((s) => ({ status: s })) as any,
      }),
      this.examAttemptRepo
        .createQueryBuilder('ea')
        .select('AVG(ea.scorePercentage)', 'avg')
        .where('ea.status IN (:...statuses)', { statuses: COMPLETED_STATUSES })
        .getRawOne<{ avg: string }>(),
      this.examAttemptRepo
        .createQueryBuilder('ea')
        .select('SUM(ea.correctAnswers + ea.wrongAnswers + ea.unanswered)', 'total')
        .where('ea.status IN (:...statuses)', { statuses: COMPLETED_STATUSES })
        .getRawOne<{ total: string }>(),
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const revenueResult = await this.platformAnalyticsRepo
      .createQueryBuilder('pda')
      .select('SUM(pda.totalRevenue)', 'total')
      .where('pda.date >= :start', { start: thirtyDaysAgo })
      .getRawOne<{ total: string }>();

    return {
      totalCompletions: completionsResult,
      avgScore: Math.round(parseFloat(avgResult?.avg ?? '0') * 10) / 10,
      totalRevenue: Math.round(parseFloat(revenueResult?.total ?? '0') * 100) / 100,
      totalQuestions: parseInt(questionsResult?.total ?? '0', 10),
    };
  }

  async getExamCompletions(granularity: 'day' | 'week' | 'month', timezone = 'UTC') {
    const { startDate, truncUnit } = this._dateRange(granularity);

    const rows = await this.examAttemptRepo
      .createQueryBuilder('ea')
      .select([
        `DATE_TRUNC('${truncUnit}', ea."createdAt" AT TIME ZONE '${timezone}') AS period`,
        'COUNT(*) AS count',
      ])
      .where('ea."createdAt" >= :start', { start: startDate })
      .andWhere('ea.status IN (:...statuses)', { statuses: COMPLETED_STATUSES })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<{ period: string; count: string }>();

    const map = new Map(rows.map((r) => [new Date(r.period).toISOString().slice(0, 10), r]));
    return this._generatePeriods(granularity).map((period) => ({
      name: period,
      Completions: Number(map.get(period)?.count ?? 0),
    }));
  }

  async getSubjectPerformance() {
    const rows = await this.subjectAnalyticsRepo
      .createQueryBuilder('ssa')
      .innerJoin('ssa.subject', 'sub')
      .select([
        'sub.name AS "subjectName"',
        'SUM(ssa.questionsAttempted) AS "totalAttempted"',
        'SUM(ssa.questionsCorrect) AS "totalCorrect"',
      ])
      .groupBy('sub.id, sub.name')
      .orderBy('"totalAttempted"', 'DESC')
      .limit(10)
      .getRawMany<{ subjectName: string; totalAttempted: string; totalCorrect: string }>();

    return rows.map((r) => ({
      name: r.subjectName,
      Accuracy:
        Number(r.totalAttempted) === 0
          ? 0
          : Math.round((Number(r.totalCorrect) / Number(r.totalAttempted)) * 100),
      Attempts: Number(r.totalAttempted),
    }));
  }

  async getQuestionDistribution() {
    const result = await this.examAttemptRepo
      .createQueryBuilder('ea')
      .select([
        'SUM(ea.correctAnswers) AS correct',
        'SUM(ea.wrongAnswers) AS wrong',
        'SUM(ea.unanswered) AS unanswered',
      ])
      .where('ea.status IN (:...statuses)', { statuses: COMPLETED_STATUSES })
      .getRawOne<{ correct: string; wrong: string; unanswered: string }>();

    return [
      { name: 'Correct', value: parseInt(result?.correct ?? '0', 10), fill: '#007FFF' },
      { name: 'Wrong', value: parseInt(result?.wrong ?? '0', 10), fill: '#A12161' },
      { name: 'Unanswered', value: parseInt(result?.unanswered ?? '0', 10), fill: '#F3A218' },
    ];
  }

  async getRevenueOverTime(granularity: 'day' | 'week' | 'month', timezone = 'UTC') {
    const { startDate, truncUnit } = this._dateRange(granularity);

    const rows = await this.platformAnalyticsRepo
      .createQueryBuilder('pda')
      .select([
        `DATE_TRUNC('${truncUnit}', pda.date::timestamp AT TIME ZONE '${timezone}') AS period`,
        'SUM(pda.totalRevenue) AS revenue',
        'SUM(pda.newSubscriptions) AS subscriptions',
      ])
      .where('pda.date >= :start', { start: startDate })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<{ period: string; revenue: string; subscriptions: string }>();

    const map = new Map(rows.map((r) => [new Date(r.period).toISOString().slice(0, 10), r]));
    return this._generatePeriods(granularity).map((period) => ({
      name: period,
      Revenue: Math.round(parseFloat(map.get(period)?.revenue ?? '0') * 100) / 100,
      Subscriptions: Number(map.get(period)?.subscriptions ?? 0),
    }));
  }

  async getExamTypeBreakdown() {
    const rows = await this.examAttemptRepo
      .createQueryBuilder('ea')
      .innerJoin('ea.examType', 'et')
      .select([
        'et.name AS name',
        'COUNT(*) AS completions',
        'AVG(ea.scorePercentage) AS "avgScore"',
      ])
      .where('ea.status IN (:...statuses)', { statuses: COMPLETED_STATUSES })
      .groupBy('et.id, et.name')
      .orderBy('completions', 'DESC')
      .getRawMany<{ name: string; completions: string; avgScore: string }>();

    const COLORS = ['#007FFF', '#A12161', '#4BABFF', '#D4527A', '#0052CC', '#E91E8C', '#66C2FF', '#8B1A50'];
    return rows.map((r, i) => ({
      name: r.name,
      Completions: Number(r.completions),
      AvgScore: Math.round(parseFloat(r.avgScore ?? '0') * 10) / 10,
      fill: COLORS[i % COLORS.length],
    }));
  }

  private _generatePeriods(granularity: 'day' | 'week' | 'month'): string[] {
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const periods: string[] = [];

    if (granularity === 'day') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        periods.push(iso(d));
      }
    } else if (granularity === 'week') {
      const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const dow = firstDay.getUTCDay();
      const toMonday = dow === 0 ? -6 : 1 - dow;
      const cur = new Date(firstDay);
      cur.setUTCDate(firstDay.getUTCDate() + toMonday);
      const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      while (cur <= lastDay) {
        periods.push(iso(cur));
        cur.setUTCDate(cur.getUTCDate() + 7);
      }
    } else {
      for (let m = 0; m < 12; m++) {
        periods.push(iso(new Date(Date.UTC(now.getUTCFullYear(), m, 1))));
      }
    }
    return periods;
  }

  private _dateRange(granularity: 'day' | 'week' | 'month') {
    const now = new Date();
    if (granularity === 'day') {
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, truncUnit: 'day' };
    }
    if (granularity === 'week') {
      return { startDate: new Date(now.getFullYear(), now.getMonth(), 1), truncUnit: 'week' };
    }
    return { startDate: new Date(now.getFullYear(), 0, 1), truncUnit: 'month' };
  }
}
