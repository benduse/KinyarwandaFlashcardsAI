import React, { useState, useEffect, useCallback } from 'react';
import { Difficulty, Flashcard as FlashcardType, QuizQuestion, User, View, AnimationStyle } from './types';
import { generateFlashcards, generateQuiz } from './services/geminiService';
import Flashcard from './components/Flashcard';
import Spinner from './components/Spinner';

const QUIZ_THRESHOLD = 20;

// --- Sound Effects Service ---
let audioContext: AudioContext;

const playSound = (type: 'flip' | 'correct' | 'incorrect') => {
  if (typeof window === 'undefined') return;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.error("Web Audio API is not supported in this browser");
      return;
    }
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  switch (type) {
    case 'flip': {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
      break;
    }
     case 'correct': {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.linearRampToValueAtTime(1046.50, audioContext.currentTime + 0.1); // C6
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
    }
    case 'incorrect': {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(100, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
    }
  }
};


const App: React.FC = () => {
  const [view, setView] = useState<View>('select_difficulty');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Basic);
  const [flashcards, setFlashcards] = useState<FlashcardType[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>('flip-horizontal');
  
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('kinyarwanda-user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      } else {
        const newUser: User = {
          username: 'Guest',
          learnedWords: {
            [Difficulty.Basic]: [],
            [Difficulty.Medium]: [],
            [Difficulty.Advanced]: [],
          },
        };
        setUser(newUser);
      }
    } catch (error) {
       console.error("Failed to parse user data from localStorage", error);
       const newUser: User = {
          username: 'Guest',
          learnedWords: {
            [Difficulty.Basic]: [],
            [Difficulty.Medium]: [],
            [Difficulty.Advanced]: [],
          },
        };
        setUser(newUser);
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('kinyarwanda-user', JSON.stringify(user));
    }
  }, [user]);

  const fetchAndSetFlashcards = useCallback(async (level: Difficulty) => {
    if (!user) return;
    setIsLoading(true);
    const learnedWords = user.learnedWords[level] || [];
    const cards = await generateFlashcards(level, 5, learnedWords);
    setFlashcards(cards);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (view === 'flashcards' && flashcards.length === 0 && !isLoading && user) {
      fetchAndSetFlashcards(difficulty);
    }
  }, [view, flashcards.length, isLoading, fetchAndSetFlashcards, difficulty, user]);

  const markWordAsLearned = (wordId: string) => {
    if (!user) return;

    setUser(currentUser => {
      if (!currentUser) return null;
      
      const currentLearned = currentUser.learnedWords[difficulty] || [];
      if (currentLearned.includes(wordId)) {
          return currentUser;
      }

      return {
        ...currentUser,
        learnedWords: {
          ...currentUser.learnedWords,
          [difficulty]: [...currentLearned, wordId],
        },
      };
    });
  };

  const handleFlip = () => {
    playSound('flip');
  };
  
  const startQuiz = async () => {
    if (flashcards.length === 0) return;
    setIsLoading(true);
    const quiz = await generateQuiz(flashcards);
    setQuizQuestions(quiz);
    setView('quiz');
    setIsLoading(false);
  };

  const handleNextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    } else {
      startQuiz();
    }
  };

  const handleStartSession = (level: Difficulty) => {
    setDifficulty(level);
    setView('flashcards');
    setCurrentCardIndex(0);
    setFlashcards([]);
  };

  // --- Sub-Components for Views ---

  const SelectDifficultyView = () => (
    <div className="text-center p-8 max-w-2xl mx-auto">
      <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-slate-100 mb-2">Welcome to Kinyarwanda AI</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">Select your level to start learning.</p>
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        {(Object.keys(Difficulty) as Array<keyof typeof Difficulty>).map(level => (
          <button
            key={level}
            onClick={() => handleStartSession(Difficulty[level])}
            className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold py-4 px-8 rounded-lg shadow-md hover:shadow-xl hover:scale-105 border border-slate-200 dark:border-slate-700 transition-all duration-300"
          >
            {Difficulty[level]}
            {user && (
              <span className="block text-xs font-normal text-slate-500 dark:text-slate-400 mt-1">
                {user.learnedWords[Difficulty[level]]?.length || 0} words learned
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const QuizView = ({ flashcards, onMarkLearned }: { flashcards: FlashcardType[], onMarkLearned: (wordId: string) => void }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);

    const question = quizQuestions[currentQuestionIndex];
    const flashcard = flashcards[currentQuestionIndex];

    const handleAnswer = (answer: string) => {
      if (isAnswered) return;

      setSelectedAnswer(answer);
      setIsAnswered(true);
      if (answer === question.correctAnswer) {
        setScore(score + 1);
        playSound('correct');
        if (flashcard) {
          onMarkLearned(flashcard.id);
        }
      } else {
        playSound('incorrect');
      }
    };

    const handleNextQuestion = () => {
      setIsAnswered(false);
      setSelectedAnswer(null);
      if (currentQuestionIndex < quizQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        // Quiz finished, show final score
        setView('select_difficulty');
      }
    };
    
    if (!question) {
        return (
            <div className="text-center p-8 max-w-2xl mx-auto">
                <h2 className="text-3xl font-bold mb-4 text-slate-800 dark:text-slate-100">Quiz Complete!</h2>
                <p className="text-xl text-slate-600 dark:text-slate-400">Your score: {score}/{quizQuestions.length}</p>
                <button
                    onClick={() => setView('select_difficulty')}
                    className="mt-8 bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    Learn More Words
                </button>
            </div>
        );
    }

    return (
      <div className="w-full max-w-2xl mx-auto p-4 md:p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
        <div className="mb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">Question {currentQuestionIndex + 1} of {quizQuestions.length}</p>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 mt-2">{question.question}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {question.options.map(option => {
            const isCorrect = option === question.correctAnswer;
            const isSelected = option === selectedAnswer;
            let buttonClass = 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200';
            if (isAnswered) {
              if (isCorrect) {
                buttonClass = 'bg-green-500 text-white';
              } else if (isSelected && !isCorrect) {
                buttonClass = 'bg-red-500 text-white';
              } else {
                buttonClass = 'bg-slate-100 dark:bg-slate-700 opacity-60'
              }
            }

            return (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                disabled={isAnswered}
                className={`p-4 rounded-lg text-left text-lg transition-all duration-300 ${buttonClass}`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {isAnswered && (
          <div className="mt-8 text-right">
            <button
              onClick={handleNextQuestion}
              className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {currentQuestionIndex < quizQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}
            </button>
          </div>
        )}
      </div>
    );
  };
  
  const renderContent = () => {
    if (isLoading || !user) {
      return <Spinner />;
    }

    switch (view) {
      case 'select_difficulty':
        return <SelectDifficultyView />;
      case 'flashcards':
        if (!flashcards[currentCardIndex]) return <Spinner />;
        return (
          <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-6">
             <Flashcard
              card={flashcards[currentCardIndex]}
              onFlip={handleFlip}
              animationStyle={animationStyle}
            />
            <button
              onClick={handleNextCard}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg"
            >
              Next Card
            </button>
             <div className="mt-4">
                <label htmlFor="animation-select" className="mr-2 text-slate-600 dark:text-slate-400">Animation:</label>
                <select 
                  id="animation-select" 
                  value={animationStyle} 
                  onChange={(e) => setAnimationStyle(e.target.value as AnimationStyle)}
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md p-2"
                >
                  <option value="flip-horizontal">Horizontal Flip</option>
                  <option value="flip-vertical">Vertical Flip</option>
                  <option value="fade">Fade</option>
                </select>
            </div>
          </div>
        );
      case 'quiz':
        return <QuizView flashcards={flashcards} onMarkLearned={markWordAsLearned} />;
      default:
        return <SelectDifficultyView />;
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center font-sans p-4">
       <div className="absolute top-4 right-4 text-xs text-slate-400">
         Kinyarwanda AI v1.0
      </div>
      {renderContent()}
    </main>
  );
};

export default App;