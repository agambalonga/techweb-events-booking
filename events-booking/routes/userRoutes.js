const Router = require('express').Router;
const router = new Router();
const { checkAuth } = require('../authMiddleware/authMiddleware');
const userController = require('../controller/userController');


router.get('/user/:id', checkAuth, userController.get_profile);

router.put('/user/:id', checkAuth, userController.update_profile);

module.exports = router;
