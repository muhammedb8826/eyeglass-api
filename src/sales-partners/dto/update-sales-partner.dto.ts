import { PartialType } from '@nestjs/mapped-types';
import { CreateSalesPartnerDto } from './create-sales-partner.dto';

export class UpdateSalesPartnerDto extends PartialType(CreateSalesPartnerDto) {}
