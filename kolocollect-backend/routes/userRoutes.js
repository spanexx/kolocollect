const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Routes for users
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.get('/profile/:id', (req, res, next) => {
    console.log("Incoming userId in route:", req.params.id);
    next();
  }, userController.getUserProfile);
  router.get('/:id/communities', userController.getUserCommunities);
router.put('/profile/:id', userController.updateUserProfile);

// Routes for joining and leaving communities
router.put('/:id/communities/join', userController.joinCommunity);
router.put('/:id/communities/leave', userController.leaveCommunity);

module.exports = router;
