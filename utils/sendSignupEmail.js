const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', // Replace with your email service
    auth: {
        user: process.env.EMAIL_ACCOUNT,
        pass: process.env.EMAIL_PASSWORD,
    },
});

module.exports = async function sendEmail({ to, subject, text }) {
    const mailOptions = {
        from: process.env.EMAIL_ACCOUNT,
        to,
        subject,
        text,
    };

    await transporter.sendMail(mailOptions);
};