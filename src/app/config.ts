import { isDevMode } from '@angular/core';

export const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    if (isDevMode() || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    // In production browser, frontend and backend share the same domain
    return '';
  } else {
    // During Server-Side Rendering (Node.js environment)
    // We can hit the local server or the public Render URL. 
    // Using the public URL is safest to avoid dynamic port mapping issues.
    return isDevMode() ? 'http://localhost:3000' : 'https://pogo-progress.onrender.com';
  }
};

export const getGoogleClientId = () => {
  return '480625039077-4q4qq6dq8spaghga4g280kv9vfh8k9kk.apps.googleusercontent.com';
};
