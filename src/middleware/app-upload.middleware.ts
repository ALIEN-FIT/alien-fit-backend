import multer from 'multer';
import { HttpResponseError } from '../utils/appError.js';
import { StatusCodes } from 'http-status-codes';

const storage = multer.memoryStorage();

const APK_MIMETYPES = [
    'application/vnd.android.package-archive',
    'application/octet-stream',
    'application/vnd.android.raw+xml',
];

const fileFilter = (req, file, cb) => {
    if (APK_MIMETYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new HttpResponseError(StatusCodes.BAD_REQUEST,'Invalid file type - expected APK'), false);
    }
};

export default multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 200 * 1024 * 1024, // 200MB
        files: 1,
    },
});
