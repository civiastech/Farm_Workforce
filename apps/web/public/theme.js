// Applies the saved light/dark preference before first paint (avoids a flash of the wrong theme).
// Loaded as an external file so the Content-Security-Policy can forbid inline scripts.
try {
  var theme = localStorage.getItem("fwp-theme");
  if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
} catch {
  /* storage unavailable: follow the system preference */
}
