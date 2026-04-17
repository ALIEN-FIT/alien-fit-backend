import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserService } from '../../user/v1/user.service.js';
import { PlanUpdateRequestRepository } from './plan-update-request.repository.js';
import { PlanUpdateRequestEntity } from './entity/plan-update-request.entity.js';
import { NotificationService } from '../../notification/v1/notification.service.js';
import { NotificationTypes } from '../../../constants/notification-type.js';
import { Roles } from '../../../constants/roles.js';

export class PlanUpdateRequestService {
    private static async notifyAdminsAboutPendingRequest(userId: string, created: boolean) {
        const user = await UserService.getUserById(userId);
        if (user.role !== Roles.USER) {
            return;
        }

        await NotificationService.notifyAdminsAndTrainers({
            type: NotificationTypes.GENERAL,
            title: created ? 'Plan update request' : 'Plan update request updated',
            body: created
                ? `${user.name} (${user.provider}) requested a plan update.`
                : `${user.name} (${user.provider}) updated a pending plan update request.`,
            byUserId: user.id.toString(),
        });
    }

    static async createOrUpdatePendingRequest(
        userId: string,
        type: string,
        payload: Record<string, unknown> | null,
        notes?: string,
    ): Promise<{ request: PlanUpdateRequestEntity; created: boolean }> {
        const pending = await PlanUpdateRequestRepository.findPendingByUser(userId);
        if (pending) {
            await pending.update({ payload, notes });
            await this.notifyAdminsAboutPendingRequest(userId, false);
            return { request: pending, created: false };
        }
        const request = await PlanUpdateRequestRepository.create({
            userId,
            type,
            payload,
            notes: notes ?? null,
        });

        await this.notifyAdminsAboutPendingRequest(userId, true);

        return { request, created: true };
    }

    static async createManualRequest(
        userId: string,
        payload: Record<string, unknown> | null,
        notes?: string,
    ): Promise<{ request: PlanUpdateRequestEntity; created: boolean }> {
        return this.createOrUpdatePendingRequest(userId, 'manual', payload, notes);
    }

    static async listRequests(status: string | undefined, page: number, limit: number) {
        const normalizedLimit = Number.isFinite(limit) ? Math.floor(limit) : 20;
        const normalizedPage = Number.isFinite(page) ? Math.floor(page) : 1;
        const safeLimit = Math.min(Math.max(normalizedLimit, 1), 100);
        const safePage = Math.max(normalizedPage, 1);
        const offset = (safePage - 1) * safeLimit;
        const { rows, count } = await PlanUpdateRequestRepository.listAll({ status, limit: safeLimit, offset });

        const totalPages = count === 0 ? 0 : Math.ceil(count / safeLimit);

        return {
            requests: rows,
            meta: {
                total: count,
                page: safePage,
                limit: safeLimit,
                totalPages,
            },
        };
    }

    static async approveRequest(requestId: string, adminId: string): Promise<PlanUpdateRequestEntity> {
        const request = await PlanUpdateRequestRepository.approve(requestId, adminId);
        if (!request) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Request not found');
        }
        return request;
    }

    static async ensurePendingProfileUpdateRequest(
        userId: string,
        profilePayload: Record<string, unknown> | null,
    ): Promise<{ request: PlanUpdateRequestEntity; created: boolean }> {
        return this.createOrUpdatePendingRequest(userId, 'profile-update', profilePayload);
    }
}
