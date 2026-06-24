import multer from 'multer';
import { MediaService } from '../modules/media/v1/media-processing.service.js';
import { HttpResponseError } from '../utils/appError.js';
import { StatusCodes } from 'http-status-codes';

const storage = multer.memoryStorage();

// Per-file size and count limits, configurable via env.
// IMPORTANT: nginx `client_max_body_size` (whole request) must be >= MAX_FILE_SIZE_MB,
// and ideally >= MAX_FILE_SIZE_MB * a few, otherwise nginx drops large multi-file
// uploads before they reach Node (seen on the client as a connection error / no response).
const MAX_FILE_SIZE_MB = Number(process.env.MEDIA_MAX_FILE_SIZE_MB) || 200;
const MAX_FILES = Number(process.env.MEDIA_MAX_FILES) || 10;

const fileFilter = (req, file, cb) => {
    if (MediaService.getMediaType(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new HttpResponseError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Invalid file type'), false);
    }
};

export default multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
        files: MAX_FILES,
    },
});
