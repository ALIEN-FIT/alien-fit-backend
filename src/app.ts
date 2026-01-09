import 'express-async-errors';
import express from 'express';
import qs from 'qs';
import i18n from './i18n/i18n-config.js';
import { corsConfig } from './config/cors.js';
import { rateLimiter } from './config/rate-limiter.js';
import helmet from 'helmet';

import { homeRouter } from './modules/home/v1/home.routes.js';
import { constantRouter } from './modules/constant/constant.routes.js';
import { userRouterV1 } from './modules/user/v1/user.routes.js';
import { authRouterV1 } from './modules/auth/v1/auth.routes.js';
import { userSessionRouterV1 } from './modules/user-session/v1/user.routes.js';
import { mediaRouterV1 } from './modules/media/v1/media.routes.js';
import { postRouterV1 } from './modules/post/v1/post.routes.js';
import { userProfileRouterV1 } from './modules/user-profile/v1/user-profile.routes.js';
import { chatRouterV1 } from './modules/chat/v1/chat.routes.js';
import { followRouterV1 } from './modules/follow/v1/follow.routes.js';
import { subscriptionRouterV1 } from './modules/subscription/v1/subscription.routes.js';
import { subscriptionPackageRouterV1 } from './modules/subscription-packages/v1/subscription-package.routes.js';
import { planUpdateRequestRouterV1 } from './modules/requests/v1/plan-update-request.routes.js';
import { trainingPlanRouterV1 } from './modules/plans/training/v1/training-plan.routes.js';
import { dietPlanRouterV1 } from './modules/plans/diet/v1/diet-plan.routes.js';
import { staticTrainingPlanRouterV1 } from './modules/plans/static-training-plans/v1/static-training-plan.routes.js';
import { trackingRouterV1 } from './modules/tracking/v1/tracking.routes.js';
import { trainingVideoRouterV1 } from './modules/training-video/v1/training-video.routes.js';
import { nutritionRouterV1 } from './modules/nutrition/v1/nutrition.routes.js';
import { feedbackRouterV1 } from './modules/feedback/v1/feedback.routes.js';
import { notificationRouterV1 } from './modules/notification/v1/notification.routes.js';

import { errorMiddleware } from './middleware/error.middleware.js';
import { notFoundMiddleware } from './middleware/not-found.middleware.js';

export function initializeApp(app: express.Application) {
    // Support clients that send language as `lang` header
    app.use((req, _res, next) => {
        const lang = req.headers['lang'];
        if (lang && !req.headers['accept-language']) {
            req.headers['accept-language'] = String(lang);
        }
        next();
    });
    app.use(i18n.init);
    app.set('trust proxy', 1);
    app.set('query parser', (str: string) => qs.parse(str));
    app.use(rateLimiter);
    app.use(corsConfig);
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(helmet({
        // Disable HSTS in dev to avoid forced HTTPS when you switch back to HTTP
        hsts: false,
        // Either always set OAC, or set to false. Pick one and keep it consistent.
        originAgentCluster: true,
        // Optional: keep COOP; it’ll only apply on HTTPS/localhost
        crossOriginOpenerPolicy: { policy: 'same-origin' },
    }));

    // app.use(sanitize()); // TODO: FIX IT____IT THROW ERROR WHEN IT SANITIZE REQUEST

    app.use(express.static('public'));

    app.use('/', homeRouter);
    app.use('/api/constant', constantRouter);
    app.use('/api/v1/users', userRouterV1);
    app.use('/api/v1/auth', authRouterV1);
    app.use('/api/v1/user-session', userSessionRouterV1);
    app.use('/api/v1/media', mediaRouterV1);
    app.use('/api/v1/posts', postRouterV1);
    app.use('/api/v1/user-profile', userProfileRouterV1);
    app.use('/api/v1/follow', followRouterV1);
    app.use('/api/v1/chat', chatRouterV1);
    app.use('/api/v1/subscription', subscriptionRouterV1);
    app.use('/api/v1/subscription-packages', subscriptionPackageRouterV1);
    app.use('/api/v1/plans/requests', planUpdateRequestRouterV1);
    app.use('/api/v1/plans/training', trainingPlanRouterV1);
    app.use('/api/v1/plans/static-training-plans', staticTrainingPlanRouterV1);
    app.use('/api/v1/plans/diet', dietPlanRouterV1);
    app.use('/api/v1/tracking', trackingRouterV1);
    app.use('/api/v1/training-videos', trainingVideoRouterV1);
    app.use('/api/v1/nutrition', nutritionRouterV1);
    app.use('/api/v1/feedback', feedbackRouterV1);
    app.use('/api/v1/notifications', notificationRouterV1);

    app.use(notFoundMiddleware);
    app.use(errorMiddleware);
}
