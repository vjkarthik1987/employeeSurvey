const mongoose = require("../db"); // Use centralized DB connection


const QuestionSchema = new mongoose.Schema({
    question: String,
    category: String,
    subCategory: String,
    shortDescription: String,
    detailedDescription: String,
    option1: String,
    option2: String,
    option3: String,
    option4: String,
    option5: String,
    actionPlans: [String],
    survey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Survey',
    },
});

const Question = mongoose.model('Question', QuestionSchema);

module.exports = Question;
