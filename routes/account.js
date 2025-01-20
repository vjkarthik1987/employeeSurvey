const express          = require('express');
const router           = express.Router();
const crypto           = require('crypto');
const isLoggedIn       = require('../middlewares/isLoggedIn')
const catchAsync       = require('../utils/catchAsync');
const Account          = require('../models/Account');
const sendEmail        = require('../utils/sendSignupEmail');
const sendSignupEmail = require('../utils/sendSignupEmail');

router.post('/', catchAsync(async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
        req.flash('error', 'Passwords do not match.')
        return res.redirect('/auth/signup');
    }

    try {
        // Generate a unique verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Create the account with the verification token
        const account = new Account({ name, email, verificationToken });
        await Account.register(account, password);

        // Send verification email
        const verificationLink = `${req.protocol}://${req.get('host')}/account/verify/${verificationToken}`;
        await sendSignupEmail({
            to: email,
            subject: 'Verify Your Email',
            text: `Hello ${name},\n\nPlease verify your email by clicking the following link:\n\n${verificationLink}\n\nThank you!`,
        });

        req.flash('success', 'Account created! Please verify your email.');
        res.redirect('/auth/signup');
    } catch (error) {
        req.flash('error', `Error creating account: ${error.message}`);
        res.redirect('/auth/signup');
    }
}));

router.get('/verify/:token', catchAsync(async (req, res) => {
    const { token } = req.params;

    // Find the account by the verification token
    const account = await Account.findOne({ verificationToken: token });

    if (!account) {
        req.flash('error', 'Invalid or expired verification link.');
        return res.redirect('/auth/signup');
    }

    // Mark account as verified and clear the token
    account.verified = true;
    account.verificationToken = null;
    await account.save();

    req.flash('success', 'Your email has been verified! You can now log in.');
    res.redirect('/auth/login');
}));

module.exports = router;