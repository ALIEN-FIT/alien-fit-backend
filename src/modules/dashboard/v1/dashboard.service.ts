import { Op, fn, col } from 'sequelize';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { SubscriptionEntity } from '../../subscription/v1/entity/subscription.entity.js';
import { SubscriptionPaymentEntity } from '../../subscription/v1/entity/subscription-payment.entity.js';
import { SubscriptionPackageEntity } from '../../subscription-packages/v1/entity/subscription-package.entity.js';
import { DailyTrackingEntity } from '../../tracking/v1/entity/daily-tracking.entity.js';
import { PostEntity } from '../../post/v1/entity/post.entity.js';
import { Gender } from '../../../constants/gender.js';

export class DashboardService {
    static async getAdminStats() {
        const totalUsers = await UserEntity.count();

        const usersByRoleRows = await UserEntity.findAll({
            attributes: ['role', [fn('COUNT', col('id')), 'count']],
            group: ['role'],
            raw: true,
        });

        const usersByRole = usersByRoleRows.reduce<Record<string, number>>((acc, row: any) => {
            acc[row.role] = Number(row.count ?? 0);
            return acc;
        }, {});

        const totalMale = await UserEntity.count({ where: { gender: Gender.MALE } });
        const totalFemale = await UserEntity.count({ where: { gender: Gender.FEMALE } });
        const totalOnline = await UserEntity.count({ where: { isOnline: true } });

        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);

        const recentUsersRows = await UserEntity.findAll({
            attributes: [[fn('DATE', col('createdAt')), 'date'], [fn('COUNT', col('id')), 'count']],
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            },
            group: [fn('DATE', col('createdAt'))],
            raw: true,
        });

        const recentUsersMap = new Map<string, number>();
        recentUsersRows.forEach((row: any) => {
            const rowDate = new Date(row.date);
            const key = `${rowDate.getMonth() + 1}/${rowDate.getDate()}`;
            recentUsersMap.set(key, Number(row.count ?? 0));
        });

        const newUsersLast7Days = Array.from({ length: 7 }).map((_, idx) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + idx);
            const key = `${date.getMonth() + 1}/${date.getDate()}`;
            return {
                date: key,
                count: recentUsersMap.get(key) ?? 0,
            };
        });

        const todayDateOnly = today.toISOString().split('T')[0];
        const todayTrainingUsers = await DailyTrackingEntity.count({
            where: {
                date: todayDateOnly,
                trainingDone: true,
            },
            distinct: true,
            col: 'userId',
        });

        const activeSubscriptions = await SubscriptionEntity.count({
            where: { isActive: true },
        });

        const endedSubscriptions = await SubscriptionEntity.count({
            where: { isSubscribed: true, isActive: false },
        });

        const notSubscribedUsers = await UserEntity.count({
            include: [{ model: SubscriptionEntity, as: 'subscription', required: false, attributes: [] }],
            where: {
                [Op.or]: [
                    { '$subscription.id$': null },
                    { '$subscription.isSubscribed$': false },
                ],
            },
            distinct: true,
        });

        const purchasedByPlanRows = await SubscriptionPaymentEntity.findAll({
            attributes: ['packageId', [fn('COUNT', col('id')), 'count']],
            where: { status: 'paid' },
            group: ['packageId'],
            raw: true,
        });

        const packageIds = purchasedByPlanRows.map((row: any) => row.packageId).filter(Boolean);
        const packageRows = packageIds.length
            ? await SubscriptionPackageEntity.findAll({
                attributes: ['id', 'name'],
                where: { id: { [Op.in]: packageIds } },
                raw: true,
            })
            : [];

        const packageNameMap = new Map<string, string>();
        packageRows.forEach((pkg: any) => {
            packageNameMap.set(pkg.id, pkg.name);
        });

        const purchasedSubscriptionByPlan = purchasedByPlanRows.map((row: any) => ({
            packageId: row.packageId,
            packageName: packageNameMap.get(row.packageId) ?? null,
            count: Number(row.count ?? 0),
        }));

        const totalPaidSubscriptionPayments = await SubscriptionPaymentEntity.count({
            where: { status: 'paid' },
        });

        const totalAmountByCurrencyRows = await SubscriptionPaymentEntity.findAll({
            attributes: ['currency', [fn('SUM', col('amount')), 'amount']],
            where: { status: 'paid' },
            group: ['currency'],
            raw: true,
        });

        const totalAmountByCurrency = totalAmountByCurrencyRows.map((row: any) => ({
            currency: row.currency,
            amount: Number(row.amount ?? 0),
        }));

        const totalPosts = await PostEntity.count();

        return {
            userStatistics: {
                totalUsers,
                totalByRole: usersByRole,
                totalMale,
                totalFemale,
                totalOnline,
                newUsersLast7Days,
                todayTrainingUsers,
                subscription: {
                    activeSubscriptions,
                    endedSubscriptions,
                    notSubscribedUsers,
                    purchasedSubscriptionByPlan,
                },
                subscriptionPayments: {
                    totalPaidCount: totalPaidSubscriptionPayments,
                    totalAmountByCurrency,
                },
            },
            totalPosts,
        };
    }
}
