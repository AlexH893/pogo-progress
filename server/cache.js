const NodeCache = require("node-cache");
const apiCache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

module.exports = {
  get: (key) => apiCache.get(key),
  set: (key, val) => apiCache.set(key, val),
  del: (key) => apiCache.del(key),
  invalidateUser: (googleId, usernames) => {
    const keys = apiCache.keys();
    if (googleId) {
      keys.forEach(k => {
        if (k.startsWith(`getData_${googleId}`) || k.startsWith(`getChartData_${googleId}`)) {
          apiCache.del(k);
        }
      });
    }
    if (usernames) {
      const uArr = Array.isArray(usernames) ? usernames : [usernames];
      uArr.forEach(u => {
        keys.forEach(k => {
          if (k.startsWith(`getUserStats_${u}`)) apiCache.del(k);
        });
      });
    }
  }
};
