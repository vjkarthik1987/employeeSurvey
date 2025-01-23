const mongoose = require("../db"); // Use centralized DB connection

const ResponseSchema = new mongoose.Schema({
    question: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
    },
    choice: Number,
    surveyInstance: {
        type: mongoose.Schema.Types.ObjectId,
        ref:'SurveyInstance',
    },
    respondent: {
        type: mongoose.Schema.Types.ObjectId,
        ref:'Respondent',
    }
});

const Response = mongoose.model('Response', ResponseSchema);

module.exports = Response;