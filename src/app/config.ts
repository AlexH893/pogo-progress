import { isDevMode } from '@angular/core';

export const getApiUrl = () => {
  // If we are running locally, use the local Node.js server
  if (isDevMode() || window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  
 // Prod url
  return 'https://pogo-progress.onrender.com';
};

export const getGoogleClientId = () => {
  return '480625039077-4q4qq6dq8spaghga4g280kv9vfh8k9kk.apps.googleusercontent.com';
};
