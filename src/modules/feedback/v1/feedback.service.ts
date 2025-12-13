import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { SupportTicketStatus } from '../../../constants/support-ticket-status.js';
import { FeedbackEntity, FeedbackStatus, FeedbackType } from './feedback.entity.js';
import { FeedbackRepository } from './feedback.repository.js';
import { UserEntity } from '../../user/v1/entity/user.entity.js';

interface CreateFeedbackPayload {
    type: FeedbackType;
    body: string;
    guestName?: string | null;
    guestPhone?: string | null;
}

interface PaginationInput {
    page?: number;
    limit?: number;
    status?: FeedbackStatus;
    type?: FeedbackType;
    search?: string;
    fromDate?: Date;
    toDate?: Date;
    userId?: string;
}

export class FeedbackService {
    static async createFeedback(payload: CreateFeedbackPayload, user: UserEntity | null) {
        if (!user && (!payload.guestName || !payload.guestPhone)) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Name and phone number are required for guests');
        }

        const feedback = await FeedbackRepository.create({
            userId: user ? user.id : null,
            guestName: user ? null : payload.guestName?.trim() ?? null,
            guestPhone: user ? null : payload.guestPhone?.trim() ?? null,
            type: payload.type,
            body: payload.body,
            status: SupportTicketStatus.OPEN,
            adminReply: null,
            repliedBy: null,
            repliedAt: null,
        });

        return feedback;
    }

    static async listUserFeedback(userId: string, filters: PaginationInput) {
        const { page, limit, offset } = normalizePagination(filters.page, filters.limit);
        const { rows, count } = await FeedbackRepository.listByUser(
            userId,
            {
                status: filters.status,
                type: filters.type,
            },
            { limit, offset }
        );

        return buildPaginated(rows, count, page, limit);
    }

    static async searchAsAdmin(filters: PaginationInput) {
        const { page, limit, offset } = normalizePagination(filters.page, filters.limit);
        const search = typeof filters.search === 'string' ? filters.search.trim() : undefined;
        const { rows, count } = await FeedbackRepository.searchForAdmin(
            {
                status: filters.status,
                type: filters.type,
                search,
                userId: filters.userId,
                fromDate: filters.fromDate,
                toDate: filters.toDate,
            },
            { limit, offset }
        );

        return buildPaginated(rows, count, page, limit);
    }

    static async respondToFeedback(
        feedbackId: string,
        adminId: string,
        updates: { status?: FeedbackStatus; reply?: string }
    ) {
        const feedback = await FeedbackRepository.findById(feedbackId);
        if (!feedback) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Feedback not found');
        }

        const dataToUpdate: Partial<FeedbackEntity> = {};
        if (updates.status) {
            dataToUpdate.status = updates.status;
        }
        if (typeof updates.reply === 'string') {
            dataToUpdate.adminReply = updates.reply;
            dataToUpdate.repliedBy = adminId;
            dataToUpdate.repliedAt = new Date();
        }

        await feedback.update(dataToUpdate);
        return feedback;
    }
}

function normalizePagination(page?: number, limit?: number) {
    const normalizedPage = Number.isFinite(page) ? Math.max(Math.floor(page!), 1) : 1;
    const normalizedLimit = Number.isFinite(limit) ? Math.max(Math.floor(limit!), 1) : 20;
    const safeLimit = Math.min(normalizedLimit, 100);
    const offset = (normalizedPage - 1) * safeLimit;
    return { page: normalizedPage, limit: safeLimit, offset };
}

function buildPaginated<T>(items: T[], total: number, page: number, limit: number) {
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return {
        items,
        meta: {
            total,
            page,
            limit,
            totalPages,
        },
    };
}
