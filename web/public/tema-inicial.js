// Applies the saved theme before the first paint (same rule as src/ui/tema.ts; the CSP blocks inline scripts).
(function () {
  try {
    var choice = window.localStorage.getItem('lilachat.tema');
    var systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (choice === 'dark' || ((choice !== 'light') && systemDark)) document.documentElement.classList.add('dark');
  } catch (error) {
    // No storage: the light palette stays.
  }
})();
