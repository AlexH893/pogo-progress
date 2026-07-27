const { handleServerError, parseError, DB_ERROR_MAP } = require('./errorHandler');

describe('errorHandler utility', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('parseError', () => {
    it('should map known MySQL error codes to friendly messages', () => {
      const err = { code: 'ER_DUP_ENTRY', message: 'Duplicate entry for key PRIMARY' };
      const parsed = parseError(err);
      expect(parsed.message).toBe('A record with this information already exists.');
      expect(parsed.code).toBe('ERR_DUPLICATE_ENTRY');
    });

    it('should map ER_BAD_FIELD_ERROR to schema mismatch', () => {
      const err = { code: 'ER_BAD_FIELD_ERROR', message: "Unknown column 'foo'" };
      const parsed = parseError(err);
      expect(parsed.message).toBe('Database schema mismatch. A requested database column was not found.');
      expect(parsed.code).toBe('ERR_SCHEMA_MISMATCH');
    });

    it('should fallback to default message if error code is unmapped', () => {
      const err = new Error('Random internal failure');
      const parsed = parseError(err, 'Custom default message');
      expect(parsed.message).toBe('Custom default message');
      expect(parsed.code).toBe('ERR_INTERNAL_SERVER');
    });
  });

  describe('handleServerError', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalExpose = process.env.EXPOSE_ERROR_DETAILS;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      process.env.EXPOSE_ERROR_DETAILS = originalExpose;
    });

    it('should send formatted json error with status 500 by default', () => {
      const err = { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:3306' };
      handleServerError(mockRes, err, 'DB failed');

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Unable to connect to the database service. Please try again shortly.',
        code: 'ERR_DB_CONNECTION'
      }));
    });

    it('should include details in non-production environment', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error('Column stardust missing');
      err.code = 'ER_BAD_FIELD_ERROR';

      handleServerError(mockRes, err);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Database schema mismatch. A requested database column was not found.',
        code: 'ERR_SCHEMA_MISMATCH',
        details: 'Column stardust missing',
        dbCode: 'ER_BAD_FIELD_ERROR'
      }));
    });

    it('should omit details in production unless EXPOSE_ERROR_DETAILS is true', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.EXPOSE_ERROR_DETAILS;
      const err = new Error('Secret db details');

      handleServerError(mockRes, err, 'Database operation failed');

      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Database operation failed',
        code: 'ERR_INTERNAL_SERVER'
      });
    });
  });
});
