import { PartialType } from '@nestjs/mapped-types';
import { CreateFilePathDto } from './create-file-path.dto';

export class UpdateFilePathDto extends PartialType(CreateFilePathDto) {}
