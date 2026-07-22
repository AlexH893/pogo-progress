const request = require('supertest');
const app = require('../app');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// Mock repositories
jest.mock('../db', () => ({
  query: jest.fn(),
  execute: jest.fn(),
  getConnection: jest.fn()
}));
jest.mock('../repositories/user.repository');
jest.mock('../repositories/stats.repository');

const userRepository = require('../repositories/user.repository');
const statsRepository = require('../repositories/stats.repository');

describe('User Controller', () => {
  let token;
  const testGoogleId = 'test-google-id';

  beforeAll(() => {
    token = jwt.sign({ googleId: testGoogleId }, JWT_SECRET);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /user-preferences', () => {
    it('should return 401 if unauthorized', async () => {
      const res = await request(app).get('/user-preferences');
      expect(res.status).toBe(401);
    });

    it('should return user preferences if authorized', async () => {
      userRepository.getPreferences.mockResolvedValue([{ default_unit: 'mi', show_fun_facts: 1 }]);
      
      const res = await request(app)
        .get('/user-preferences')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ default_unit: 'mi', show_fun_facts: 1 }]);
      expect(userRepository.getPreferences).toHaveBeenCalledWith(testGoogleId);
    });
  });

  describe('PUT /user-preferences/:username', () => {
    it('should return 403 if user does not own the trainer', async () => {
      userRepository.findByUsername.mockResolvedValue([]); // not found or unowned

      const res = await request(app)
        .put('/user-preferences/Ash')
        .set('Authorization', `Bearer ${token}`)
        .send({ defaultUnit: 'mi' });
      
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Not authorized/);
    });

    it('should update preferences if authorized', async () => {
      userRepository.findByUsername.mockResolvedValue([{ google_id: testGoogleId }]);
      userRepository.updatePreferences.mockResolvedValue(true);

      const res = await request(app)
        .put('/user-preferences/Ash')
        .set('Authorization', `Bearer ${token}`)
        .send({ defaultUnit: 'km', showFunFacts: false });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(userRepository.updatePreferences).toHaveBeenCalledWith('Ash', 'km', false, true); // displayTutorial defaults to true if not explicitly false/undefined based on logic, wait the logic is `displayTutorial !== false`, so undefined !== false is true
    });
  });

  describe('GET /export-data', () => {
    it('should return empty array if no linked trainers', async () => {
      userRepository.findByGoogleId.mockResolvedValue([]);
      
      const res = await request(app)
        .get('/export-data')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return all stats for linked trainers', async () => {
      userRepository.findByGoogleId.mockResolvedValue([{ username: 'Ash' }]);
      statsRepository.getStatsByUsernames.mockResolvedValue([{ level: 40 }]);

      const res = await request(app)
        .get('/export-data')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ level: 40 }]);
      expect(statsRepository.getStatsByUsernames).toHaveBeenCalledWith(['Ash']);
    });
  });

  describe('DELETE /delete-account', () => {
    it('should soft delete user and stats', async () => {
      userRepository.findByGoogleId.mockResolvedValue([{ username: 'Ash' }, { username: 'Brock' }]);
      statsRepository.softDeleteStatsByUsernames.mockResolvedValue(true);
      userRepository.softDeleteUserByGoogleId.mockResolvedValue(true);

      const res = await request(app)
        .delete('/delete-account')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(statsRepository.softDeleteStatsByUsernames).toHaveBeenCalledWith(['Ash', 'Brock']);
      expect(userRepository.softDeleteUserByGoogleId).toHaveBeenCalledWith(testGoogleId);
    });
  });
});
