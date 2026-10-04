/**
 * Where to go after signing in: the `redirect` query value when it is a path on this site, else the
 * hub. The value comes from the address bar, so anyone can put anything in it.
 */
export const safeRedirect = (value: unknown): string => {
	if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
	let url: URL;
	try {
		// Resolved as the browser will resolve it. "/\host" and "/<tab>/host" start with one slash
		// and still name another site; only the parser shows that.
		url = new URL(value, window.location.origin);
	} catch {
		return "/";
	}
	if (url.origin !== window.location.origin) return "/";
	const path = url.pathname + url.search + url.hash;
	// "/.//host" resolves to the path "//host", which a navigation would again read as a site.
	if (path.startsWith("//")) return "/";
	// Back to the sign-in page would be a loop.
	if (url.pathname.replace(/\/+$/, "") === "/login") return "/";
	return path;
};
