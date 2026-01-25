import { PassThrough } from 'stream';
import { MediaEntity } from './model/media.model.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { StatusCodes } from 'http-status-codes';
import { StorageFactory } from '../../../storage/storage-factory.js';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import type { Express } from 'express';

const ffmpegBinaryPath = ffmpegInstaller?.path;
if (ffmpegBinaryPath) {
    ffmpeg.setFfmpegPath(ffmpegBinaryPath);
}

const MediaTypes = {
    IMAGE: 'image',
    VIDEO: 'video',
    DOCUMENT: 'document',
    AUDIO: 'audio',
} as const;

const SUPPORTED_MIME_TYPES = {
    [MediaTypes.IMAGE]: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'],
    [MediaTypes.VIDEO]: ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/avi', 'video/mpeg', 'video/3gpp', 'video/mov'],
    [MediaTypes.DOCUMENT]: ['application/pdf'],
    [MediaTypes.AUDIO]: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4'],
};

const VIDEO_INPUT_FORMATS: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/mov': 'mov',
    'video/x-matroska': 'matroska',
    'video/webm': 'webm',
    'video/avi': 'avi',
    'video/mpeg': 'mpeg',
    'video/3gpp': '3gp',
    'video/ogg': 'ogg',
};

export class MediaService {
    static storageService = StorageFactory.getStorage();

    static async processAndUpload(file: Express.Multer.File) {
        const mediaType = this.getMediaType(file.mimetype);

        if (!mediaType) {
            throw new HttpResponseError(
                StatusCodes.UNSUPPORTED_MEDIA_TYPE,
                'Unsupported file type'
            );
        }

        const processedFile = await this.processFile(file, mediaType);
        const key = `${Date.now()}-${file.originalname}`;

        // Upload main file
        await this.storageService.uploadFile(processedFile.buffer, key, file.mimetype);
        const url = this.storageService.getPublicUrl(key);

        let thumbnails = {} as Record<string, string>;
        if (mediaType === MediaTypes.VIDEO) {
            thumbnails = await this.generateThumbnails(file, key);
        }

        const media = new MediaEntity({
            key: key,
            url: url,
            contentType: file.mimetype,
            originalName: file.originalname,
            mediaType,
            size: file.size,
            thumbnails: thumbnails
        });

        await media.save();
        return media;
    }

    static async processAndUploadMany(files: Express.Multer.File[]) {
        return Promise.all(files.map((file) => this.processAndUpload(file)));
    }

    static async generateThumbnails(file: Express.Multer.File, baseKey: string) {
        const sizes = {
            small: 320,
            medium: 640,
            large: 1200
        };

        const thumbnails: Record<string, string> = {};

        let frameBuffer: Buffer;

        try {
            frameBuffer = await this.extractVideoFrame(file);
        } catch (error) {
            console.error('Failed to capture thumbnail frame for', file.originalname, error);
            return thumbnails;
        }

        await Promise.all(
            Object.entries(sizes).map(async ([size, width]) => {
                const key = `thumbnails/${size}/${baseKey}`;
                const buffer = await sharp(frameBuffer)
                    .resize(width)
                    .jpeg({ quality: 80 })
                    .toBuffer();

                await this.storageService.uploadFile(buffer, key, 'image/jpeg');
                thumbnails[size] = this.storageService.getPublicUrl(key);
            })
        );

        return thumbnails;
    }

    static async extractVideoFrame(file: Express.Multer.File): Promise<Buffer> {
        if (!file.buffer?.length) {
            throw new Error('Video buffer is empty');
        }

        return new Promise<Buffer>((resolve, reject) => {
            const inputStream = new PassThrough();
            inputStream.end(file.buffer);

            const command = ffmpeg(inputStream);
            const videoFormat = this.getVideoInputFormat(file.mimetype);
            if (videoFormat) {
                command.inputFormat(videoFormat);
            }

            const chunks: Buffer[] = [];
            const outputStream = new PassThrough();

            outputStream.on('data', (chunk) => chunks.push(chunk));
            outputStream.on('end', () => {
                if (!chunks.length) {
                    return reject(new Error('Failed to capture a video frame'));
                }

                resolve(Buffer.concat(chunks));
            });
            outputStream.on('error', reject);

            command
                .frames(1)
                .outputFormat('png')
                .on('error', reject)
                .pipe(outputStream, { end: true });
        });
    }

    static async getMedia(id) {
        const media = await MediaEntity.findByPk(id);
        if (!media) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Media not found');
        }

        const buffer = await this.storageService.downloadFile(media.key as string);
        return { ...(media.get ? media.get({ plain: true }) : media), buffer };
    }

    static async getMediaInfo(id) {
        const media = await MediaEntity.findByPk(id);
        if (!media) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Media not found');
        }

        return {
            id: media.id,
            url: media.url,
            contentType: media.contentType,
            mediaType: media.mediaType,
            size: media.size,
            createdAt: media.createdAt,
            thumbnails: media.thumbnails
        };
    }

    static getVideoInputFormat(mimetype?: string) {
        if (typeof mimetype !== 'string') {
            return undefined;
        }

        const normalized = mimetype.split(';')[0]?.toLowerCase().trim();
        if (!normalized) {
            return undefined;
        }

        return VIDEO_INPUT_FORMATS[normalized];
    }

    static getMediaType(mimetype) {
        if (typeof mimetype !== 'string') {
            return undefined;
        }

        const normalized = mimetype.split(';')[0]?.toLowerCase().trim();
        if (!normalized) {
            return undefined;
        }

        return Object.keys(SUPPORTED_MIME_TYPES).find((type) =>
            SUPPORTED_MIME_TYPES[type].includes(normalized)
        );
    }

    static async processFile(file, mediaType) {
        // Image processing
        if (mediaType === MediaTypes.IMAGE) {
            return this.processImage(file);
        }

        // Video processing (extract thumbnail, etc.)
        if (mediaType === MediaTypes.VIDEO) {
            return this.processVideo(file);
        }

        if (mediaType === MediaTypes.AUDIO) {
            return this.processAudio(file);
        }

        // Return document as-is
        return file;
    }

    static async processImage(file) {
        // Implementation for image resizing, optimization
        // Return processed file buffer + metadata
        return file;
    }

    static async processVideo(file) {
        // Implementation for video processing
        // Return processed file + thumbnail
        return file;
    }

    static async processAudio(file) {
        // Placeholder for future audio-specific processing (e.g. waveform extraction)
        return file;
    }
};