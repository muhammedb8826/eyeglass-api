import { IsNotEmpty, IsString } from "class-validator";

export class CreateSaleItemNoteDto {
    @IsNotEmpty()
    @IsString()
    text: string;
  
    @IsString()
    @IsNotEmpty()
    userId: string;
}
