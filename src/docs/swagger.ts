import swaggerJsdoc, { OAS3Options } from "swagger-jsdoc";
import path from "path";

const swaggerOptions: OAS3Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SmartSave API",
      version: "1.0.0",
      description:
        "API documentation for the SmartSave finance tracker. Auth is via JWT Bearer token. Most routes require authentication.",
    },
    servers: [
      {
        url: process.env.APP_BASE_URL || "http://localhost:4000",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string", format: "email" },
            username: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            currentBalance: { type: "string", nullable: true },
          },
        },
        UserProfile: {
          allOf: [
            { $ref: "#/components/schemas/User" },
            {
              type: "object",
              properties: {
                monthlyNetIncome: { type: "string", nullable: true },
                monthlyHousingCost: { type: "string", nullable: true },
                monthlyUtilitiesCost: { type: "string", nullable: true },
                monthlyOtherFixedCosts: { type: "string", nullable: true },
              },
            },
          ],
        },
        AuthResponse: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: { $ref: "#/components/schemas/User" },
          },
        },
        Account: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", nullable: true },
            institutionName: { type: "string", nullable: true },
            provider: { type: "string", example: "mock" },
            currency: { type: "string", example: "EUR" },
            createdAt: { type: "string", format: "date-time" },
            _count: {
              type: "object",
              properties: {
                transactions: { type: "integer" },
              },
            },
          },
        },
        Transaction: {
          type: "object",
          properties: {
            id: { type: "string" },
            amount: { type: "string", description: "Decimal string; negative = expense" },
            merchant: { type: "string", nullable: true },
            description: { type: "string", nullable: true },
            date: { type: "string", format: "date-time" },
            category: {
              nullable: true,
              allOf: [{ $ref: "#/components/schemas/Category" }],
            },
            account: {
              nullable: true,
              allOf: [{ $ref: "#/components/schemas/Account" }],
            },
          },
        },
        Category: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            displayName: { type: "string" },
            color: { type: "string", nullable: true },
          },
        },
        SavingsGoal: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            goalAmount: { type: "string", description: "Decimal string" },
            targetDate: { type: "string", format: "date-time" },
            startingBalance: { type: "string", nullable: true, description: "Decimal string" },
            primaryAccountId: { type: "string", nullable: true },
          },
        },
        DailyBudget: {
          type: "object",
          properties: {
            date: { type: "string", format: "date-time" },
            baseDailyAllowance: { type: "string", description: "Decimal string" },
            carryOverFromPrev: { type: "string", description: "Decimal string" },
            spentToday: { type: "string", description: "Decimal string" },
            computedLimit: { type: "string", description: "Decimal string" },
          },
        },
      },
    },
  },
  apis: [
    path.join(__dirname, "../routes/*.ts"),
    path.join(__dirname, "../routes/*.js"),
    path.join(__dirname, "../index.ts"),
    path.join(__dirname, "../index.js"),
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);

