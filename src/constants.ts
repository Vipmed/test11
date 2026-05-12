/**
 * Constants for the MedTest Pro platform
 */

export const COLORS = {
  background: "#0a0a0b",
  foreground: "#e2e8f0",
  card: "#0d0d0e",
  accent: "#3b82f6",
  muted: "#64748b",
  primary: "#3b82f6",
  error: "#ef4444",
  success: "#22c55e",
};

export const PRESETS = [
  { questions: 28, time: 28 },
  { questions: 48, time: 48 },
  { questions: 80, time: 80 },
  { questions: 200, time: 200, name: "Stress Test" },
];

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
  SUPERADMIN = "SUPERADMIN",
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIdx: number;
  category?: string;
  baseId: string;
}

export interface Attempt {
  id: string;
  userId: string;
  questionId: string;
  isCorrect: boolean;
  interval: number;
  easeFactor: number;
  repetition: number;
  nextReview?: Date;
  createdAt: Date;
}
