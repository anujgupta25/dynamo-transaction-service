export interface IGetBalanceResponse {
  success: boolean;
  balance: number;
  message?: string;
  statusCode: number;
}

export type TransactionType = "credit" | "debit";

export interface ITransactInput {
  idempotentKey: string;
  userId: string;
  amount: string;
  type: TransactionType;
}

export interface ITransactResponse {
  success: boolean;
  newBalance?: number;
  message?: string;
  statusCode: number;
}
