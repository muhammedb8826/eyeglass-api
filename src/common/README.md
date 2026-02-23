# Standard Response Types and Interceptors

This module provides standardized response types and interceptors for consistent API responses across your NestJS application.

## Features

- **Standardized Response Format**: Consistent structure for all API responses
- **Type Safety**: Full TypeScript support with generic types
- **Automatic Formatting**: Interceptors that automatically format responses
- **Error Handling**: Comprehensive error response types and codes
- **Pagination Support**: Built-in pagination response format
- **Helper Methods**: Utility methods for common response scenarios

## Response Types

### Base Response Interface

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
  path?: string;
}
```

### Success Response

```typescript
interface SuccessResponse<T = any> extends ApiResponse<T> {
  success: true;
  data: T;
}
```

### Error Response

```typescript
interface ErrorResponse extends ApiResponse {
  success: false;
  error: {
    code: string;
    details?: string;
    field?: string;
  };
}
```

### Paginated Response

```typescript
interface PaginatedResponse<T = any> extends SuccessResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

## ResponseBuilder Class

The `ResponseBuilder` class provides static methods to create standardized responses.

### Success Responses

```typescript
// Basic success response
ResponseBuilder.success(data, 'Custom message');

// Specific success responses
ResponseBuilder.created(data, 'Resource created successfully');
ResponseBuilder.updated(data, 'Resource updated successfully');
ResponseBuilder.deleted('Resource deleted successfully');
```

### Error Responses

```typescript
// Common error responses
ResponseBuilder.notFound('User');
ResponseBuilder.validationError('email', 'Invalid email format');
ResponseBuilder.unauthorized('Invalid credentials');
ResponseBuilder.forbidden('Insufficient permissions');
ResponseBuilder.conflict('Email already exists', 'Duplicate email detected');
ResponseBuilder.badRequest('Invalid input', 'Missing required fields');
ResponseBuilder.internalError('Database connection failed');
```

### Paginated Responses

```typescript
ResponseBuilder.paginated(data, page, limit, total, 'Custom message');
```

## Interceptors

### ResponseInterceptor

Automatically formats single-item responses.

```typescript
@UseInterceptors(ResponseInterceptor)
async getUser(id: string) {
  return this.userService.findById(id); // Raw data
  // Automatically formatted to: { success: true, message: "...", data: {...}, timestamp: "..." }
}
```

### PaginatedResponseInterceptor

Automatically formats paginated responses.

```typescript
@UseInterceptors(PaginatedResponseInterceptor)
async getUsers(page: number, limit: number) {
  return this.userService.findAll(page, limit); // Raw data with pagination
  // Automatically formatted to include pagination metadata
}
```

## Error Codes

Predefined error codes for consistent error handling:

```typescript
const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};
```

## Usage Examples

### Controller with Manual Response Formatting

```typescript
@Controller('users')
export class UserController {
  @Post()
  async createUser(@Body() dto: CreateUserDto): Promise<SuccessResponse<User>> {
    const user = await this.userService.create(dto);
    return ResponseBuilder.created(user, 'User created successfully');
  }

  @Get(':id')
  async getUser(@Param('id') id: string): Promise<SuccessResponse<User>> {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return ResponseBuilder.success(user, 'User retrieved successfully');
  }
}
```

### Controller with Automatic Response Formatting

```typescript
@Controller('users')
export class UserController {
  @Get()
  @UseInterceptors(PaginatedResponseInterceptor)
  async getUsers(@Query('page') page: number, @Query('limit') limit: number) {
    // Return raw data - interceptor handles formatting
    return this.userService.findAll(page, limit);
  }

  @Get(':id')
  @UseInterceptors(ResponseInterceptor)
  async getUser(@Param('id') id: string) {
    // Return raw data - interceptor handles formatting
    return this.userService.findById(id);
  }
}
```

### Service with Response Handling

```typescript
@Injectable()
export class UserService {
  async createUser(dto: CreateUserDto) {
    try {
      const user = await this.repository.save(dto);
      return ResponseBuilder.created(user, 'User created successfully');
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return ResponseBuilder.conflict(
          'User with this email already exists',
          'Duplicate email address detected'
        );
      }
      throw error; // Let the exception filter handle it
    }
  }
}
```

## Global Exception Filter

The `GlobalExceptionFilter` automatically formats all exceptions to use the standard error response format. It handles:

- HTTP exceptions (BadRequest, NotFound, etc.)
- Validation errors
- Database errors
- Custom exceptions
- Unhandled errors

## Migration Guide

### From Old Response Format

**Before:**
```typescript
return {
  statusCode: 200,
  data: user,
  message: 'User created'
};
```

**After:**
```typescript
return ResponseBuilder.created(user, 'User created successfully');
```

### From Old Error Handling

**Before:**
```typescript
throw new BadRequestException('Invalid input');
```

**After:**
```typescript
// Still works the same way, but now automatically formatted
throw new BadRequestException('Invalid input');

// Or use ResponseBuilder for more control
return ResponseBuilder.badRequest('Invalid input', 'Missing required fields');
```

## Best Practices

1. **Use Interceptors**: For automatic response formatting in most cases
2. **Manual Formatting**: For custom messages or complex scenarios
3. **Consistent Error Codes**: Use predefined error codes for consistency
4. **Exception Filter**: Let the global exception filter handle most errors
5. **Type Safety**: Always specify return types for better TypeScript support

## Configuration

The response types and interceptors are automatically available when you import from the common module:

```typescript
import { ResponseBuilder, ResponseInterceptor, PaginatedResponseInterceptor } from '../common';
```

## Testing

When testing controllers that use these response types:

```typescript
describe('UserController', () => {
  it('should return formatted success response', async () => {
    const result = await controller.createUser(dto);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.timestamp).toBeDefined();
    expect(result.message).toBe('User created successfully');
  });
});
```
