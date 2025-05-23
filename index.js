const express = require("express");
const mongoose = require("mongoose");
const socketIo = require("socket.io");
const http = require("http");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const { setIoUser } = require("./controllers/userController");
const { setIoScrapbook } = require("./controllers/scrapbookController");
const { setIoAuth } = require("./controllers/authController");

const userRoutes = require("./routes/userRoutes");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);
const JWT_SECRET = process.env.JWT_SECRET || "snapbook-secret-key";

// Initialize Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/snapbookdb")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Socket.io authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: Token required"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded._id);
    socket.userId = user._id.toString();
    socket.username = user.username;
    socket.avatar = user.avatar;
    // Join a room based on user ID
    socket.join(`user:${socket.userId}`);
    next();
  } catch (error) {
    return next(new Error("Authentication error: Invalid token"));
  }
});

// Set Socket.io instances in controllers
setIoUser(io);
setIoScrapbook(io);
setIoAuth(io);

// Socket.io event handlers
io.on("connection", (socket) => {
  // Join scrapbook room
  socket.on("join-user", (userId) => {
    socket.join(`user:${userId}`);
  });
  socket.on("join-scrapbook", (scrapbookId) => {
    socket.join(`scrapbook:${scrapbookId}`);

    // Notify other users (excluding self)
    socket.to(`scrapbook:${scrapbookId}`).emit("user-joined", {
      userId: socket.userId,
      username: socket.username,
      timestamp: new Date(),
      avatar: socket.avatar,
    });
  });

  // Leave scrapbook room
  socket.on("leave-scrapbook", (scrapbookId) => {
    socket.leave(`scrapbook:${scrapbookId}`);

    // Notify other users (excluding self)
    socket.to(`scrapbook:${scrapbookId}`).emit("user-left", {
      userId: socket.userId,
      username: socket.username,
      timestamp: new Date(),
    });
  });

  // Item operations (realtime updates)
  socket.on("item-added", ({ scrapbookId, item }) => {
    // Only emit to others in the scrapbook room, not back to sender
    socket.to(`scrapbook:${scrapbookId}`).emit("item-added", {
      ...item,
      addedBy: {
        userId: socket.userId,
        username: socket.username,
      },
    });
  });

  socket.on("item-updated", ({ scrapbookId, item }) => {
    socket.to(`scrapbook:${scrapbookId}`).emit("item-updated", {
      ...item,
      updatedBy: {
        userId: socket.userId,
        username: socket.username,
      },
    });
  });

  socket.on("item-removed", ({ scrapbookId, itemId }) => {
    socket.to(`scrapbook:${scrapbookId}`).emit("item-removed", {
      itemId,
      removedBy: {
        userId: socket.userId,
        username: socket.username,
      },
    });
  });

  // Collaborator operations
  socket.on("collaborator-added", ({ scrapbookId, collaborator }) => {
    socket.to(`scrapbook:${scrapbookId}`).emit("collaborator-added", {
      collaborator,
      addedBy: {
        userId: socket.userId,
        username: socket.username,
      },
    });
  });

  socket.on("collaborator-removed", ({ scrapbookId, collaboratorId }) => {
    socket.to(`scrapbook:${scrapbookId}`).emit("collaborator-removed", {
      collaboratorId,
      removedBy: {
        userId: socket.userId,
        username: socket.username,
      },
    });
  });

  // Title updates
  socket.on("title-updated", ({ scrapbookId, title }) => {
    socket.to(`scrapbook:${scrapbookId}`).emit("title-updated", {
      title,
      updatedBy: {
        userId: socket.userId,
        username: socket.username,
      },
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    // Get all rooms the socket was in
    const rooms = Array.from(socket.rooms).filter((room) =>
      room.startsWith("scrapbook:")
    );

    // Notify each room that user has left (excluding self)
    rooms.forEach((room) => {
      socket.to(room).emit("user-left", {
        userId: socket.userId,
        username: socket.username,
        timestamp: new Date(),
      });
    });
  });
});

// Define Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", userRoutes);
app.use("/api/scrapbooks", require("./routes/scrapbookRoutes"));
app.use("/api/file", require("./GCP/upload"));

const mainPage = fs.readFileSync(
  path.join(__dirname, "public", "index.html"),
  "utf-8"
);

const profilePage = fs.readFileSync(
  path.join(__dirname, "public", "profile.html"),
  "utf-8"
);

// Base route for API health check
app.get("/", (req, res) => {
  res.send(mainPage);
});

// Serve static files from the public directory
app.get("/public/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "public", filename);
  res.sendFile(filePath);
});

// User profile route
app.get("/:username", async (req, res, next) => {
  try {
    if (
      !req.params.username ||
      req.params.username === "" ||
      !req.params.username.includes("@")
    ) {
      return res.redirect("/");
    }
    const username = req.params.username.replace("@", "");

    if (username === "public" || username === "app" || username === "api") {
      return next();
    }

    // Check if user exists
    const user = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, "i") },
    }).select("-password -__v");
    if (!user) {
      return res.send(`
        <h1>User not found</h1>
        <p>Sorry, we couldn't find a user with the username "@${username}".</p>
        `);
    }

    // Send the profile page
    res.send(profilePage);
  } catch (error) {
    console.error("Error in profile route:", error);
    res.status(500).send("Server error");
  }
});

// Start server (using http server for Socket.io)
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Make io available to routes
app.set("io", io);
