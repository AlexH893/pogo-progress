const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const userRepository = require('../repositories/user.repository');
const statsRepository = require('../repositories/stats.repository');

exports.getTestToken = (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }
  const token = jwt.sign(
    { googleId: 'cypress_test_user_id', email: 'cypress@test.com', name: 'Cypress Test' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  res.json({ token, user: { googleId: 'cypress_test_user_id', email: 'cypress@test.com', name: 'Cypress Test' } });
};

exports.cleanupTestData = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }
  try {
    const userRows = await userRepository.findByGoogleIdIncludingDeleted('cypress_test_user_id');
    
    const testUsernames = [
      'Stillworld', 'crosspawz', 'Swagpapa209', 
      'DarkraiPH1111', 'TheSleepySiren1', 'TheSleepySirenl', 
      'RedEliGmz', 'RedEliGm', 'Zaford42', 'CypressTestUser'
    ];
    
    const allUsernamesToDelete = [...new Set([...testUsernames, ...userRows.map(r => r.username)])];
    
    if (allUsernamesToDelete.length > 0) {
      await statsRepository.hardDeleteStatsByUsernames(allUsernamesToDelete);
      await userRepository.deleteByUsernames(allUsernamesToDelete);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};
