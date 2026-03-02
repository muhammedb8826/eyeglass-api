import { PartialType } from '@nestjs/mapped-types';
import { CreateItemBaseDto } from './create-item-base.dto';

export class UpdateItemBaseDto extends PartialType(CreateItemBaseDto) {}
