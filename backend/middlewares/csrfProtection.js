
const csurf = require('csurf');

const csrfProtection = csurf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'strict',
    }
});

module.exports = csrfProtection;
