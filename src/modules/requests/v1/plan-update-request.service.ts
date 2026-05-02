import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserService } from '../../user/v1/user.service.js';
import { PlanUpdateRequestRepository } from './plan-update-request.repository.js';
import { PlanUpdateRequestEntity } from './entity/plan-update-request.entity.js';
import { NotificationService } from '../../notification/v1/notification.service.js';
import { NotificationTypes } from '../../../constants/notification-type.js';
import { Roles } from '../../../constants/roles.js';

type RequestedPlanKind = 'workout-plan' | 'diet-plan';

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

    static async ensurePendingCycleCompletionRequest(
        userId: string,
        input: {
            dueDate: Date;
            requestedPlanKinds: RequestedPlanKind[];
        },
    ): Promise<{ request: PlanUpdateRequestEntity; created: boolean }> {
        const user = await UserService.getUserById(userId);
        if (user.role !== Roles.USER) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Plan update requests can only be created for users');
        }

        const requestedPlanKinds = [...new Set(input.requestedPlanKinds)]
            .filter((value): value is RequestedPlanKind => value === 'workout-plan' || value === 'diet-plan');

        if (requestedPlanKinds.length === 0) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'At least one requested plan kind is required');
        }

        const existingCycleRequest = await PlanUpdateRequestRepository.findLatestByUserAndType(userId, 'cycle-complete');
        if (existingCycleRequest && existingCycleRequest.createdAt.getTime() >= input.dueDate.getTime()) {
            return { request: existingCycleRequest, created: false };
        }

        const pending = await PlanUpdateRequestRepository.findPendingByUser(userId);
        if (pending) {
            return { request: pending, created: false };
        }

        const request = await PlanUpdateRequestRepository.create({
            userId,
            type: 'cycle-complete',
            payload: {
                reason: '30-day-cycle-complete',
                dueDate: input.dueDate.toISOString(),
                requestedPlanKinds,
            },
            notes: `User completed the 30-day cycle and needs an updated ${formatRequestedPlanKinds(requestedPlanKinds)}.`,
        });

        await NotificationService.notifyAdminsAndTrainers({
            type: NotificationTypes.GENERAL,
            title: '30-day cycle completed',
            body: `${user.name} (${user.provider}) completed the 30-day cycle and needs an updated ${formatRequestedPlanKinds(requestedPlanKinds)}.`,
            byUserId: user.id.toString(),
        });

        return { request, created: true };
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

function formatRequestedPlanKinds(requestedPlanKinds: RequestedPlanKind[]) {
    if (requestedPlanKinds.length === 2) {
        return 'workout plan and diet plan';
    }

    return requestedPlanKinds[0] === 'diet-plan' ? 'diet plan' : 'workout plan';
}
