const db = require('../db');
const statsRepository = require('./stats.repository');

jest.mock('../db');

describe('StatsRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPreviousStats', () => {
    it('should return the first row if stats exist', async () => {
      const mockRow = { id: 1, username: 'testuser' };
      db.execute.mockResolvedValue([[mockRow]]);

      const result = await statsRepository.getPreviousStats('testuser', '2023-01-01');

      // Bug #5 fix: query must use strict `<` so a row at the exact same
      // timestamp is never returned as "previous" stats (which would cause
      // all diffs to show 0).
      expect(db.execute).toHaveBeenCalledWith(
        'SELECT * FROM stats WHERE username = ? AND created_at < ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1',
        ['testuser', '2023-01-01']
      );
      expect(result).toEqual(mockRow);
    });

    it('should return null if no stats exist', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await statsRepository.getPreviousStats('testuser', '2023-01-01');

      expect(result).toBeNull();
    });

    // Regression: Bug #5 — uploading two entries at the same timestamp
    // previously caused the new row to be returned as its own previousStats,
    // making all diffs show 0. Verify the query uses strict `<`.
    it('should use strict < comparison so same-timestamp rows are excluded', async () => {
      db.execute.mockResolvedValue([[]]);
      const sameTimestamp = '2024-06-15T12:00:00.000Z';

      await statsRepository.getPreviousStats('testuser', sameTimestamp);

      const [sql] = db.execute.mock.calls[0];
      expect(sql).toContain('created_at <');
      expect(sql).not.toContain('created_at <=');
    });
  });

  describe('hasStats', () => {
    it('should return true if stats exist', async () => {
      db.execute.mockResolvedValue([[{ id: 1 }]]);

      const result = await statsRepository.hasStats('testuser');

      expect(db.execute).toHaveBeenCalledWith(
        'SELECT id FROM stats WHERE username = ? AND is_deleted = 0 LIMIT 1',
        ['testuser']
      );
      expect(result).toBe(true);
    });

    it('should return false if no stats exist', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await statsRepository.hasStats('testuser');

      expect(result).toBe(false);
    });
  });

  describe('insertStat', () => {
    it('should insert stat and return insertId', async () => {
      db.execute.mockResolvedValue([{ insertId: 42 }]);

      const result = await statsRepository.insertStat('testuser', 40, 100, 500, 200, 1000, 'entry', '2023-01-01');

      expect(db.execute).toHaveBeenCalledWith(
        'INSERT INTO stats (username, level, distance_walked, caught, stop_visited, total_xp, stardust, entry_name, created_at, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['testuser', 40, 100, 500, 200, 1000, null, 'entry', '2023-01-01', expect.any(Date)]
      );
      expect(result).toBe(42);
    });
  });

  describe('getStatById', () => {
    it('should return the stat if it exists', async () => {
      const mockRow = { id: 1, username: 'testuser' };
      db.execute.mockResolvedValue([[mockRow]]);

      const result = await statsRepository.getStatById(1);

      expect(db.execute).toHaveBeenCalledWith(
        'SELECT * FROM stats WHERE id = ? AND is_deleted = 0',
        [1]
      );
      expect(result).toEqual(mockRow);
    });

    it('should return null if stat does not exist', async () => {
      db.execute.mockResolvedValue([[]]);

      const result = await statsRepository.getStatById(1);

      expect(result).toBeNull();
    });
  });

  describe('updateStat', () => {
    it('should update stat with createdAt', async () => {
      db.execute.mockResolvedValue([{}]);

      await statsRepository.updateStat(1, 'testuser', 40, 100, 500, 200, 1000, 'entry', '2023-01-01');

      expect(db.execute).toHaveBeenCalledWith(
        'UPDATE stats SET username = ?, level = ?, distance_walked = ?, caught = ?, stop_visited = ?, total_xp = ?, stardust = ?, entry_name = ?, created_at = ? WHERE id = ?',
        ['testuser', 40, 100, 500, 200, 1000, null, 'entry', '2023-01-01', 1]
      );
    });

    it('should update stat without createdAt', async () => {
      db.execute.mockResolvedValue([{}]);

      await statsRepository.updateStat(1, 'testuser', 40, 100, 500, 200, 1000, 'entry');

      expect(db.execute).toHaveBeenCalledWith(
        'UPDATE stats SET username = ?, level = ?, distance_walked = ?, caught = ?, stop_visited = ?, total_xp = ?, stardust = ?, entry_name = ? WHERE id = ?',
        ['testuser', 40, 100, 500, 200, 1000, null, 'entry', 1]
      );
    });
  });

  describe('softDeleteStat', () => {
    it('should update is_deleted to 1', async () => {
      db.execute.mockResolvedValue([{}]);

      await statsRepository.softDeleteStat(1);

      expect(db.execute).toHaveBeenCalledWith(
        'UPDATE stats SET is_deleted = 1 WHERE id = ?',
        [1]
      );
    });
  });

  describe('getStatsByGoogleId', () => {
    it('should get stats by googleId', async () => {
      const mockUserRows = [{ username: 'testuser', google_id: 'google123', default_unit: 'km' }];
      const mockStatsRows = [{ id: 1, username: 'testuser' }];
      
      db.execute
        .mockResolvedValueOnce([mockUserRows])
        .mockResolvedValueOnce([mockStatsRows]);

      const result = await statsRepository.getStatsByGoogleId('google123');

      expect(db.execute).toHaveBeenNthCalledWith(1,
        'SELECT username, google_id, default_unit FROM users WHERE google_id = ? AND is_deleted = 0',
        ['google123']
      );
      
      expect(db.execute).toHaveBeenNthCalledWith(2,
        'SELECT stats.* FROM stats WHERE username IN (?) AND is_deleted = 0 ORDER BY created_at DESC',
        ['testuser']
      );

      expect(result).toEqual([
        { id: 1, username: 'testuser', google_id: 'google123', default_unit: 'km' }
      ]);
    });

    it('should return empty array if no users found', async () => {
      db.execute.mockResolvedValueOnce([[]]);
      const result = await statsRepository.getStatsByGoogleId('google123');
      expect(result).toEqual([]);
      expect(db.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStatsByUsername', () => {
    it('should get stats by username', async () => {
      const mockRows = [{ id: 1, username: 'testuser' }];
      db.execute.mockResolvedValue([mockRows]);

      const result = await statsRepository.getStatsByUsername('testuser');

      expect(db.execute).toHaveBeenCalledWith(
        'SELECT id, username, level, distance_walked, caught, stop_visited, total_xp, stardust, entry_name, created_at, uploaded_at FROM stats WHERE username = ? AND is_deleted = 0 ORDER BY created_at ASC',
        ['testuser']
      );
      expect(result).toEqual(mockRows);
    });
  });

  describe('getPaginatedStatsByGoogleId', () => {
    it('should get paginated stats by googleId with default pagination and sorting', async () => {
      const mockUserRows = [{ username: 'testuser', google_id: 'google123', default_unit: 'km' }];
      const mockStatsRows = [{ id: 1, username: 'testuser' }];
      
      db.execute
        .mockResolvedValueOnce([mockUserRows])
        .mockResolvedValueOnce([mockStatsRows]);

      const result = await statsRepository.getPaginatedStatsByGoogleId('google123', undefined, undefined);

      expect(db.execute).toHaveBeenNthCalledWith(1,
        'SELECT username, google_id, default_unit FROM users WHERE google_id = ? AND is_deleted = 0',
        ['google123']
      );
      
      expect(db.execute).toHaveBeenNthCalledWith(2,
        'SELECT stats.* FROM stats WHERE username IN (?) AND is_deleted = 0 ORDER BY created_at DESC LIMIT 50 OFFSET 0',
        ['testuser']
      );

      expect(result).toEqual([
        { id: 1, username: 'testuser', google_id: 'google123', default_unit: 'km' }
      ]);
    });

    it('should return empty array if no users found', async () => {
      db.execute.mockResolvedValueOnce([[]]);
      const result = await statsRepository.getPaginatedStatsByGoogleId('google123', 10, 0);
      expect(result).toEqual([]);
      expect(db.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPaginatedStatsByUsername', () => {
    it('should get paginated stats by username with default pagination and sorting', async () => {
      const mockRows = [{ id: 1, username: 'testuser' }];
      db.execute.mockResolvedValue([mockRows]);

      const result = await statsRepository.getPaginatedStatsByUsername('testuser', undefined, undefined);

      expect(db.execute).toHaveBeenCalledWith(
        'SELECT id, username, level, distance_walked, caught, stop_visited, total_xp, stardust, entry_name, created_at, uploaded_at FROM stats WHERE username = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT 50 OFFSET 0',
        ['testuser']
      );
      expect(result).toEqual(mockRows);
    });
  });

  describe('getStatsByUsernames', () => {
    it('should return empty array if usernames is empty', async () => {
      const result = await statsRepository.getStatsByUsernames([]);
      expect(result).toEqual([]);
      expect(db.execute).not.toHaveBeenCalled();
    });

    it('should get stats by multiple usernames', async () => {
      const mockRows = [{ id: 1, username: 'user1' }];
      db.execute.mockResolvedValue([mockRows]);

      const result = await statsRepository.getStatsByUsernames(['user1', 'user2']);

      expect(db.execute).toHaveBeenCalledWith(
        'SELECT * FROM stats WHERE username IN (?,?) AND is_deleted = 0 ORDER BY username ASC, created_at ASC',
        ['user1', 'user2']
      );
      expect(result).toEqual(mockRows);
    });
  });

  describe('softDeleteStatsByUsernames', () => {
    it('should do nothing if usernames is empty', async () => {
      await statsRepository.softDeleteStatsByUsernames([]);
      expect(db.execute).not.toHaveBeenCalled();
    });

    it('should soft delete stats by usernames', async () => {
      db.execute.mockResolvedValue([{}]);

      await statsRepository.softDeleteStatsByUsernames(['user1', 'user2']);

      expect(db.execute).toHaveBeenCalledWith(
        'UPDATE stats SET is_deleted = 1 WHERE username IN (?,?)',
        ['user1', 'user2']
      );
    });
  });

  describe('hardDeleteStatsByUsernames', () => {
    it('should do nothing if usernames is empty', async () => {
      await statsRepository.hardDeleteStatsByUsernames([]);
      expect(db.execute).not.toHaveBeenCalled();
    });

    it('should hard delete stats by usernames', async () => {
      db.execute.mockResolvedValue([{}]);

      await statsRepository.hardDeleteStatsByUsernames(['user1', 'user2']);

      expect(db.execute).toHaveBeenCalledWith(
        'DELETE FROM stats WHERE username IN (?,?)',
        ['user1', 'user2']
      );
    });
  });
});
