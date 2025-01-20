const mongoose              = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/pricePelican');

const SurveySchema = new mongoose.Schema({
    name: String,
    description: String,
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref:'Question',
    }],
});

const Survey = mongoose.model('Survey', SurveySchema);

module.exports = Survey;