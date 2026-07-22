const cache = require('../cache');
const userRepository = require('../repositories/user.repository');
const statsRepository = require('../repositories/stats.repository');

exports.postData = async (req, res) => {
  try {
    const { username, level, distanceWalked, caught, stopVisited, totalXp, stardust, entryName, createdAt, uploadedAt } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    const insertDate = createdAt ? new Date(createdAt) : new Date();
    const uploadedDate = uploadedAt ? new Date(uploadedAt) : null;
    const previousStats = await statsRepository.getPreviousStats(username, insertDate);
    
    // 1. Handle Users Table
    const userRows = await userRepository.findByUsername(username);
    
    if (req.user) {
      const existingUsers = await userRepository.findByGoogleId(req.user.googleId);
      if (existingUsers.length > 0 && existingUsers[0].username !== username) {
        return res.status(403).json({ error: 'You can only link one trainer to your account.' });
      }
    }

    if (userRows.length > 0) {
      const userRow = userRows[0];
      if (userRow.google_id) {
        if (process.env.DISABLE_RATE_LIMIT !== 'true') {
          if (!req.user || userRow.google_id !== req.user.googleId) {
            return res.status(403).json({ error: 'This trainer is linked to an account. Please log in to upload stats.' });
          }
        }
      }
      if (!userRow.google_id && req.user) {
        await userRepository.updateUserGoogleId(username, req.user.googleId);
      } else {
        await userRepository.updateDateUpdated(username);
      }
    } else {
      await userRepository.createUser(username, req.user ? req.user.googleId : null);
    }

    // 2. Handle Stats Table
    let statId = null;
    if ((distanceWalked !== undefined && caught !== undefined && totalXp !== undefined) || stardust !== undefined) {
      const hasStats = await statsRepository.hasStats(username);
      
      statId = await statsRepository.insertStat(
        username,
        level != null ? level : null,
        distanceWalked != null ? distanceWalked : null,
        caught != null ? caught : null,
        stopVisited != null ? stopVisited : null,
        totalXp != null ? totalXp : null,
        entryName || null,
        insertDate,
        uploadedDate,
        stardust != null ? stardust : null
      );

      // Turn off tutorial if this was their first successful upload
      if (!hasStats) {
        await userRepository.updateTutorialDisplay(username, false);
      }
    }

    cache.invalidateUser(req.user ? req.user.googleId : null, username);
    res.json({ success: true, statId, previousStats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.updateData = async (req, res) => {
  try {
    const statId = req.params.id;
    const { username, level, distanceWalked, caught, stopVisited, totalXp, stardust, entryName, createdAt } = req.body;
    
    const stat = await statsRepository.getStatById(statId);
    if (!stat) return res.status(404).json({ error: 'Not found' });
    const originalUsername = stat.username;
    
    const originalUserRows = await userRepository.findByUsername(originalUsername);
    if (originalUserRows.length === 0 || originalUserRows[0].google_id !== req.user.googleId) {
      return res.status(403).json({ error: 'Not authorized to edit this entry.' });
    }

    if (username !== originalUsername) {
      const newUserRows = await userRepository.findByUsername(username);
      if (newUserRows.length === 0 || newUserRows[0].google_id !== req.user.googleId) {
        return res.status(403).json({ error: 'Not authorized to assign to this trainer.' });
      }
    }

    await statsRepository.updateStat(
      statId,
      username,
      level != null ? level : null,
      distanceWalked != null ? distanceWalked : null,
      caught != null ? caught : null,
      stopVisited != null ? stopVisited : null,
      totalXp != null ? totalXp : null,
      entryName || null,
      createdAt ? new Date(createdAt) : null,
      stardust != null ? stardust : null
    );

    cache.invalidateUser(req.user ? req.user.googleId : null, [username, originalUsername]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.deleteData = async (req, res) => {
  try {
    const statId = req.params.id;
    
    const stat = await statsRepository.getStatById(statId);
    if (!stat) return res.status(404).json({ error: 'Not found' });
    const statUsername = stat.username;
    
    const userRows = await userRepository.findByUsername(statUsername);
    if (userRows.length === 0 || userRows[0].google_id !== req.user.googleId) {
      return res.status(403).json({ error: 'Not authorized to delete this entry.' });
    }

    await statsRepository.softDeleteStat(statId);
    cache.invalidateUser(req.user ? req.user.googleId : null, statUsername);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.getData = async (req, res) => {
  try {
    const { limit, offset, sortField, sortDir } = req.query;

    if (!req.user) {
      if (process.env.DISABLE_RATE_LIMIT === 'true') {
        const rows = await statsRepository.getPaginatedStatsByUsername('Stillworld', limit, offset, sortField, sortDir);
        return res.json(rows);
      }
      return res.json([]);
    }
    
    const cacheKey = `getData_${req.user.googleId}_${limit}_${offset}_${sortField}_${sortDir}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const rows = await statsRepository.getPaginatedStatsByGoogleId(req.user.googleId, limit, offset, sortField, sortDir);
    cache.set(cacheKey, rows);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.getChartData = async (req, res) => {
  try {
    if (!req.user) {
      if (process.env.DISABLE_RATE_LIMIT === 'true') {
        const rows = await statsRepository.getStatsByUsername('Stillworld');
        return res.json(rows);
      }
      return res.json([]);
    }
    
    const cacheKey = `getChartData_${req.user.googleId}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const rows = await statsRepository.getStatsByGoogleId(req.user.googleId);
    cache.set(cacheKey, rows);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const username = req.params.username;
    const { limit, offset, sortField, sortDir } = req.query;
    
    const userRows = await userRepository.findByUsername(username);
    if (userRows.length > 0) {
      const userRow = userRows[0];
      if (userRow.google_id) {
        if (!req.user || userRow.google_id !== req.user.googleId) {
          return res.status(403).json({ error: 'Private profile' });
        }
      }
    }

    const cacheKey = `getUserStats_${username}_${req.user ? req.user.googleId : 'guest'}_${limit}_${offset}_${sortField}_${sortDir}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const rows = await statsRepository.getPaginatedStatsByUsername(username, limit, offset, sortField, sortDir);
    cache.set(cacheKey, rows);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
};
