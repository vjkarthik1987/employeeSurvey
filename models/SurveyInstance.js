const mongoose = require("../db"); // Use centralized DB connection


const SurveyInstanceSchema = new mongoose.Schema({
    survey: {
        type: mongoose.Schema.Types.ObjectId,
        ref:'Survey',
    },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref:'Account',
    },
    name: String,
    respondents:[{
        type: mongoose.Schema.Types.ObjectId,
        ref:'Respondent',
    }],
    status: String,
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    }
});

const SurveyInstance = mongoose.model('SurveyInstance', SurveyInstanceSchema);

module.exports = SurveyInstance;
