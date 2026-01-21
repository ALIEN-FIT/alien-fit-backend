import { StorageFactory } from '../../../storage/storage-factory.js';
import { AppVersionEntity } from './entity/app-version.entity.js';
import { v4 as uuidv4 } from 'uuid';
import { HttpResponseError } from '../../../utils/appError.js';
import { StatusCodes } from 'http-status-codes';

export class AppService {
    static async getLatestVersion(platform: string) {
        const record = await AppVersionEntity.findOne({ where: { platform } });
        if (!record) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'No version info for platform');
        }
        return record;
    }

    static async getApkDownloadUrl(platform: string) {
        const record = await AppVersionEntity.findOne({ where: { platform } });
        if (!record || !record.apkUrl) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'APK not found');
        }
        return record.apkUrl;
    }

    static async updateVersion(platform: string, payload: any) {
        let record = await AppVersionEntity.findOne({ where: { platform } });
        const values = {
            latestVersion: payload.latestVersion ?? record?.latestVersion,
            minAllowedVersion: payload.minAllowedVersion ?? record?.minAllowedVersion,
            isMandatory: payload.isMandatory ?? record?.isMandatory ?? false,
            releaseNotes: payload.releaseNotes ?? record?.releaseNotes ?? null,
            metadata: payload.metadata ?? record?.metadata ?? null,
        };

        if (record) {
            await record.update(values);
        } else {
            record = await AppVersionEntity.create({ platform, ...values } as any);
        }
        return record;
    }
}

export default AppService;
