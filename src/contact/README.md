# Contact Module

This module handles contact form submissions from your frontend and sends emails using nodemailer.

## Features

- ✅ Contact form validation
- ✅ Email sending via SMTP
- ✅ HTML and plain text email templates
- ✅ Configurable SMTP settings
- ✅ Error handling and logging

## Setup

### 1. Environment Variables

Add these variables to your `.env` file:

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
CONTACT_EMAIL=contact@yourcompany.com
```

### 2. Gmail Setup (Recommended)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. Use the generated password as `SMTP_PASS`

### 3. Alternative SMTP Providers

You can use any SMTP provider by updating the environment variables:

```bash
# For Outlook/Hotmail
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587

# For Yahoo
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587

# For custom SMTP server
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
```

## API Endpoint

**POST** `/api/v1/contact`

### Request Body

```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "company": "Acme Corp",
  "serviceType": "Printing Services",
  "projectDetails": "I need business cards printed..."
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "message": "Message sent successfully! We'll get back to you within 24 hours.",
  "timestamp": "2025-01-09T12:00:00.000Z"
}
```

**Error (400/500):**
```json
{
  "success": false,
  "message": "Failed to send message. Please try again or contact us directly.",
  "timestamp": "2025-01-09T12:00:00.000Z"
}
```

## Frontend Integration

Update your frontend fetch URL to match your backend:

```typescript
// Change from localhost to your production URL
const response = await fetch('https://yourdomain.com/api/v1/contact', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(formData),
});
```

## Testing

1. Start your NestJS application
2. Send a POST request to `/api/v1/contact`
3. Check your email inbox for the contact form submission
4. Check application logs for any errors

## Troubleshooting

### Common Issues

1. **Authentication failed**: Check your SMTP credentials
2. **Connection timeout**: Verify SMTP host and port
3. **Email not received**: Check spam folder and CONTACT_EMAIL setting

### Debug Mode

Enable debug logging by setting the log level in your main.ts:

```typescript
app.useLogger(['error', 'warn', 'log', 'debug']);
```

## Security Notes

- Never commit `.env` files to version control
- Use App Passwords instead of your main password
- Consider rate limiting for production use
- Validate and sanitize all input data
