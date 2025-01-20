const mongoose              = require('mongoose');
const crypto = require('crypto');
const passportLocalMongoose = require('passport-local-mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/pricePelican');

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
    }
});
// Add passport-local-mongoose plugin
AccountSchema.plugin(passportLocalMongoose, {
    usernameField: 'email' // Use email as the username field
});

const Account = mongoose.model('Account', AccountSchema);

module.exports = Account;