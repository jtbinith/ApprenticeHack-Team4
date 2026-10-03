// Review periods (#57): the time between one review and the next. Shared with
// the review pack (#58), which summarises a period.

import type { Review } from '../../../shared/types';
import { db } from '../../db';

export interface ReviewPeriod {
  review: Review;
  /** The review before this one, if any. */
  previous?: Review;
  /** Period start: previous review, else apprenticeship start, else 12 weeks before. */
  from: Date;
  /** Period end: this review's date. */
  to: Date;
}

const DAY = 86_400_000;

/** Reviews in date order, each with the period leading up to it. */
export async function reviewPeriods(): Promise<ReviewPeriod[]> {
  const [reviews, settings] = await Promise.all([
    db.reviews.orderBy('date').toArray(),
    db.settings.get('settings'),
  ]);
  return reviews.map((review, i) => {
    const previous = reviews[i - 1];
    const to = new Date(review.date);
    const from = previous
      ? new Date(previous.date)
      : settings?.apprenticeshipStart
        ? new Date(settings.apprenticeshipStart)
        : new Date(to.getTime() - 84 * DAY);
    return { review, previous, from, to };
  });
}

/** The next review on or after today (its period is the "current" one). */
export function upcoming(
  periods: ReviewPeriod[],
  now = new Date(),
): ReviewPeriod | undefined {
  return periods.find((p) => p.to.getTime() >= startOfDay(now).getTime());
}

export function daysUntil(date: Date, now = new Date()): number {
  return Math.round(
    (startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY,
  );
}

export function inPeriod(
  when: string | Date,
  period: Pick<ReviewPeriod, 'from' | 'to'>,
): boolean {
  const t = new Date(when).getTime();
  return t >= period.from.getTime() && t < period.to.getTime();
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
