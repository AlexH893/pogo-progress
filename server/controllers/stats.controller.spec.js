const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// Mock dependencies
jest.mock('../db', () => ({
  query: jest.fn(),
  execute: jest.fn(),
  getConnection: jest.fn()
}));
jest.mock('../repositories/user.repository');
jest.mock('../repositories/stats.repository');
jest.mock('../cache');

const userRepository = require('../repositories/user.repository');
const statsRepository = require('../repositories/stats.repository');
const cache = require('../cache');

describe('Stats Controller', () => {
  let token;
  const testGoogleId = 'test-google-id';

  beforeAll(() => {
    token = jwt.sign({ googleId: testGoogleId }, JWT_SECRET);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /post-data', () => {
    it('should return 400 if username is missing', async () => {
      const res = await request(app).post('/post-data').send({ level: 40 });
      expect(res.status).toBe(400); // Triggered by validation middleware
    });

    it('should create new stat entry and user if authorized and valid', async () => {
      userRepository.findByUsername.mockResolvedValue([]); // new user
      userRepository.findByGoogleId.mockResolvedValue([]); // not linked yet
      statsRepository.hasStats.mockResolvedValue(false);
      statsRepository.insertStat.mockResolvedValue(123);
      
      const res = await request(app)
        .post('/post-data')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'NewTrainer',
          level: 30,
          distanceWalked: 10,
          caught: 100,
          totalXp: 500000
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.statId).toBe(123);
      expect(userRepository.createUser).toHaveBeenCalledWith('NewTrainer', testGoogleId);
      expect(statsRepository.insertStat).toHaveBeenCalled();
      expect(cache.invalidateUser).toHaveBeenCalledWith(testGoogleId, 'NewTrainer');
    });

    it('should return 403 if trying to upload to a trainer linked to someone else', async () => {
      userRepository.findByUsername.mockResolvedValue([{ google_id: 'other-google-id' }]);
      userRepository.findByGoogleId.mockResolvedValue([]);

      const res = await request(app)
        .post('/post-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'TakenTrainer' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/linked to an account/);
    });
  });

  describe('GET /get-data', () => {
    it('should return empty array if no user', async () => {
      const res = await request(app).get('/get-data');
      expect(res.status).toBe(200); // optionalAuth lets it through
      expect(res.body).toEqual([]);
    });

    it('should return cached data if available', async () => {
      cache.get.mockReturnValue([{ level: 40 }]);

      const res = await request(app)
        .get('/get-data')
        .query({ limit: 50, offset: 0, sortField: 'created_at', sortDir: 'desc' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ level: 40 }]);
      expect(statsRepository.getPaginatedStatsByGoogleId).not.toHaveBeenCalled();
    });

    it('should fetch from db and cache if not in cache', async () => {
      cache.get.mockReturnValue(null);
      statsRepository.getPaginatedStatsByGoogleId.mockResolvedValue([{ level: 41 }]);

      const res = await request(app)
        .get('/get-data')
        .query({ limit: 50, offset: 0, sortField: 'created_at', sortDir: 'desc' })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ level: 41 }]);
      expect(statsRepository.getPaginatedStatsByGoogleId).toHaveBeenCalledWith(testGoogleId, '50', '0', 'created_at', 'desc');
      expect(cache.set).toHaveBeenCalledWith(`getData_${testGoogleId}_50_0_created_at_desc`, [{ level: 41 }]);
    });
  });

  describe('DELETE /delete-data/:id', () => {
    it('should soft delete stat if user owns it', async () => {
      statsRepository.getStatById.mockResolvedValue({ username: 'Ash' });
      userRepository.findByUsername.mockResolvedValue([{ google_id: testGoogleId }]);
      statsRepository.softDeleteStat.mockResolvedValue(true);

      const res = await request(app)
        .delete('/delete-data/99')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(statsRepository.softDeleteStat).toHaveBeenCalledWith('99');
    });

    it('should return 403 if user does not own the stat', async () => {
      statsRepository.getStatById.mockResolvedValue({ username: 'Ash' });
      userRepository.findByUsername.mockResolvedValue([{ google_id: 'other-id' }]); // unowned

      const res = await request(app)
        .delete('/delete-data/99')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /update-data/:id', () => {
    it('should return 404 if stat does not exist', async () => {
      statsRepository.getStatById.mockResolvedValue(null);
      const res = await request(app)
        .put('/update-data/99')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'Ash', level: 40 });
      expect(res.status).toBe(404);
    });

    it('should return 403 if user does not own the original stat', async () => {
      statsRepository.getStatById.mockResolvedValue({ username: 'Ash' });
      userRepository.findByUsername.mockResolvedValue([{ google_id: 'other-id' }]);

      const res = await request(app)
        .put('/update-data/99')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'Ash', level: 40 });
      
      expect(res.status).toBe(403);
    });

    it('should return 403 if re-assigning to a trainer owned by someone else', async () => {
      statsRepository.getStatById.mockResolvedValue({ username: 'Ash' });
      // Owns Ash
      userRepository.findByUsername.mockImplementation((uname) => {
        if (uname === 'Ash') return Promise.resolve([{ google_id: testGoogleId }]);
        if (uname === 'Misty') return Promise.resolve([{ google_id: 'other-id' }]);
        return Promise.resolve([]);
      });

      const res = await request(app)
        .put('/update-data/99')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'Misty', level: 40 });
      
      expect(res.status).toBe(403);
    });

    it('should successfully update if owned', async () => {
      statsRepository.getStatById.mockResolvedValue({ username: 'Ash' });
      userRepository.findByUsername.mockResolvedValue([{ google_id: testGoogleId }]);
      statsRepository.updateStat.mockResolvedValue(true);

      const res = await request(app)
        .put('/update-data/99')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'Ash', level: 45 });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(statsRepository.updateStat).toHaveBeenCalled();
      expect(cache.invalidateUser).toHaveBeenCalled();
    });
  });

  describe('GET /get-chart-data', () => {
    it('should return empty array if no user and rate limit is enabled', async () => {
      const res = await request(app).get('/get-chart-data');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return cached chart data if available', async () => {
      cache.get.mockReturnValue([{ id: 1, level: 40 }]);
      const res = await request(app)
        .get('/get-chart-data')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 1, level: 40 }]);
      expect(statsRepository.getStatsByGoogleId).not.toHaveBeenCalled();
    });

    it('should fetch chart data and cache if not available', async () => {
      cache.get.mockReturnValue(null);
      statsRepository.getStatsByGoogleId.mockResolvedValue([{ id: 2, level: 42 }]);

      const res = await request(app)
        .get('/get-chart-data')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 2, level: 42 }]);
      expect(statsRepository.getStatsByGoogleId).toHaveBeenCalledWith(testGoogleId);
      expect(cache.set).toHaveBeenCalledWith(`getChartData_${testGoogleId}`, [{ id: 2, level: 42 }]);
    });
  });

  describe('GET /get-user-stats/:username', () => {
    it('should return 403 if profile is private and requested by another user', async () => {
      userRepository.findByUsername.mockResolvedValue([{ google_id: 'some-other-id' }]);
      const res = await request(app).get('/get-user-stats/PrivateUser');
      expect(res.status).toBe(403);
    });

    it('should return data if profile is owned by requesting user', async () => {
      userRepository.findByUsername.mockResolvedValue([{ google_id: testGoogleId }]);
      cache.get.mockReturnValue([{ level: 40 }]);
      const res = await request(app)
        .get('/get-user-stats/MyUser')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ level: 40 }]);
    });

    it('should return data if profile has no google_id (public)', async () => {
      userRepository.findByUsername.mockResolvedValue([{ google_id: null }]);
      cache.get.mockReturnValue(null);
      statsRepository.getPaginatedStatsByUsername.mockResolvedValue([{ level: 30 }]);

      const res = await request(app).get('/get-user-stats/PublicUser');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ level: 30 }]);
      expect(statsRepository.getPaginatedStatsByUsername).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });
  });
});
