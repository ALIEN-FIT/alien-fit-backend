import express from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { Roles } from '../../../constants/roles.js';
import {
    getMyChatController,
    getMyMessagesController,
    sendMessageAsUserController,
    listChatsController,
    getMessagesForUserController,
    sendMessageAsTrainerController,
    getOnlineUsersCountController,
    getUserPresenceController,
    markUserMessagesReadController,
    markMyTrainerMessagesReadController,
    updateMyMessageController,
    deleteMyMessageController,
    updateUserMessageController,
    deleteUserMessageController,
} from './chat.controller.js';
import {
    paginationSchema,
    listChatsSchema,
    sendUserMessageSchema,
    trainerGetMessagesSchema,
    trainerSendMessageWithParamsSchema,
    trainerMessageParamsSchema,
    userUpdateMessageSchema,
    userDeleteMessageSchema,
    adminUpdateMessageSchema,
    adminDeleteMessageSchema,
} from './chat.validation.js';

export const chatRouterV1 = express.Router();

chatRouterV1.use(auth);

chatRouterV1.get('/me', getMyChatController);
chatRouterV1.get('/me/messages', validateRequest(paginationSchema), getMyMessagesController);
chatRouterV1.post('/me/messages', validateRequest(sendUserMessageSchema), sendMessageAsUserController);
chatRouterV1.patch('/me/messages/:messageId', validateRequest(userUpdateMessageSchema), updateMyMessageController);
chatRouterV1.delete('/me/messages/:messageId', validateRequest(userDeleteMessageSchema), deleteMyMessageController);
chatRouterV1.post('/me/messages/read', markMyTrainerMessagesReadController);

chatRouterV1.use(authorizeRoles(Roles.TRAINER, Roles.ADMIN));
chatRouterV1.get('/users', validateRequest(listChatsSchema), listChatsController);
chatRouterV1.get('/users/:userId/messages', validateRequest(trainerGetMessagesSchema), getMessagesForUserController);
chatRouterV1.post('/users/:userId/messages', validateRequest(trainerSendMessageWithParamsSchema), sendMessageAsTrainerController);

chatRouterV1.use(authorizeRoles(Roles.ADMIN));
chatRouterV1.post('/users/:userId/messages/read', validateRequest(trainerMessageParamsSchema), markUserMessagesReadController);
chatRouterV1.patch('/users/:userId/messages/:messageId', validateRequest(adminUpdateMessageSchema), updateUserMessageController);
chatRouterV1.delete('/users/:userId/messages/:messageId', validateRequest(adminDeleteMessageSchema), deleteUserMessageController);
chatRouterV1.get('/presence/online/count', getOnlineUsersCountController);
chatRouterV1.get('/presence/:userId', validateRequest(trainerMessageParamsSchema), getUserPresenceController);
