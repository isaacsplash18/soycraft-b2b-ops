import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

// Flips SENT invoices past their due date to OVERDUE. Invoked daily by the
// Vercel cron configured in vercel.json. Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` when the CRON_SECRET env var is set.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await prisma.invoice.updateMany({
    where: { status: "SENT", dueDate: { lt: today } },
    data: { status: "OVERDUE" },
  });

  if (result.count > 0) {
    revalidatePath("/invoices");
    revalidatePath("/dashboard");
  }

  return NextResponse.json({ marked: result.count });
}
