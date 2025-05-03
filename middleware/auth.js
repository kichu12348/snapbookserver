const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'snapbook-secret-key';
const User = require('../models/User');

const userMap = new Map(); // Store user data in memory

// Middleware to verify JWT token
exports.auth = async function(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if no token
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  
  // Verify token
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Check if user exists in memory map
    let userFromMap = userMap.get(decoded._id);
    if (!userFromMap) {
      const user = await User.findById(decoded._id);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      // Store user data in memory map for future requests
      const data ={
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatar: user.avatar
      }
      userMap.set(decoded._id, data);
      userFromMap = data;
    }
    req.user = userFromMap; // Attach user data to request object
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid: ' + error.message });
  }
};


exports.updateUserInMap = (userId,data) => {
  userMap.set(userId, data); 
}