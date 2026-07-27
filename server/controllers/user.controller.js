const userRepository = require('../repositories/user.repository');
const statsRepository = require('../repositories/stats.repository');
const { handleServerError } = require('../utils/errorHandler');

exports.getUserPreferences = async (req, res) => {
  try {
    const rows = await userRepository.getPreferences(req.user.googleId);
    res.json(rows);
  } catch (err) {
    return handleServerError(res, err, 'Failed to fetch user preferences.');
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

    const toNullableBool = (val) => val === true ? true : val === false ? false : null;
    await userRepository.updatePreferences(
      username,
      defaultUnit || 'km',
      toNullableBool(showFunFacts),
      toNullableBool(displayTutorial)
    );

    res.json({ success: true });
  } catch (err) {
    return handleServerError(res, err, 'Failed to update user preferences.');
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
    return handleServerError(res, err, 'Failed to export user data.');
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
    return handleServerError(res, err, 'Failed to unlink trainer profile.');
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
    return handleServerError(res, err, 'Failed to delete account.');
  }
};
