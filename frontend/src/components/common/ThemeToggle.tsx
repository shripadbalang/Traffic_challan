import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  variant?: 'button' | 'pill';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  variant = 'button',
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        className={`relative inline-flex items-center h-8 w-14 rounded-full p-1 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] ${
          isDark ? 'bg-[#1E293B] border border-[#24344D]' : 'bg-[#E2E8F0] border border-[#CBD5E1]'
        } ${className}`}
      >
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ${
            isDark ? 'translate-x-6 bg-[#3B82F6] text-white' : 'translate-x-0 bg-white text-[#D97706]'
          }`}
        >
          {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`inline-flex items-center justify-center p-2 rounded-lg border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] ${
        isDark
          ? 'bg-[#111C2E] border-[#1E293B] text-[#F1F5F9] hover:bg-[#162238] hover:border-[#3B82F6]/50'
          : 'bg-white border-[#E2E8F0] text-[#172033] hover:bg-[#F1F5F9] hover:border-[#CBD5E1]'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-[#F59E0B] transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-[#174EA6] transition-transform hover:-rotate-12" />
      )}
    </button>
  );
};
