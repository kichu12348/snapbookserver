const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { auth } = require("../middleware/auth");
const User = require("../models/User");

// @route   GET /api/users/me
// @desc    Get current user's profile
// @access  Private
router.get("/me", auth, userController.getProfile);

// @route   GET /api/users/profile/:username
router.get("/profile/:username",userController.getUserProfile);

// @route   PUT /api/users/me
// @desc    Update user profile
// @access  Private
router.put("/me", auth, userController.updateProfile);

// Add this route to your userRoutes.js file
router.get("/search", auth, async (req, res) => {
  try {
    const { query } = req.query;

    // Return empty array if query is too short
    if (!query || query.length < 2) {
      return res.json([]);
    }

    // Search by username or email (excluding the current user)
    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } }, // Exclude current user
        {
          $or: [
            { username: { $regex: query, $options: "i" } },
            { email: { $regex: query, $options: "i" } },
          ],
        },
      ],
    })
      .select("username email avatar")
      .limit(10);

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

module.exports = router;
