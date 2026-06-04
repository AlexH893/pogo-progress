import { isDevMode } from '@angular/core';

export const getApiUrl = () => {
  // If we are running locally, use the local Node.js server
  if (isDevMode() || window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  
  // If we are in production (GitHub Pages), use the deployed backend URL
  // IMPORTANT: You need to replace this URL with your actual Koyeb or Render URL!
  return 'https://replace-this-with-your-render-url.onrender.com';
};
