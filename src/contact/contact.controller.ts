import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactDto } from './dto/contact.dto';
import { Public } from '../decorators';

@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(private readonly contactService: ContactService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async submitContact(@Body() contactData: ContactDto) {
    this.logger.log(`Received contact form submission from: ${contactData.fullName}`);
    
    try {
      const emailSent = await this.contactService.sendContactEmail(contactData);
      
      if (emailSent) {
        this.logger.log(`Contact email sent successfully for: ${contactData.fullName}`);
        return {
          success: true,
          message: 'Message sent successfully! We\'ll get back to you within 24 hours.',
          timestamp: new Date().toISOString()
        };
      } else {
        this.logger.error(`Failed to send contact email for: ${contactData.fullName}`);
        return {
          success: false,
          message: 'Failed to send message. Please try again or contact us directly.',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      this.logger.error(`Error processing contact form for: ${contactData.fullName}`, error);
      return {
        success: false,
        message: 'An error occurred. Please try again later.',
        timestamp: new Date().toISOString()
      };
    }
  }
}
