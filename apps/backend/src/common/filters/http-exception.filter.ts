import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const respObj = exceptionResponse as Record<string, any>;
        if (Array.isArray(respObj.message)) {
          message = 'Validation failed';
          errors = respObj.message;
        } else {
          message = respObj.message || exception.message;
        }
        if (respObj.errors && Array.isArray(respObj.errors)) {
          errors = respObj.errors;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
      // Handle MongoDB duplicate key error code 11000 if not caught in service
      if ((exception as any).code === 11000) {
        status = HttpStatus.CONFLICT;
        message = 'A resource with this identifier already exists';
      }
    }

    const errorPayload = {
      statusCode: status,
      message,
      ...(errors && errors.length > 0 ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorPayload);
  }
}
