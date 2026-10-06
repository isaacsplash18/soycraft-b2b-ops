import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { SettingsForm } from "@/components/settings/settings-form";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const dynamic = "force-dynamic";

async function getSettings() {
  const settings = await prisma.settings.findMany();
  return Object.fromEntries(settings.map((s) => [s.key, s.value]));
}

async function updateSettings(data: Record<string, string>) {
  "use server";
  await prisma.$transaction(
    Object.entries(data).map(([key, value]) =>
      prisma.settings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
  revalidatePath("/settings");
  revalidateTag(CACHE_TAGS.settings, "max");
  return { success: true };
}

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <SettingsForm settings={settings} action={updateSettings} />
    </div>
  );
}
