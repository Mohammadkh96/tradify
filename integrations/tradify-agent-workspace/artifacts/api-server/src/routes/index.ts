import { Router, type IRouter } from "express";
import healthRouter from "./health";
import legalRouter from "./legal";
import tradifyRouter from "./tradify";

const router: IRouter = Router();

router.use(healthRouter);
router.use(legalRouter);
router.use(tradifyRouter);

export default router;
