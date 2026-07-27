const autocannon = require('autocannon');

const instance = autocannon({
  url: 'http://localhost:3000/post-data', // The API server runs on 3000, not 4200
  connections: 10, // Increased connections to push more entries faster
  //duration: 5, // Run for 20 seconds to push a ton of entries
  amount: 13327,
  requests: [
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      setupRequest: (req, context) => {
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        const randomUploadedTime = thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo);
        const randomScreenshotTime = randomUploadedTime - (Math.random() * 5 * 24 * 60 * 60 * 1000);
        
        // Map the random date to a progress value from 0.0 to 1.0 so stats always increase chronologically
        const thirtyFiveDaysAgo = now - (35 * 24 * 60 * 60 * 1000);
        const windowSize = 35 * 24 * 60 * 60 * 1000;
        let progress = (randomScreenshotTime - thirtyFiveDaysAgo) / windowSize;
        progress = Math.max(0, Math.min(1, progress));
        
        // Add a slight curve so the graphs look natural
        const curve = Math.pow(progress, 1.2);

        const dynamicData = {
          username: 'Stillworld',
          level: Math.min(40, Math.floor(curve * 40) + 1),
          distanceWalked: Math.floor(curve * 5000),
          caught: Math.floor(curve * 150000),
          stopVisited: Math.floor(curve * 120000),
          totalXp: Math.floor(curve * 30000000),
          entryName: `Auto Upload`,
          createdAt: new Date(randomScreenshotTime).toISOString(),
          uploadedAt: new Date(randomUploadedTime).toISOString()
        };

        return {
          ...req,
          body: JSON.stringify(dynamicData)
        };
      }
    }
  ]
}, (err, result) => {
  if (err) {
    console.error('Error during load test:', err);
  } else {
    console.log('Load test completed successfully!');
    console.log(`Total Requests: ${result.requests.total}`);
    console.log(`Average Latency: ${result.latency.mean} ms`);
    console.log(`Errors: ${result.errors}`);
  }
});

// This will display a progress bar in the terminal
autocannon.track(instance);
