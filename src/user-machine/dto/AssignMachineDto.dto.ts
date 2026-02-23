import { IsArray, IsString } from 'class-validator';

export class AssignMachineDto {
    @IsString()
    userId: string;

    @IsArray()
    @IsString({ each: true })
    machineId: string[];
}
