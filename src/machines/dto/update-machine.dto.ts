import { PartialType } from '@nestjs/mapped-types';
import { CreateMachineDto } from './create-machine.dto';

export class UpdateMachineDto extends PartialType(CreateMachineDto) {
    name?: string;
    description?: string;
    status?: boolean;
}
