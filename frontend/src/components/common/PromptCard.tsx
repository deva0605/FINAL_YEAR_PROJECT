import React from 'react';

interface PromptCardProps {
  text: string;
  onClick: () => void;
}

export const PromptCard: React.FC<PromptCardProps> = ({ text, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="p-3 text-left bg-surface-container-low rounded-xl border border-outline-variant/20 hover:bg-surface-container-high hover:border-primary/40 transition-all text-sm text-on-surface-variant"
    >
      {text}
    </button>
  );
};
