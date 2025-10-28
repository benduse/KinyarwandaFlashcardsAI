import React, { useState } from 'react';
import { AnimationStyle, Flashcard as FlashcardType } from '../types';

interface FlashcardProps {
  card: FlashcardType;
  onFlip: () => void;
  animationStyle: AnimationStyle;
}

const Flashcard: React.FC<FlashcardProps> = ({ card, onFlip, animationStyle }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    onFlip();
  };

  const FrontFace = () => (
    <div className="w-full h-full flex flex-col justify-center items-center bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
      <p className="text-sm text-indigo-500 dark:text-indigo-400 mb-4">Kinyarwanda</p>
      <h2 className="text-5xl font-bold text-slate-800 dark:text-slate-100 text-center">{card.word}</h2>
      <p className="absolute bottom-4 text-xs text-slate-400">Click to flip</p>
    </div>
  );

  const BackFace = () => (
    <div className="w-full h-full flex flex-col justify-center items-start bg-indigo-500 dark:bg-indigo-600 text-white rounded-2xl shadow-lg p-6 space-y-4">
      <div>
        <p className="text-sm opacity-80">Meaning:</p>
        <p className="text-2xl font-semibold">{card.meaning}</p>
      </div>
      <hr className="w-full border-t border-indigo-400 dark:border-indigo-500" />
      <div>
        <p className="text-sm opacity-80">Usage:</p>
        <p className="text-lg">{card.sentence_kinyarwanda}</p>
        <p className="text-sm italic opacity-80">{card.sentence_english}</p>
      </div>
      <p className="absolute bottom-4 text-xs opacity-70">Click to flip back</p>
    </div>
  );

  if (animationStyle === 'fade') {
    return (
      <div className="w-full h-80 relative cursor-pointer" onClick={handleFlip}>
        <div className={`absolute w-full h-full transition-opacity duration-500 ${isFlipped ? 'opacity-0' : 'opacity-100'}`}>
          <FrontFace />
        </div>
        <div className={`absolute w-full h-full transition-opacity duration-500 ${isFlipped ? 'opacity-100' : 'opacity-0'}`}>
          <BackFace />
        </div>
      </div>
    );
  }

  const rotationClass = animationStyle === 'flip-vertical' ? 'rotate-x-180' : 'rotate-y-180';

  return (
    <div className="w-full h-80 perspective-1000" onClick={handleFlip}>
      <div
        className={`relative w-full h-full transform-style-3d transition-transform duration-700 cursor-pointer ${
          isFlipped ? rotationClass : ''
        }`}
      >
        <div className="absolute w-full h-full backface-hidden">
          <FrontFace />
        </div>
        <div className={`absolute w-full h-full backface-hidden ${rotationClass}`}>
          <BackFace />
        </div>
      </div>
    </div>
  );
};

export default Flashcard;