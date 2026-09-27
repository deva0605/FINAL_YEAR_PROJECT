import React from 'react';

interface PromptCardProps {
  text: string;
  onClick: () => void;
}

export const PromptCard: React.FC<PromptCardProps> = ({ text, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="p-2.5 text-left bg-white rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all shadow-xs text-xs font-medium"
    >
      {text}
    </button>
  );
};
