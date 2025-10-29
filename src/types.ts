export type AnimationStyle = 'flip-horizontal' | 'flip-vertical' | 'fade';

export enum Difficulty {
  Basic = 'Basic',
  Medium = 'Medium',
  Advanced = 'Advanced',
}

export interface Flashcard {
  id: string;
  word: string;
  meaning: string;
  sentence_kinyarwanda: string;
  sentence_english: string;
}

export interface SpacedRepetitionInfo {
  nextReviewDate: string; // ISO date string
  interval: number; // in days
  easeFactor: number;
  repetitions: number;
}

export interface User {
  username: string;
  isGuest?: boolean;
  learnedWords: {
    [key in Difficulty]: {
      [wordId: string]: SpacedRepetitionInfo;
    };
  };
}

export type View = 'dashboard' | 'flashcards' | 'login';