import { dynamoClient } from "../db/dbClient";
import {
  GetItemCommand,
  TransactWriteItemsCommand,
  type TransactWriteItemsCommandInput,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import {
  IGetBalanceResponse,
  ITransactResponse,
} from "../interfaces/interfaces";
import { ITransactInput } from "../interfaces/interfaces";

const USER_BALANCES_TABLE = "UserBalances";
const TRANSACTIONS_TABLE = "Transactions";

/**
 * Retrieves the current balance for a specified user by 'userId'.
 * @param userId The ID of the user.
 * @returns The user's current balance in response
 */
export async function getCurrentBalance(
  userId: string
): Promise<IGetBalanceResponse> {
  const params = {
    TableName: USER_BALANCES_TABLE,
    Key: marshall({ userId }),
  };

  try {
    const command = new GetItemCommand(params);
    const { Item } = await dynamoClient.send(command);
    if (!Item) {
      return {
        success: false,
        balance: 0,
        message: `No balance record found for userId ${userId}. Returning 0.`,
        statusCode: 404,
      };
    }

    const unmarshalledItem = unmarshall(Item);
    const userBalance = unmarshalledItem?.balance || 0;

    return { success: true, balance: userBalance, statusCode: 200 };
  } catch (error) {
    console.error(`Failed to retrieve balance for userId ${userId}:`, error);
    throw new Error(`Failed to retrieve balance${error}`);
  }
}

/**
 * Processes a transaction (credit or debit) atomically and idempotently.
 * @param payload The transaction details.
 * @throws {Error} If the amount is invalid ('Amount must be a positive number.').
 * @throws {Error} If a debit exceeds the available balance.
 * @throws {Error} If the idempotentKey has been used (Duplicate transaction check)
 * @throws {Error} For any other DynamoDB or system error ('Transaction processing failed.').
 */
export async function transact(
  payload: ITransactInput
): Promise<ITransactResponse> {
  const { idempotentKey, userId, amount, type } = payload;

  const amountAsNumber = parseFloat(amount);

  if (isNaN(amountAsNumber) || amountAsNumber <= 0) {
    return {
      success: false,
      newBalance: 0,
      message: "Invalid Amount value, Amount must be a positive number.",
      statusCode: 400,
    };
  }

  const now = new Date().toISOString();
  let balanceUpdateExpression: string;
  let balanceConditionExpression: string | undefined;

  if (type === "credit") {
    // for credits, initializes balance to 0 if user is new
    balanceUpdateExpression =
      "SET balance = if_not_exists(balance, :zero) + :amount, updatedAt = :now";
  } else {
    // 'debit'
    balanceUpdateExpression =
      "SET balance = balance - :amount, updatedAt = :now";

    balanceConditionExpression = "balance >= :amount";
  }

  const transactionParams: TransactWriteItemsCommandInput = {
    TransactItems: [
      {
        Put: {
          TableName: TRANSACTIONS_TABLE,
          Item: marshall({
            idempotentKey,
            userId,
            amount: amountAsNumber,
            type,
            status: "COMPLETED",
            createdAt: now,
          }),
          ConditionExpression: "attribute_not_exists(idempotentKey)",
        },
      },
      {
        Update: {
          TableName: USER_BALANCES_TABLE,
          Key: marshall({ userId }),
          UpdateExpression: balanceUpdateExpression,
          ConditionExpression: balanceConditionExpression,
          ExpressionAttributeValues: marshall({
            ":amount": amountAsNumber,
            ":now": now,
            ...(type === "credit" && { ":zero": 0 }), // adding zero only for credits
          }),
        },
      },
    ],
  };

  try {
    // atomicity ensured here
    await dynamoClient.send(new TransactWriteItemsCommand(transactionParams));

    const newBalance = await getCurrentBalance(userId);

    return { success: true, newBalance: newBalance.balance, statusCode: 200 };
  } catch (error: any) {
    console.log("error", error);

    // Error handling logic
    // Handle specific transaction failures
    if (error.name === "TransactionCanceledException") {
      const cancellationReasons = error.CancellationReasons || [];

      if (
        cancellationReasons[0] &&
        cancellationReasons[0].Code === "ConditionalCheckFailed"
      ) {
        return {
          success: false,
          message: `Transaction ${idempotentKey} is a duplicate.`,
          statusCode: 409,
        };
      }
      if (
        cancellationReasons[1] &&
        cancellationReasons[1].Code === "ConditionalCheckFailed"
      ) {
        return {
          success: false,
          message: "Insufficient funds for this debit.",
          statusCode: 409,
        };
      }
    }
    return {
      success: false,
      message: `Transaction failed: ${error}`,
      statusCode: 500,
    };
  }
}
