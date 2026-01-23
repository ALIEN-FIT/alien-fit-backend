import { StatusCodes } from 'http-status-codes';
import type { Express } from 'express';
import { env } from '../config/env.js';
import { HttpResponseError } from './appError.js';

const BASE_URL = 'https://api.calorieninjas.com';
const API_KEY = "env.calorieninjas_api_key";

async function parseResponse(response: Response, fallbackStatus: number) {
    const raw = await response.text();
    console.log(raw)
    if (!response.ok) {
        const message = raw || 'CalorieNinjas request failed';
        throw new HttpResponseError(response.status || fallbackStatus, message);
    }

    if (!raw) {
        return {};
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new HttpResponseError(fallbackStatus, 'Invalid response from CalorieNinjas');
    }
}

export class CalorieNinjasClient {
    private static baseHeaders = { 'X-Api-Key': API_KEY } as const;

    private static async get(path: string, query: string) {
        const url = new URL(path, BASE_URL);
        url.searchParams.set('query', query);
        console.log('CalorieNinjas request URL:', url.toString());
        const response = await fetch(url, {
            headers: this.baseHeaders,
        });


        return parseResponse(response, StatusCodes.BAD_GATEWAY);
    }

    static fetchNutrition(query: string) {
        return this.get('/v1/nutrition', query);
    }

    static fetchRecipes(query: string) {
        console.log('Fetching recipes with query:', query);
        return this.get('/v1/recipe', query);
    }

    static async fetchImageTextNutrition(file: Express.Multer.File) {
        if (!file) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Image file is required');
        }

        const formData = new FormData();
        const blob = new Blob([file.buffer as any], {
            type: file.mimetype || 'application/octet-stream',
        });
        formData.append('media', blob, file.originalname || 'upload');

        const response = await fetch(`${BASE_URL}/v1/imagetextnutrition`, {
            method: 'POST',
            headers: this.baseHeaders,
            body: formData,
        });

        return parseResponse(response, StatusCodes.BAD_GATEWAY);
    }
}
