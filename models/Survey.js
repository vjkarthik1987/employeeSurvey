const mongoose              = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/pricePelican');

const SurveySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
    }],
    status: { type: String, enum: ['active', 'archived', 'draft'], default: 'active' },
}, { timestamps: true });

const Survey = mongoose.model('Survey', SurveySchema);

module.exports = Survey;