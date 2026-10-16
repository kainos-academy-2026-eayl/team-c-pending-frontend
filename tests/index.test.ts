import { expect, describe, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe('GET /health', () => {
    it('returns 200 and health status', async () => {
        const response = await request(createApp())
            .get('/health')
            .expect(200);

        expect(response.body).toHaveProperty("status", "ok");
    });
});