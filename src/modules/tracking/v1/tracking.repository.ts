import { DailyTrackingEntity } from './entity/daily-tracking.entity.js';

export class TrackingRepository {
    static findByUserAndDate(userId: string, date: Date) {
        const dateOnly = date.toISOString().split('T')[0];
        return DailyTrackingEntity.findOne({ where: { userId, date: dateOnly } });
    }

    static async findOrCreate(userId: string, date: Date) {
        const dateOnly = date.toISOString().split('T')[0];
        const [record] = await DailyTrackingEntity.findOrCreate({
            where: { userId, date: dateOnly },
            defaults: {
                userId,
                date: dateOnly,
            },
        });
        return record;
    }

    static async findByUserAndDates(userId: string, dates: Array<string>): Promise<DailyTrackingEntity[]> {
        if (!dates.length) {
            return [];
        }

        return DailyTrackingEntity.findAll({
            where: {
                userId,
                date: Array.from(new Set(dates)),
            },
        });
    }
}
