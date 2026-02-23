import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ResponseBuilder, ErrorCodes } from './response.types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      // Handle different types of HTTP exceptions
      switch (status) {
        case HttpStatus.BAD_REQUEST:
          errorResponse = ResponseBuilder.badRequest(
            this.getErrorMessage(exceptionResponse),
            this.getErrorDetails(exceptionResponse)
          );
          break;
        
        case HttpStatus.UNAUTHORIZED:
          errorResponse = ResponseBuilder.unauthorized(
            this.getErrorMessage(exceptionResponse)
          );
          break;
        
        case HttpStatus.FORBIDDEN:
          errorResponse = ResponseBuilder.forbidden(
            this.getErrorMessage(exceptionResponse)
          );
          break;
        
        case HttpStatus.NOT_FOUND:
          errorResponse = ResponseBuilder.notFound(
            this.getErrorMessage(exceptionResponse)
          );
          break;
        
        case HttpStatus.CONFLICT:
          errorResponse = ResponseBuilder.conflict(
            this.getErrorMessage(exceptionResponse),
            this.getErrorDetails(exceptionResponse)
          );
          break;
        
        case HttpStatus.UNPROCESSABLE_ENTITY:
          errorResponse = ResponseBuilder.validationError(
            this.getErrorField(exceptionResponse),
            this.getErrorMessage(exceptionResponse)
          );
          break;
        
        default:
          errorResponse = ResponseBuilder.error(
            this.getErrorMessage(exceptionResponse),
            this.getHttpStatusToErrorCode(status)
          );
      }
    } else {
      // Handle non-HTTP exceptions
      const error = exception as Error;
      this.logger.error(`Unhandled exception: ${error.message}`, error.stack);
      
      errorResponse = ResponseBuilder.internalError(
        process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message
      );
    }

    // Add path information to the error response
    errorResponse.path = request.url;

    // Log the error
    this.logger.error(
      `Exception occurred: ${errorResponse.message}`,
      {
        statusCode: status,
        path: request.url,
        method: request.method,
        timestamp: errorResponse.timestamp,
        errorCode: errorResponse.error?.code,
      }
    );

    response.status(status).json(errorResponse);
  }

  private getErrorMessage(exceptionResponse: any): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }
    
    if (exceptionResponse && typeof exceptionResponse === 'object') {
      return exceptionResponse.message || exceptionResponse.error || 'An error occurred';
    }
    
    return 'An error occurred';
  }

  private getErrorDetails(exceptionResponse: any): string | undefined {
    if (exceptionResponse && typeof exceptionResponse === 'object') {
      return exceptionResponse.details || exceptionResponse.error || undefined;
    }
    return undefined;
  }

  private getErrorField(exceptionResponse: any): string {
    if (exceptionResponse && typeof exceptionResponse === 'object') {
      return exceptionResponse.field || 'unknown';
    }
    return 'unknown';
  }

  private getHttpStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCodes.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCodes.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCodes.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCodes.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCodes.CONFLICT;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCodes.VALIDATION_ERROR;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCodes.RATE_LIMIT_EXCEEDED;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ErrorCodes.SERVICE_UNAVAILABLE;
      default:
        return ErrorCodes.INTERNAL_ERROR;
    }
  }
}
