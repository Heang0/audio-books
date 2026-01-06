const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { upload } = require('../middleware/upload');

// Existing routes
router.get('/', articleController.getArticles);
router.get('/search', articleController.searchArticles); // ADD THIS LINE
router.get('/:id', articleController.getArticle);
router.post('/', upload, articleController.createArticle);
router.put('/:id', upload, articleController.updateArticle);
router.delete('/:id', articleController.deleteArticle);

// NEW ROUTES FOR DURATION FIXING
router.get('/debug/durations', articleController.debugDurations);
router.put('/:id/fix-duration', articleController.fixArticleDuration);
router.put('/:id/duration', articleController.updateArticleDuration);
router.get('/:id/real-duration', articleController.getArticleWithRealDuration);
router.post('/bulk-fix-durations', articleController.bulkFixDurations);

module.exports = router;