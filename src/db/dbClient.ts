import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({
  region: "eu-north-1",
});

export { dynamoClient };
