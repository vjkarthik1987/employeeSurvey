const mongoose = require("../db"); // Use centralized DB connection


const ArticleSchema = new mongoose.Schema({
    heading: String,
    topic: String,
    link: String,
    article: String,
    author: String,
    date: Date,
    status: {
        type: Boolean,
        default: true,
    }
},{
    timestamps: true // This adds createdAt and updatedAt fields
});

const Article = mongoose.model('Article', ArticleSchema);

module.exports = Article;