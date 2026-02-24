# Verify Domain in Resend - Simple Steps

To send emails to ANY email address, you need to verify a domain in Resend.

## Option 1: Verify a Domain (Recommended - FREE)

If you own a domain (like `yourdomain.com`):

### Step 1: Go to Resend Domains
1. Go to: https://resend.com/domains
2. Click **"Add Domain"**
3. Enter your domain (e.g., `yourdomain.com`)
4. Click **"Add"**

### Step 2: Add DNS Records
Resend will show you DNS records to add:

1. Go to your domain registrar (where you bought the domain)
   - Examples: GoDaddy, Namecheap, Cloudflare, Google Domains
2. Go to DNS settings
3. Add these records (Resend will show you exact values):

**Required Records:**
- **TXT record** for domain verification
- **DKIM records** (usually 2-3 TXT records)
- **SPF record** (TXT record)

### Step 3: Wait for Verification
- Usually takes 5-60 minutes
- Resend will show "Verified" when ready

### Step 4: Update API Code
Once verified, I'll update the code to use your domain:
- Change `from: '0per8r <onboarding@resend.dev>'` 
- To: `from: '0per8r <noreply@yourdomain.com>'`

---

## Option 2: Use a Different Email Service (No Domain Required)

If you don't want to verify a domain, we can switch to:

1. **EmailJS** (free, client-side, but limited)
2. **SendGrid** (free tier, but also requires domain for production)
3. **Mailgun** (free tier, also requires domain)

**Note:** Most reliable email services require domain verification for sending to any address.

---

## Option 3: Use a Subdomain

If you have a domain, you can use a subdomain:
- Example: `mail.yourdomain.com` or `emails.yourdomain.com`
- Same process as Option 1, just verify the subdomain

---

## What's Your Situation?

1. **Do you own a domain?** → Use Option 1 (easiest)
2. **Don't own a domain?** → We can switch to a different service, but they all have limitations

Tell me which option you prefer and I'll guide you through it!




