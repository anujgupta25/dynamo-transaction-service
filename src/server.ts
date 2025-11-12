import express, { Request, Response } from "express";
import { validate } from "./middleware/validate-payload";
import { getBalanceSchema, transactSchema } from "./schemas/schemas";
import { getCurrentBalance, transact } from "./service/transaction-service";

const app = express();
app.use(express.json());

app.get(
  "/balance/:userId",
  validate(getBalanceSchema),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const result = await getCurrentBalance(userId);

      if (!result.success)
        return res.status(result.statusCode || 500).json(result);
      return res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, message: JSON.stringify(error) });
    }
  }
);

app.post(
  "/transact",
  validate(transactSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await transact(req.body);
      return res.status(result.statusCode).json(result);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error,
      });
    }
  }
);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 App is running on http://localhost:${PORT}`);
});
