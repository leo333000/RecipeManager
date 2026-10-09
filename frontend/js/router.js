// Hash router: "#/recipes/abc?draft=1" -> { path: "/recipes/abc", query }.

export function parseHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '') || '/';
  const [path, search = ''] = raw.split('?');
  return { path: path.startsWith('/') ? path : `/${path}`, query: new URLSearchParams(search) };
}

/** Finds the first route whose pattern ("/recipes/:id") matches `path`. */
export function matchRoute(routes, path) {
  const parts = path.split('/').filter(Boolean);
  for (const route of routes) {
    const patternParts = route.pattern.split('/').filter(Boolean);
    if (patternParts.length !== parts.length) continue;

    const params = {};
    const matches = patternParts.every((part, index) => {
      if (part.startsWith(':')) {
        try {
          params[part.slice(1)] = decodeURIComponent(parts[index]);
        } catch {
          return false;
        }
        return true;
      }
      return part === parts[index];
    });
    if (matches) return { route, params };
  }
  return null;
}

export function navigate(path) {
  if (window.location.hash === `#${path}`) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = path;
}

export function currentPath() {
  return parseHash(window.location.hash).path;
}
