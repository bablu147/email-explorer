// Theme Boot: read the theme preference before first paint to prevent a flash of the wrong theme.
// Loaded from <head> as a classic blocking script. It is a file rather than an inline block because
// the Content-Security-Policy in _headers (script-src 'self') does not allow inline scripts.
(function() {
  try {
    var t = localStorage.getItem('reflect_theme') || (document.cookie.match(/reflect_theme=(dark|light)/) || [])[1];
    var isDark = true;
    if (t === 'light') {
      isDark = false;
    } else if (t === 'dark') {
      isDark = true;
    } else {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    }
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', isDark ? '#0E1117' : '#F6F8FA');
  } catch(e) {}
})();
