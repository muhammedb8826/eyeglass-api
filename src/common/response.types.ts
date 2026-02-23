export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
  path?: string;
}

export interface SuccessResponse<T = any> extends ApiResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse extends ApiResponse {
  success: false;
  error: {
    code: string;
    details?: string;
    field?: string;
  };
}

export interface PaginatedResponse<T = any> extends SuccessResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Helper functions to create standardized responses
export class ResponseBuilder {
  static success<T>(data: T, message: string = 'Operation completed successfully'): SuccessResponse<T> {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  static error(
    message: string,
    code: string = 'INTERNAL_ERROR',
    details?: string,
    field?: string
  ): ErrorResponse {
    return {
      success: false,
      message,
      timestamp: new Date().toISOString(),
      error: {
        code,
        details,
        field,
      },
    };
  }

  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Data retrieved successfully'
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / limit);
    
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  static created<T>(data: T, message: string = 'Resource created successfully'): SuccessResponse<T> {
    return this.success(data, message);
  }

  static updated<T>(data: T, message: string = 'Resource updated successfully'): SuccessResponse<T> {
    return this.success(data, message);
  }

  static deleted(message: string = 'Resource deleted successfully'): SuccessResponse<null> {
    return this.success(null, message);
  }

  static notFound(resource: string = 'Resource'): ErrorResponse {
    return this.error(
      `${resource} not found`,
      'NOT_FOUND',
      `The requested ${resource.toLowerCase()} could not be found`
    );
  }

  static validationError(field: string, details: string): ErrorResponse {
    return this.error(
      'Validation failed',
      'VALIDATION_ERROR',
      details,
      field
    );
  }

  static unauthorized(message: string = 'Unauthorized access'): ErrorResponse {
    return this.error(message, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Access forbidden'): ErrorResponse {
    return this.error(message, 'FORBIDDEN');
  }

  static conflict(message: string, details?: string): ErrorResponse {
    return this.error(message, 'CONFLICT', details);
  }

  static badRequest(message: string, details?: string): ErrorResponse {
    return this.error(message, 'BAD_REQUEST', details);
  }

  static internalError(message: string = 'Internal server error'): ErrorResponse {
    return this.error(message, 'INTERNAL_ERROR');
  }
}

// Common error codes
export const ErrorCodes = {
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
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
