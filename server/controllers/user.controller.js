const userRepository = require('../repositories/user.repository');
const statsRepository = require('../repositories/stats.repository');

exports.getUserPreferences = async (req, res) => {
  try {
    const rows = await userRepository.getPreferences(req.user.googleId);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.updateUserPreferences = async (req, res) => {
  try {
    const username = req.params.username;
    const { defaultUnit, showFunFacts, displayTutorial } = req.body;
    
    const userRows = await userRepository.findByUsername(username);
    if (userRows.length === 0 || userRows[0].google_id !== req.user.googleId) {
      return res.status(403).json({ error: 'Not authorized to edit this trainer.' });
    }

    await userRepository.updatePreferences(
      username,
      defaultUnit || 'km',
      showFunFacts !== false,
      displayTutorial !== false
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.exportData = async (req, res) => {
  try {
    const userRows = await userRepository.findByGoogleId(req.user.googleId);
    if (userRows.length === 0) {
      return res.json([]);
    }
    const usernames = userRows.map(r => r.username);
    const statRows = await statsRepository.getStatsByUsernames(usernames);
    res.json(statRows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.unlinkTrainer = async (req, res) => {
  try {
    const username = req.params.username;
    
    const userRows = await userRepository.findByUsername(username);
    if (userRows.length === 0 || userRows[0].google_id !== req.user.googleId) {
      return res.status(403).json({ error: 'Not authorized to unlink this trainer.' });
    }

    await userRepository.unlinkTrainer(username);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const userRows = await userRepository.findByGoogleId(req.user.googleId);
    
    if (userRows.length > 0) {
      const usernames = userRows.map(r => r.username);
      await statsRepository.softDeleteStatsByUsernames(usernames);
      await userRepository.softDeleteUserByGoogleId(req.user.googleId);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};
