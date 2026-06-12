import { isDevMode } from '@angular/core';

export const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    if (isDevMode() || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
  } else {
    // During Server-Side Rendering (Node.js environment)
    return 'http://localhost:3000';
  }
  
 // Prod url
  return 'https://pogo-progress.onrender.com';
};

export const getGoogleClientId = () => {
  return '480625039077-4q4qq6dq8spaghga4g280kv9vfh8k9kk.apps.googleusercontent.com';
};
