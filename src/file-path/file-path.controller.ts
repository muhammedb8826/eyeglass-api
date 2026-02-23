import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { FilePathService } from './file-path.service';
import { CreateFilePathDto } from './dto/create-file-path.dto';
import { UpdateFilePathDto } from './dto/update-file-path.dto';

@Controller('file-path')
export class FilePathController {
  constructor(private readonly filePathService: FilePathService) {}

  @Post()
  create(@Body() createFilePathDto: CreateFilePathDto) {
    return this.filePathService.create(createFilePathDto);
  }

  @Get()
  findAll(@Query('page') page:number = 1, @Query('limit') limit: number = 10) {
    const skip = (page - 1) * limit
    const take = limit
    return this.filePathService.findAll(skip, take);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.filePathService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFilePathDto: UpdateFilePathDto) {
    return this.filePathService.update(id, updateFilePathDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.filePathService.remove(id);
  }
}
