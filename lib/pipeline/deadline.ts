/**
 * A wall-clock budget shared by every pipeline stage.
 *
 * The pipeline runs inside a serverless function that is killed without
 * warning at `maxDuration`. A killed function cannot release the run lock or
 * record its outcome, so the run row sits in 'running' until the stale
 * reclaim clears it 15 minutes later.
 *
 * Per-run item caps alone cannot prevent this. The provider's rate limit is
 * 8,000 tokens per minute and a full run needs roughly twice that, so calls
 * get 429s and back off 10-20 seconds each — a locally successful run took
 * 316 seconds for work that "should" take 30. How long a stage takes is
 * therefore not predictable from how many items it processes.
 *
 * So stages check the clock between items and stop voluntarily, leaving the
 * rest queued for the next run.
 */
export interface Deadline {
  /** Milliseconds left before the budget is spent. */
  remainingMs(): number;
  /**
   * True when there is not enough time left to attempt another unit of work.
   * `reserveMs` is a rough estimate of what one unit costs.
   */
  expired(reserveMs: number): boolean;
}

export function createDeadline(budgetMs: number): Deadline {
  const endsAt = Date.now() + budgetMs;

  return {
    remainingMs: () => Math.max(0, endsAt - Date.now()),
    expired: (reserveMs: number) => Date.now() + reserveMs > endsAt,
  };
}

/** A deadline that never expires — for local scripts and manual runs. */
export function noDeadline(): Deadline {
  return {
    remainingMs: () => Number.POSITIVE_INFINITY,
    expired: () => false,
  };
}
