import { isDevMode } from '@angular/core';

export const getApiUrl = () => {
  // If we are running locally, use the local Node.js server
  if (isDevMode() || window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  
 // Prod url
  return 'https://pogo-progress.onrender.com';
};
