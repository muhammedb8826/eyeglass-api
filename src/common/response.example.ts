import { Controller, Get, Post, Body, Param, Query, UseInterceptors } from '@nestjs/common';
import { ResponseBuilder, SuccessResponse } from './response.types';
import { ResponseInterceptor, PaginatedResponseInterceptor } from './response.interceptor';

// Example DTO
class CreateUserDto {
  name: string;
  email: string;
}

class User {
  id: string;
  name: string;
  email: string;
}

// Example service
class UserService {
  async createUser(dto: CreateUserDto): Promise<User> {
    // Simulate user creation
    const user = {
      id: 'user-123',
      name: dto.name,
      email: dto.email,
    };
    return user;
  }

  async getUsers(page: number = 1, limit: number = 10): Promise<{ data: User[]; total: number }> {
    // Simulate paginated users
    const users = Array.from({ length: limit }, (_, i) => ({
      id: `user-${page * limit + i}`,
      name: `User ${page * limit + i}`,
      email: `user${page * limit + i}@example.com`,
    }));
    
    return {
      data: users,
      total: 100, // Total users in database
    };
  }

  async getUserById(id: string): Promise<User> {
    // Simulate user retrieval
    return {
      id,
      name: 'John Doe',
      email: 'john@example.com',
    };
  }
}

// Example controller using the new response types
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Method 1: Using ResponseBuilder directly in the controller
  @Post()
  async createUser(@Body() dto: CreateUserDto): Promise<SuccessResponse<User>> {
    try {
      const user = await this.userService.createUser(dto);
      return ResponseBuilder.created(user, 'User created successfully');
    } catch (error) {
      // This will be caught by the GlobalExceptionFilter and formatted automatically
      throw error;
    }
  }

  // Method 2: Using the ResponseInterceptor to automatically format responses
  @Get()
  @UseInterceptors(PaginatedResponseInterceptor)
  async getUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    // Return raw data - the interceptor will format it
    return this.userService.getUsers(page, limit);
  }

  // Method 3: Using ResponseBuilder for custom success messages
  @Get(':id')
  @UseInterceptors(ResponseInterceptor)
  async getUserById(@Param('id') id: string) {
    // Return raw data - the interceptor will format it
    return this.userService.getUserById(id);
  }

  // Method 4: Manual response formatting for complex scenarios
  @Get('custom/:id')
  async getCustomUser(@Param('id') id: string): Promise<SuccessResponse<User>> {
    const user = await this.userService.getUserById(id);
    
    // Custom formatting with specific message
    return ResponseBuilder.success(user, `User ${id} retrieved successfully`);
  }
}

// Example of how to use in services
class OrderService {
  async createOrder(orderData: any) {
    try {
      // Your business logic here
      const order = { id: 'order-123', ...orderData };
      
      // Return success response
      return ResponseBuilder.created(order, 'Order created successfully');
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        // Return error response
        return ResponseBuilder.conflict(
          'Order with this reference already exists',
          'Duplicate order reference detected'
        );
      }
      
      // Re-throw to be handled by the exception filter
      throw error;
    }
  }

  async getOrders(page: number, limit: number) {
    try {
      // Your business logic here
      const orders = []; // Your orders data
      const total = 0; // Total count
      
      // Return paginated response
      return ResponseBuilder.paginated(orders, page, limit, total, 'Orders retrieved successfully');
    } catch (error) {
      throw error;
    }
  }
}

// Example of error handling in controllers
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body() orderData: any) {
    // The service can return either success or error responses
    const result = await this.orderService.createOrder(orderData);
    
    // Check if it's an error response
    if (!result.success) {
      // Handle error response
      return result; // This will be sent as-is
    }
    
    // Handle success response
    return result;
  }

  @Get()
  async getOrders(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    return this.orderService.getOrders(page, limit);
  }
}

/*
USAGE EXAMPLES:

1. Basic Success Response:
   ResponseBuilder.success(data, 'Custom message')

2. Specific Success Responses:
   ResponseBuilder.created(data, 'Resource created')
   ResponseBuilder.updated(data, 'Resource updated')
   ResponseBuilder.deleted('Resource deleted')

3. Error Responses:
   ResponseBuilder.notFound('User')
   ResponseBuilder.validationError('email', 'Invalid email format')
   ResponseBuilder.unauthorized('Invalid credentials')
   ResponseBuilder.forbidden('Insufficient permissions')
   ResponseBuilder.conflict('Email already exists', 'Duplicate email detected')
   ResponseBuilder.badRequest('Invalid input', 'Missing required fields')
   ResponseBuilder.internalError('Database connection failed')

4. Paginated Responses:
   ResponseBuilder.paginated(data, page, limit, total, 'Custom message')

5. Using Interceptors:
   @UseInterceptors(ResponseInterceptor) - for single items
   @UseInterceptors(PaginatedResponseInterceptor) - for paginated lists

6. Automatic Error Handling:
   Just throw exceptions - the GlobalExceptionFilter will format them automatically
*/
