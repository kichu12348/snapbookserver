const express = require('express');
const router = express.Router();
const scrapbookController = require('../controllers/scrapbookController');
const auth = require('../middleware/auth');

// Get all scrapbooks
router.get('/', auth, scrapbookController.getScrapbooks);

// Create a new scrapbook
router.post('/', auth, scrapbookController.createScrapbook);

// Get a specific scrapbook
router.get('/:id', auth, scrapbookController.getScrapbook);

// Update scrapbook title
router.put('/:id/title', auth, scrapbookController.updateTitle);

// Add item to scrapbook
router.post('/:id/items', auth, scrapbookController.addItem);

// Remove item from scrapbook
router.delete('/:scrapbookId/items/:itemId', auth, scrapbookController.removeItem);

// Get timeline for a scrapbook
router.get('/:id/timeline', auth, scrapbookController.getTimeline);

// Add collaborator to scrapbook
router.post('/:id/collaborators', auth, scrapbookController.addCollaborator);

// Remove collaborator from scrapbook
router.delete('/:id/collaborators/:collaboratorId', auth, scrapbookController.removeCollaborator);

module.exports = router;
