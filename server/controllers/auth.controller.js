const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
let client;
if (CLIENT_ID) {
  client = new OAuth2Client(CLIENT_ID);
}

exports.googleAuth = async (req, res) => {
  try {
    if (!client) {
      return res.status(500).json({ error: 'Server not configured for Google Auth' });
    }
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });
    
    const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    // Issue our own JWT (default 30 days expiration, or set JWT_EXPIRES_IN env var)
    const token = jwt.sign({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name
    }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });
    
    res.json({ token, user: { googleId: payload.sub, email: payload.email, name: payload.name } });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Invalid token' });
  }
};
