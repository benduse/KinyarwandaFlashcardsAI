import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Difficulty, Flashcard as FlashcardType, User, View, AnimationStyle, SpacedRepetitionInfo } from './types';
import { generateFlashcards, generateFlashcardsForWords } from './services/geminiService';
import Flashcard from './components/Flashcard';
import Spinner from './components/Spinner';

// --- SRS Constants ---
const NEW_WORD_EASE_FACTOR = 2.5;
const NEW_WORD_INTERVAL = 1;

// --- Sound Effects Service ---
let audioContext: AudioContext;

const playSound = (type: 'flip' | 'correct' | 'incorrect' | 'swoosh') => {
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
     case 'correct': { // For 'Good' or 'Easy'
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(1046.50, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        break;
    }
    case 'incorrect': { // For 'Again'
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

const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Basic);
  const [studyQueue, setStudyQueue] = useState<FlashcardType[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>('flip-horizontal');
  
  const migrateUserData = (oldUser: any): User => {
    const newUser: User = {
      username: oldUser.username || 'Guest',
      learnedWords: {
        [Difficulty.Basic]: {},
        [Difficulty.Medium]: {},
        [Difficulty.Advanced]: {},
      }
    };

    const today = new Date();
    today.setDate(today.getDate() + 1); // review tomorrow
    const nextReviewDate = today.toISOString();

    (Object.keys(Difficulty) as Array<keyof typeof Difficulty>).forEach(levelKey => {
      const level = Difficulty[levelKey];
      if(oldUser.learnedWords[level] && Array.isArray(oldUser.learnedWords[level])) {
        oldUser.learnedWords[level].forEach((wordId: string) => {
          newUser.learnedWords[level][wordId] = {
            nextReviewDate,
            interval: NEW_WORD_INTERVAL,
            easeFactor: NEW_WORD_EASE_FACTOR,
            repetitions: 1,
          };
        });
      }
    });

    return newUser;
  };

  useEffect(() => {
    try {
      const lastUser = localStorage.getItem('kinyarwanda-currentUser');
      const emptyUserBase = {
        learnedWords: {
          [Difficulty.Basic]: {},
          [Difficulty.Medium]: {},
          [Difficulty.Advanced]: {},
        },
      };

      if (lastUser) {
        const savedUserData = localStorage.getItem(`kinyarwanda-user-${lastUser}`);
        if (savedUserData) {
          const parsedUser = JSON.parse(savedUserData);
          const basicWords = parsedUser.learnedWords?.[Difficulty.Basic];
          if (Array.isArray(basicWords)) {
            console.log("Old user data format detected. Migrating...");
            setUser(migrateUserData(parsedUser));
          } else {
            setUser(parsedUser);
          }
          setView('dashboard');
        } else {
          localStorage.removeItem('kinyarwanda-currentUser');
          setView('login');
        }
      } else {
        const visitCount = parseInt(localStorage.getItem('kinyarwanda-visit-count') || '0', 10);
        if (visitCount >= 2) {
          setView('login');
        } else {
          localStorage.setItem('kinyarwanda-visit-count', String(visitCount + 1));
          setUser({
            ...emptyUserBase,
            username: 'Guest',
            isGuest: true,
          });
          setView('dashboard');
        }
      }
    } catch (error) {
       console.error("Failed to initialize user", error);
       setView('login');
    }
  }, []);

  useEffect(() => {
    if (user && !user.isGuest) {
      localStorage.setItem(`kinyarwanda-user-${user.username}`, JSON.stringify(user));
      localStorage.setItem('kinyarwanda-currentUser', user.username);
    }
  }, [user]);

  const wordsDueForReview = useMemo(() => {
    if (!user) return [];
    const today = getToday();
    const dueWords: { id: string; difficulty: Difficulty }[] = [];
    
    for (const level of Object.values(Difficulty)) {
      const wordsInLevel = user.learnedWords[level];
      for (const wordId in wordsInLevel) {
        const wordInfo = wordsInLevel[wordId];
        if (new Date(wordInfo.nextReviewDate) <= today) {
          dueWords.push({ id: wordId, difficulty: level });
        }
      }
    }
    return dueWords;
  }, [user]);

  const handleLogin = (username: string) => {
    if (!username.trim()) return;
    const existingUserData = localStorage.getItem(`kinyarwanda-user-${username}`);
    let userData: User;
    if (existingUserData) {
      userData = JSON.parse(existingUserData);
    } else {
      userData = {
        username,
        isGuest: false,
        learnedWords: {
          [Difficulty.Basic]: {},
          [Difficulty.Medium]: {},
          [Difficulty.Advanced]: {},
        },
      };
    }
    setUser(userData);
    setView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('kinyarwanda-currentUser');
    const visitCount = parseInt(localStorage.getItem('kinyarwanda-visit-count') || '0', 10);
    localStorage.setItem('kinyarwanda-visit-count', String(visitCount + 1));
    setUser({
        username: 'Guest',
        isGuest: true,
        learnedWords: {
          [Difficulty.Basic]: {},
          [Difficulty.Medium]: {},
          [Difficulty.Advanced]: {},
        },
      });
    setView('dashboard');
  };

  const handleStartReviewSession = async () => {
    if (wordsDueForReview.length === 0) return;
    setIsLoading(true);
    const wordIds = wordsDueForReview.map(w => w.id);
    const cards = await generateFlashcardsForWords(wordIds);
    setStudyQueue(cards);
    setCurrentCardIndex(0);
    setIsCardFlipped(false);
    setView('flashcards');
    setIsLoading(false);
  };
  
  const handleLearnNewWords = async (level: Difficulty) => {
    if (!user) return;
    setIsLoading(true);
    const learnedWordIds = Object.keys(user.learnedWords[level] || {});
    const cardCount = user.isGuest ? 3 : 5;
    const newCards = await generateFlashcards(level, cardCount, learnedWordIds);
    
    if (newCards.length > 0) {
        if (!user.isGuest) {
            setUser(currentUser => {
                if (!currentUser) return null;
                const updatedLearnedWords = { ...currentUser.learnedWords[level] };
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);

                newCards.forEach(card => {
                    updatedLearnedWords[card.id] = {
                        nextReviewDate: tomorrow.toISOString(),
                        interval: NEW_WORD_INTERVAL,
                        easeFactor: NEW_WORD_EASE_FACTOR,
                        repetitions: 0,
                    };
                });

                return {
                    ...currentUser,
                    learnedWords: { ...currentUser.learnedWords, [level]: updatedLearnedWords },
                };
            });
        }

        setDifficulty(level);
        setStudyQueue(newCards);
        setCurrentCardIndex(0);
        setIsCardFlipped(false);
        setView('flashcards');
    }
    setIsLoading(false);
  };

  const handleReviewRating = (rating: 'again' | 'good' | 'easy') => {
    const card = studyQueue[currentCardIndex];
    if (!card || !user || user.isGuest) return;

    let srsInfo = user.learnedWords[difficulty][card.id];
    if(!srsInfo) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        srsInfo = { nextReviewDate: tomorrow.toISOString(), interval: 1, easeFactor: 2.5, repetitions: 0 };
    }

    let { interval, easeFactor, repetitions } = srsInfo;

    switch (rating) {
        case 'again':
            playSound('incorrect');
            repetitions = 0;
            interval = 1;
            break;
        case 'good':
            playSound('correct');
            repetitions += 1;
            interval = Math.ceil(interval * easeFactor);
            break;
        case 'easy':
            playSound('correct');
            repetitions += 1;
            interval = Math.ceil(interval * easeFactor * 1.3);
            easeFactor += 0.15;
            break;
    }
    
    const nextReviewDate = new Date();
    nextReviewDate.setDate(getToday().getDate() + interval);

    const updatedSrsInfo: SpacedRepetitionInfo = {
        nextReviewDate: nextReviewDate.toISOString(),
        interval,
        easeFactor: Math.max(1.3, easeFactor),
        repetitions,
    };
    
    setUser(currentUser => {
        if (!currentUser) return null;
        return {
            ...currentUser,
            learnedWords: {
                ...currentUser.learnedWords,
                [difficulty]: {
                    ...currentUser.learnedWords[difficulty],
                    [card.id]: updatedSrsInfo,
                },
            },
        };
    });

    if (currentCardIndex < studyQueue.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsCardFlipped(false);
    } else {
      setView('dashboard');
    }
  };

  // --- Views ---

  const LoginView = () => {
    const [usernameInput, setUsernameInput] = useState('');
    return (
      <div className="text-center p-8 max-w-sm mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Welcome!</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Log in or sign up to save your progress.</p>
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(usernameInput); }}>
          <input
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="Enter your username"
            className="w-full px-4 py-3 mb-4 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Username"
          />
          <button
            type="submit"
            disabled={!usernameInput.trim()}
            className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            Continue Learning
          </button>
        </form>
         <p className="text-xs text-slate-400 mt-4">
            No password needed. Your progress is saved to this device.
        </p>
      </div>
    );
  };

  const DashboardView = () => (
    <div className="text-center p-8 max-w-2xl mx-auto">
      <h1 className="text-4xl md:text-5xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        Welcome {user?.isGuest ? 'Back!' : `${user?.username}!`}
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8 text-lg">
        {user?.isGuest
          ? "You're learning as a guest. Log in to save your progress!"
          : 'Your daily Kinyarwanda practice awaits.'}
      </p>

      {user?.isGuest && (
        <div className="mb-6">
          <button
            onClick={() => setView('login')}
            className="bg-green-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-green-600 transition-colors"
          >
            Log In / Sign Up
          </button>
        </div>
      )}
      
      <div className="mb-10">
        <button
            onClick={handleStartReviewSession}
            disabled={wordsDueForReview.length === 0 || user?.isGuest}
            title={user?.isGuest ? "Log in to review cards" : ""}
            className="w-full sm:w-auto bg-indigo-600 text-white font-bold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:bg-slate-400 disabled:dark:bg-slate-600 disabled:scale-100 disabled:cursor-not-allowed"
        >
            Review {wordsDueForReview.length} Cards
        </button>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-4">
            {user?.isGuest ? 'Try a Few New Words (3 per session)' : 'Or, Learn New Words'}
        </h2>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
            {(Object.values(Difficulty)).map(level => (
            <button
                key={level}
                onClick={() => handleLearnNewWords(level)}
                className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold py-4 px-8 rounded-lg shadow-md hover:shadow-xl hover:scale-105 border border-slate-200 dark:border-slate-700 transition-all duration-300"
            >
                {level}
                {user && (
                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400 mt-1">
                    {Object.keys(user.learnedWords[level])?.length || 0} words learned
                </span>
                )}
            </button>
            ))}
        </div>
      </div>
    </div>
  );

  const FlashcardSessionView = () => {
    const card = studyQueue[currentCardIndex];
    if (!card) return (
      <div className="text-center p-8">
        <p className="text-slate-600 dark:text-slate-400">Session complete! Returning to dashboard...</p>
      </div>
    );
    
    return (
      <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-6">
        <div className="w-full text-center">
            <p className="text-slate-500 dark:text-slate-400">Card {currentCardIndex + 1} of {studyQueue.length}</p>
        </div>
        <Flashcard
          card={card}
          onFlip={() => { playSound('flip'); setIsCardFlipped(!isCardFlipped); }}
          animationStyle={animationStyle}
        />
        {isCardFlipped && (
            <div className="w-full grid grid-cols-3 gap-3 animate-fade-in">
                <button onClick={() => handleReviewRating('again')} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-colors">Again</button>
                <button onClick={() => handleReviewRating('good')} className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-lg transition-colors">Good</button>
                <button onClick={() => handleReviewRating('easy')} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-colors">Easy</button>
            </div>
        )}
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
  };
  
  const renderContent = () => {
    if (!user && view !== 'login') {
      return <Spinner />;
    }
    if (view === 'login') {
      return <LoginView />;
    }
    if (isLoading) {
      return <Spinner />;
    }
    switch (view) {
      case 'dashboard':
        return <DashboardView />;
      case 'flashcards':
        return <FlashcardSessionView />;
      default:
        return <LoginView />;
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center font-sans p-4">
       <div className="absolute top-4 right-4 text-xs text-slate-400">
         Kinyarwanda AI v2.1
      </div>
       <div className="absolute top-4 left-4">
        {view === 'flashcards' && (
            <button onClick={() => setView('dashboard')} className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors">
                &larr; Back to Dashboard
            </button>
        )}
        {user && !user.isGuest && view === 'dashboard' && (
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors">
                Log Out
            </button>
        )}
       </div>
      {renderContent()}
    </main>
  );
};

export default App;