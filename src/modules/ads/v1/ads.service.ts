import { Op, Transaction } from 'sequelize';
import { StatusCodes } from 'http-status-codes';
import { sequelize } from '../../../database/db-config.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { AdEntity } from './entity/ad.entity.js';
import { AdViewEntity } from './entity/ad-view.entity.js';
import { MediaEntity } from '../../media/v1/model/media.model.js';

interface CreateAdPayload {
    imageId: string;
    appName: string;
    link?: string | null;
    promoCode?: string | null;
    discountAmount: number;
    discountType: string;
    startDate: string;
    endDate: string;
    priority?: number;
    isActive?: boolean;
}

interface UpdateAdPayload {
    adId: string;
    imageId?: string;
    appName?: string;
    link?: string | null;
    promoCode?: string | null;
    discountAmount?: number;
    discountType?: string;
    startDate?: string;
    endDate?: string;
    priority?: number;
    isActive?: boolean;
}

function normalizeNullableString(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return value as string;
}

export class AdsService {
    static async adminListAll(): Promise<AdEntity[]> {
        return AdEntity.findAll({
            order: [
                ['priority', 'DESC'],
                ['createdAt', 'DESC'],
            ],
            include: [{ model: MediaEntity, as: 'image' }],
        });
    }

    static async adminGetById(adId: string): Promise<AdEntity> {
        const ad = await AdEntity.findByPk(adId, {
            include: [{ model: MediaEntity, as: 'image' }],
        });
        if (!ad) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Ad not found');
        }
        return ad;
    }

    static async adminCreate(payload: CreateAdPayload): Promise<AdEntity> {
        const ad = await AdEntity.create({
            imageId: payload.imageId,
            appName: payload.appName,
            link: normalizeNullableString(payload.link),
            promoCode: normalizeNullableString(payload.promoCode),
            discountAmount: payload.discountAmount,
            discountType: payload.discountType,
            startDate: new Date(payload.startDate),
            endDate: new Date(payload.endDate),
            priority: payload.priority ?? 0,
            isActive: payload.isActive ?? true,
        } as any);

        return this.adminGetById(ad.id);
    }

    static async adminUpdate(payload: UpdateAdPayload): Promise<AdEntity> {
        const ad = await AdEntity.findByPk(payload.adId);
        if (!ad) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Ad not found');
        }

        const patch: any = {};
        if (payload.imageId !== undefined) patch.imageId = payload.imageId;
        if (payload.appName !== undefined) patch.appName = payload.appName;
        if (payload.link !== undefined) patch.link = normalizeNullableString(payload.link);
        if (payload.promoCode !== undefined) patch.promoCode = normalizeNullableString(payload.promoCode);
        if (payload.discountAmount !== undefined) patch.discountAmount = payload.discountAmount;
        if (payload.discountType !== undefined) patch.discountType = payload.discountType;
        if (payload.startDate !== undefined) patch.startDate = new Date(payload.startDate);
        if (payload.endDate !== undefined) patch.endDate = new Date(payload.endDate);
        if (payload.priority !== undefined) patch.priority = payload.priority;
        if (payload.isActive !== undefined) patch.isActive = payload.isActive;

        await ad.update(patch);
        return this.adminGetById(ad.id);
    }

    static async adminDelete(adId: string): Promise<void> {
        return sequelize.transaction(async (transaction) => {
            const ad = await AdEntity.findByPk(adId, { transaction });
            if (!ad) {
                throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Ad not found');
            }

            // Remove dependent ad view records first to satisfy FK constraints
            await AdViewEntity.destroy({ where: { adId }, transaction });

            await ad.destroy({ transaction });
        });
    }

    static async adminGetStats(adId: string) {
        const ad = await AdEntity.findByPk(adId);
        if (!ad) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Ad not found');
        }
        return {
            adId: ad.id,
            viewCount: ad.viewCount,
            uniqueViewersCount: ad.uniqueViewersCount,
            clickCount: ad.clickCount,
            promoCopyCount: ad.promoCopyCount,
        };
    }

    static async listActiveForUser(userId?: string): Promise<AdEntity[]> {
        const now = new Date();

        return sequelize.transaction(async (transaction: Transaction) => {
            const ads = await AdEntity.findAll({
                where: {
                    isActive: true,
                    startDate: { [Op.lte]: now },
                    endDate: { [Op.gte]: now },
                },
                order: [
                    ['priority', 'DESC'],
                    ['createdAt', 'DESC'],
                ],
                include: [{ model: MediaEntity, as: 'image' }],
                transaction,
            });

            if (ads.length === 0) {
                return [];
            }

            await Promise.all(
                ads.map((ad) =>
                    AdEntity.increment('viewCount', { by: 1, where: { id: ad.id }, transaction })
                )
            );

            if (userId) {
                for (const ad of ads) {
                    const [record, created] = await AdViewEntity.findOrCreate({
                        where: { adId: ad.id, userId },
                        defaults: { adId: ad.id, userId, firstSeenAt: now },
                        transaction,
                    });
                    void record;
                    if (created) {
                        await AdEntity.increment('uniqueViewersCount', { by: 1, where: { id: ad.id }, transaction });
                    }
                }
            }

            return ads;
        });
    }

    static async trackClick(adId: string): Promise<void> {
        const updated = await AdEntity.increment('clickCount', { by: 1, where: { id: adId } });
        void updated;
    }

    static async trackPromoCopy(adId: string): Promise<void> {
        const updated = await AdEntity.increment('promoCopyCount', { by: 1, where: { id: adId } });
        void updated;
    }
}
