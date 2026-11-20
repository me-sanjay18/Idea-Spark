import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

let cachedCsrfToken = '';

function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export function setCsrfToken(token) {
  if (token) {
    cachedCsrfToken = token;
  }
}

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    let csrf = readCookie('ideaspark_csrf') || cachedCsrfToken;
    if (!csrf && config.url !== '/auth/csrf-token') {
      try {
        const res = await axios.get(`${API_BASE}/auth/csrf-token`, { withCredentials: true });
        csrf = res.data?.data?.csrfToken || readCookie('ideaspark_csrf');
        if (csrf) cachedCsrfToken = csrf;
      } catch {
        // Ignore; server will handle if needed
      }
    }
    if (csrf) {
      config.headers['X-CSRF-Token'] = csrf;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const maybeCsrf = response.data?.data?.csrfToken;
    if (maybeCsrf) {
      cachedCsrfToken = maybeCsrf;
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

