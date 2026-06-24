import { StatusCodes } from 'http-status-codes';
import { errorLogger } from '../config/logger.config.js';
import { HttpResponseError } from '../utils/appError.js';
import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(err: Error | HttpResponseError, req: Request, res: Response, next: NextFunction) {

    if (err instanceof HttpResponseError) {
        return res.status(err.statusCode).json({
            message: req.__(err.message),
            statusCode: err.statusCode,
            status: err.status,
        });
    }

    // Multer upload errors (file too large, too many files, unexpected field).
    if (err.name === 'MulterError') {
        const code = (err as { code?: string }).code;
        const maxMb = process.env.MEDIA_MAX_FILE_SIZE_MB || '200';
        const maxFiles = process.env.MEDIA_MAX_FILES || '10';

        let statusCode: number = StatusCodes.BAD_REQUEST;
        let message = err.message;

        if (code === 'LIMIT_FILE_SIZE') {
            statusCode = StatusCodes.REQUEST_TOO_LONG; // 413
            message = `File too large. Maximum ${maxMb} MB per file.`;
        } else if (code === 'LIMIT_FILE_COUNT' || code === 'LIMIT_UNEXPECTED_FILE') {
            message = `Too many files. Maximum ${maxFiles} files per upload.`;
        }

        return res.status(statusCode).json({ message, statusCode, status: 'error' });
    }

    errorLogger.error(err.stack + " || " + err.message + " || " + err.name + "||" +  (req.user ? ` || User ID: ${req.user.id}` : ' ||  Unauthenticated') + ` || ${req.method} ${req.originalUrl}` ) ;

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: req.__('internal_server_error'),
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        status: 'error'
    });
}