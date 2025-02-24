const express              = require('express');
const multer               = require('multer');
const csvParser            = require('csv-parser');
const fs                   = require('fs');
const path                 = require('path');
const upload               = multer({ dest: 'uploads/' });
const router               = express.Router();
const mongoose             = require('mongoose');
const puppeteer            = require("puppeteer");
const ejs                  = require("ejs");
const createCsvWriter      = require('csv-writer').createObjectCsvWriter;
const os                   = require('os');
const isLoggedIn           = require('../middlewares/isLoggedIn')
const Survey               = require('../models/Survey');
const Question             = require('../models/Question');
const SurveyInstance       = require('../models/SurveyInstance');
const Respondent           = require('../models/Respondent');
const Response             = require('../models/Response');
const Account              = require('../models/Account');
const catchAsync           = require('../utils/catchAsync');
const sendEmail            = require('../utils/sendEmail');
const summarizeText        = require("../utils/summarizer");
const analyzeSurveyResults = require("../utils/analyzeSurveyResults");
const { isArray }          = require('util');

//Constants
const fields = [
    {
        field:1,
        name:"Band",
    },
    {
        field:2,
        name:"Location",
    },
    {
        field:3,
        name:"Team",
    },
    {
        field:4,
        name:"Gender",
    },
    {
        field:5,
        name:"Experience",
    }
]

router.get('/home', isLoggedIn, catchAsync(async (req, res) => {
    const surveys = await Survey.find();
    const user = req.user;
    const account = await Account.findById(user).populate({
        path:'surveyInstances',
    }).lean();

    // Fetch the 5 most recent survey instances linked to the user's account
    const recentSurveyInstances = await SurveyInstance.find({ account: user._id })
        .populate('survey', 'name') // Populate survey details (only name)
        .sort({ startDate: -1 }) // Sort by most recent first
        .limit(5) // Get only the last 5 instances
        .lean();
    
    let respondents = 0;
    let stoppedInstances = 0;
    let activeInstances = 0;
    for (instance of account.surveyInstances) {
        respondents = respondents + instance.respondents.length;
        (instance.status == 'Stopped') ? (stoppedInstances++) : (activeInstances++);
    }

    res.render('./survey/home', { surveys, user, recentSurveyInstances, account, respondents, stoppedInstances, activeInstances });
}));

router.get('/:surveyID', isLoggedIn, catchAsync(async(req, res) => {
    const survey = await Survey.findById(req.params.surveyID);
    const accountID = req.user._id;
    const surveyInstances = await SurveyInstance.find({
        survey: survey,
        account: accountID,
    });
    res.render('./survey/individualSurvey', {survey, accountID, surveyInstances});
}));

router.get('/:surveyID/surveyInstance', isLoggedIn, catchAsync(async (req, res) => {
    const survey = await Survey.findById(req.params.surveyID);
    res.render('./survey/newSurveyInstance', { survey });
}));

router.post('/:surveyID/surveyInstance/upload', isLoggedIn, upload.single('csvFile'), catchAsync(async (req, res) => {
    const { surveyID } = req.params;
    const accountID = req.user._id;
    const { name, startDate, endDate } = req.body;

    // Create a new survey instance
    const surveyInstance = new SurveyInstance({
        survey: surveyID,
        account: accountID,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'Created',
    });
    await surveyInstance.save();

    const respondents = [];
    const filePath = req.file.path;

    fs.createReadStream(filePath, { encoding: 'utf8' })
        .pipe(csvParser())
        .on('data', (row) => {
            const cleanedRow = Object.fromEntries(
                Object.entries(row).map(([key, value]) => [key.trim().replace(/^\uFEFF/, ''), value.trim()])
            );
            console.log('Cleaned Row:', cleanedRow);

            const { respondentName, respondentEmail, field1, field2, field3, field4, field5 } = cleanedRow;
            if (respondentName && respondentEmail) {
                respondents.push({ respondentName, respondentEmail, field1, field2, field3, field4, field5 });
            }
        })
        .on('end', async () => {
            fs.unlinkSync(filePath); // Delete uploaded CSV file

            try {
                // Save respondents and generate survey links
                const savedRespondents = await Promise.all(
                    respondents.map(async (respondentData) => {
                        const respondent = new Respondent({
                            ...respondentData,
                            surveyInstance: surveyInstance._id,
                            status: true,
                            progress: 'new',
                        });
                        await respondent.save();
                        return {
                            _id: respondent._id,
                            respondentName: respondent.respondentName,
                            respondentEmail: respondent.respondentEmail,
                            surveyLink: `${req.protocol}://${req.get('host')}/app/takeSurvey/${surveyID}/${surveyInstance._id}/${respondent._id}`
                        };
                    })
                );

                surveyInstance.respondents.push(...savedRespondents.map(r => r._id));
                await surveyInstance.save();

                // Update account with the new survey instance
                await Account.findByIdAndUpdate(accountID, { $push: { surveyInstances: surveyInstance._id } });

                // ✅ Generate CSV file for download
                 // ✅ Detect User's Downloads or Documents Folder
                 const downloadsDir = path.join(os.homedir(), 'Downloads');  // Preferred location
                 const documentsDir = path.join(os.homedir(), 'Documents');  // Alternative

                // Ensure at least one exists
                const saveDir = fs.existsSync(downloadsDir) ? downloadsDir : documentsDir;
                // ✅ Generate CSV file in user's folder
                const csvFilePath = path.join(saveDir, `Respondents-${surveyInstance._id}.csv`);
                const csvWriter = createCsvWriter({
                    path: csvFilePath,
                    header: [
                        { id: 'respondentName', title: 'Name' },
                        { id: 'respondentEmail', title: 'Email' },
                        { id: 'surveyLink', title: 'Survey Link' },
                        { id: '_id', title: 'ID'},
                    ]
                });

                await csvWriter.writeRecords(savedRespondents);
                req.flash('success', 'Survey instance and respondents added successfully! The CSV is saved in your downloads directory or your documents folder.');

                //res.redirect(`/app/survey/${surveyID}/${surveyInstance._id}/downloadCSV`);
                res.redirect(`/app/survey/${surveyID}`);

            } catch (err) {
                console.error('Error processing respondents:', err);
                req.flash('error', 'Error adding respondents.');
                res.redirect(`/app/survey/${surveyID}`);
            }
        })
        .on('error', (err) => {
            console.error('Error reading CSV:', err);
            req.flash('error', 'Error processing CSV file.');
            res.redirect(`/app/survey/${surveyID}`);
        });
}));

//Download CSV
router.get('/:surveyID/:surveyInstanceID/downloadCSV', isLoggedIn, (req, res) => {
    const { surveyInstanceID } = req.params;
    const csvFilePath = path.join(__dirname, `../downloads/respondents-${surveyInstanceID}.csv`);

    if (fs.existsSync(csvFilePath)) {
        res.setHeader('Content-Disposition', `attachment; filename=Respondents-${surveyInstanceID}.csv`);
        res.setHeader('Content-Type', 'text/csv');
        res.download(csvFilePath, (err) => {
            if (!err) {
                setTimeout(() => {
                    fs.unlinkSync(csvFilePath); // ✅ Deletes file after download
                }, 5000);
            }
        });
    } else {
        req.flash('error', 'CSV file not found.');
        res.redirect(`/app/survey/${req.params.surveyID}`);
    }
});

//Upload survey status to 'MailSent' once button is clicked
router.post("/:surveyID/:surveyInstanceID/markAsSent", isLoggedIn, catchAsync(async (req, res) => {
    try {
        const { surveyInstanceID } = req.params;

        // Update status to "MailSent"
        await SurveyInstance.findByIdAndUpdate(surveyInstanceID, { status: "MailSent" });

        res.json({ success: true, message: "Survey status updated to 'MailSent'." });
    } catch (error) {
        console.error("❌ Error updating survey status:", error);
        res.status(500).json({ success: false, message: "Failed to update survey status." });
    }
}));

//Download results as a csv
router.post("/:surveyID/:surveyInstanceID/downloadResults", isLoggedIn, catchAsync(async (req, res) => {
    try {
        const { surveyID, surveyInstanceID } = req.params;
        console.log("🔵 Generating CSV for Survey Instance:", surveyInstanceID);

        // Fetch survey instance with respondents
        const surveyInstance = await SurveyInstance.findById(surveyInstanceID).populate("respondents");
        if (!surveyInstance) {
            console.log("❌ Survey instance not found");
            return res.status(404).json({ success: false, message: "Survey instance not found." });
        }

        console.log("🔵 Found Survey Instance:", surveyInstance.name);

        // Fetch all questions for this survey
        const questions = await Question.find({ survey: surveyID }).select("question");
        const questionHeaders = questions.map(q => q.question); // Extract question texts

        console.log("🔵 Found Questions:", questionHeaders);

        // Prepare data for CSV
        const resultsData = await Promise.all(
            surveyInstance.respondents.map(async (respondent) => {
                // Fetch all responses for this respondent
                const responses = await Response.find({ respondent: respondent._id, surveyInstance: surveyInstanceID })
                    .populate("question", "question"); // Get question text

                // Create a response map { "question_text": response_value }
                const responseMap = {};
                responses.forEach(resp => {
                    responseMap[resp.question.question] = resp.choice;
                });

                // Build row with respondent details and responses
                const row = {
                    respondentTeam: respondent.respondentTeam || "N/A",
                    field1: respondent.field1 || "N/A",
                    field2: respondent.field2 || "N/A",
                    field3: respondent.field3 || "N/A",
                    field4: respondent.field4 || "N/A",
                    field5: respondent.field5 || "N/A",
                    strengthsFeedback: respondent.strengthsFeedback || "No feedback provided",
                    improvementsFeedback: respondent.improvementsFeedback || "No feedback provided",
                    status: respondent.progress
                };

                // Add responses for all questions (ensuring missing ones are "N/A")
                questionHeaders.forEach(qText => {
                    row[qText] = responseMap[qText] || "N/A"; // Use "N/A" if response is missing
                });

                return row;
            })
        );

        if (resultsData.length === 0) {
            console.log("❌ No respondents found");
            return res.status(400).json({ success: false, message: "No respondents found in this survey instance." });
        }

        console.log("🔵 Preparing to write CSV...");

        // Detect user's Downloads folder
        const downloadsDir = path.join(os.homedir(), "Downloads");
        const fileName = `results_${surveyInstanceID}.csv`;
        const filePath = path.join(downloadsDir, fileName);

        // Ensure Downloads folder exists
        if (!fs.existsSync(downloadsDir)) {
            console.log("❌ Downloads folder missing, creating...");
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        // Create CSV Writer with dynamic question headers
        const csvWriter = createCsvWriter({
            path: filePath,
            header: [
                { id: "respondentTeam", title: "Respondent Team" },
                { id: "field1", title: "Field 1" },
                { id: "field2", title: "Field 2" },
                { id: "field3", title: "Field 3" },
                { id: "field4", title: "Field 4" },
                { id: "field5", title: "Field 5" },
                { id: "strengthsFeedback", title: "Strengths Feedback" },
                { id: "improvementsFeedback", title: "Improvements Feedback" },
                { id: "status", title: "Status" },
                ...questionHeaders.map(q => ({ id: q, title: q })) // Dynamic question columns
            ]
        });

        await csvWriter.writeRecords(resultsData);
        console.log(`✅ CSV File Created Successfully: ${filePath}`);

        res.json({ success: true, message: "Results generated successfully!", filePath });

    } catch (error) {
        console.error("❌ Error generating results CSV:", error);
        res.status(500).json({ success: false, message: "Failed to generate CSV." });
    }
}));

//For serving the file as a csv with results
router.get("/:surveyID/:surveyInstanceID/fetchCSV", isLoggedIn, (req, res) => {
    const filePath = req.query.filePath;

    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: "CSV file not found." });
    }

    res.download(filePath, (err) => {
        if (!err) {
            setTimeout(() => {
                fs.unlinkSync(filePath); // ✅ Delete file after download
            }, 5000);
        }
    });
});

router.get("/:surveyID/:surveyInstanceID/respondents", isLoggedIn, catchAsync(async(req, res) => {
    const { surveyID, surveyInstanceID } = req.params;
    const accountID = req.user._id;
    const survey = await Survey.findById(surveyID);
    const surveyInstance = await  SurveyInstance.findById(surveyInstanceID);
    const respondents = await Respondent.find({
        surveyInstance: surveyInstance
    });
    res.render('./survey/individualSurveyInstanceRespondents', {survey, surveyInstance, respondents})
}));

//Download report of respondents
router.post("/:surveyID/:surveyInstanceID/respondents/downloadReport", isLoggedIn, catchAsync(async (req, res) => {
    try {
        const { surveyID, surveyInstanceID } = req.params;
        console.log("🔵 Generating Respondents CSV for Survey Instance:", surveyInstanceID);

        // Fetch survey instance with respondents
        const surveyInstance = await SurveyInstance.findById(surveyInstanceID).populate("respondents");
        if (!surveyInstance) {
            console.log("❌ Survey instance not found");
            return res.status(404).json({ success: false, message: "Survey instance not found." });
        }

        console.log("🔵 Found Survey Instance:", surveyInstance.name);

        // Prepare data for CSV
        const resultsData = surveyInstance.respondents.map(respondent => ({
            respondentName: respondent.respondentName || "N/A",
            respondentEmail: respondent.respondentEmail || "N/A",
            band: respondent.field1 || "N/A",
            location: respondent.field2 || "N/A",
            team: respondent.field3 || "N/A",
            gender: respondent.field4 || "N/A",
            experience: respondent.field5 || "N/A",
            status: respondent.progress ? respondent.progress.charAt(0).toUpperCase() + respondent.progress.slice(1) : "N/A"
        }));

        if (resultsData.length === 0) {
            console.log("❌ No respondents found");
            return res.status(400).json({ success: false, message: "No respondents found in this survey instance." });
        }

        console.log("🔵 Preparing to write CSV...");

        // Detect user's Downloads or Documents folder
        const baseDir = os.platform() === "win32" ? path.join(os.homedir(), "Documents") : path.join(os.homedir(), "Downloads");
        const dateSuffix = new Date().toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD format
        const fileName = `RespondentsStatus_${dateSuffix}.csv`;
        const filePath = path.join(baseDir, fileName);

        // Ensure base directory exists
        if (!fs.existsSync(baseDir)) {
            console.log("❌ Base directory missing, creating...");
            fs.mkdirSync(baseDir, { recursive: true });
        }

        // Create CSV Writer
        const csvWriter = createCsvWriter({
            path: filePath,
            header: [
                { id: "respondentName", title: "Name" },
                { id: "respondentEmail", title: "Email" },
                { id: "band", title: "Band" },
                { id: "location", title: "Location" },
                { id: "team", title: "Team" },
                { id: "gender", title: "Gender" },
                { id: "experience", title: "Experience" },
                { id: "status", title: "Status" }
            ]
        });

        await csvWriter.writeRecords(resultsData);
        console.log(`✅ CSV File Created Successfully: ${filePath}`);

        res.json({ success: true, message: "Report generated successfully!", filePath, fileName });

    } catch (error) {
        console.error("❌ Error generating respondents CSV:", error);
        res.status(500).json({ success: false, message: "Failed to generate CSV." });
    }
}));

//Get route to serve the file
router.get("/:surveyID/:surveyInstanceID/fetchRespondentsCSV", isLoggedIn, (req, res) => {
    const filePath = req.query.filePath;

    console.log("🔵 Fetching CSV File:", filePath);

    if (!filePath || !fs.existsSync(filePath)) {
        console.log("❌ CSV file not found.");
        return res.status(404).json({ success: false, message: "CSV file not found." });
    }

    res.download(filePath, (err) => {
        if (!err) {
            console.log("✅ File downloaded, deleting...");
            setTimeout(() => {
                fs.unlinkSync(filePath); // ✅ Delete file after download
            }, 5000);
        } else {
            console.log("❌ Error while downloading file:", err);
        }
    });
});

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

    req.session.surveyResults = {
        overallAverageScore,
        categoryAverages,
        detailedScores
    };

    res.render('./survey/individualSurveyInstance', {
        survey,
        surveyInstance,
        overallAverageScore,
        categoryAverages,
        detailedScores,
        fields,
    });
}));

//Get details of text responses
router.get('/:surveyID/:surveyInstanceID/textResponses', isLoggedIn, catchAsync(async (req, res) => {
    try {
        const { surveyID, surveyInstanceID } = req.params;

        // Fetch survey and survey instance
        const survey = await Survey.findById(surveyID);
        const surveyInstance = await SurveyInstance.findById(surveyInstanceID);

        if (!survey || !surveyInstance) {
            req.flash("error", "Survey or Survey Instance not found.");
            return res.redirect('/');
        }

        // Get all respondents who have completed the survey
        const respondents = await Respondent.find({
            surveyInstance: surveyInstanceID, // Ensure it's an ObjectId
            progress: "completed"
        }).select("strengthsFeedback improvementsFeedback");

        // Initialize arrays
        const strengths = [];
        const improvements = [];

        // Extract strengths and improvements
        respondents.forEach(respondent => {
            if (respondent.strengthsFeedback) strengths.push(respondent.strengthsFeedback);
            if (respondent.improvementsFeedback) improvements.push(respondent.improvementsFeedback);
        });

        // Generate summaries
        const strengthsSummary = await summarizeText(strengths.join(". "));
        const improvementsSummary = await summarizeText(improvements.join(". "));

        res.render('./survey/listTextResponse', { strengths, improvements, strengthsSummary, improvementsSummary, survey, surveyInstance });

    } catch (error) {
        console.error("❌ Error getting details of text responses:", error);
        req.flash("error", "Failed to fetch text responses.");
        res.redirect('/app/survey/home');
    }
}));


// Stop a survey instance
router.post("/:surveyID/:surveyInstanceID/stopInstance", catchAsync(async (req, res) => {
    const { surveyInstanceID, surveyID } = req.params;

    try {
        // Find the survey instance and update its status to "Stopped"
        await SurveyInstance.findByIdAndUpdate(surveyInstanceID, { status: "Stopped" });

        req.flash("success", "Survey instance has been stopped.");
    } catch (error) {
        console.error("Error stopping survey instance:", error);
        req.flash("error", "Failed to stop survey instance.");
    }
    res.redirect(`/app/survey/${surveyID}/${surveyInstanceID}`);
}));

//Send Email
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

// Send Reminder Emails to Incomplete Respondents
router.post("/:surveyID/:surveyInstanceID/sendReminder", isLoggedIn, catchAsync(async (req, res) => {
    const { surveyID, surveyInstanceID } = req.params;

    // Fetch survey instance and populate respondents
    const survey = await Survey.findById(surveyID);
    const surveyInstance = await SurveyInstance.findById(surveyInstanceID).populate('respondents');

    if (!survey || !surveyInstance) {
        req.flash("error", "Survey or Survey Instance not found.");
        return res.redirect(`/app/survey/${surveyID}`);
    }

    // Get only respondents who haven't completed the survey
    const pendingRespondents = surveyInstance.respondents.filter(respondent => respondent.status === true);

    if (pendingRespondents.length === 0) {
        req.flash("error", "No pending respondents to remind.");
        return res.redirect(`/app/survey/${surveyID}/${surveyInstanceID}`);
    }

    // Send reminder emails
    for (const respondent of pendingRespondents) {
        const takeSurveyLink = `${req.protocol}://${req.get("host")}/app/takeSurvey/${surveyID}/${surveyInstanceID}/${respondent._id}`;

        const emailContent = `
            Hello ${respondent.respondentName},

            This is a friendly reminder to complete the survey "${survey.name}". Click the link below to take the survey:

            ${takeSurveyLink}

            Thank you!
        `;

        try {
            await sendEmail({
                to: respondent.respondentEmail,
                subject: `Reminder: Complete your survey - ${survey.name}`,
                text: emailContent,
            });
            console.log(`Reminder sent to: ${respondent.respondentEmail}`);
        } catch (error) {
            console.error(`Error sending reminder to ${respondent.respondentEmail}:`, error);
        }
    }

    req.flash("success", "Reminders sent successfully to pending respondents!");
    res.redirect(`/app/survey/${surveyID}/${surveyInstanceID}`);
}));

// Update Survey Instance Details
router.post("/:surveyID/:surveyInstanceID/edit", catchAsync(async (req, res) => {
    const { surveyID, surveyInstanceID } = req.params;
    const { name, endDate } = req.body;

    try {
        // Find and update the survey instance
        await SurveyInstance.findByIdAndUpdate(surveyInstanceID, {
            name: name,
            endDate: new Date(endDate),
        });

        req.flash("success", "Survey instance updated successfully.");
    } catch (error) {
        console.error("Error updating survey instance:", error);
        req.flash("error", "Failed to update survey instance.");
    }

    res.redirect(`/app/survey/${surveyID}/list`);
}));

// Delete Survey Instance and Related Data
router.delete("/:surveyID/:surveyInstanceID/delete", isLoggedIn, catchAsync(async (req, res) => {
    const { surveyID, surveyInstanceID } = req.params;

    try {
        // Delete all responses linked to this survey instance
        await Response.deleteMany({ surveyInstance: surveyInstanceID });

        // Delete all respondents linked to this survey instance
        await Respondent.deleteMany({ surveyInstance: surveyInstanceID });

        // Delete the survey instance itself
        await SurveyInstance.findByIdAndDelete(surveyInstanceID);

        console.log(`Survey Instance ${surveyInstanceID} deleted successfully.`);
        
        // Send a JSON response instead of redirect
        res.status(200).json({ success: true, message: "Survey instance deleted successfully." });
    } catch (error) {
        console.error("Error deleting survey instance:", error);
        res.status(500).json({ success: false, message: "Failed to delete survey instance." });
    }
}));

//Detailed Analyis by unique values in the field
router.get("/:surveyID/:surveyInstanceID/:fieldNumber", isLoggedIn, catchAsync(async (req, res) => {
    const { surveyID, surveyInstanceID, fieldNumber } = req.params;
    const survey = await Survey.findById(surveyID);
    const surveyInstance = await SurveyInstance.findById(surveyInstanceID).populate("respondents");

    if (!survey || !surveyInstance) {
        req.flash("error", "Survey or Survey Instance not found.");
        return res.redirect("/app/survey/home");
    }

    // Extract field number (convert "field1" to 1)
    const fieldNum = parseInt(fieldNumber.replace("field", ""), 10);
    const fieldObj = fields.find(f => f.field === fieldNum);
    if (!fieldObj) {
        req.flash("error", "Invalid field selected.");
        return res.redirect(`/app/survey/${surveyID}/${surveyInstanceID}`);
    }

    console.log(`🔵 Processing field: ${fieldObj.name}`);

    // 🔹 Step 1: Get unique values in selected field
    const uniqueValues = [...new Set(surveyInstance.respondents.map(res => res[`field${fieldNum}`]).filter(Boolean))];

    console.log(`🔵 Unique Values in ${fieldObj.name}:`, uniqueValues);

    // 🔹 Step 2: Compute overall averages, category-wise averages, and question-wise averages
    let overallAverages = {};
    let categoryWiseAverages = {};
    let questionAverages = {};

    for (const value of uniqueValues) {
        let totalScore = 0;
        let responseCount = 0;
        let categoryScores = {};

        const filteredRespondents = surveyInstance.respondents.filter(res => res[`field${fieldNum}`] === value);

        for (const respondent of filteredRespondents) {
            const responses = await Response.find({
                respondent: respondent._id,
                surveyInstance: surveyInstanceID
            }).populate("question");

            responses.forEach(resp => {
                totalScore += resp.choice;
                responseCount++;

                const categoryName = resp.question.category;
                if (!categoryScores[categoryName]) categoryScores[categoryName] = { total: 0, count: 0 };
                categoryScores[categoryName].total += resp.choice;
                categoryScores[categoryName].count++;
            });
        }

        overallAverages[value] = responseCount ? (totalScore / responseCount).toFixed(2) : "N/A";

        categoryWiseAverages[value] = {};
        for (const category in categoryScores) {
            categoryWiseAverages[value][category] = (categoryScores[category].total / categoryScores[category].count).toFixed(2);
        }
    }

    // 🔹 Step 3: Compute Question-Wise Averages
    for (const value of uniqueValues) {
        questionAverages[value] = {};
        for (const respondent of surveyInstance.respondents.filter(res => res[`field${fieldNum}`] === value)) {
            const responses = await Response.find({ respondent: respondent._id, surveyInstance: surveyInstanceID }).populate("question");

            responses.forEach(resp => {
                const questionText = resp.question.question;
                if (!questionAverages[questionText]) questionAverages[questionText] = {};
                if (!questionAverages[questionText][value]) questionAverages[questionText][value] = { total: 0, count: 0 };

                questionAverages[questionText][value].total += resp.choice;
                questionAverages[questionText][value].count++;
            });
        }

        for (const question in questionAverages) {
            if (questionAverages[question][value]) {
                questionAverages[question][value] = (questionAverages[question][value].total / questionAverages[question][value].count).toFixed(2);
            }
        }
    }

    // 🔹 Step 4: Fetch AI Analysis
    const aiInsights = await analyzeSurveyResults(fieldObj.name, uniqueValues, overallAverages, categoryWiseAverages, questionAverages);

    console.log("✅ AI Insights Received");

    res.render("./survey/individualSurveyInstanceDetail", {
        survey,
        surveyInstance,
        fieldName: fieldObj.name,
        uniqueValues,
        overallAverages,
        categoryWiseAverages,
        questionAverages,
        aiInsights
    });
}));

module.exports = router;