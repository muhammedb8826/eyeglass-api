import { PartialType } from '@nestjs/mapped-types';
import { CreateUnitCategoryDto } from './create-unit-category.dto';

export class UpdateUnitCategoryDto extends PartialType(CreateUnitCategoryDto) {}
