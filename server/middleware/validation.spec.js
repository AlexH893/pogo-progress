const { validateStats, validatePreferences } = require('./validation');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('validateStats', () => {
    it('should call next() if valid stats are provided', () => {
      req.body = {
        username: 'AshKetchum_123',
        level: 40,
        distanceWalked: 150.5,
        caught: 5000,
        stopVisited: 2500,
        totalXp: 20000000,
        entryName: 'My Entry!',
        createdAt: new Date().toISOString()
      };

      validateStats(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should strip unknown fields and call next()', () => {
      req.body = {
        username: 'Misty',
        unknownField: 'this should be removed'
      };

      validateStats(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body).not.toHaveProperty('unknownField');
    });

    it('should return 400 if username is missing', () => {
      req.body = {
        level: 40
      };

      validateStats(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('\"username\" is required') })
      );
    });

    it('should return 400 if username contains invalid characters', () => {
      req.body = {
        username: 'Invalid-Name@'
      };

      validateStats(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('\"username\" must only contain alphanumeric characters and underscores') })
      );
    });

    it('should return 400 if level is out of bounds', () => {
      req.body = {
        username: 'Brock',
        level: 81
      };

      validateStats(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('\"level\" must be less than or equal to 80') })
      );
    });
  });

  describe('validatePreferences', () => {
    it('should call next() if valid preferences are provided', () => {
      req.body = {
        defaultUnit: 'km',
        showFunFacts: true,
        displayTutorial: false
      };

      validatePreferences(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 if defaultUnit is invalid', () => {
      req.body = {
        defaultUnit: 'meters'
      };

      validatePreferences(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('\"defaultUnit\" must be one of [km, mi, null, ]') })
      );
    });
  });
});
