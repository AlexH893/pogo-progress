const http = require('http');

const makeRequest = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/auth/test-token',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.end();
  });
};

async function runRateLimitTest() {
  console.log('Starting Rate Limit Test for /auth/test-token...');
  console.log('The auth limit is set to 10 requests per 15 mins in production, but might be 1000 locally depending on NODE_ENV.');
  
  // To ensure we hit the limit, we will force NODE_ENV=production when running this test,
  // or just send enough requests to hit the local limit. For this test, we assume the server
  // is already running locally at port 3000. 
  
  // We will send 15 requests rapidly. 
  // If the limit is 10, the 11th should fail.
  let successCount = 0;
  let rateLimitedCount = 0;
  
  for (let i = 1; i <= 15; i++) {
    try {
      const response = await makeRequest();
      if (response.statusCode === 429) {
        console.log(`Request ${i}: 🔴 Rate Limited! (429) - ${response.data}`);
        rateLimitedCount++;
      } else {
        console.log(`Request ${i}: 🟢 Success (Status: ${response.statusCode})`);
        successCount++;
      }
    } catch (err) {
      console.error(`Request ${i}: Failed to connect. Is the server running?`, err.message);
      process.exit(1);
    }
  }
  
  console.log('\n--- Test Summary ---');
  console.log(`Successful requests: ${successCount}`);
  console.log(`Rate limited requests: ${rateLimitedCount}`);
  
  if (rateLimitedCount > 0) {
    console.log('✅ Rate limiter is WORKING!');
  } else {
    console.log('⚠️ No requests were rate limited. If you are running locally without NODE_ENV=production, the limit might be 1000.');
  }
}

runRateLimitTest();
