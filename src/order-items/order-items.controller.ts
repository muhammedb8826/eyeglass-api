import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { OrderItemsService } from './order-items.service';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';
import { GetCurrentUser } from 'src/decorators';
import { User } from 'src/entities/user.entity';

@Controller('order-items')
@RequirePermissions(Permissions.ORDER_ITEMS_READ)
export class OrderItemsController {
  constructor(private readonly orderItemsService: OrderItemsService) {}

  @Post()
  @RequirePermissions(Permissions.ORDER_ITEMS_WRITE)
  async create(@Body() createOrderItemDto: CreateOrderItemDto) {
    return this.orderItemsService.create(createOrderItemDto);
  }

  @Get('all')
  async findAllOrderItems(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('item') item?: string,
    @Query('status') status?: string,
  ) {
    const skip = (page - 1) * limit
    const take = limit
    return this.orderItemsService.findAllOrderItems(skip, take, search, startDate, endDate, item, status);
  }

  @Get(':orderId')
  async findAll(@Param('orderId') orderId: string) {
    return this.orderItemsService.findAll(orderId);
  }

  @Patch(':id')
  @RequireAnyPermissions(
    Permissions.ORDER_ITEMS_WRITE,
    Permissions.PRODUCTION_WRITE,
    Permissions.QUALITY_CONTROL_WRITE,
  )
  async update(
    @Param('id') id: string,
    @Body() updateOrderItemDto: UpdateOrderItemDto,
    @GetCurrentUser() user: User,
  ) {
    return this.orderItemsService.update(id, updateOrderItemDto, user);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.ORDER_ITEMS_WRITE)
  async remove(@Param('id') id: string) {
    return this.orderItemsService.remove(id);
  }
}
