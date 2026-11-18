const SESSION_KEY = 'sketch-party-session';
const PROFILE_KEY = 'sketch-party-profile';

export function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
}

export function saveSession(value) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function readProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; }
}

export function saveProfile(value) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(value));
}
