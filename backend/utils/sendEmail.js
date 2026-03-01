const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Check if email is configured
    const isConfigured = process.env.EMAIL_USER && process.env.EMAIL_USER !== 'your_username';

    if (!isConfigured) {
        console.log('---------------------------------------------------------');
        console.log('📧 DEVELOPMENT MODE: EMAIL NOT CONFIGURED');
        console.log(`TO: ${options.email}`);
        console.log(`SUBJECT: ${options.subject}`);
        console.log('MESSAGE:');
        console.log(options.message);
        console.log('---------------------------------------------------------');
        return;
    }

    // Determine if secure should be true (Port 465)
    const isSecure = process.env.EMAIL_PORT == 465;

    // Create a transporter
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: isSecure, // true for 465, false for 587/2525
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: {
            // Do not fail on invalid certs
            rejectUnauthorized: false
        }
    });

    // Define email options
    const mailOptions = {
        from: `Sri Vaishnavi Jewellers <${process.env.EMAIL_FROM}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
    };

    console.log(`Attempting to send email to: ${options.email} via ${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}`);

    // Send email
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
    } catch (error) {
        console.error('Nodemailer Error:', error);
        throw error;
    }
};

module.exports = sendEmail;
