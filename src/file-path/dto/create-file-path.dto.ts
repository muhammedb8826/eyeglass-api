import { IsNotEmpty, IsString } from "class-validator";

export class CreateFilePathDto {
    @IsString()
    @IsNotEmpty()
    filePath: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsString()
    @IsNotEmpty()
    fileType: string;
}
