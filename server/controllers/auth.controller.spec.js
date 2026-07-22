process.env.GOOGLE_CLIENT_ID = 'test-client-id';

const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: (...args) => mockVerifyIdToken(...args)
      };
    })
  };
});

jest.mock('jsonwebtoken');
jest.mock('../middleware/auth', () => ({
  JWT_SECRET: 'test-secret'
}));

const authController = require('./auth.controller');

describe('Auth Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('googleAuth', () => {
    it('should return 400 if credential is missing', async () => {
      await authController.googleAuth(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing credential' });
    });

    it('should issue a token and return user details for a valid credential', async () => {
      mockReq.body.credential = 'valid-token';
      
      const mockPayload = {
        sub: '12345',
        email: 'test@example.com',
        name: 'Test User'
      };
      
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload
      });
      
      jwt.sign.mockReturnValue('mock-jwt-token');

      await authController.googleAuth(mockReq, mockRes);

      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: 'valid-token',
        audience: 'test-client-id'
      });

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          googleId: '12345',
          email: 'test@example.com',
          name: 'Test User'
        },
        'test-secret',
        { expiresIn: '7d' }
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        token: 'mock-jwt-token',
        user: {
          googleId: '12345',
          email: 'test@example.com',
          name: 'Test User'
        }
      });
    });

    it('should return 401 if token verification fails', async () => {
      mockReq.body.credential = 'invalid-token';
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token signature'));

      await authController.googleAuth(mockReq, mockRes);

      expect(console.error).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      
      console.error.mockRestore();
    });
  });
});
