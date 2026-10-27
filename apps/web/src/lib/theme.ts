import { useCallback, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
const STORAGE_KEY = "fwp-theme";

function read(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/** Theme preference shared with public/theme.js, which applies it before first paint. */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(read);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* preference just won't persist */
    }
  }, []);

  return { theme, setTheme };
}
