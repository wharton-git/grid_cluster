const BASE_URL = import.meta.env.VITE_API_URL;

import axios, { type AxiosResponse } from "axios";
import { type Data, type FractalResponse } from "./types";


export async function generateFractal(data: Data): Promise<FractalResponse | null> {
    try {
        const response: AxiosResponse<FractalResponse> = await axios.post(
            `${BASE_URL}/generate`, 
            data
        );

        return response.data; 
    } catch (error) {
        console.error("Error while generating fractal", error);
        return null;
    }
}