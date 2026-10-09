// Minimal method + path router with ":param" segments.

export function createRouter() {
  const routes = [];

  function add(method, pattern, handler, { isPublic = false } = {}) {
    const keys = [];
    const source = pattern.replace(/:([a-zA-Z]+)/g, (_, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    routes.push({ method, regex: new RegExp(`^${source}/?$`), keys, handler, isPublic });
  }

  /** Returns { handler, params, isPublic }, { methodNotAllowed: true }, or null. */
  function match(method, path) {
    let pathMatched = false;
    for (const route of routes) {
      const found = route.regex.exec(path);
      if (!found) continue;
      pathMatched = true;
      if (route.method !== method) continue;

      const params = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(found[index + 1]);
      });
      return { handler: route.handler, params, isPublic: route.isPublic };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }

  return {
    match,
    get: (pattern, handler, options) => add('GET', pattern, handler, options),
    post: (pattern, handler, options) => add('POST', pattern, handler, options),
    put: (pattern, handler, options) => add('PUT', pattern, handler, options),
    patch: (pattern, handler, options) => add('PATCH', pattern, handler, options),
    delete: (pattern, handler, options) => add('DELETE', pattern, handler, options),
  };
}
