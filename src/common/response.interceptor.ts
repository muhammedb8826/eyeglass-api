import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseBuilder, SuccessResponse } from './response.types';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T>> {
    const request = context.switchToHttp().getRequest();
    
    return next.handle().pipe(
      map(data => {
        // If the response is already formatted, return it as is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Transform the response to use our standard format
        return ResponseBuilder.success(data, 'Operation completed successfully');
      }),
    );
  }
}

@Injectable()
export class PaginatedResponseInterceptor<T> implements NestInterceptor<T[], any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { page = 1, limit = 10 } = request.query;
    
    return next.handle().pipe(
      map((result: any) => {
        // If the response is already formatted, return it as is
        if (result && typeof result === 'object' && 'success' in result) {
          return result;
        }

        // Handle different response formats
        if (Array.isArray(result)) {
          // If it's just an array, assume it's paginated data
          return ResponseBuilder.paginated(result, parseInt(page), parseInt(limit), result.length);
        }

        if (result && result.data && Array.isArray(result.data) && result.total !== undefined) {
          // If it's already a paginated result object
          return ResponseBuilder.paginated(
            result.data,
            parseInt(page),
            parseInt(limit),
            result.total
          );
        }

        // Default case
        return ResponseBuilder.success(result);
      }),
    );
  }
}

// Decorator to apply the response interceptor to specific controllers or methods
export const UseResponseInterceptor = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      // Method decorator
      Reflect.defineMetadata('response_interceptor', true, descriptor.value);
    } else {
      // Class decorator
      Reflect.defineMetadata('response_interceptor', true, target);
    }
  };
};

// Decorator to apply the paginated response interceptor
export const UsePaginatedResponseInterceptor = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      // Method decorator
      Reflect.defineMetadata('paginated_response_interceptor', true, descriptor.value);
    } else {
      // Class decorator
      Reflect.defineMetadata('paginated_response_interceptor', true, target);
    }
  };
};
