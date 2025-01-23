const mongoose = require("../db"); // Use centralized DB connection


const RespondentSchema = new mongoose.Schema({
    respondentEmail: String,
    respondentName: String,
    respondentTeam: String,
    surveyInstance: {
        type: mongoose.Schema.Types.ObjectId,
        ref:'SurveyInstance',
    },
    responses:[{
        type: mongoose.Schema.Types.ObjectId,
        ref:'Response',
    }],
    status:Boolean,
    progress:{
        type: String,
        enum: ['new','saved','completed']
    }
});

const Respondent = mongoose.model('Respondent', RespondentSchema);

module.exports = Respondent;