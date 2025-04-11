const mongoose = require('mongoose');

// Schema for scrapbook items (text, images)
const scrapbookItemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'text'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Schema for timeline entries
const timelineEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['created', 'updated', 'added', 'removed'],
    required: true
  },
  itemType: {
    type: String,
    enum: ['scrapbook', 'image', 'text', 'title', 'collaborator'],
    required: true
  },
  details: {
    itemId: mongoose.Schema.Types.ObjectId,
    content: String,
    collaborator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Main scrapbook schema
const scrapbookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  items: [scrapbookItemSchema],
  timeline: [timelineEntrySchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt timestamp before saving
scrapbookSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Scrapbook', scrapbookSchema);
