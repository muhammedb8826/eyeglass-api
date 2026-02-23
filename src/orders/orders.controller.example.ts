import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ResponseBuilder, SuccessResponse, PaginatedResponse } from '../common';
import { ResponseInterceptor, PaginatedResponseInterceptor } from '../common';

// Example of how to refactor the OrdersController to use the new response types

@Controller('orders')
export class OrdersControllerExample {
  constructor(private readonly ordersService: OrdersService) { }

  // Method 1: Manual response formatting with custom messages
  @Post()
  async create(@Body() createOrderDto: CreateOrderDto): Promise<SuccessResponse<any>> {
    try {
      const order = await this.ordersService.create(createOrderDto);
      return ResponseBuilder.created(order, 'Order created successfully');
    } catch (error) {
      // Let the global exception filter handle the error formatting
      throw error;
    }
  }

  // Method 2: Using ResponseInterceptor for automatic formatting
  @Get(':id')
  @UseInterceptors(ResponseInterceptor)
  async findOne(@Param('id') id: string) {
    // Return raw data - the interceptor will format it automatically
    return this.ordersService.findOne(id);
  }

  // Method 3: Using PaginatedResponseInterceptor for paginated results
  @Get()
  @UseInterceptors(PaginatedResponseInterceptor)
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
    const skip = (page - 1) * limit;
    const take = limit;
    
    // Return raw data - the interceptor will format it with pagination
    return this.ordersService.findAll(skip, take, search, startDate, endDate, item1, item2, item3);
  }

  // Method 4: Manual pagination formatting for complex scenarios
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
  ): Promise<PaginatedResponse<any>> {
    const skip = (page - 1) * limit;
    const take = limit;
    
    const result = await this.ordersService.generateCompanyReport(
      skip, take, startDate, endDate, search, item1, item2, item3
    );
    
    // Manual formatting for custom pagination message
    return ResponseBuilder.paginated(
      result.reportData,
      page,
      limit,
      result.pagination.totalItems,
      'Company report generated successfully'
    );
  }

  // Method 5: Custom success messages for specific operations
  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateOrderDto: UpdateOrderDto
  ): Promise<SuccessResponse<any>> {
    const updatedOrder = await this.ordersService.update(id, updateOrderDto);
    return ResponseBuilder.updated(updatedOrder, `Order ${id} updated successfully`);
  }

  // Method 6: Delete operations with confirmation messages
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<SuccessResponse<null>> {
    await this.ordersService.remove(id);
    return ResponseBuilder.deleted(`Order ${id} deleted successfully`);
  }

  // Method 7: Business logic operations with custom messages
  @Get(':id/profit')
  async calculateProfit(@Param('id') id: string): Promise<SuccessResponse<any>> {
    const profit = await this.ordersService.calculateOrderProfit(id);
    return ResponseBuilder.success(profit, `Profit calculated for order ${id}`);
  }

  // Method 8: Filtered operations with automatic formatting
  @Get('profit/filtered')
  @UseInterceptors(ResponseInterceptor)
  async calculateFilteredProfit(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('item1') item1?: string,
    @Query('item2') item2?: string,
    @Query('item3') item3?: string,
  ) {
    // Return raw data - the interceptor will format it
    return this.ordersService.calculateFilteredOrdersProfit(
      startDate, endDate, search, item1, item2, item3
    );
  }
}

/*
KEY BENEFITS OF THIS APPROACH:

1. **Consistent Response Format**: All endpoints return the same structure
2. **Automatic Error Handling**: Global exception filter handles all errors
3. **Type Safety**: Full TypeScript support with proper return types
4. **Flexibility**: Choose between automatic and manual formatting
5. **Maintainability**: Centralized response logic and error handling
6. **Developer Experience**: Clear, predictable API responses

RESPONSE EXAMPLES:

Success Response:
{
  "success": true,
  "message": "Order created successfully",
  "data": { "id": "order-123", ... },
  "timestamp": "2025-01-09T01:54:46.123Z"
}

Error Response:
{
  "success": false,
  "message": "Order not found",
  "timestamp": "2025-01-09T01:54:46.123Z",
  "path": "/api/v1/orders/non-existent-id",
  "error": {
    "code": "NOT_FOUND",
    "details": "The requested order could not be found"
  }
}

Paginated Response:
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": [...],
  "timestamp": "2025-01-09T01:54:46.123Z",
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
*/
