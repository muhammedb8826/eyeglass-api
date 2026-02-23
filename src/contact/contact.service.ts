import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ContactDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
        port: this.configService.get<number>('SMTP_PORT', 587),
        secure: false, // true for 465, false for other ports
        auth: {
          user: this.configService.get<string>('SMTP_USER'),
          pass: this.configService.get<string>('SMTP_PASS'),
        },
      });

      this.logger.log('Email transporter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize email transporter', error);
    }
  }

  async sendContactEmail(contactData: ContactDto): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.configService.get<string>('SMTP_USER'),
        to: this.configService.get<string>('CONTACT_EMAIL', this.configService.get<string>('SMTP_USER')),
        subject: `New Contact Form Submission - ${contactData.serviceType}`,
        html: this.generateEmailHtml(contactData),
        text: this.generateEmailText(contactData),
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully: ${info.messageId}`);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to send contact email', error);
      return false;
    }
  }

  private generateEmailHtml(contactData: ContactDto): string {
    return `
      <h2>New Contact Form Submission</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr style="background-color: #f2f2f2;">
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Full Name:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${contactData.fullName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Email:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${contactData.email || 'Not provided'}</td>
        </tr>
        <tr style="background-color: #f2f2f2;">
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Phone:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${contactData.phone}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Company:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${contactData.company || 'Not provided'}</td>
        </tr>
        <tr style="background-color: #f2f2f2;">
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Service Type:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${contactData.serviceType}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Project Details:</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${contactData.projectDetails}</td>
        </tr>
      </table>
      <p><em>This message was sent from your website contact form.</em></p>
    `;
  }

  private generateEmailText(contactData: ContactDto): string {
    return `
New Contact Form Submission

Full Name: ${contactData.fullName}
Email: ${contactData.email || 'Not provided'}
Phone: ${contactData.phone}
Company: ${contactData.company || 'Not provided'}
Service Type: ${contactData.serviceType}
Project Details: ${contactData.projectDetails}

This message was sent from your website contact form.
    `;
  }
}
