const express          = require('express');
const router           = express.Router();
const multer           = require("multer"); // Import multer for handling multipart data
const upload           = multer();
const Survey           = require('../models/Survey');
const Question         = require('../models/Question');
const SurveyInstance   = require('../models/SurveyInstance');
const Respondent       = require('../models/Respondent');
const Account          = require('../models/Account');
const catchAsync       = require('../utils/catchAsync');
const sendEmail        = require('../utils/sendEmail');
const Response         = require('../models/Response');

router.get('/:surveyID/:surveyInstanceID/:respondentID', catchAsync(async(req, res) => {
    const { surveyID, surveyInstanceID, respondentID } = req.params;

    // Fetch the survey, survey instance, and respondent
    const survey = await Survey.findById(surveyID);
    const surveyInstance = await SurveyInstance.findById(surveyInstanceID);
    const respondent = await Respondent.findById(respondentID);
    const questions = await Question.find({ survey: surveyID });
    const uniqueCategories = await Question.distinct('category', { survey: surveyID });

    // Calculate total number of questions
    const totalQuestions = questions.length;

    // Fetch saved responses for the respondent
    const savedResponses = await Response.find({
        respondent: respondentID,
        surveyInstance: surveyInstanceID
    }).lean();

    // Convert responses into a key-value pair format { questionId: choice }
    let responseMap = {};
    savedResponses.forEach(response => {
        responseMap[response.question] = response.choice;
    });

    res.render('./takeSurvey/takeSurvey', {
        survey,
        surveyInstance,
        respondent,
        questions,
        uniqueCategories,
        totalQuestions,  // ✅ Ensure totalQuestions is explicitly passed
        responseMap
    });
}));

// Submit survey responses and mark respondent as "completed"
router.post('/:surveyID/:surveyInstanceID/:respondentID', catchAsync(async (req, res) => {
    const { surveyID, surveyInstanceID, respondentID } = req.params;
    const { responses, strengthsFeedback, improvementsFeedback } = req.body;  // Responses contain question IDs as keys and choices as values

    try {
        // Verify that the survey instance and respondent exist
        const surveyInstance = await SurveyInstance.findById(surveyInstanceID);
        const respondent = await Respondent.findById(respondentID);

        if (!surveyInstance || !respondent) {
            req.flash('error', 'Invalid survey or respondent information.');
            return res.redirect('/');
        }

        // Save responses
        const responseDocs = [];
        for (const [questionId, choice] of Object.entries(responses)) {
            const response = new Response({
                question: questionId,
                choice: Number(choice),
                surveyInstance: surveyInstanceID,
                respondent: respondentID
            });
            await response.save();
            responseDocs.push(response._id); // Store response IDs
        }

        // Update respondent with saved responses and completion status
        respondent.responses.push(...responseDocs);
        respondent.status = false; // Set the respondent's status to false
        await Respondent.findByIdAndUpdate(respondentID, {
            strengthsFeedback,
            improvementsFeedback,
            progress: "completed"
        });

        // Redirect to home with success message
        req.flash('success', 'Survey responses saved successfully!');
        res.redirect('/');
    } catch (error) {
        console.error("Error submitting survey:", error);
        req.flash('error', 'Failed to submit survey.');
        res.redirect('/');
    }
}));


// Save progress without completing the survey
router.post("/:surveyID/:surveyInstanceID/:respondentID/save", catchAsync(async (req, res) => {
    console.log("🔵 Save Progress Route Hit: /:surveyID/:surveyInstanceID/:respondentID/save");
    console.log("Received Request Body:", req.body);

    const { surveyID, surveyInstanceID, respondentID } = req.params;
    const { responses, strengthsFeedback, improvementsFeedback } = req.body; // Extract text-based responses

    try {
        // Validate that responses exist
        if (!responses || Object.keys(responses).length === 0) {
            return res.status(400).json({ success: false, message: "No responses received." });
        }
        
        // Find the respondent
        const respondent = await Respondent.findById(respondentID);
        if (!respondent) {
            return res.status(404).json({ success: false, message: "Respondent not found." });
        }

        // Save responses
        for (const [questionId, choice] of Object.entries(responses)) {
            let response = await Response.findOne({
                question: questionId,
                respondent: respondentID,
                surveyInstance: surveyInstanceID
            });

            if (response) {
                response.choice = Number(choice); // Update existing response
            } else {
                response = new Response({
                    question: questionId,
                    choice: Number(choice),
                    surveyInstance: surveyInstanceID,
                    respondent: respondentID
                });
            }
            await response.save();
        }

        // Save text-based responses
        await Respondent.findByIdAndUpdate(respondentID, {
            strengthsFeedback,
            improvementsFeedback,
            progress: "saved"
        });

        res.json({ success: true, message: "Progress saved successfully!" });
    } catch (error) {
        console.error("Error saving progress:", error);
        res.status(500).json({ success: false, message: "Failed to save progress." });
    }
}));

module.exports = router;