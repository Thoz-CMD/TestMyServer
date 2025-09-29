// Auto-detect API base URL (optimized: try cached port first, reduce noisy 404s)
const API_PORT_CANDIDATES = [8000,8001,8002,8003,8004];
let BASE_URL = 'http://localhost:8000';
let apiReady;

const LS_KEY = 'api_last_port';

async function probe(port) {
  try {
    const resp = await fetch(`http://localhost:${port}/health`, { cache: 'no-store' });
    if (resp.ok) return true;
  } catch (e) { /* silent */ }
  return false;
}

async function detectApiBase() {
  // 1. Try cached port first (if exists)
  const cached = Number(localStorage.getItem(LS_KEY));
  if (cached && API_PORT_CANDIDATES.includes(cached)) {
    if (await probe(cached)) {
      BASE_URL = `http://localhost:${cached}`;
      console.log('[config] API (cached) =>', BASE_URL);
      return BASE_URL;
    }
  }
  // 2. Sequential probe (stop at first success)
  for (const p of API_PORT_CANDIDATES) {
    if (p === cached) continue; // already tried
    if (await probe(p)) {
      BASE_URL = `http://localhost:${p}`;
      localStorage.setItem(LS_KEY, String(p));
      console.log('[config] API detected at', BASE_URL);
      return BASE_URL;
    }
  }
  console.warn('[config] API not detected. Using default', BASE_URL);
  return BASE_URL;
}

apiReady = detectApiBase();

export { BASE_URL, apiReady };
