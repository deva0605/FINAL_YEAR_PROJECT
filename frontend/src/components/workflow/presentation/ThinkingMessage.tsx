import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThinkingMessageProps {
  messages: string[];
  interval?: number;
}

export const ThinkingMessage: React.FC<ThinkingMessageProps> = ({ messages, interval = 1500 }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, interval);

    return () => clearInterval(timer);
  }, [messages, interval]);

  return (
    <div className="relative flex h-4 items-center overflow-hidden text-xs">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="absolute w-full truncate text-ink-muted"
        >
          {messages[index]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
