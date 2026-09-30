import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { createProductSyncStore } from "../services/product-sync.server";
import { handleProductUpdate } from "../services/product-webhook.server";

export const action = ({ request }: ActionFunctionArgs) =>
  handleProductUpdate(
    request,
    authenticate.webhook,
    createProductSyncStore(db).record,
  );
