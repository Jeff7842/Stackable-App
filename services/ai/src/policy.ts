/** School-level settings for the AI tutor; nothing in the gate or allowance is hard-coded. */
export interface AiPolicy {
  hintsPerQuestion: number;
  practiceItems: number;
  unaidedPoints: number;
  practiceSetPoints: number;
  dailyAllowanceBase: number;
}

export const DEFAULT_POLICY: AiPolicy = {
  hintsPerQuestion: 3,
  practiceItems: 5,
  unaidedPoints: 10,
  practiceSetPoints: 5,
  dailyAllowanceBase: 10,
};

/** Higher points buy more AI requests per day; a tier never changes the hint cap. */
export interface AllowanceTier {
  minPoints: number;
  dailyRequests: number;
}
