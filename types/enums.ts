export enum ExamConfigModes {
  MOCK = 'mock',
  TIMED = 'timed',
  REVISION = 'revision',
}
export enum QuestionDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

// Exam writing category — not all exam types support all categories.
// JAMB → only OBJECTIVES
// WAEC / NECO / GCE → OBJECTIVES + THEORY + PRACTICAL (subject-dependent)
export enum QuestionCategory {
  OBJECTIVES = 'objectives', // Multiple-choice paper
  THEORY = 'theory',         // Written/essay paper
  PRACTICAL = 'practical',   // Lab or hands-on paper
}

// Question selection filter for paid users when starting an exam.
// Demo users always get MIXED within the free-tier pool (no choice).
export enum QuestionFilter {
  MIXED   = 'mixed',   // ~90% unseen + ~10% seen (worst performance first)
  FRESH   = 'fresh',   // Unseen only — falls back to seen if bank exhausted
  FLAGGED = 'flagged', // Questions the student explicitly flagged for review
  WEAK    = 'weak',    // Questions with poor performance (most wrong first)
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  ESSAY = 'essay',
  TRUE_FALSE = 'true_false',
  FILL_IN_THE_BLANK = 'fill_in_the_blank',
  MATCHING = 'matching',
  MULTIPLE_RESPONSE = 'multiple_response', // Select all that apply
  SHORT_ANSWER = 'short_answer', // Brief text checked against keywords
}

export enum UserType {
  STUDENT = 'student',
  SPONSOR = 'sponsor',
  AFFILIATE = 'affiliate',
  ADMIN = 'admin',
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  DUAL = 'dual',
}

export enum FlagReasons {
  DIFFICULT = 'difficult',
  ERROR = 'error',
  REPORT = 'report',
}

export enum ExamTypes {
  REVISION = 'revision',
  TIMED = 'timed',
  MOCK = 'mock',
}

export enum ExamAttemptStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  AUTO_SUBMITTED = 'auto_submitted',
}

// Currency types for multi-currency pricing
export enum Currency {
  NGN = 'NGN',
  USD = 'USD',
  GBP = 'GBP',
  EUR = 'EUR',
  CAD = 'CAD',
  AUD = 'AUD',
}

// Legacy alias for backwards compatibility - will be removed
export const DenominationTypes = Currency;

export enum GenericStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum DonationType {
  EXAM_SUBSCRIPTION = 'exam_subscription',
  EDUCATIONAL_ITEMS = 'educational_items',
  GENERAL = 'general',
}

export enum MessageStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum SponsorType {
  INDIVIDUAL = 'individual',
  COMPANY = 'company',
  RELIGIOUS = 'religious',
  GOVERNMENT = 'government',
}

export enum LogActionTypes {
  LOGIN = 'login',
  SIGNUP = 'signup',
  EXAM_START = 'exam_start',
  EXAM_SUBMIT = 'exam_submit',
  PAYMENT = 'payment',
  ERROR = 'error',
  SYSTEM = 'system',
  OTHER = 'other',

  // Allows for generic logs too, just CRUD actions
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum LogSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum PaymentProvider {
  STRIPE = 'stripe', // Handles international payments (includes Link payment method)
  PAYSTACK = 'paystack', // Handles Nigerian payments
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum CommissionStatus {
  PENDING = 'pending',
  PAID = 'paid',
}

export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ReferredUserType {
  STUDENT = 'student',
  SPONSOR = 'sponsor',
}

// === Subscription & Transaction Enums ===

export enum TransactionType {
  SUBSCRIPTION_PURCHASE = 'subscription_purchase',
  SUBSCRIPTION_RENEWAL = 'subscription_renewal',
  SPONSORSHIP = 'sponsorship',
  REFUND = 'refund',
}

export enum SubscriptionStatus {
  PENDING = 'pending', // Awaiting payment confirmation
  SCHEDULED = 'scheduled', // Payment confirmed; starts on scheduledStartDate (stacked resub)
  ACTIVE = 'active', // Currently active subscription
  EXPIRED = 'expired', // Past end date
  CANCELLED = 'cancelled', // Cancelled by user or admin
  PAST_DUE = 'past_due', // Payment failed but in grace period
  SUSPENDED = 'suspended', // Suspended due to payment issues
}

export enum GivebackType {
  SUBSCRIPTION = 'subscription',
  // Future: BOOK_PURCHASE = 'book_purchase', TUTOR_SESSION = 'tutor_session', etc.
}

export enum GivebackStatus {
  PENDING = 'pending',     // Payment not yet confirmed
  ACTIVE = 'active',       // Payment confirmed, subscriptions running
  EXPIRED = 'expired',     // endDate has passed (lazy-set on next read)
  FAILED = 'failed',       // Payment failed / cancelled
}

export enum SponsorInviteStatus {
  PENDING = 'pending',     // Email sent, student hasn't activated yet
  ACCEPTED = 'accepted',  // Student clicked link and set password
  EXPIRED = 'expired',    // 7-day window passed without activation
}

export enum ChatroomType {
  SPONSOR_STUDENT = 'sponsor_student',
  STUDENT_STUDENT = 'student_student', // reserved for future use
}

export enum ChatDeliveryStatus {
  SENT = 'sent', // saved to DB, not yet read
  READ = 'read', // recipient opened the chatroom (lastReadAt updated)
}

export enum WebhookEventType {
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_RENEWED = 'subscription.renewed',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_EXPIRED = 'subscription.expired',
  INVOICE_CREATED = 'invoice.created',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  REFUND_PROCESSED = 'refund.processed',
}
