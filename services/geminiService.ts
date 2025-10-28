import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, Flashcard } from '../types';

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

export const generateFlashcards = async (level: Difficulty, count: number, learnedWords: string[] = []): Promise<Flashcard[]> => {
  try {
    let prompt = `Generate ${count} new Kinyarwanda flashcards for a ${level.toLowerCase()} level learner. Provide the word, its English meaning, and an example sentence in both languages.`;

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

    // Normalize IDs to be safe for object keys
    return flashcardsData.map((card: Omit<Flashcard, 'id'>) => ({
      ...card,
      id: card.word.toLowerCase().replace(/[^a-z]/g, ''),
    }));
  } catch (error) {
    console.error("Error generating flashcards:", error);
    return [];
  }
};

export const generateFlashcardsForWords = async (words: string[]): Promise<Flashcard[]> => {
  if (words.length === 0) return [];
  try {
    const prompt = `Generate full flashcard details for the following Kinyarwanda words: ${words.join(', ')}. For each word, provide its English meaning, and an example sentence in both Kinyarwanda and English. Ensure the 'word' field in the response matches the requested word exactly.`;

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

    // Normalize IDs to be safe for object keys
    return flashcardsData.map((card: Omit<Flashcard, 'id'>) => ({
      ...card,
      id: card.word.toLowerCase().replace(/[^a-z]/g, ''),
    }));
  } catch (error) {
    console.error("Error generating flashcards for review:", error);
    return [];
  }
};
