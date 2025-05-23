const Scrapbook = require("../models/Scrapbook");
const User = require("../models/User");
const { deleteFile } = require("../GCP/uploadGcp");

let io;

exports.setIoScrapbook = (socket) => (io = socket);

// Get all scrapbooks for the current user (including collaborations)
exports.getScrapbooks = async (req, res) => {
  try {
    const scrapbooks = await Scrapbook.find({
      $or: [{ owner: req.user._id }, { collaborators: req.user._id }],
    })
      .populate("owner", "username avatar")
      .populate("collaborators", "username avatar")
      .sort({ updatedAt: -1 });

    res.json(scrapbooks);
  } catch (error) {
    console.error("Get scrapbooks error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const refactoredScrapbooks = (scrapbooks) => {
  return scrapbooks.map((scrapbook) => {
    const { _id, title, collaborators, items, createdAt } = scrapbook;
    const coverImage =
      items.find((item) => item.type === "image")?.content || null; // Get the first image item as cover
    return {
      _id,
      title,
      coverImage,
      createdAt,
      collaboratorsLength: collaborators.length || 0,
      itemsLength: items.length || 0,
    };
  });
};
// Get all scrapbooks for a specific user (both owned and collaborations)
exports.getUserScrapbooks = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Get user's own scrapbooks
    const ownedScrapbooks = await Scrapbook.find({ owner: userId })
      .populate("owner", "username avatar")
      .populate("collaborators", "username avatar")
      .sort({ updatedAt: -1 });

    // Get scrapbooks where user is a collaborator
    const collaboratedScrapbooks = await Scrapbook.find({
      collaborators: userId,
      owner: { $ne: userId }, // Exclude scrapbooks where user is also the owner
    })
      .populate("owner", "username avatar")
      .populate("collaborators", "username avatar")
      .sort({ updatedAt: -1 });

    // Refactor scrapbooks to include cover image and counts
    const refactoredOwnedScrapbooks = refactoredScrapbooks(ownedScrapbooks);
    const refactoredCollaboratedScrapbooks = refactoredScrapbooks(collaboratedScrapbooks);

    res.json({
      success: true,
      ownedScrapbooks: refactoredOwnedScrapbooks,
      collaboratedScrapbooks: refactoredCollaboratedScrapbooks,
      counts:{
        owned: refactoredOwnedScrapbooks.length,
        collaborated: refactoredCollaboratedScrapbooks.length,
      }
    });
  } catch (error) {
    console.error("Get user scrapbooks error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get a scrapbook by ID
exports.getScrapbook = async (req, res) => {
  try {
    const scrapbook = await Scrapbook.findById(req.params.id)
      .populate("owner", "username avatar")
      .populate("collaborators", "username avatar");

    if (!scrapbook) {
      return res.status(404).json({ message: "Scrapbook not found" });
    }

    // Check if user is owner or collaborator
    const isOwner = scrapbook.owner._id.toString() === req.user._id;
    const isCollaborator = scrapbook.collaborators.some(
      (collab) => collab._id.toString() === req.user._id
    );

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(scrapbook);
  } catch (error) {
    console.error("Get scrapbook error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create a new scrapbook
exports.createScrapbook = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const newScrapbook = new Scrapbook({
      title,
      owner: req.user._id,
      collaborators: [],
      items: [],
      timeline: [
        {
          user: req.user._id,
          action: "created",
          itemType: "scrapbook",
          timestamp: new Date(),
        },
      ],
    });

    await newScrapbook.save();

    const populatedScrapbook = await Scrapbook.findById(
      newScrapbook._id
    ).populate("owner", "username avatar");

    res.status(201).json(populatedScrapbook);
  } catch (error) {
    console.error("Create scrapbook error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update a scrapbook title
exports.updateTitle = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const scrapbook = await Scrapbook.findById(req.params.id);

    if (!scrapbook) {
      return res.status(404).json({ message: "Scrapbook not found" });
    }

    // Check if user is owner or collaborator
    const isOwner = scrapbook.owner.toString() === req.user._id;
    const isCollaborator = scrapbook.collaborators.some(
      (collab) => collab.toString() === req.user._id
    );

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: "Access denied" });
    }

    scrapbook.title = title;

    // Add to timeline
    scrapbook.timeline.push({
      user: req.user._id,
      action: "updated",
      itemType: "title",
      details: { content: title },
      timestamp: new Date(),
    });

    await scrapbook.save();

    const timeline = {
      ...scrapbook.timeline[scrapbook.timeline.length - 1].toObject(),
      user: req.user,
    };

    // Notify clients via Socket.io, but exclude the sender
    const io = req.app.get("io");
    if (io) {
      io.to(`scrapbook:${scrapbook._id}`)
        .except(`user:${req.user._id}`)
        .emit("title-updated", {
          title,
          updatedBy: {
            userId: req.user._id,
          },
          timeline, // Send the latest timeline entry
        });
    }

    res.json({
      success: true,
      title,
      timeline,
    });
  } catch (error) {
    console.error("Update title error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add an item to the scrapbook
exports.addItem = async (req, res) => {
  try {
    const { type, content, position } = req.body;

    if (!type || !content) {
      return res.status(400).json({ message: "Type and content are required" });
    }

    const scrapbook = await Scrapbook.findById(req.params.id);

    if (!scrapbook) {
      return res.status(404).json({ message: "Scrapbook not found" });
    }
    // Check if user is owner or collaborator
    const isOwner = scrapbook.owner.toString() === req.user._id;
    const isCollaborator = scrapbook.collaborators.some(
      (collab) => collab.toString() === req.user._id
    );

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Create new item
    const newItem = {
      type,
      content,
      position: position || { x: 0, y: 0 },
      createdBy: req.user._id,
      createdAt: new Date(),
    };

    scrapbook.items.push(newItem);

    // Add to timeline
    scrapbook.timeline.push({
      user: req.user._id,
      action: "added",
      itemType: type,
      details: {
        itemId: newItem._id,
        content: content,
      },
      timestamp: new Date(),
    });

    await scrapbook.save();

    const timeline = {
      ...scrapbook.timeline[scrapbook.timeline.length - 1].toObject(),
      user: req.user,
    };

    // Get the newly created item (with ID generated by MongoDB)
    const createdItem = scrapbook.items[scrapbook.items.length - 1];

    // Notify clients via Socket.io, but exclude the sender
    const io = req.app.get("io");
    if (io) {
      // Send to all users in the scrapbook room EXCEPT the user who performed the action
      io.to(`scrapbook:${scrapbook._id}`)
        .except(`user:${req.user._id}`)
        .emit("item-added", {
          ...createdItem.toObject(),
          addedBy: {
            userId: req.user._id,
          },
          timeline, // Send the latest timeline entry
        });
    }

    res.status(201).json({
      success: true,
      newItem: createdItem,
      timeline, // Send the latest timeline entry
    });
  } catch (error) {
    console.error("Add item error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove an item from the scrapbook
exports.removeItem = async (req, res) => {
  try {
    const scrapbook = await Scrapbook.findById(req.params.scrapbookId);

    if (!scrapbook) {
      return res.status(404).json({ message: "Scrapbook not found" });
    }

    // Check if user is owner or collaborator
    const isOwner = scrapbook.owner.toString() === req.user._id;
    const isCollaborator = scrapbook.collaborators.some(
      (collab) => collab.toString() === req.user._id
    );

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Find the item
    const itemIndex = scrapbook.items.findIndex(
      (item) => item._id.toString() === req.params.itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Store item type for timeline before removing
    const removedItem = scrapbook.items[itemIndex];

    if (removedItem.type === "image") {
      // Delete the image from GCP if it's an image item
      await deleteFile(removedItem.content);

      // const imageTimeLineIndex = scrapbook.timeline.findIndex(
      //   (item) =>
      //     item.details.itemId.toString() === removedItem._id.toString() &&
      //     item.action === "added" &&
      //     item.itemType === "image"
      // );
      // if (imageTimeLineIndex !== -1) {
      //   scrapbook.timeline[imageTimeLineIndex].details.content = null; // Set content to null in the timeline
      // }
    }

    // Remove the item
    scrapbook.items.splice(itemIndex, 1);

    // Add to timeline
    scrapbook.timeline.push({
      user: req.user._id,
      action: "removed",
      itemType: removedItem.type,
      details: {
        itemId: removedItem._id,
      },
      timestamp: new Date(),
    });

    await scrapbook.save();

    const timeline = {
      ...scrapbook.timeline[scrapbook.timeline.length - 1].toObject(),
      user: req.user,
    };

    // Notify clients via Socket.io, but exclude the sender
    const io = req.app.get("io");
    if (io) {
      io.to(`scrapbook:${scrapbook._id}`)
        .except(`user:${req.user._id}`)
        .emit("item-removed", {
          itemId: req.params.itemId,
          removedBy: {
            userId: req.user._id,
          },
          timeline, // Send the latest timeline entry
        });
    }

    res.json({
      success: true,
      timeline, // Send the latest timeline entry
    });
  } catch (error) {
    console.error("Remove item error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add a collaborator to the scrapbook
exports.addCollaborator = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    // Find the user to add as collaborator
    const collaborator = await User.findOne({ username });

    if (!collaborator) {
      return res.status(404).json({ message: "User not found" });
    }

    const scrapbook = await Scrapbook.findById(req.params.id);

    if (!scrapbook) {
      return res.status(404).json({ message: "Scrapbook not found" });
    }

    // Only the owner can add collaborators
    if (scrapbook.owner.toString() !== req.user._id) {
      return res
        .status(403)
        .json({ message: "Only the owner can add collaborators" });
    }

    // Check if user is already a collaborator
    if (scrapbook.collaborators.includes(collaborator._id)) {
      return res
        .status(400)
        .json({ message: "User is already a collaborator" });
    }

    // Check if user is the owner (can't be both owner and collaborator)
    if (collaborator._id.toString() === scrapbook.owner.toString()) {
      return res
        .status(400)
        .json({ message: "Owner cannot be added as a collaborator" });
    }

    // Add collaborator
    scrapbook.collaborators.push(collaborator._id);

    // Add to timeline
    scrapbook.timeline.push({
      user: req.user._id,
      action: "added",
      itemType: "collaborator",
      details: {
        collaborator: collaborator._id,
      },
      timestamp: new Date(),
    });

    await scrapbook.populate(
      "timeline.details.collaborator",
      "username avatar"
    );

    await scrapbook.save();

    const timeline = {
      ...scrapbook.timeline[scrapbook.timeline.length - 1].toObject(),
      user: req.user,
    };
    // Get populated scrapbook
    const populatedScrapbook = await Scrapbook.findById(scrapbook._id)
      .populate("owner", "username avatar")
      .populate("collaborators", "username avatar");

    // Find the newly added collaborator data
    const addedCollaborator = populatedScrapbook.collaborators.find(
      (c) => c._id.toString() === collaborator._id.toString()
    );

    // Notify clients via Socket.io, but exclude the sender
    const io = req.app.get("io");
    if (io) {
      io.to(`scrapbook:${scrapbook._id}`)
        .except(`user:${req.user._id}`)
        .emit("collaborator-added", {
          collaborator: {
            _id: collaborator._id,
            username: collaborator.username,
            avatar: collaborator.avatar,
          },
          addedBy: {
            userId: req.user._id,
          },
          timeline, // Send the latest timeline entry
        });
    }

    res.json({
      success: true,
      collaborator: addedCollaborator,
      timeline, // Send the latest timeline entry
    });
  } catch (error) {
    console.error("Add collaborator error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove a collaborator from the scrapbook
exports.removeCollaborator = async (req, res) => {
  try {
    const scrapbook = await Scrapbook.findById(req.params.id);

    if (!scrapbook) {
      return res.status(404).json({ message: "Scrapbook not found" });
    }

    // Only the owner can remove collaborators
    if (scrapbook.owner.toString() !== req.user._id) {
      return res
        .status(403)
        .json({ message: "Only the owner can remove collaborators" });
    }

    const collaboratorId = req.params.collaboratorId;

    // Check if user is a collaborator
    const collaboratorIndex = scrapbook.collaborators.findIndex(
      (collab) => collab.toString() === collaboratorId
    );

    if (collaboratorIndex === -1) {
      return res.status(404).json({ message: "Collaborator not found" });
    }

    // Remove collaborator
    scrapbook.collaborators.splice(collaboratorIndex, 1);

    // Add to timeline
    scrapbook.timeline.push({
      user: req.user._id,
      action: "removed",
      itemType: "collaborator",
      details: {
        collaborator: collaboratorId,
      },
      timestamp: new Date(),
    });

    await scrapbook.populate(
      "timeline.details.collaborator",
      "username avatar"
    );

    await scrapbook.save();

    const timeline = {
      ...scrapbook.timeline[scrapbook.timeline.length - 1].toObject(),
      user: req.user,
    };

    // Notify clients via Socket.io, but exclude the sender
    const io = req.app.get("io");
    if (io) {
      io.to(`scrapbook:${scrapbook._id}`)
        .except(`user:${req.user._id}`)
        .emit("collaborator-removed", {
          collaboratorId,
          removedBy: {
            userId: req.user._id,
          },
          timeline, // Send the latest timeline entry
        });
    }

    res.json({
      success: true,
      message: "Collaborator removed successfully",
      timeline, // Send the latest timeline entry
    });
  } catch (error) {
    console.error("Remove collaborator error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get timeline for a scrapbook
exports.getTimeline = async (req, res) => {
  try {
    const scrapbook = await Scrapbook.findById(req.params.id)
      .populate("timeline.user", "username avatar")
      .populate("timeline.details.collaborator", "username avatar");

    if (!scrapbook) {
      return res.status(404).json({ message: "Scrapbook not found" });
    }

    // Check if user is owner or collaborator
    const isOwner = scrapbook.owner.toString() === req.user._id;
    const isCollaborator = scrapbook.collaborators.some(
      (collab) => collab.toString() === req.user._id
    );

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Sort timeline by timestamp (latest first)
    const sortedTimeline = [...scrapbook.timeline].sort(
      (a, b) => b.timestamp - a.timestamp
    );

    res.json(sortedTimeline);
  } catch (error) {
    console.error("Get timeline error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteScrapbook = async (req, res) => {
  try {
    const scrapbook = await Scrapbook.findById(req.params.id);
    const io = req.app.get("io");
    if (!scrapbook) {
      return res.status(404).json({ message: "Scrapbook not found" });
    }

    // Only the owner can delete the scrapbook
    if (scrapbook.owner.toString() !== req.user._id) {
      // Check if user is collaborator
      const isCollaborator = scrapbook.collaborators.some(
        (collab) => collab.toString() === req.user._id.toString()
      );
      if (isCollaborator) {
        scrapbook.collaborators = scrapbook.collaborators.filter(
          (collab) => collab.toString() !== req.user._id.toString()
        );
        // Add to timeline
        scrapbook.timeline.push({
          user: req.user._id,
          action: "removed",
          itemType: "collaborator",
          details: {
            collaborator: req.user._id,
          },
          timestamp: new Date(),
        });
        await scrapbook.save();
        const timeline = {
          ...scrapbook.timeline[scrapbook.timeline.length - 1].toObject(),
          user: req.user,
        };
        // Notify clients via Socket.io, but exclude the sender
        if (io) {
          // io.to(`scrapbook:${scrapbook._id}`)
          //   .except(`user:${req.user._id}`)
          //   .emit("collaborator-removed", {
          //     collaboratorId: req.user._id,
          //     removedBy: {
          //       userId: req.user._id,
          //     },
          //     timeline, // Send the latest timeline entry
          //   });
          scrapbook.collaborators.forEach((collab) => {
            io.to(`user:${collab.toString()}`)
              .except(`user:${req.user._id}`)
              .emit("collaborator-removed", {
                collaboratorId: req.user._id,
                removedBy: {
                  userId: req.user._id,
                },
                timeline, // Send the latest timeline entry
              });
          });
          io.to(`user:${scrapbook.owner.toString()}`).emit(
            "collaborator-removed",
            {
              collaboratorId: req.user._id,
              removedBy: {
                userId: req.user._id,
              },
              timeline, // Send the latest timeline entry
            }
          );
        }
        return res.status(200).json({
          success: true,
          message: "You have been removed from the scrapbook",
          scrapbookId: req.params.id,
          isOwner: false,
        });
      }
      return res.status(403).json({ message: "Access denied" });
    }

    // Delete images from GCP
    for (const item of scrapbook.items) {
      if (item.type === "image") {
        await deleteFile(item.content);
      }
    }

    await Scrapbook.findByIdAndDelete(req.params.id);

    // Notify clients via Socket.io, but exclude the sender

    if (io) {
      scrapbook.collaborators.forEach((collab) => {
        io.to(`user:${collab.toString()}`)
          .except(`user:${req.user._id}`)
          .emit("scrapbook-deleted", {
            scrapbookId: req.params.id,
            deletedBy: {
              userId: req.user._id,
            },
          });
      });
    }

    res.json({
      success: true,
      isOwner: true,
      message: "Scrapbook deleted successfully",
      scrapbookId: req.params.id,
    });
  } catch (error) {
    console.log("Delete scrapbook error:", error.message);
    res.status(500).json({ message: "Server error: " + error.message });
  }
};
