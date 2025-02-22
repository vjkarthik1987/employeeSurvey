const mongoose = require("../db"); // Use centralized DB connection


const RespondentSchema = new mongoose.Schema({
    respondentEmail: String,
    respondentName: String,
    respondentTeam: String,
    surveyInstance: {
        type: mongoose.Schema.Types.ObjectId,
        ref:'SurveyInstance',
    },
    field1: String,
    field2: String,
    field3: String,
    field4: String,
    field5: String,
    responses:[{
        type: mongoose.Schema.Types.ObjectId,
        ref:'Response',
    }],
    status:Boolean,
    progress:{
        type: String,
        enum: ['new','saved','completed']
    },
    strengthsFeedback: String,
    improvementsFeedback: String,
    continueFeedback: String,
    detailedFeedback1: String,
    detailedFeedback2: String 
});

const Respondent = mongoose.model('Respondent', RespondentSchema);

module.exports = Respondent;