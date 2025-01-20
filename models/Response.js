const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/pricePelican');

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