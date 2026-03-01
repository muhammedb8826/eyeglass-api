import { PartialType } from '@nestjs/mapped-types';
import { CreateLabToolDto } from './create-lab-tool.dto';

export class UpdateLabToolDto extends PartialType(CreateLabToolDto) {}
