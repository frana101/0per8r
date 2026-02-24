# Email Verification Setup Required

The email verification feature requires a backend API endpoint to be configured with a Resend API key.

## Current Status

The app is configured to send emails via: `https://0per8r-email-api.vercel.app/api/send-verification`

## What You Need To Do

1. **Get a Resend API Key**:
   - Go to https://resend.com
   - Sign up (free tier: 100 emails/day)
   - Create an API key
   - Copy the key (starts with `re_...`)

2. **Set up the Vercel Backend**:
   - The backend code is in `api/send-verification.js`
   - Deploy it to Vercel or your hosting service
   - Set the environment variable: `RESEND_API_KEY=re_your_key_here`

3. **Update the API URL** (if using different host):
   - The API URL is in `app.js` in the `sendVerificationEmail` function
   - Change `backendUrl` to your deployed endpoint URL

## Alternative: Use a Different Email Service

You can modify `api/send-verification.js` to use:
- SendGrid (free tier: 100 emails/day)
- Mailgun (free tier: 5,000 emails/month)
- AWS SES
- Or any other email service

## Testing

After setup, test by:
1. Running the app: `npm start`
2. Try signing up with a real email address
3. Check your inbox for the verification code

The verification code will be sent to the email address provided during signup.




