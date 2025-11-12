# DynamoDB Transaction Service

This repository contains two endpoints providing two core functions, `getCurrentBalance` and `transact`, for managing user balances in DynamoDB.

## Evaluation Criteria Met

- **Functionality**:
  - `getCurrentBalance`: Retrieves the balance for a user.
  - `transact`: Handles credits and debits.
- **Error Handling**: The `transact` function throws specific errors for invalid input, duplicate transactions, and insufficient funds.
- **Idempotency**: Achieved by using a `ConditionExpression` of `attribute_not_exists(idempotentKey)` in the `Transactions` table. This is part of an atomic transaction.
- **Race Conditions**: Handled by using DynamoDB's `TransactWriteItems` operation. This bundles the idempotency check and the balance update into a single, all-or-nothing atomic operation, making race conditions impossible.

## Project Structure

```text
├── src/
│   ├── db/
│   │   └── dbClient.ts           # DynamoDB client configuration and export
│   ├── interfaces/
│   │   └── interfaces.ts         # TypeScript interfaces and type definitions
│   ├── middleware/
│   │   └── validate-payload.ts   # Middleware to validate requests against Zod schemas
│   ├── schemas/
│   │   └── schemas.ts            # Zod validation schemas for API inputs
│   ├── service/
│   │   └── transaction-service.ts # Core business logic (getCurrentBalance, transact)
│   └── server.ts                 # Application entry point and route definitions
├── dist/                         # Compiled JavaScript output (after build)
├── package.json                  # Project dependencies and scripts
├── tsconfig.json                 # TypeScript compiler configuration
└── README.md                     # Project documentation
```

## Prerequisites

- Node.js (v18+)
- AWS Credentials configured (for DynamoDB access)
- **`UserBalances`**, **`Transactions`** table has to be created in DynamoDB

## DynamoDB Table Design & Tables creation(Pre-requisite)

This solution requires two DynamoDB tables:

1.  **`UserBalances`**

    - **Partition Key**: `userId` (String)
    - **Attribute**: `balance` (Number)

2.  **`Transactions`**
    - **Partition Key**: `idempotentKey` (String)
    - **Attributes**: `userId`, `amount`, `type`, `createdAt`, `status`,(all are STRING type)

## How to Install and run

1.  **Install Dependencies:**

    ```bash
    npm install
    ```

2.  **Run code on development server:**
    Run the typescript file directly for dev environment using ts compiler (ts-node)

    ```bash
    npm run dev
    ```

3.  **Build the Code:**
    To transpile the TypeScript to JavaScript (creates a `/dist` folder). This will build and then start the server on **`PORT 3000`**
    ```bash
    npm run start
    ```

## API Reference

### 1. Get User Balance

Retrieves the current available balance for a specific user.

- URL: **`/balance/:userId`**
- Method: `GET`

**Success Response (200 OK):**

```
{
  "success": true,
  "balance": 150.50,
  "statusCode: 200
}
```

### 2. Process Transaction

Initiates a credit or debit. This endpoint is idempotent; sending the same idempotentKey twice will not process the transaction a second time.

- URL: **`/transact`**
- Method: `POST`
- Headers: `Content-Type: application/json`

**Request Body**

```
{
  "idempotentKey": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user_123",
  "amount": "50.00",
  "type": "credit or debit"
}
```

**Success Response (200 OK):**

```
{
    "success": true,
    "newBalance": 200.50,
    "statusCode": 200
}
```

**Error Codes**

**`200`** - **Success** Response.

**`400`** - Validation failed (e.g., negative amount, invalid type).

**`409`** - **Conflict**: Transaction is a duplicate key OR Insufficient funds.

**`500`** - **Internal Server Error.**
