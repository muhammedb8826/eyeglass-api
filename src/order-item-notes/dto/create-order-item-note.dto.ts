import { IsNotEmpty, IsString } from "class-validator";

export class CreateOrderItemNoteDto {
    @IsNotEmpty()
  @IsString()
  text: string;

  userId: string;
}
