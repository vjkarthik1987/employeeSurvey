const mongoose              = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/pricePelican');

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
});

const SurveyInstance = mongoose.model('SurveyInstance', SurveyInstanceSchema);

module.exports = SurveyInstance;