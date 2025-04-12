const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const User = require('../models/User'); 
const auth = require('../middleware/auth'); 

// @route   POST /api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', authController.register);

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', authController.login);


// Add this route to your userRoutes.js file
router.get('/search',auth, async (req, res) => {
  try {
    const { query } = req.query;
    // Return empty array if query is too short
    if (!query || query.length < 2) {
      return res.json([]);
    }
    
    // Search by username or email (excluding the current user)
    const users = await User.find({
      $and: [
        { _id: { $ne: req.user.id } }, // Exclude current user
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    }).select('username email avatar').limit(10);
    
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
