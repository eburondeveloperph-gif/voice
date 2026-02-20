import { NextRequest } from "next/server";

import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { listProviderCategories } from "@/lib/ev/integrations";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "settings.integrations.providers", async () => ({
    payload: {
      categories: listProviderCategories(),
    },
  }));
}

