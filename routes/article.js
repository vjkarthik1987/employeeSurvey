const express          = require('express');
const router           = express.Router();
const isAdmin          = require('../middlewares/isAdmin');
const catchAsync       = require('../utils/catchAsync');
const Article          = require('../models/Article');

router.get('/', isAdmin, catchAsync(async(req, res) => {
    res.render('./admin/article/createArticle');
}));

router.post('/', isAdmin, catchAsync(async(req, res) => {
    const {heading, article, topic} = req.body;
    const link = heading
                    .substring(0, 20)
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '-')
                    .replace(/-+/g, '-');
    const newArticle = new Article({
        heading,
        article,
        topic,
        link,
        author: 'Admin',
        date: new Date(),
    })
    newArticle.save();
    req.flash('success', 'Article saved');
    res.redirect('/admin');
}));

router.get('/list', catchAsync(async(req, res) => {
    const articles = await Article.find();
    res.render('./admin/article/listArticles', {articles});
}))

module.exports = router;