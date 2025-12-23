# Email Verification Setup

## Current Implementation

The app now requires **real email addresses** and includes email verification. However, the email sending is currently **mocked** (shows code in console).

## To Enable Real Email Sending

You need to integrate a real email service. Here are options:

### Option 1: SendGrid (Recommended - Free tier available)

1. Sign up at https://sendgrid.com
2. Get API key
3. Install SendGrid SDK:
   ```bash
   npm install @sendgrid/mail
   ```
4. Update `sendVerificationEmail()` function in `app.js`:
   ```javascript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   
   async function sendVerificationEmail(email, code) {
     const msg = {
       to: email,
       from: 'noreply@0per8r.com', // Your verified sender
       subject: '0per8r Email Verification',
       text: `Your verification code is: ${code}`,
       html: `<h1>0per8r Verification</h1><p>Your code is: <strong>${code}</strong></p>`
     };
     return sgMail.send(msg);
   }
   ```

### Option 2: Mailgun

1. Sign up at https://mailgun.com
2. Get API key
3. Install Mailgun:
   ```bash
   npm install mailgun-js
   ```
4. Update function similarly

### Option 3: Backend API

Create a simple backend (Node.js/Express) that:
- Receives email and code
- Sends email via service
- Returns success/failure

Then call it from the app:
```javascript
async function sendVerificationEmail(email, code) {
  return fetch('https://your-api.com/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });
}
```

## For Development/Testing

Currently, the verification code is:
1. Logged to console
2. Stored in localStorage
3. Valid for 24 hours

You can check the console to see codes during development.

## Security Notes

- Codes expire after 24 hours
- Codes are 6 digits
- Email addresses are normalized (lowercase)
- Passwords are hashed (though simple - consider bcrypt for production)

## Next Steps

1. Choose an email service
2. Get API credentials
3. Update `sendVerificationEmail()` function
4. Test email delivery
5. Deploy!

