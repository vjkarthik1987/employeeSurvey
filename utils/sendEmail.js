// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//     service: 'gmail', // Use your email service provider
//     auth: {
//         user: process.env.EMAIL_ACCOUNT,
//         pass: process.env.EMAIL_PASSWORD
//     }
// });

// module.exports = async function sendEmail({ to, subject, text }) {
//     const mailOptions = {
//         from: process.env.EMAIL_ACCOUNT,
//         to,
//         subject,
//         text
//     };

//     await transporter.sendMail(mailOptions);
// };

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com', // Office 365 SMTP server
    port: 587, // Secure SMTP port
    secure: false, // Use TLS
    auth: {
        user: process.env.OFFICE365_EMAIL, // Your Office 365 email
        pass: process.env.OFFICE365_PASSWORD // Your Office 365 password or app password
    },
    tls: {
        ciphers: 'SSLv3'
    }
});

module.exports = async function sendEmail({ to, subject, text }) {
    const mailOptions = {
        from: process.env.OFFICE365_EMAIL, // Your Office 365 email
        to,
        subject,
        text
    };

    await transporter.sendMail(mailOptions);
};
