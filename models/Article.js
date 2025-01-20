const mongoose              = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/pricePelican');

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