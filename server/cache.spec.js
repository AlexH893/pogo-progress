const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDel = jest.fn();
const mockKeys = jest.fn();

jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => ({
    get: mockGet,
    set: mockSet,
    del: mockDel,
    keys: mockKeys
  }));
});

const cache = require('./cache');

describe('cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should call apiCache.get with correct key', () => {
      mockGet.mockReturnValue('value');
      const result = cache.get('testKey');
      expect(mockGet).toHaveBeenCalledWith('testKey');
      expect(result).toBe('value');
    });
  });

  describe('set', () => {
    it('should call apiCache.set with correct key and value', () => {
      cache.set('testKey', 'value');
      expect(mockSet).toHaveBeenCalledWith('testKey', 'value');
    });
  });

  describe('del', () => {
    it('should call apiCache.del with correct key', () => {
      cache.del('testKey');
      expect(mockDel).toHaveBeenCalledWith('testKey');
    });
  });

  describe('invalidateUser', () => {
    it('should delete keys starting with getData_ and getChartData_ for a specific googleId', () => {
      mockKeys.mockReturnValue([
        'getData_123',
        'getChartData_123',
        'getData_456',
        'otherKey'
      ]);

      cache.invalidateUser('123', null);

      expect(mockDel).toHaveBeenCalledWith('getData_123');
      expect(mockDel).toHaveBeenCalledWith('getChartData_123');
      expect(mockDel).not.toHaveBeenCalledWith('getData_456');
      expect(mockDel).not.toHaveBeenCalledWith('otherKey');
    });

    it('should delete keys starting with getUserStats_ for a specific username string', () => {
      mockKeys.mockReturnValue([
        'getUserStats_user1',
        'getUserStats_user2',
        'otherKey'
      ]);

      cache.invalidateUser(null, 'user1');

      expect(mockDel).toHaveBeenCalledWith('getUserStats_user1');
      expect(mockDel).not.toHaveBeenCalledWith('getUserStats_user2');
    });

    it('should delete keys starting with getUserStats_ for an array of usernames', () => {
      mockKeys.mockReturnValue([
        'getUserStats_user1',
        'getUserStats_user2',
        'getUserStats_user3'
      ]);

      cache.invalidateUser(null, ['user1', 'user2']);

      expect(mockDel).toHaveBeenCalledWith('getUserStats_user1');
      expect(mockDel).toHaveBeenCalledWith('getUserStats_user2');
      expect(mockDel).not.toHaveBeenCalledWith('getUserStats_user3');
    });

    it('should handle both googleId and usernames being provided simultaneously', () => {
      mockKeys.mockReturnValue([
        'getData_123',
        'getUserStats_user1'
      ]);

      cache.invalidateUser('123', 'user1');

      expect(mockDel).toHaveBeenCalledWith('getData_123');
      expect(mockDel).toHaveBeenCalledWith('getUserStats_user1');
    });
    
    it('should not throw if keys is empty', () => {
      mockKeys.mockReturnValue([]);
      expect(() => {
        cache.invalidateUser('123', 'user1');
      }).not.toThrow();
    });
  });
});
