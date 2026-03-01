import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabTool } from 'src/entities/lab-tool.entity';
import { LabToolService } from './lab-tool.service';
import { LabToolController } from './lab-tool.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LabTool])],
  controllers: [LabToolController],
  providers: [LabToolService],
  exports: [LabToolService],
})
export class LabToolModule {}
