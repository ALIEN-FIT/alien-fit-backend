import { Op, fn, col } from 'sequelize';
import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { SubscriptionEntity } from '../../subscription/v1/entity/subscription.entity.js';
import { SubscriptionPaymentEntity } from '../../subscription/v1/entity/subscription-payment.entity.js';
import { SubscriptionPackageEntity } from '../../subscription-packages/v1/entity/subscription-package.entity.js';
import { DailyTrackingEntity } from '../../tracking/v1/entity/daily-tracking.entity.js';
import { PostEntity } from '../../post/v1/entity/post.entity.js';
import { Gender } from '../../../constants/gender.js';
import { Roles } from '../../../constants/roles.js';

// All "user" statistics below count clients only (role = user), so admins and
// trainers never inflate totals like notSubscribedUsers, gender, or online.
const CLIENT_ROLE = Roles.USER;

export class DashboardService {
    static async getAdminStats() {
        const totalUsers = await UserEntity.count({ where: { role: CLIENT_ROLE } });

        // Full role breakdown is kept for transparency (admins/trainers included here only).
        const usersByRoleRows = await UserEntity.findAll({
            attributes: ['role', [fn('COUNT', col('id')), 'count']],
            group: ['role'],
            raw: true,
        });

        const usersByRole = usersByRoleRows.reduce<Record<string, number>>((acc, row: any) => {
            acc[row.role] = Number(row.count ?? 0);
            return acc;
        }, {});

        const totalMale = await UserEntity.count({ where: { role: CLIENT_ROLE, gender: Gender.MALE } });
        const totalFemale = await UserEntity.count({ where: { role: CLIENT_ROLE, gender: Gender.FEMALE } });
        const totalOnline = await UserEntity.count({ where: { role: CLIENT_ROLE, isOnline: true } });

        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);

        const recentUsersRows = await UserEntity.findAll({
            attributes: [[fn('DATE', col('createdAt')), 'date'], [fn('COUNT', col('id')), 'count']],
            where: {
                role: CLIENT_ROLE,
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

        const now = new Date();

        const activeSubscriptions = await SubscriptionEntity.count({
            where: { isActive: true },
        });

        // "Ended" = the subscription period has elapsed (endDate in the past).
        // The previous definition (isSubscribed:true AND isActive:false) never
        // matched real data — ended subscriptions are stored as both flags false —
        // so it always returned 0.
        const endedSubscriptions = await SubscriptionEntity.count({
            where: {
                endDate: { [Op.ne]: null, [Op.lt]: now },
            },
        });

        const notSubscribedUsers = await UserEntity.count({
            include: [{ model: SubscriptionEntity, as: 'subscription', required: false, attributes: [] }],
            where: {
                role: CLIENT_ROLE,
                [Op.or]: [
                    { '$subscription.id$': null },
                    { '$subscription.isSubscribed$': false },
                ],
            },
            distinct: true,
        });

        // Active subscribers per plan: count the CURRENTLY active subscriptions
        // grouped by the package of each subscriber's most recent paid payment
        // (subscriptions have no packageId, so the link is via payments). This
        // reconciles with activeSubscriptions instead of counting raw payments.
        const purchasedSubscriptionByPlan = await this.getActiveSubscribersByPlan();

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

    private static async getActiveSubscribersByPlan(): Promise<Array<{ packageId: string | null; packageName: string | null; count: number }>> {
        const activeSubs = await SubscriptionEntity.findAll({
            where: { isActive: true },
            attributes: ['userId'],
            raw: true,
        });

        const activeUserIds = activeSubs.map((s: any) => s.userId).filter(Boolean) as string[];
        if (activeUserIds.length === 0) {
            return [];
        }

        // Latest paid payment per active user → its packageId.
        const payments = await SubscriptionPaymentEntity.findAll({
            where: { userId: { [Op.in]: activeUserIds }, status: 'paid' },
            attributes: ['userId', 'packageId', 'createdAt'],
            order: [['createdAt', 'DESC']],
            raw: true,
        });

        const latestPackageByUser = new Map<string, string | null>();
        for (const payment of payments as any[]) {
            if (!latestPackageByUser.has(payment.userId)) {
                latestPackageByUser.set(payment.userId, payment.packageId ?? null);
            }
        }

        // Count active users per package. Active users with no paid payment
        // (e.g. free subscriptions) fall under the null bucket so the totals
        // still reconcile with activeSubscriptions.
        const countByPackage = new Map<string | null, number>();
        for (const userId of activeUserIds) {
            const packageId = latestPackageByUser.get(userId) ?? null;
            countByPackage.set(packageId, (countByPackage.get(packageId) ?? 0) + 1);
        }

        const packageIds = [...countByPackage.keys()].filter((id): id is string => Boolean(id));
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

        return [...countByPackage.entries()].map(([packageId, count]) => ({
            packageId,
            packageName: packageId ? (packageNameMap.get(packageId) ?? null) : null,
            count,
        }));
    }
}
