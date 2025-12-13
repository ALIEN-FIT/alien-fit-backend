import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { NutritionService } from './nutrition.service.js';

export async function getNutritionController(req: Request, res: Response): Promise<void> {
    const { query } = req.query as { query: string };
    const items = await NutritionService.getNutrition(query);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { items },
    });
}

export async function getRecipesController(req: Request, res: Response): Promise<void> {
    const { query } = req.query as { query: string };
    console.log('Received recipe query:', query);
    const recipes = await NutritionService.getRecipes(query);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { recipes },
    });
}

export async function imageTextNutritionController(req: Request, res: Response): Promise<void> {
    const file = req.file;

    if (!file) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Image file is required');
    }

    const result = await NutritionService.extractNutritionFromImage(file);

    res.status(StatusCodes.OK).json({
        status: 'success',
        data: result,
    });
}
