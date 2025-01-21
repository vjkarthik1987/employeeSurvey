const express          = require('express');
const multer           = require('multer');
const csvParser        = require('csv-parser');
const fs               = require('fs');
const upload           = multer({ dest: 'uploads/' });
const router           = express.Router();
const mongoose         = require('mongoose');
const isLoggedIn       = require('../middlewares/isLoggedIn')
const Survey           = require('../models/Survey');
const Question         = require('../models/Question');
const SurveyInstance   = require('../models/SurveyInstance');
const Respondent       = require('../models/Respondent');
const Response         = require('../models/Response');
const Account          = require('../models/Account');
const catchAsync       = require('../utils/catchAsync');
const sendEmail        = require('../utils/sendEmail');
const { isArray } = require('util');

router.get('/home', isLoggedIn, catchAsync(async(req, res) => {
    const surveys = await Survey.find();
    res.render('./survey/home', {surveys});
}));

router.get('/:surveyID', isLoggedIn, catchAsync(async(req, res) => {
    const survey = await Survey.findById(req.params.surveyID);
    res.render('./survey/individualSurvey', {survey});
}));

router.get('/:surveyID/surveyInstance', isLoggedIn, catchAsync(async (req, res) => {
    const survey = await Survey.findById(req.params.surveyID);
    res.render('./survey/newSurveyInstance', { survey });
}));

router.post('/:surveyID/surveyInstance/upload', isLoggedIn, upload.single('csvFile'), catchAsync(async (req, res) => {
    const { surveyID } = req.params;
    const accountID = req.user._id;
    const { name } = req.body;

    // Create a new survey instance
    const surveyInstance = new SurveyInstance({
        survey: surveyID,
        account: accountID,
        name: name,
        status: 'Created',
    });
    await surveyInstance.save();

    const respondents = [];
    const filePath = req.file.path;

    fs.createReadStream(filePath, { encoding: 'utf8' })
        .pipe(csvParser())
        .on('data', (row) => {
            // Clean and trim keys and values from the row
            const cleanedRow = Object.fromEntries(
                Object.entries(row).map(([key, value]) => [key.trim().replace(/^\uFEFF/, ''), value.trim()])
            );
            console.log('Cleaned Row:', cleanedRow);

            const { respondentName, respondentEmail } = cleanedRow;

            if (respondentName && respondentEmail) {
                respondents.push({ respondentName, respondentEmail });
            }
        })
        .on('end', async () => {
            fs.unlinkSync(filePath); // Delete the uploaded CSV file after processing

            try {
                // Save all respondents in parallel
                const savedRespondents = await Promise.all(
                    respondents.map(async (respondentData) => {
                        const respondent = new Respondent({
                            ...respondentData,
                            surveyInstance: surveyInstance._id,
                            status: true,
                            progress: 'new' // Set progress status to 'new'
                        });
                        await respondent.save();
                        return respondent._id;
                    })
                );

                // Add all respondent IDs to the survey instance
                surveyInstance.respondents.push(...savedRespondents);
                await surveyInstance.save();

                // Update account with the new survey instance
                await Account.findByIdAndUpdate(accountID, {
                    $push: { surveyInstances: surveyInstance._id },
                });

                req.flash('success', 'Survey instance and respondents added successfully!');
            } catch (err) {
                console.error('Error processing respondents:', err);
                req.flash('error', 'Error adding respondents.');
            }

            res.redirect(`/app/survey/${surveyID}`);
        })
        .on('error', (err) => {
            console.error('Error reading CSV:', err);
            req.flash('error', 'Error processing CSV file.');
            res.redirect(`/app/survey/${surveyID}`);
        });
}));

router.get('/:surveyID/list', isLoggedIn, catchAsync(async(req, res) => {
    const { surveyID } = req.params;
    const accountID = req.user._id;
    const survey = await Survey.findById(surveyID);
    const surveyInstances = await SurveyInstance.find({
        survey: survey,
        account: accountID,
    });
    res.render('./survey/listSurveyInstance', {surveyInstances});
}));

router.get('/:surveyID/:surveyInstanceID', isLoggedIn, catchAsync(async (req, res) => {
    const { surveyID, surveyInstanceID } = req.params;

    // Fetch the survey and survey instance, populating the respondents array
    const survey = await Survey.findById(surveyID);
    const surveyInstance = await SurveyInstance.findById(surveyInstanceID).populate('respondents');

    let overallAverageScore = null;
    let categoryAverages = {};
    let questionScores = {}; // To aggregate scores per question
    let detailedScores = []; // Final processed scores for each question

    let totalResponses = 0; // Total number of responses across all respondents
    let totalScoreSum = 0; // Sum of all response scores for overall average


    if (surveyInstance.respondents.length > 0) {
        const categoryScores = {}; // Category-wise scores

        for (const respondent of surveyInstance.respondents) {
            if (!respondent.status) {
                const responses = await Response.find({
                    respondent: respondent._id,
                    surveyInstance: surveyInstanceID,
                }).populate({
                    path: 'question',
                    select: 'category shortDescription detailedDescription actionPlans question option1 option2 option3 option4 option5'
                });


                if (responses.length > 0) {
                    // Update total score and response count
                    totalScoreSum += responses.reduce((sum, response) => sum + response.choice, 0);
                    totalResponses += responses.length;

                    responses.forEach((response) => {
                        const { category, shortDescription, actionPlans } = response.question;
                        const roundedScore = Math.round(response.choice);

                        // Initialize data for the question if not already present
                        if (!questionScores[shortDescription]) {
                            questionScores[shortDescription] = {
                                category,
                                shortDescription,
                                totalScore: 0,
                                responseCount: 0,
                                actionPlans: actionPlans || [],
                            };
                        }

                        // Update the scores for the question
                        questionScores[shortDescription].totalScore += response.choice;
                        questionScores[shortDescription].responseCount += 1;

                        // Update category-wise scores
                        if (!categoryScores[category]) {
                            categoryScores[category] = { total: 0, count: 0 };
                        }
                        categoryScores[category].total += response.choice;
                        categoryScores[category].count += 1;
                    });
                }
            }
        }

        // Calculate overall average score
        if (totalResponses > 0) {
            overallAverageScore = (totalScoreSum / totalResponses).toFixed(2);
        }

        // Calculate category-wise averages
        for (const category in categoryScores) {
            categoryAverages[category] = (
                categoryScores[category].total / categoryScores[category].count
            ).toFixed(2);
        }

        // Process question scores into detailedScores array
        for (const shortDescription in questionScores) {
            const questionData = questionScores[shortDescription];
            const averageScore = (questionData.totalScore / questionData.responseCount).toFixed(2);
            const correspondingPlan =
                questionData.actionPlans[Math.round(averageScore) - 1] || 'No action plan available';

            detailedScores.push({
                category: questionData.category,
                shortDescription: questionData.shortDescription,
                score: averageScore,
                actionPlan: correspondingPlan,
            });
        }
    }

    res.render('./survey/individualSurveyInstance', {
        survey,
        surveyInstance,
        overallAverageScore,
        categoryAverages,
        detailedScores,
    });
}));

router.get('/:surveyID/:surveyInstanceID/sendEmail', isLoggedIn, catchAsync(async (req, res) => {
    const { surveyID, surveyInstanceID } = req.params;

    // Fetch survey and survey instance, populate respondents
    const survey = await Survey.findById(surveyID);
    const surveyInstance = await SurveyInstance.findById(surveyInstanceID).populate('respondents');

    if (!survey || !surveyInstance) {
        req.flash('error', 'Survey or Survey Instance not found.');
        return res.redirect(`/app/survey/${surveyID}`);
    }

    // Ensure the survey instance has respondents
    if (surveyInstance.respondents.length === 0) {
        req.flash('error', 'No respondents found for this survey instance.');
        return res.redirect(`/app/survey/${surveyID}/${surveyInstanceID}`);
    }

    // Send emails to all respondents
    for (const respondent of surveyInstance.respondents) {
        // Construct the link for each respondent to take the survey
        const takeSurveyLink = `${req.protocol}://${req.get('host')}/app/takeSurvey/${surveyID}/${surveyInstanceID}/${respondent._id}`;

        // Compose email content
        const emailContent = `
            Hello ${respondent.respondentName},

            You have been invited to take the survey "${survey.name}". Click the following link to participate: ${takeSurveyLink}

            Thank you!
        `;

        // Send the email using the sendEmail utility
        try {
            await sendEmail({
                to: respondent.respondentEmail,
                subject: `Assess your pricing capabilities through our ${survey.name}`,
                text: emailContent
            });
            console.log(`Email sent to: ${respondent.respondentEmail}`);
        } catch (error) {
            console.error(`Error sending email to ${respondent.respondentEmail}:`, error);
        }
    }

    // Update the status of the survey instance
    surveyInstance.status = 'MailSent';
    await surveyInstance.save();

    req.flash('success', 'Emails sent successfully to all respondents!');
    res.redirect(`/app/survey/${surveyID}/${surveyInstanceID}`);
}));

module.exports = router;