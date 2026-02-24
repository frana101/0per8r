// Backend API endpoint for sending verification emails
// Deployed on Vercel as a serverless function

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, code, subject } = req.body;

  if (!to || !code) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Get API key from environment variable
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: '0per8r <onboarding@resend.dev>',
        to: to,
        subject: subject || '0per8r Email Verification',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0f0;">0per8r Email Verification</h1>
            <p>Your verification code is:</p>
            <div style="background: #1a1a2e; padding: 20px; text-align: center; margin: 20px 0;">
              <h2 style="color: #0f0; font-size: 32px; letter-spacing: 8px; margin: 0;">${code}</h2>
            </div>
            <p style="color: #666; font-size: 12px;">This code expires in 24 hours.</p>
            <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
        text: `Your 0per8r verification code is: ${code}\n\nThis code expires in 24 hours.`
      })
    });

    const result = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(500).json({ error: result.message || 'Failed to send email' });
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: error.message });
  }
}

