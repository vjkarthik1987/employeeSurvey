const express          = require('express');
const router           = express.Router();
const catchAsync       = require('../utils/catchAsync');
const Article          = require('../models/Article');

router.get('/', catchAsync(async(req, res) => {
    const articles = await Article.find({}).sort({ date: -1 }).limit(6);
    res.render('./gen/thoughts', {articles});
}));

router.get('/all', catchAsync(async(req, res) => {
    const articles = await Article.find({});
    console.log(articles);
    res.render('./thoughts/allArticles', { articles });
}));

router.get('/articles/:articleID', catchAsync(async(req, res) => {
    const article = await Article.findById(req.params.articleID);
    res.render('./thoughts/individualArticle', {article});
}));



module.exports = router;