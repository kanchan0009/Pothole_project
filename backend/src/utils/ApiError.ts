
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly fields?: Record<string, string>;

  constructor(statusCode: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.fields = fields;
  }

  static badRequest(message: string, fields?: Record<string, string>): ApiError {
    return new ApiError(400, message, fields);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message);
  }

  static unprocessable(message: string): ApiError {
    return new ApiError(422, message);
  }
}
