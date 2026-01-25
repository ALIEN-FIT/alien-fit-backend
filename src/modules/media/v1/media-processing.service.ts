import { MediaEntity } from './model/media.model.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { StatusCodes } from 'http-status-codes';
import { StorageFactory } from '../../../storage/storage-factory.js';
import sharp from 'sharp';
import type { Express } from 'express';


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

    static async generateThumbnails(file, baseKey) {
        const sizes = {
            small: 320,
            medium: 640,
            large: 1200
        };

        const thumbnails = {};

        await Promise.all(
            Object.entries(sizes).map(async ([size, width]) => {
                const key = `thumbnails/${size}/${baseKey}`;
                const buffer = await sharp(file.buffer)
                    .resize(width)
                    .jpeg({ quality: 80 })
                    .toBuffer();

                await this.storageService.uploadFile(buffer, key, 'image/jpeg');
                thumbnails[size] = this.storageService.getPublicUrl(key);
            })
        );

        return thumbnails;
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