export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "ForgeNet API",
    version: "1.0.0",
    description: "Backend API contract for the ForgeNet developer collaboration platform."
  },
  servers: [
    { url: "http://localhost:5000" }
  ],
  paths: {
    "/api/v1/health": {
      get: {
        summary: "Health check",
        responses: {
          200: { description: "API is healthy" }
        }
      }
    },
    "/api/v1/auth/login": {
      post: {
        summary: "Login user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Login successful" },
          400: { description: "Validation error" },
          401: { description: "Invalid credentials" }
        }
      }
    },
    "/api/v1/users": {
      get: {
        summary: "List users",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 }, required: false },
          { name: "skip", in: "query", schema: { type: "integer", minimum: 0 }, required: false }
        ],
        responses: { 200: { description: "List of users" } }
      },
      post: {
        summary: "Register user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string", minLength: 2 },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "User created" },
          400: { description: "Validation error" },
          409: { description: "Duplicate email" }
        }
      }
    },
    "/api/v1/posts": {
      get: {
        summary: "List posts",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 }, required: false },
          { name: "skip", in: "query", schema: { type: "integer", minimum: 0 }, required: false }
        ],
        responses: { 200: { description: "List of posts" } }
      },
      post: {
        summary: "Create post",
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: "Post created" }, 401: { description: "Unauthorized" } }
      }
    },
    "/api/v1/communities": {
      get: {
        summary: "List communities",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 }, required: false },
          { name: "skip", in: "query", schema: { type: "integer", minimum: 0 }, required: false }
        ],
        responses: { 200: { description: "List of communities" } }
      },
      post: {
        summary: "Create community",
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: "Community created" }, 401: { description: "Unauthorized" } }
      }
    },
    "/api/v1/search/users": {
      get: {
        summary: "Search users",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 }, required: false },
          { name: "skip", in: "query", schema: { type: "integer", minimum: 0 }, required: false }
        ],
        responses: { 200: { description: "User search results" } }
      }
    },
    "/api/v1/search/posts": {
      get: {
        summary: "Search posts",
        parameters: [
          { name: "q", in: "query", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 }, required: false },
          { name: "skip", in: "query", schema: { type: "integer", minimum: 0 }, required: false }
        ],
        responses: { 200: { description: "Post search results" } }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  }
};
