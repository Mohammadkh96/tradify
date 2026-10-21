import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tradigoRouter from "./tradigo";
import coachApplicationsRouter from "./coachApplications";
import applicationStorageRouter from "./applicationStorage";
import adminOperationsRouter from "./adminOperations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tradigoRouter);
router.use(coachApplicationsRouter);
router.use(applicationStorageRouter);
router.use(adminOperationsRouter);

export default router;
