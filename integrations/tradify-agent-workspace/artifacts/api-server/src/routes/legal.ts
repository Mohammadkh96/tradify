import { Router } from "express";
import { createPublicAccountDeletionRequest } from "../tradify-runtime";
import {
  deletionRequestPage,
  privacyPolicyPage,
  supportPage,
  termsPage,
} from "../services/legal-content";

const router = Router();

router.get("/legal/privacy", (_req, res) => {
  res.type("html").send(privacyPolicyPage());
});

router.get("/legal/terms", (_req, res) => {
  res.type("html").send(termsPage());
});

router.get("/legal/support", (_req, res) => {
  res.type("html").send(supportPage());
});

router.get("/legal/account-deletion", (_req, res) => {
  res.type("html").send(deletionRequestPage());
});

router.post("/legal/account-deletion/request", async (req, res) => {
  try {
    const result = await createPublicAccountDeletionRequest(String(req.body?.email ?? ""));
    req.log.info(
      { requestId: result.requestId, knownAccount: result.knownAccount },
      "Public account deletion request received",
    );
    res
      .status(202)
      .type("html")
      .send(
        deletionRequestPage(
          "Your request was received. If an account matches, the deletion request will be handled through the secure account process.",
        ),
      );
  } catch {
    res.status(400).type("html").send(deletionRequestPage("Enter a valid account email address."));
  }
});

export default router;
