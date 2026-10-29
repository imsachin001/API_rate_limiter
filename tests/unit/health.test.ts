import request from "supertest";
import { app } from "../../src/app";

describe("GET /health", () => {
  it("returns the service health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe(
      "distributed-rate-limiter"
    );
  });
});
