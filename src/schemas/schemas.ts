import { z } from "zod";

export const getBalanceSchema = z.object({
  params: z.object({
    userId: z.string().min(1, "User ID is required"),
  }),
});

export const transactSchema = z.object({
  body: z.object({
    idempotentKey: z.string().or(z.string().min(5)),
    userId: z.string().min(1, "User ID is required"),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive number"),
    type: z.enum(["credit", "debit"], {
      error: () => ({
        message: "Type must be either 'credit' or 'debit'",
      }),
    }),
  }),
});

export type TransactRequest = z.infer<typeof transactSchema>["body"];
