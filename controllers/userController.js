const User = require("../models/User");
const { updateUserInMap } = require("../middleware/auth");
const e = require("express");

let io;

exports.setIoUser = (socket) => (io = socket);

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password -__v");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { username, avatar, bio } = req.body;

    // Ensure user exists
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If updating username, check it's not already taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: "Username is already taken" });
      }
      user.username = username;
    }

    // Update user fields if provided
    if (avatar) user.avatar = avatar;
    if (bio !== undefined) user.bio = bio;

    await user.save();
    const data = {
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    };
    updateUserInMap(user._id.toString(), data); // Update user data in memory map
    res.json({ user });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const username = req.params.username;
    // find username in db without case sensitivity
    const user = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
    }).select("-password -__v");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const userData = {
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
    };
    res.json({ user: userData });
  }
  catch (error) {
    res.status(500).json({ message: "Server error "+error.message });
  }
};
