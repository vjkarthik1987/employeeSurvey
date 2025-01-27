//See Account Admin Home Page
//See Survey Instances and Response Rates
//Edit Account Information
//Change password
//Survey specific information
//Engagement metrics 

const express          = require('express');
const router           = express.Router();
const passport         = require('passport');
const SurveyInstance   = require('../models/SurveyInstance');
const Respondent       = require('../models/Respondent');
const Account          = require("../models/Account");
const catchAsync       = require('../utils/catchAsync');
const isLoggedIn       = require('../middlewares/isLoggedIn');

router.get('/home', isLoggedIn, catchAsync(async(req, res) => {
    res.render('./accountAdmin/home');
}));

router.get('/surveyInstances', isLoggedIn, catchAsync(async(req, res) => {
    const accountId = req.user._id; // Get logged-in admin's account ID

    // Fetch all survey instances created by this admin
    const surveyInstances = await SurveyInstance.find({ account: accountId })
        .populate('survey', 'name') // Get survey name
        .populate('respondents') // Get all respondents linked to the survey
        .select('survey name status startDate endDate respondents') // Fetch only required fields
        .lean(); // Convert to plain JavaScript objects for easier manipulation

    // Count completed responses per survey instance
    for (let instance of surveyInstances) {
        instance.completedResponses = await Respondent.countDocuments({
            surveyInstance: instance._id,
            progress: 'completed' // Only count respondents who completed the survey
        });
    }

    res.render('./accountAdmin/listSurveyInstances', { surveyInstances });
}));


router.post("/changePassword", isLoggedIn, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await Account.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Verify old password using Passport's authenticate method
        user.changePassword(oldPassword, newPassword, async function (err) {
            if (err) {
                return res.status(400).json({ message: "Old password is incorrect or invalid" });
            }

            await user.save();

            // Log the user out so they must re-login
            req.logout((err) => {
                if (err) return res.status(500).json({ message: "Error logging out after password change" });
                res.status(200).json({ message: "Password updated successfully! Please log in again." });
            });
        });

    } catch (error) {
        res.status(500).json({ message: "Error updating password" });
    }
});

module.exports = router;
