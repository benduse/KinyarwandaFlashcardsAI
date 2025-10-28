import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, Flashcard, QuizQuestion } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const flashcardSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      word: {
        type: Type.STRING,
        description: 'A single Kinyarwanda word.',
      },
      meaning: {
        type: Type.STRING,
        description: 'The English translation of the Kinyarwanda word.',
      },
      sentence_kinyarwanda: {
        type: Type.STRING,
        description: 'An example sentence in Kinyarwanda using the word.',
      },
      sentence_english: {
        type: Type.STRING,
        description: 'The English translation of the example sentence.',
      },
    },
    required: ['word', 'meaning', 'sentence_kinyarwanda', 'sentence_english'],
  },
};

const quizSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: {
        type: Type.STRING,
        description: 'A multiple-choice question asking for the meaning of a Kinyarwanda word. For example, "What is the meaning of \'muraho\'?"',
      },
      options: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
        description: 'An array of 4 possible English answers.',
      },
      correctAnswer: {
        type: Type.STRING,
        description: 'The correct English answer from the options array.',
      },
    },
    required: ['question', 'options', 'correctAnswer'],
  },
};

export const generateFlashcards = async (level: Difficulty, count: number, learnedWords: string[] = []): Promise<Flashcard[]> => {
  try {
    let prompt = `Generate ${count} Kinyarwanda flashcards for a ${level.toLowerCase()} level learner. Provide the word, its English meaning, and an example sentence in both languages.`;

    if (learnedWords.length > 0) {
      prompt += ` Do not include any of these words: ${learnedWords.join(', ')}.`;
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: flashcardSchema,
      },
    });

    const jsonString = response.text.trim();
    const flashcardsData = JSON.parse(jsonString);

    return flashcardsData.map((card: Omit<Flashcard, 'id'>) => ({
      ...card,
      id: card.word.toLowerCase(),
    }));
  } catch (error) {
    console.error("Error generating flashcards:", error);
    // Fallback with dummy data in case of API error
    return [
      { id: 'muraho', word: 'Muraho', meaning: 'Hello (formal)', sentence_kinyarwanda: 'Muraho, neza cyane?', sentence_english: 'Hello, how are you?' },
      { id: 'amakuru', word: 'Amakuru?', meaning: 'How are you? (news?)', sentence_kinyarwanda: 'Amakuru yawe?', sentence_english: 'How are you?' },
    ];
  }
};

export const generateQuiz = async (flashcards: Flashcard[]): Promise<QuizQuestion[]> => {
  try {
    const wordsForQuiz = flashcards.map(fc => `"${fc.word}" (meaning: ${fc.meaning})`).join(', ');
    const prompt = `Create a multiple-choice quiz with ${flashcards.length} questions based on these Kinyarwanda words and their meanings: ${wordsForQuiz}. Each question should ask for the English meaning of a Kinyarwanda word and provide 4 options.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: quizSchema,
      },
    });

    const jsonString = response.text.trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error generating quiz:", error);
    return [];
  }
};