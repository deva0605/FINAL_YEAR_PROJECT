import React from 'react';

interface PromptCardProps {
  text: string;
  onClick: () => void;
}

export const PromptCard: React.FC<PromptCardProps> = ({ text, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-canvas hover:text-ink"
    >
      {text}
    </button>
  );
};
