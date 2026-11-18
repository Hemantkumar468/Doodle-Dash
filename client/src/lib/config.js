const fallback = typeof window === 'undefined'
  ? 'http://localhost:5000'
  : `${window.location.protocol}//${window.location.hostname}:5000`;

export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || fallback).replace(/\/+$/, '');
