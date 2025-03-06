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
    status: {
        type:String,
        enum: ['Created', 'In Progress', 'MailSent','Stopped'],
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    field1Analysis: String,
    field2Analysis: String,
    field3Analysis: String,
    field4Analysis: String,
    field5Analysis: String,
});

const SurveyInstance = mongoose.model('SurveyInstance', SurveyInstanceSchema);

module.exports = SurveyInstance;
