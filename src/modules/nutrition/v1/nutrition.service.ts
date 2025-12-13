import type { Express } from 'express';
import { CalorieNinjasClient } from '../../../utils/calorie-ninjas.client.js';

export class NutritionService {
    static async getNutrition(query: string) {
        const data = await CalorieNinjasClient.fetchNutrition(query);
        return data?.items ?? [];
    }

    static async getRecipes(query: string) {
        const data = await CalorieNinjasClient.fetchRecipes(query);
        if (Array.isArray(data)) {
            return data;
        }
        return data?.items ?? [];
    }

    static async extractNutritionFromImage(file: Express.Multer.File) {
        return CalorieNinjasClient.fetchImageTextNutrition(file);
    }
}
