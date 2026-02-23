import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Public } from '../decorators/public.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Public()
  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Public()
  @Post('debug')
  async debugCreate(@Body() createOrderDto: CreateOrderDto) {
    try {
      console.log('Debug: Received order data:', JSON.stringify(createOrderDto, null, 2));
      const result = await this.ordersService.create(createOrderDto);
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
    @Query('item1') item1?: string,
    @Query('item2') item2?: string,
    @Query('item3') item3?: string,
  ) {
    const skip = (page - 1) * limit
    const take = limit
    return this.ordersService.findAll(skip, take, search, startDate, endDate, item1, item2, item3);
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
  async update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
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
