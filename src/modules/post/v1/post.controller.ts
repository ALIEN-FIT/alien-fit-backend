import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PostService, PostCommentService } from './post.service.js';

export async function createPostController(req: Request, res: Response) {
    const post = await PostService.createPost(req.user!, req.body);
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { post },
    });
}

export async function getMyPostsController(req: Request, res: Response) {
    const { page, limit } = req.query;
    const data = await PostService.getMyPosts(req.user!, {
        page: Number(page),
        limit: Number(limit),
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data,
    });
}

export async function getUserPostsController(req: Request, res: Response) {
    const { page, limit } = req.query;
    const { userId } = req.params;

    const data = await PostService.getPostsByUser(userId, req.user ?? null, {
        page: Number(page),
        limit: Number(limit),
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data,
    });
}

export async function getPostController(req: Request, res: Response) {
    const { postId } = req.params;
    const post = await PostService.getPost(postId, req.user ?? null);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { post },
    });
}

export async function getFeedController(req: Request, res: Response) {
    const { page, limit } = req.query;
    const data = await PostService.getFeed(req.user!, {
        page: Number(page),
        limit: Number(limit),
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data,
    });
}

export async function searchPostsController(req: Request, res: Response) {
    const { page, limit } = req.query;

    const filters = {
        userId: toOptionalString(req.query.userId),
        username: toOptionalString(req.query.username),
        text: toOptionalString(req.query.text),
        scope: parseSearchScope(req.query.scope),
        createdAfter: parseDateFromQuery(req.query.createdAfter),
        createdBefore: parseDateFromQuery(req.query.createdBefore),
    };

    const data = await PostService.searchPosts(req.user!, filters, {
        page: Number(page),
        limit: Number(limit),
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data,
    });
}

export async function updatePostController(req: Request, res: Response) {
    const { postId } = req.params;
    const post = await PostService.updatePost(postId, req.user!, req.body);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { post },
    });
}

export async function deletePostController(req: Request, res: Response) {
    const { postId } = req.params;
    const result = await PostService.deletePost(postId, req.user!);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}

export async function reportPostController(req: Request, res: Response) {
    const { postId } = req.params;
    const report = await PostService.reportPost(postId, req.user!, req.body.reason ?? req.query.reason as string);
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { report },
    });
}

export async function togglePostLikeController(req: Request, res: Response) {
    const { postId } = req.params;
    const result = await PostService.toggleLike(postId, req.user!);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}

export async function getPostLikesController(req: Request, res: Response) {
    const { postId } = req.params;
    const { page, limit } = req.query;
    const data = await PostService.getPostLikes(postId, req.user!, {
        page: Number(page),
        limit: Number(limit),
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data,
    });
}

export async function toggleSavePostController(req: Request, res: Response) {
    const { postId } = req.params;
    const result = await PostService.toggleSave(postId, req.user!);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}

export async function getSavedPostsController(req: Request, res: Response) {
    const { page, limit } = req.query;
    const data = await PostService.getSavedPosts(req.user!, {
        page: Number(page),
        limit: Number(limit),
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data,
    });
}

export async function createCommentController(req: Request, res: Response) {
    const { postId } = req.params;
    const { content, mediaIds } = req.body;
    const comment = await PostCommentService.createComment(postId, req.user!, { content, mediaIds });
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { comment },
    });
}

export async function createCommentReplyController(req: Request, res: Response) {
    const { postId, commentId } = req.params;
    const { content, mediaIds } = req.body;
    const reply = await PostCommentService.createReply(postId, commentId, req.user!, { content, mediaIds });
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { comment: reply },
    });
}

export async function listCommentsController(req: Request, res: Response) {
    const { postId } = req.params;
    const { page, limit } = req.query;
    const data = await PostCommentService.listComments(postId, req.user!, {
        page: Number(page),
        limit: Number(limit),
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data,
    });
}

export async function updateCommentController(req: Request, res: Response) {
    const { commentId } = req.params;
    const { content, mediaIds } = req.body;
    const comment = await PostCommentService.updateComment(commentId, req.user!, { content, mediaIds });
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { comment },
    });
}

export async function deleteCommentController(req: Request, res: Response) {
    const { commentId } = req.params;
    const result = await PostCommentService.deleteComment(commentId, req.user!);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}

export async function toggleCommentLikeController(req: Request, res: Response) {
    const { commentId } = req.params;
    const result = await PostCommentService.toggleLike(commentId, req.user!);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}

export async function reportCommentController(req: Request, res: Response) {
    const { commentId } = req.params;
    const report = await PostCommentService.reportComment(commentId, req.user!, req.body.reason ?? req.query.reason as string);
    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { report },
    });
}

function toOptionalString(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && value.length > 0) {
        return value[0];
    }
    return undefined;
}

function parseDateFromQuery(value: unknown): Date | undefined {
    const stringValue = toOptionalString(value);
    if (!stringValue) {
        return undefined;
    }
    const parsed = new Date(stringValue);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseSearchScope(value: unknown): 'posts' | 'users' | 'both' | undefined {
    const scope = toOptionalString(value)?.toLowerCase();
    if (scope === 'posts' || scope === 'users' || scope === 'both') {
        return scope;
    }
    return undefined;
}
