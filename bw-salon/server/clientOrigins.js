export function isAllowedClientOrigin(origin, allowedOrigins, isProduction) {
  if (!isProduction || !origin || allowedOrigins.includes(origin)) return true;

  let requestUrl;
  try {
    requestUrl = new URL(origin);
  } catch {
    return false;
  }
  if (requestUrl.protocol !== "https:" || requestUrl.origin !== origin) return false;

  return allowedOrigins.some(allowedOrigin => {
    let allowedUrl;
    try {
      allowedUrl = new URL(allowedOrigin);
    } catch {
      return false;
    }

    const suffix = ".vercel.app";
    if (allowedUrl.protocol !== "https:" || !allowedUrl.hostname.endsWith(suffix)) {
      return false;
    }

    const projectHost = allowedUrl.hostname.slice(0, -suffix.length);
    return requestUrl.hostname.startsWith(`${projectHost}-`) &&
      requestUrl.hostname.endsWith(suffix);
  });
}
