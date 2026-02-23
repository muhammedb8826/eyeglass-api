import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitCategoryService } from './unit-category.service';
import { UnitCategoryController } from './unit-category.controller';
import { UnitCategory } from 'src/entities/unit-category.entity';
import { Item } from 'src/entities/item.entity';


@Module({
  imports: [TypeOrmModule.forFeature([UnitCategory, Item])],
  controllers: [UnitCategoryController],
  providers: [UnitCategoryService],
  exports: [UnitCategoryService],
})
export class UnitCategoryModule {}
