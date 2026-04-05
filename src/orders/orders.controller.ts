import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Public } from '../decorators/public.decorator';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { Permissions } from 'src/permissions/permission.constants';
import { User } from 'src/entities/user.entity';

@Controller('orders')
@RequirePermissions(Permissions.ORDERS_READ)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Public()
  @Post()
  create(
    @Body() createOrderDto: CreateOrderDto,
    @Req() req: Request,
  ) {
    return this.ordersService.create(
      createOrderDto,
      req.user as User | undefined,
    );
  }

  @Public()
  @Post('debug')
  async debugCreate(
    @Body() createOrderDto: CreateOrderDto,
    @Req() req: Request,
  ) {
    try {
      console.log('Debug: Received order data:', JSON.stringify(createOrderDto, null, 2));
      const result = await this.ordersService.create(
        createOrderDto,
        req.user as User | undefined,
      );
      console.log('Debug: Order created successfully:', result.id);
      return result;
    } catch (error) {
      console.error('Debug: Error creating order:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        sqlMessage: error.sqlMessage
      });
      throw error;
    }
  }

  @Get()
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('datePreset') datePreset?: string,
    @Query('dateField') dateField?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('customerId') customerId?: string,
    @Query('minGrandTotal') minGrandTotal?: string,
    @Query('maxGrandTotal') maxGrandTotal?: string,
    @Query('item1') item1?: string,
    @Query('item2') item2?: string,
    @Query('item3') item3?: string,
  ) {
    const skip = (page - 1) * limit;
    const take = limit;
    return this.ordersService.findAll(skip, take, {
      search,
      startDate,
      endDate,
      datePreset,
      dateField,
      status,
      sortBy,
      sortOrder,
      customerId,
      minGrandTotal,
      maxGrandTotal,
      item1,
      item2,
      item3,
    });
  }

  @Public()
  @Get('all')
  async findAllOrders() {
    return this.ordersService.findAllOrders();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.ORDERS_WRITE)
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @Req() req: Request,
  ) {
    return this.ordersService.update(
      id,
      updateOrderDto,
      req.user as User,
    );
  }

  @Delete(':id')
  @RequirePermissions(Permissions.ORDERS_WRITE)
  async remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }

  @Get(':id/profit')
  async calculateProfit(@Param('id') id: string) {
    return this.ordersService.calculateOrderProfit(id);
  }

  @Get('profit/filtered')
  async calculateFilteredProfit(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('item1') item1?: string,
    @Query('item2') item2?: string,
    @Query('item3') item3?: string,
  ) {
    return this.ordersService.calculateFilteredOrdersProfit(
      startDate,
      endDate,
      search,
      item1,
      item2,
      item3
    );
  }

  @Get('report/company')
  async generateCompanyReport(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('item1') item1?: string,
    @Query('item2') item2?: string,
    @Query('item3') item3?: string,
  ) {
    const skip = (page - 1) * limit
    const take = limit
    return this.ordersService.generateCompanyReport(
      skip,
      take,
      startDate,
      endDate,
      search,
      item1,
      item2,
      item3
    );
  }
}
