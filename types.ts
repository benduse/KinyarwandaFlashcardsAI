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

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface User {
  username: string;
  learnedWords: {
    [key in Difficulty]: string[];
  };
}

export type View = 'select_difficulty' | 'flashcards' | 'quiz' | 'login' | 'dashboard' | 'review';