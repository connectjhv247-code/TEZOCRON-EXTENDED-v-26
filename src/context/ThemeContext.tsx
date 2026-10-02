import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  brightness: number;
  setTheme: (theme: ThemePreference) => void;
  setBrightness: (brightness: number) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  resolvedTheme: 'dark',
  brightness: 100,
  setTheme: () => {},
  setBrightness: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('tezocron_theme') as ThemePreference;
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          return saved;
        }
      } catch {
        // Fallback if localStorage access is denied in cross-origin iframe
      }
    }
    return 'dark';
  });

  const [brightness, setBrightnessState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('tezocron_brightness');
        if (saved) {
          const val = parseInt(saved, 10);
          if (!isNaN(val) && val >= 30 && val <= 170) {
            return val;
          }
        }
      } catch {
        // Fallback
      }
    }
    return 100;
  });

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Listen to system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  // Apply to document.documentElement
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    if (resolvedTheme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, [resolvedTheme]);

  // Apply brightness filter globally to document.documentElement
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--app-brightness', `${brightness}%`);
    root.style.filter = `brightness(${brightness}%)`;
  }, [brightness]);

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tezocron_theme', newTheme);
      } catch {
        // Fallback if localStorage access is denied
      }
    }
  };

  const setBrightness = (newBrightness: number) => {
    const clamped = Math.max(30, Math.min(170, newBrightness));
    setBrightnessState(clamped);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('tezocron_brightness', String(clamped));
      } catch {
        // Fallback if localStorage access is denied
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, brightness, setTheme, setBrightness }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
