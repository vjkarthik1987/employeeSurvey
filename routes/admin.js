const express          = require('express');
const router           = express.Router();
const isAdmin          = require('../middlewares/isAdmin');
const catchAsync       = require('../utils/catchAsync');

router.get('/', isAdmin, catchAsync(async(req, res) => {
    res.render('./admin/adminPanel');
}));

module.exports = router;