import { z } from 'zod';
import { insertTradeSchema, tradeJournal } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  trades: {
    list: {
      method: 'GET' as const,
      path: '/api/trades',
      responses: {
        200: z.array(z.custom<typeof tradeJournal.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/trades/:id',
      responses: {
        200: z.custom<typeof tradeJournal.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/trades',
      input: insertTradeSchema,
      responses: {
        201: z.custom<typeof tradeJournal.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/trades/:id',
      input: insertTradeSchema.partial(),
      responses: {
        200: z.custom<typeof tradeJournal.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/trades/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    validate: {
      method: 'POST' as const,
      path: '/api/trades/validate',
      input: insertTradeSchema.pick({
        htfBias: true,
        structureState: true,
        liquidityStatus: true,
        zoneValidity: true,
        htfBiasClear: true,
        zoneValid: true,
        liquidityTaken: true,
        structureConfirmed: true,
        entryConfirmed: true,
      }),
      responses: {
        200: z.object({
          valid: z.boolean(),
          reason: z.string().optional(),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type TradeInput = z.infer<typeof api.trades.create.input>;
export type TradeResponse = z.infer<typeof api.trades.create.responses[201]>;
export type ValidationInput = z.infer<typeof api.trades.validate.input>;
