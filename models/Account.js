const crypto = require('crypto');
const passportLocalMongoose = require('passport-local-mongoose');
const industries = require('../data/industry');
const mongoose = require("../db"); // Use centralized DB connection


const AccountSchema = new mongoose.Schema({
    name: {
        type: String,
        unique: true,
        required: true,
        trim: true,
    },
    email: String,
    surveyInstances: [{
        type: mongoose.Schema.Types.ObjectId,
        ref:'SurveyInstance',
    }],
    verified:{
        type:Boolean,
        default: false,
    },
    verificationToken: {
        type: String,
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    status: {
        type: Boolean,
        default: true,
    },
    industry: {
        type: String,
        enum: industries,
        required: true,
    }
});
// Add passport-local-mongoose plugin
AccountSchema.plugin(passportLocalMongoose, {
    usernameField: 'email' // Use email as the username field
});

const Account = mongoose.model('Account', AccountSchema);

module.exports = Account;