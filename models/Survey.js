const mongoose = require("../db"); // Use centralized DB connection

const SurveySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    status: { type: String, enum: ['active', 'archived', 'draft'], default: 'active' },
    category: String,
}, { timestamps: true });

const Survey = mongoose.model('Survey', SurveySchema);

module.exports = Survey;