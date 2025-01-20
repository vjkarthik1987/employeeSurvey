const express          = require('express');
const router           = express.Router();
const Survey           = require('../models/Survey');
const Question         = require('../models/Question');
const SurveyInstance   = require('../models/SurveyInstance');
const Respondent       = require('../models/Respondent');
const Account          = require('../models/Account');
const catchAsync       = require('../utils/catchAsync');
const sendEmail        = require('../utils/sendEmail');
const Response         = require('../models/Response');

router.get('/:surveyID/:surveyInstanceID/:respondentID', catchAsync(async(req, res) => {
    const {surveyID, surveyInstanceID, respondentID} = req.params;
    const survey = await Survey.findById(surveyID);
    const surveyInstance = await SurveyInstance.findById(surveyInstanceID);
    const respondent = await Respondent.findById(respondentID);
    const questions = await Question.find({survey:survey});
    const uniqueCategories = await Question.distinct('category', { survey: surveyID });
    res.render('./takeSurvey/takeSurvey', {survey, surveyInstance, respondent, questions, uniqueCategories});
}));

router.post('/:surveyID/:surveyInstanceID/:respondentID', catchAsync(async (req, res) => {
    const { surveyID, surveyInstanceID, respondentID } = req.params;
    const { responses } = req.body; // responses is an object with question IDs as keys and choices as values

    // Verify that the survey, surveyInstance, and respondent exist
    const surveyInstance = await SurveyInstance.findById(surveyInstanceID);
    const respondent = await Respondent.findById(respondentID);

    if (!surveyInstance || !respondent) {
        req.flash('error', 'Invalid survey or respondent information.');
        return res.redirect('/');
    }

    // Loop through responses, create and save Response documents
    const responseDocs = [];
    for (const [questionId, choice] of Object.entries(responses)) {
        const response = new Response({
            question: questionId,
            choice: Number(choice),
            surveyInstance: surveyInstanceID,
            respondent: respondentID
        });
        await response.save();
        responseDocs.push(response._id); // Store response IDs to add to the respondent
    }

    // Update the Respondent document with the new responses
    respondent.responses.push(...responseDocs);
    respondent.status = false; // Set the respondent's status to false
    await respondent.save();

    // Redirect to home with success message
    req.flash('success', 'Survey responses saved successfully!');
    res.redirect('/');
}));

module.exports = router;