/**
 * SM-2 Algorithm Implementation
 * Based on SuperMemo-2
 */

export interface SM2Result {
  interval: number;
  repetition: number;
  easeFactor: number;
}

export function calculateSM2(
  quality: number, // 0-5
  repetition: number,
  previousInterval: number,
  previousEaseFactor: number
): SM2Result {
  let interval: number;
  let easeFactor: number;

  if (quality >= 3) {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(previousInterval * previousEaseFactor);
    }
    repetition++;
    easeFactor = previousEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    repetition = 0;
    interval = 1;
    easeFactor = previousEaseFactor;
  }

  if (easeFactor < 1.3) easeFactor = 1.3;

  return { interval, repetition, easeFactor };
}

// Map correctness to quality (3-5 for correct, 0-2 for incorrect)
export function getQualityFromCorrectness(isCorrect: boolean, timeSpent: number): number {
    if (!isCorrect) return 0;
    if (timeSpent < 5) return 5;
    if (timeSpent < 15) return 4;
    return 3;
}
