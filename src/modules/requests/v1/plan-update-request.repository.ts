import { UserEntity } from '../../user/v1/entity/user.entity.js';
import { PlanUpdateRequestEntity } from './entity/plan-update-request.entity.js';

export class PlanUpdateRequestRepository {
    static create(data: Partial<PlanUpdateRequestEntity>) {
        return PlanUpdateRequestEntity.create(data);
    }

    static findPendingByUser(userId: string) {
        return PlanUpdateRequestEntity.findOne({
            where: {
                userId,
                status: 'pending',
            },
        });
    }

    static listAll({ status, limit, offset }: { status?: string; limit: number; offset: number }) {
        const where = status ? { status } : {};
        return PlanUpdateRequestEntity.findAndCountAll({
            where,
            include: [{ model: UserEntity, as: 'user' }],
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });
    }

    static findById(id: string) {
        return PlanUpdateRequestEntity.findByPk(id);
    }

    static async approve(id: string, adminId: string) {
        const request = await this.findById(id);
        if (!request) {
            return null;
        }
        await request.update({
            status: 'approved',
            approvedBy: adminId,
            approvedAt: new Date(),
        });
        return request;
    }

    static async reject(id: string, adminId: string, notes?: string) {
        const request = await this.findById(id);
        if (!request) {
            return null;
        }
        await request.update({
            status: 'rejected',
            approvedBy: adminId,
            approvedAt: new Date(),
            notes: notes ?? request.notes,
        });
        return request;
    }
}
