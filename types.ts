
export interface WordItem {
  id: string;
  term: string;
  definition?: string;
  phonetic?: string;
  example?: string;
  masteryLevel: number;
  lastMemorizedAt?: number; // 时间戳，用于筛选最近一周单词
}

export interface StudySet {
  id: string;
  name: string;
  wordCount: number;
  words: WordItem[];
  type: 'IMAGE' | 'DOC' | 'EXCEL' | 'TEXT' | 'DEMO';
  createdAt: number;
}

export interface QuizQuestion {
  word: string;
  correctAnswer: string;
  options: string[]; // 包含正确答案在内的 4 个选项
  context?: string; // 语境题干
}

export interface AIWordDetails {
  definition: string;
  phonetic: string;
  chineseTranslation: string;
  exampleSentence: string;
  synonyms: string[];
}

export enum AppView {
  LANDING = 'LANDING',
  LEARNING = 'LEARNING',
  SUMMARY = 'SUMMARY',
  TESTING = 'TESTING'
}

export interface LearningSessionStats {
  total: number;
  correct: number;
  incorrect: number;
  wordCount: number;
  startTime: number;
}
