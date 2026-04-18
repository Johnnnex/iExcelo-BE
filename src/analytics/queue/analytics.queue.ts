export const ANALYTICS_QUEUE = 'analytics';

export const AnalyticsJobs = {
  UPDATE_DAILY: 'update_daily_analytics',
  UPDATE_SUBJECT_BATCH: 'update_subject_analytics_batch',
  TRACK_PLATFORM: 'track_platform_analytics',
  TRACK_AFFILIATE_DAILY: 'track_affiliate_daily_analytics',
  UPDATE_STREAK: 'update_student_streak',
} as const;

export interface UpdateDailyAnalyticsJobData {
  studentId: string;
  examTypeId: string;
  data: {
    questionsAttempted?: number;
    questionsCorrect?: number;
    questionsWrong?: number;
    questionsUnanswered?: number;
    timeSpentSeconds?: number;
    scorePercentage?: number;
  };
}

export interface UpdateSubjectAnalyticsBatchJobData {
  studentId: string;
  examTypeId: string;
  subjects: Array<{
    subjectId: string;
    data: {
      questionsAttempted?: number;
      questionsCorrect?: number;
      questionsWrong?: number;
      essayQuestionsAttempted?: number;
    };
  }>;
}

export interface TrackPlatformAnalyticsJobData {
  data: {
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
  };
}

export interface TrackAffiliateDailyAnalyticsJobData {
  affiliateId: string;
  data: {
    clicks?: number;
    referrals?: number;
    conversions?: number;
    commissionsEarned?: number;
  };
}

export interface UpdateStudentStreakJobData {
  studentId: string;
}
