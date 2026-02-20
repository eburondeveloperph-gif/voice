import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

const approvedVoices = [
  // ── English ────────────────────────────────────────────────
  { id: "orbit-elliot", label: "Elliot", locale: "en-CA", upstreamProvider: "vapi", upstreamVoiceId: "elliot", sortOrder: 1 },
  { id: "orbit-tara", label: "Tara", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "tara", sortOrder: 2 },
  { id: "orbit-nico", label: "Nico", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "nico", sortOrder: 3 },
  { id: "orbit-emma", label: "Emma", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "emma", sortOrder: 4 },
  { id: "orbit-neil", label: "Neil", locale: "en-GB", upstreamProvider: "vapi", upstreamVoiceId: "neil", sortOrder: 5 },
  { id: "orbit-sagar", label: "Sagar", locale: "en-IN", upstreamProvider: "vapi", upstreamVoiceId: "sagar", sortOrder: 6 },
  { id: "orbit-kai", label: "Kai", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "kai", sortOrder: 7 },
  { id: "orbit-leia", label: "Leia", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "leia", sortOrder: 8 },
  { id: "orbit-dan", label: "Dan", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "dan", sortOrder: 9 },
  { id: "orbit-zac", label: "Zac", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "zac", sortOrder: 10 },
  { id: "orbit-jess", label: "Jess", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "jess", sortOrder: 11 },
  { id: "orbit-mia", label: "Mia", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "mia", sortOrder: 12 },
  { id: "orbit-zoe", label: "Zoe", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "zoe", sortOrder: 13 },
  { id: "orbit-leo", label: "Leo", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "leo", sortOrder: 14 },
  { id: "orbit-savannah", label: "Savannah", locale: "en-US", upstreamProvider: "vapi", upstreamVoiceId: "savannah", sortOrder: 15 },
  { id: "orbit-rohan", label: "Rohan", locale: "en-IN", upstreamProvider: "vapi", upstreamVoiceId: "rohan", sortOrder: 16 },
  { id: "orbit-burt", label: "Burt", locale: "en-US", upstreamProvider: "11labs", upstreamVoiceId: "burt", sortOrder: 17 },
  { id: "orbit-aria", label: "Aria", locale: "en-US", upstreamProvider: "11labs", upstreamVoiceId: "aria", sortOrder: 18 },

  // ── Dutch – Netherlands ────────────────────────────────────
  { id: "orbit-emma-nl", label: "Emma (NL)", locale: "nl-NL", upstreamProvider: "vapi", upstreamVoiceId: "emma", sortOrder: 30 },
  { id: "orbit-tara-nl", label: "Tara (NL)", locale: "nl-NL", upstreamProvider: "vapi", upstreamVoiceId: "tara", sortOrder: 31 },
  { id: "orbit-nico-nl", label: "Nico (NL)", locale: "nl-NL", upstreamProvider: "vapi", upstreamVoiceId: "nico", sortOrder: 32 },

  // ── Dutch – Flemish (Belgium) ──────────────────────────────
  { id: "orbit-emma-be", label: "Emma (BE)", locale: "nl-BE", upstreamProvider: "vapi", upstreamVoiceId: "emma", sortOrder: 35 },
  { id: "orbit-leia-be", label: "Leia (BE)", locale: "nl-BE", upstreamProvider: "vapi", upstreamVoiceId: "leia", sortOrder: 36 },

  // ── German ─────────────────────────────────────────────────
  { id: "orbit-emma-de", label: "Emma (DE)", locale: "de-DE", upstreamProvider: "vapi", upstreamVoiceId: "emma", sortOrder: 40 },
  { id: "orbit-kai-de", label: "Kai (DE)", locale: "de-DE", upstreamProvider: "vapi", upstreamVoiceId: "kai", sortOrder: 41 },
  { id: "orbit-leo-de", label: "Leo (DE)", locale: "de-DE", upstreamProvider: "vapi", upstreamVoiceId: "leo", sortOrder: 42 },

  // ── French ─────────────────────────────────────────────────
  { id: "orbit-mia-fr", label: "Mia (FR)", locale: "fr-FR", upstreamProvider: "vapi", upstreamVoiceId: "mia", sortOrder: 50 },
  { id: "orbit-leia-fr", label: "Leia (FR)", locale: "fr-FR", upstreamProvider: "vapi", upstreamVoiceId: "leia", sortOrder: 51 },
  { id: "orbit-dan-fr", label: "Dan (FR)", locale: "fr-FR", upstreamProvider: "vapi", upstreamVoiceId: "dan", sortOrder: 52 },

  // ── Spanish ────────────────────────────────────────────────
  { id: "orbit-mia-es", label: "Mia (ES)", locale: "es-ES", upstreamProvider: "vapi", upstreamVoiceId: "mia", sortOrder: 60 },
  { id: "orbit-leo-es", label: "Leo (ES)", locale: "es-ES", upstreamProvider: "vapi", upstreamVoiceId: "leo", sortOrder: 61 },
  { id: "orbit-zoe-es", label: "Zoe (ES)", locale: "es-ES", upstreamProvider: "vapi", upstreamVoiceId: "zoe", sortOrder: 62 },

  // ── Portuguese (Brazil) ────────────────────────────────────
  { id: "orbit-savannah-pt", label: "Savannah (PT)", locale: "pt-BR", upstreamProvider: "vapi", upstreamVoiceId: "savannah", sortOrder: 70 },
  { id: "orbit-tara-pt", label: "Tara (PT)", locale: "pt-BR", upstreamProvider: "vapi", upstreamVoiceId: "tara", sortOrder: 71 },

  // ── Italian ────────────────────────────────────────────────
  { id: "orbit-mia-it", label: "Mia (IT)", locale: "it-IT", upstreamProvider: "vapi", upstreamVoiceId: "mia", sortOrder: 80 },
  { id: "orbit-leo-it", label: "Leo (IT)", locale: "it-IT", upstreamProvider: "vapi", upstreamVoiceId: "leo", sortOrder: 81 },

  // ── Polish ─────────────────────────────────────────────────
  { id: "orbit-emma-pl", label: "Emma (PL)", locale: "pl-PL", upstreamProvider: "vapi", upstreamVoiceId: "emma", sortOrder: 90 },
  { id: "orbit-zoe-pl", label: "Zoe (PL)", locale: "pl-PL", upstreamProvider: "vapi", upstreamVoiceId: "zoe", sortOrder: 91 },

  // ── Turkish ────────────────────────────────────────────────
  { id: "orbit-mia-tr", label: "Mia (TR)", locale: "tr-TR", upstreamProvider: "vapi", upstreamVoiceId: "mia", sortOrder: 100 },
  { id: "orbit-kai-tr", label: "Kai (TR)", locale: "tr-TR", upstreamProvider: "vapi", upstreamVoiceId: "kai", sortOrder: 101 },

  // ── Arabic ─────────────────────────────────────────────────
  { id: "orbit-sagar-ar", label: "Sagar (AR)", locale: "ar-SA", upstreamProvider: "vapi", upstreamVoiceId: "sagar", sortOrder: 110 },
  { id: "orbit-rohan-ar", label: "Rohan (AR)", locale: "ar-SA", upstreamProvider: "vapi", upstreamVoiceId: "rohan", sortOrder: 111 },

  // ── Hindi ──────────────────────────────────────────────────
  { id: "orbit-sagar-hi", label: "Sagar (HI)", locale: "hi-IN", upstreamProvider: "vapi", upstreamVoiceId: "sagar", sortOrder: 120 },
  { id: "orbit-rohan-hi", label: "Rohan (HI)", locale: "hi-IN", upstreamProvider: "vapi", upstreamVoiceId: "rohan", sortOrder: 121 },

  // ── Japanese ───────────────────────────────────────────────
  { id: "orbit-mia-ja", label: "Mia (JA)", locale: "ja-JP", upstreamProvider: "vapi", upstreamVoiceId: "mia", sortOrder: 130 },
  { id: "orbit-kai-ja", label: "Kai (JA)", locale: "ja-JP", upstreamProvider: "vapi", upstreamVoiceId: "kai", sortOrder: 131 },

  // ── Korean ─────────────────────────────────────────────────
  { id: "orbit-zoe-ko", label: "Zoe (KO)", locale: "ko-KR", upstreamProvider: "vapi", upstreamVoiceId: "zoe", sortOrder: 140 },
  { id: "orbit-leo-ko", label: "Leo (KO)", locale: "ko-KR", upstreamProvider: "vapi", upstreamVoiceId: "leo", sortOrder: 141 },

  // ── Mandarin Chinese ──────────────────────────────────────
  { id: "orbit-mia-zh", label: "Mia (ZH)", locale: "zh-CN", upstreamProvider: "vapi", upstreamVoiceId: "mia", sortOrder: 150 },
  { id: "orbit-kai-zh", label: "Kai (ZH)", locale: "zh-CN", upstreamProvider: "vapi", upstreamVoiceId: "kai", sortOrder: 151 },

  // ── Tagalog (Philippines) ──────────────────────────────────
  { id: "orbit-mia-tl", label: "Mia (TL)", locale: "tl-PH", upstreamProvider: "vapi", upstreamVoiceId: "mia", sortOrder: 160 },
  { id: "orbit-savannah-tl", label: "Savannah (TL)", locale: "tl-PH", upstreamProvider: "vapi", upstreamVoiceId: "savannah", sortOrder: 161 },

  // ── Thai ───────────────────────────────────────────────────
  { id: "orbit-mia-th", label: "Mia (TH)", locale: "th-TH", upstreamProvider: "vapi", upstreamVoiceId: "mia", sortOrder: 170 },
  { id: "orbit-leia-th", label: "Leia (TH)", locale: "th-TH", upstreamProvider: "vapi", upstreamVoiceId: "leia", sortOrder: 171 },

  // ── Vietnamese ─────────────────────────────────────────────
  { id: "orbit-emma-vi", label: "Emma (VI)", locale: "vi-VN", upstreamProvider: "vapi", upstreamVoiceId: "emma", sortOrder: 180 },
  { id: "orbit-dan-vi", label: "Dan (VI)", locale: "vi-VN", upstreamProvider: "vapi", upstreamVoiceId: "dan", sortOrder: 181 },
];

async function main() {
  const orgSlug = process.env.EV_DEFAULT_ORG_SLUG ?? "eburon-demo";
  const orgName = process.env.EV_DEFAULT_ORG_NAME ?? "Eburon Demo";
  const userEmail = process.env.EV_DEFAULT_USER_EMAIL ?? "owner@eburon.local";

  const org = await prisma.org.upsert({
    where: { slug: orgSlug },
    update: { name: orgName },
    create: {
      slug: orgSlug,
      name: orgName,
    },
  });

  await prisma.user.upsert({
    where: {
      orgId_email: {
        orgId: org.id,
        email: userEmail,
      },
    },
    update: {
      displayName: "Workspace Owner",
    },
    create: {
      orgId: org.id,
      email: userEmail,
      displayName: "Workspace Owner",
    },
  });

  for (const voice of approvedVoices) {
    await prisma.voiceCatalog.upsert({
      where: { id: voice.id },
      update: {
        label: voice.label,
        locale: voice.locale,
        upstreamProvider: voice.upstreamProvider,
        upstreamVoiceId: voice.upstreamVoiceId,
        sortOrder: voice.sortOrder,
        isApproved: true,
      },
      create: {
        ...voice,
        isApproved: true,
      },
    });
  }

  console.log(`Seeded org=${org.slug} and ${approvedVoices.length} approved voices.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
