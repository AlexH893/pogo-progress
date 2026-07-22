const db = require('../db');
const userRepository = require('./user.repository');

jest.mock('../db');

describe('UserRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByUsername', () => {
    it('should call db.execute and return rows', async () => {
      const mockRows = [{ username: 'testuser' }];
      db.execute.mockResolvedValue([mockRows]);

      const result = await userRepository.findByUsername('testuser');

      expect(db.execute).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE username = ? AND is_deleted = 0',
        ['testuser']
      );
      expect(result).toEqual(mockRows);
    });
  });

  describe('findByGoogleId', () => {
    it('should call db.execute and return rows', async () => {
      const mockRows = [{ username: 'testuser' }];
      db.execute.mockResolvedValue([mockRows]);

      const result = await userRepository.findByGoogleId('google123');

      expect(db.execute).toHaveBeenCalledWith(
        'SELECT username FROM users WHERE google_id = ? AND is_deleted = 0',
        ['google123']
      );
      expect(result).toEqual(mockRows);
    });
  });

  describe('createUser', () => {
    it('should create user with google_id', async () => {
      db.execute.mockResolvedValue([{}]);

      await userRepository.createUser('testuser', 'google123');

      expect(db.execute).toHaveBeenCalledWith(
        'INSERT INTO users (username, date_added, date_updated, google_id) VALUES (?, NOW(), NOW(), ?)',
        ['testuser', 'google123']
      );
    });

    it('should create user without google_id', async () => {
      db.execute.mockResolvedValue([{}]);

      await userRepository.createUser('testuser', undefined);

      expect(db.execute).toHaveBeenCalledWith(
        'INSERT INTO users (username, date_added, date_updated) VALUES (?, NOW(), NOW())',
        ['testuser']
      );
    });
  });

  describe('updateUserGoogleId', () => {
    it('should update user google_id', async () => {
      db.execute.mockResolvedValue([{}]);

      await userRepository.updateUserGoogleId('testuser', 'google123');

      expect(db.execute).toHaveBeenCalledWith(
        'UPDATE users SET date_updated = NOW(), google_id = ? WHERE username = ?',
        ['google123', 'testuser']
      );
    });
  });

  describe('updateDateUpdated', () => {
    it('should update date_updated', async () => {
      db.execute.mockResolvedValue([{}]);

      await userRepository.updateDateUpdated('testuser');

      expect(db.execute).toHaveBeenCalledWith(
        'UPDATE users SET date_updated = NOW() WHERE username = ?',
        ['testuser']
      );
    });
  });

  describe('updateTutorialDisplay', () => {
    it('should update display_tutorial', async () => {
      db.execute.mockResolvedValue([{}]);

      await userRepository.updateTutorialDisplay('testuser', false);

      expect(db.execute).toHaveBeenCalledWith(
        'UPDATE users SET display_tutorial = ? WHERE username = ?',
        [false, 'testuser']
      );
    });
  });

  describe('getPreferences', () => {
    it('should get user preferences', async () => {
      const mockRows = [{ username: 'testuser', default_unit: 'km' }];
      db.execute.mockResolvedValue([mockRows]);

      const result = await userRepository.getPreferences('google123');

      expect(db.execute).toHaveBeenCalledWith(
        'SELECT username, default_unit, show_fun_facts, display_tutorial FROM users WHERE google_id = ? AND is_deleted = 0',
        ['google123']
      );
      expect(result).toEqual(mockRows);
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      db.execute.mockResolvedValue([{}]);

      await userRepository.updatePreferences('testuser', 'mi', true, false);

      expect(db.execute).toHaveBeenCalledWith(
        'UPDATE users SET default_unit = ?, show_fun_facts = ?, display_tutorial = ? WHERE username = ?',
        ['mi', true, false, 'testuser']
      );
    });
  });

  describe('unlinkTrainer', () => {
    it('should set google_id to NULL', async () => {
      db.execute.mockResolvedValue([{}]);

      await userRepository.unlinkTrainer('testuser');

      expect(db.execute).toHaveBeenCalledWith(
        'UPDATE users SET google_id = NULL WHERE username = ?',
        ['testuser']
      );
    });
  });

  describe('softDeleteUserByGoogleId', () => {
    it('should set is_deleted to 1', async () => {
      db.execute.mockResolvedValue([{}]);

      await userRepository.softDeleteUserByGoogleId('google123');

      expect(db.execute).toHaveBeenCalledWith(
        'UPDATE users SET is_deleted = 1 WHERE google_id = ?',
        ['google123']
      );
    });
  });

  describe('deleteByUsernames', () => {
    it('should do nothing if usernames array is empty', async () => {
      await userRepository.deleteByUsernames([]);
      expect(db.execute).not.toHaveBeenCalled();
    });

    it('should hard delete users by usernames', async () => {
      db.execute.mockResolvedValue([{}]);

      await userRepository.deleteByUsernames(['user1', 'user2']);

      expect(db.execute).toHaveBeenCalledWith(
        'DELETE FROM users WHERE username IN (?,?)',
        ['user1', 'user2']
      );
    });
  });

  describe('findByGoogleIdIncludingDeleted', () => {
    it('should return rows including deleted ones', async () => {
      const mockRows = [{ username: 'testuser' }];
      db.execute.mockResolvedValue([mockRows]);

      const result = await userRepository.findByGoogleIdIncludingDeleted('google123');

      expect(db.execute).toHaveBeenCalledWith(
        'SELECT username FROM users WHERE google_id = ?',
        ['google123']
      );
      expect(result).toEqual(mockRows);
    });
  });
});
