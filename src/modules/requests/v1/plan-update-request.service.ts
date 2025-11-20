import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserService } from '../../user/v1/user.service.js';
import { PlanUpdateRequestRepository } from './plan-update-request.repository.js';
import { PlanUpdateRequestEntity } from './entity/plan-update-request.entity.js';

export class PlanUpdateRequestService {
    static async createOrUpdatePendingRequest(
        userId: string,
        type: string,
        payload: Record<string, unknown> | null,
        notes?: string,
    ): Promise<PlanUpdateRequestEntity> {
        await UserService.getUserById(userId);
        const pending = await PlanUpdateRequestRepository.findPendingByUser(userId);
        if (pending) {
            await pending.update({ payload, notes });
            return pending;
        }
        return PlanUpdateRequestRepository.create({
            userId,
            type,
            payload,
            notes: notes ?? null,
        });
    }

    static async createManualRequest(
        userId: string,
        payload: Record<string, unknown> | null,
        notes?: string,
    ): Promise<PlanUpdateRequestEntity> {
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
    ): Promise<PlanUpdateRequestEntity> {
        return this.createOrUpdatePendingRequest(userId, 'profile-update', profilePayload);
    }
}
