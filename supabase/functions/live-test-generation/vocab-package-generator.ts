// Supabase Edge functions intentionally use dynamic table names without generated DB types.
// deno-lint-ignore no-explicit-any
type SupabaseClientLike = any;

export type FirestoreLessonSummary = {
  id: string;
  lessonTitle: string;
  levelCode: string;
  dayNumber: number;
  totalChunks: number;
};

export type FirestoreLessonChunk = {
  chunkId: string;
  english: string;
  vietnamese: string;
  category?: string;
};

export async function fetchFirestoreLessons(
  googleApiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FirestoreLessonSummary[]> {
  const url = `https://firestore.googleapis.com/v1/projects/chunks-voicecloning-genshai/databases/(default)/documents/lessons?key=${googleApiKey}&pageSize=100`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    let errorText = "";
    try {
      errorText = await response.text();
    } catch {
      // ignore
    }
    throw new Error(
      `Firestore list lessons failed (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    documents?: Array<{
      name: string;
      // deno-lint-ignore no-explicit-any
      fields?: Record<string, any>;
    }>;
  };

  const lessons: FirestoreLessonSummary[] = (data.documents ?? []).map((doc) => {
    const nameParts = doc.name.split("/");
    const id =
      doc.fields?.id?.stringValue ??
      nameParts[nameParts.length - 1] ??
      "";
    const lessonTitle = doc.fields?.lesson_title?.stringValue ?? id;
    const levelCode = doc.fields?.level_code?.stringValue ?? "";
    const dayNumber = Number(doc.fields?.day_number?.integerValue ?? 0);
    const totalChunks = Number(
      doc.fields?.total_chunks?.integerValue ??
        doc.fields?.chunks?.arrayValue?.values?.length ??
        0,
    );

    return { id, lessonTitle, levelCode, dayNumber, totalChunks };
  });

  lessons.sort((a, b) => {
    const cmp = a.levelCode.localeCompare(b.levelCode);
    if (cmp !== 0) return cmp;
    return a.dayNumber - b.dayNumber;
  });

  return lessons;
}

export async function fetchFirestoreLessonChunks(
  lessonId: string,
  googleApiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FirestoreLessonChunk[]> {
  const cleanId = lessonId.trim();
  const url = `https://firestore.googleapis.com/v1/projects/chunks-voicecloning-genshai/databases/(default)/documents/lessons/${cleanId}?key=${googleApiKey}`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    let errorText = "";
    try {
      errorText = await response.text();
    } catch {
      // ignore
    }
    throw new Error(
      `Firestore get lesson chunks failed (${response.status}): ${errorText}`,
    );
  }

  const doc = (await response.json()) as {
    fields?: {
      chunks?: {
        arrayValue?: {
          values?: Array<{
            mapValue?: {
              // deno-lint-ignore no-explicit-any
              fields?: Record<string, any>;
            };
          }>;
        };
      };
    };
  };

  const rawValues = doc.fields?.chunks?.arrayValue?.values ?? [];
  const chunks: FirestoreLessonChunk[] = [];

  for (const val of rawValues) {
    const f = val.mapValue?.fields;
    if (!f) continue;
    const chunkId = f.chunk_id?.stringValue ?? "";
    const english = f.english?.stringValue ?? "";
    const vietnamese = f.vietnamese?.stringValue ?? "";
    const category = f.category?.stringValue;

    if (english || vietnamese) {
      chunks.push({
        chunkId,
        english: english.trim(),
        vietnamese: vietnamese.trim(),
        category: category ? category.trim() : undefined,
      });
    }
  }

  return chunks;
}

export const GREEN_TEST_SESSION_LANGUAGES_7X3: Array<"vi" | "en"> = [
  "en",
  "en",
  "en",
  "vi",
  "vi",
  "vi",
  "en",
];
export const RED_TEST_SESSION_LANGUAGES_7X3: Array<"vi" | "en"> = [
  "vi",
  "vi",
  "vi",
  "en",
  "en",
  "en",
  "en",
];
export const RED_TEST_HINT_PROGRESSION_7X3 = [2, 3, 4, 2, 3, 4, 4];

export type CvrBreakdown = {
  tc: number; // Term/Chunk Complexity (1 for Green, 2-4 hints for Red)
  lc: number; // Lexical/Length Complexity (1.0 basic, 1.1-1.2 compound/eCommerce)
  tl: number; // Time Latency (1.0 for continuous Green, 2.0-3.0 for Red with 650ms pauses)
  cvr: number; // Cognitive Voltage Resistance in Ohms (TC * LC * TL)
  cci: number; // Cognitive Current Index in Amps
  cpd: number; // Cognitive Power Dissipation in Volts (CVR * CCI)
};

export function calculateCvr(tc: number, lc: number, tl: number): number {
  return Number((tc * lc * tl).toFixed(1));
}

export function calculateCpd(cvr: number, cci: number): number {
  return Number((cvr * cci).toFixed(1));
}

export function calculateCciFromCpd(targetCpd: number, cvr: number): number {
  if (cvr <= 0) return 1;
  return Math.max(1, Math.round(targetCpd / cvr));
}

export type GeneratePackageStructureInput = {
  testType: "GREEN" | "RED" | "green" | "red";
  lessonId: string;
  chunks: FirestoreLessonChunk[];
  targetQuestions?: 21 | 42 | 49 | number;
  sessionLayout?: "7x3" | "3x7" | "6x7" | "7x7" | string;
  sessionLanguages?: Array<"vi" | "en">;
  targetCpd?: number;
  packageCode?: string;
  title?: string;
  versionLabel?: string;
  lexicalComplexity?: number;
};

export type GeneratedPackageStructure = {
  packageCode: string;
  title: string;
  slug: string;
  description: string;
  versionLabel: string;
  testType: "GREEN" | "RED";
  targetQuestions: number;
  targetCpd: number;
  sessionLayout?: string;
  sessionLanguages?: Array<"vi" | "en">;
  lifecycleNarration: {
    package_start: { vi: string; en: string };
    part_intro: {
      1: { vi: string; en: string };
      2: { vi: string; en: string };
      3: { vi: string; en: string };
    };
    package_end: { vi: string; en: string };
  };
  sections: Array<{
    sectionOrder: number;
    part: number;
    title: string;
    targetCvrOhm: number;
    cciAmpe: number;
    cpd: number;
    sessionLanguage?: "vi" | "en";
    hintCount?: number;
    introTextVi: string;
    introTextEn: string;
    items: Array<{
      itemOrder: number;
      globalItemNumber: number;
      chunkIds: string[];
      termVi: string;
      termEn: string;
      promptVi: string;
      promptEn: string;
      spokenScriptVi: string | null;
      spokenScriptEn: string | null;
      tc: number;
      lc: number;
      tl: number;
      measuredCvr: number;
      cvrBreakdown?: CvrBreakdown;
    }>;
  }>;
  totalItems: number;
  previewItems: Array<{
    itemOrder: number;
    sessionOrder: number;
    termVi: string;
    termEn: string;
    promptVi: string;
    promptEn: string;
    tc: number;
    lc: number;
    tl: number;
    measuredCvr: number;
    spokenScriptVi: string | null;
    spokenScriptEn: string | null;
  }>;
};

export function generatePackageStructure(
  input: GeneratePackageStructureInput,
): GeneratedPackageStructure {
  const isRed = input.testType.toUpperCase() === "RED";
  const testType: "GREEN" | "RED" = isRed ? "RED" : "GREEN";

  let targetQuestions = Number(input.targetQuestions ?? 42);
  if (![21, 42, 49].includes(targetQuestions)) {
    targetQuestions = 42;
  }

  const chunks = input.chunks.length > 0
    ? input.chunks
    : [
        {
          chunkId: "fallback_01",
          english: "Focus term",
          vietnamese: "Thuật ngữ trọng tâm",
          category: "vocab",
        },
      ];

  const is7x3 = targetQuestions === 21 && input.sessionLayout === "7x3";
  const numSessions = is7x3
    ? 7
    : targetQuestions === 21
      ? (input.sessionLayout === "7x3" ? 7 : 3)
      : targetQuestions === 49
        ? 7
        : 6;
  const itemsPerSession = is7x3 ? 3 : targetQuestions === 21 && numSessions === 7 ? 3 : 7;
  const targetCpd = Number(input.targetCpd ?? (isRed ? 56 : 12));

  const packageCode = input.packageCode
    ? input.packageCode.trim()
    : isRed
      ? `R01-${targetQuestions}Q-${targetCpd}V`
      : `G01-${targetQuestions}Q-${targetCpd}V`;

  const title = input.title
    ? input.title.trim()
    : `${packageCode} (${isRed ? "Red Test - Awareness & Traps" : "Green Test - Focus"})`;

  const slug = `${packageCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
  const description = `${testType} Test generated from lesson ${input.lessonId} (${targetQuestions}Q - ${targetCpd}V)`;

  // Determine Part mapping for each session
  function getPartForSession(s: number): 1 | 2 | 3 {
    if (numSessions === 3) {
      return s as 1 | 2 | 3;
    }
    if (numSessions === 7) {
      if (s <= 2) return 1;
      if (s <= 4) return 2;
      return 3;
    }
    if (s <= 2) return 1;
    if (s <= 4) return 2;
    return 3;
  }

  const defaultSessionLanguages: Array<"vi" | "en"> = isRed
    ? (numSessions === 7 ? RED_TEST_SESSION_LANGUAGES_7X3 : ["vi", "vi", "vi", "en", "en", "en"])
    : (numSessions === 7 ? GREEN_TEST_SESSION_LANGUAGES_7X3 : ["en", "en", "en", "vi", "vi", "en"]);
  const activeSessionLanguages = input.sessionLanguages && input.sessionLanguages.length >= numSessions
    ? input.sessionLanguages
    : defaultSessionLanguages;

  // Pre-define Green test CVR bands and CCI progressions
  const greenCvrProgression: Record<number, number[]> = {
    3: [2, 6, 11],
    6: [1, 3, 5, 7, 9, 13],
    7: [2, 2, 3, 3, 4, 4, 6],
  };
  const greenCciProgression: Record<number, number[]> = {
    3: [2, 4, 6],
    6: [2, 2, 4, 4, 6, 6],
    7: [6, 6, 4, 4, 3, 3, 2],
  };

  const sections: GeneratedPackageStructure["sections"] = [];
  const previewItems: GeneratedPackageStructure["previewItems"] = [];
  let globalItemNumber = 0;

  for (let s = 1; s <= numSessions; s++) {
    const part = getPartForSession(s);
    const sessionLang = activeSessionLanguages[s - 1] ?? (isRed ? "vi" : "en");

    let sessionCvr: number;
    let sessionCci: number;
    let sessionCpd: number;
    let sessionHintCount: number;

    if (!isRed) {
      // Green Test: Continuous focus, TL = 1.0, Target 12V CPD (CPD = CVR * CCI)
      sessionHintCount = 1;
      if (numSessions === 7) {
        const baseCvrCurve = greenCvrProgression[7];
        const baseCciCurve = greenCciProgression[7];
        if (targetCpd === 12) {
          sessionCvr = baseCvrCurve[s - 1] ?? 3;
          sessionCci = baseCciCurve[s - 1] ?? 4;
          sessionCpd = calculateCpd(sessionCvr, sessionCci);
        } else {
          const scale = targetCpd / 12;
          sessionCvr = Number(((baseCvrCurve[s - 1] ?? 3) * scale).toFixed(1));
          sessionCci = calculateCciFromCpd(targetCpd, sessionCvr);
          sessionCpd = calculateCpd(sessionCvr, sessionCci);
        }
      } else {
        sessionCvr = greenCvrProgression[numSessions]?.[s - 1] ?? 3;
        sessionCci = greenCciProgression[numSessions]?.[s - 1] ?? 2;
        sessionCpd = calculateCpd(sessionCvr, sessionCci);
      }
    } else {
      // Red Test: Cognitive traps, exact hint progression [2, 3, 4, 2, 3, 4, 4] for 7 sessions
      sessionHintCount = numSessions === 7
        ? RED_TEST_HINT_PROGRESSION_7X3[s - 1] ?? 2
        : (s <= 3 ? 2 : 3);
      const tc = sessionHintCount;
      const lc = Number((input.lexicalComplexity ?? 1.15).toFixed(2));
      const tl = Number(
        (2.0 + ((s - 1) / Math.max(numSessions - 1, 1)) * 1.0).toFixed(1),
      );
      sessionCvr = calculateCvr(tc, lc, tl);
      sessionCci = calculateCciFromCpd(targetCpd, sessionCvr);
      sessionCpd = calculateCpd(sessionCvr, sessionCci);
    }

    const sessionTitle = `Session ${s}`;
    const introTextVi = isRed
      ? `Session ${s}: Mức kháng trở ${sessionCvr} Ohm, cường độ ${sessionCci} Ampe. Mục tiêu ${sessionCpd} CPD. Hãy sẵn sàng.`
      : `Session ${s}: Mức kháng trở ${sessionCvr} Ohm, cường độ ${sessionCci} Ampe. Bắt đầu bài tập.`;
    const introTextEn = isRed
      ? `Session ${s}: Resistance ${sessionCvr} Ohm, current ${sessionCci} Amps. Target ${sessionCpd} CPD. Get ready.`
      : `Session ${s}: Resistance ${sessionCvr} Ohm, current ${sessionCci} Amps. Ready to begin.`;

    const items: GeneratedPackageStructure["sections"][0]["items"] = [];

    for (let i = 1; i <= itemsPerSession; i++) {
      globalItemNumber += 1;
      const itemIndex = globalItemNumber - 1;

      if (!isRed) {
        // GREEN TEST (Focus)
        // 1 chunk / complete sentence per item, TL = 1.0
        const chunk = chunks[itemIndex % chunks.length];
        const lc = 1.0;
        const tl = 1.0;
        const tc = sessionCvr;
        const measuredCvr = calculateCvr(tc, lc, tl);

        const termVi = chunk.vietnamese;
        const termEn = chunk.english;
        const promptVi = chunk.vietnamese;
        const promptEn = chunk.english;

        const cvrBreakdown: CvrBreakdown = {
          tc,
          lc,
          tl,
          cvr: measuredCvr,
          cci: sessionCci,
          cpd: sessionCpd,
        };

        const item = {
          itemOrder: i,
          globalItemNumber,
          chunkIds: [chunk.chunkId],
          termVi,
          termEn,
          promptVi,
          promptEn,
          spokenScriptVi: null,
          spokenScriptEn: null,
          tc,
          lc,
          tl,
          measuredCvr,
          cvrBreakdown,
        };
        items.push(item);

        previewItems.push({
          itemOrder: i,
          sessionOrder: s,
          termVi,
          termEn,
          promptVi,
          promptEn,
          tc,
          lc,
          tl,
          measuredCvr,
          spokenScriptVi: null,
          spokenScriptEn: null,
        });
      } else {
        // RED TEST (Awareness & Traps)
        // Hints count according to session hint structure
        const combineCount = sessionHintCount;
        const selectedChunks: FirestoreLessonChunk[] = [];
        for (let c = 0; c < combineCount; c++) {
          const cIdx = (itemIndex * combineCount + c) % chunks.length;
          selectedChunks.push(chunks[cIdx]);
        }

        const chunkIds = selectedChunks.map((c) => c.chunkId);
        const termEn = selectedChunks.map((c) => c.english).join(" + ");
        const termVi = selectedChunks.map((c) => c.vietnamese).join(" + ");
        const promptEn = selectedChunks.map((c) => c.english).join(" / ");
        const promptVi = selectedChunks.map((c) => c.vietnamese).join(" / ");

        // Injects SSML with 650ms semantic gap between chunks
        const spokenScriptEn = `<speak>${selectedChunks.map((c) => `<s>${c.english}</s>`).join(' <break time="650ms"/> ')}</speak>`;
        const spokenScriptVi = `<speak>${selectedChunks.map((c) => `<s>${c.vietnamese}</s>`).join(' <break time="650ms"/> ')}</speak>`;

        const tl = Number(
          (2.0 + ((s - 1) / Math.max(numSessions - 1, 1)) * 1.0).toFixed(1),
        );
        const tc = combineCount;
        const lc = Number((input.lexicalComplexity ?? 1.15).toFixed(2));
        const measuredCvr = calculateCvr(tc, lc, tl);

        const cvrBreakdown: CvrBreakdown = {
          tc,
          lc,
          tl,
          cvr: measuredCvr,
          cci: sessionCci,
          cpd: sessionCpd,
        };

        const item = {
          itemOrder: i,
          globalItemNumber,
          chunkIds,
          termVi,
          termEn,
          promptVi,
          promptEn,
          spokenScriptVi,
          spokenScriptEn,
          tc,
          lc,
          tl,
          measuredCvr,
          cvrBreakdown,
        };
        items.push(item);

        previewItems.push({
          itemOrder: i,
          sessionOrder: s,
          termVi,
          termEn,
          promptVi,
          promptEn,
          tc,
          lc,
          tl,
          measuredCvr,
          spokenScriptVi,
          spokenScriptEn,
        });
      }
    }

    sections.push({
      sectionOrder: s,
      part,
      title: sessionTitle,
      targetCvrOhm: sessionCvr,
      cciAmpe: sessionCci,
      cpd: sessionCpd,
      sessionLanguage: sessionLang,
      hintCount: sessionHintCount,
      introTextVi,
      introTextEn,
      items,
    });
  }

  // Lifecycle Narration Scripts
  const lifecycleNarration: GeneratedPackageStructure["lifecycleNarration"] = {
    package_start: isRed
      ? {
          vi: "Chào mừng em đến với bài kiểm tra Red Test (Awareness & Traps). Bài kiểm tra được thiết kế với các bẫy nhận thức và sự ngắt nhịp để đo lường độ Nhận Thức và khả năng Phục Hồi. Hãy chú ý lắng nghe khoảng lặng và nắm bắt trọn vẹn ngữ cảnh.",
          en: "Welcome to the Red Test (Awareness & Recovery). This assessment introduces cognitive traps and pauses to measure your Awareness and Recovery reflexes. Pay close attention to pauses and context.",
        }
      : {
          vi: "Chào mừng em đến với bài kiểm tra Green Test (Focus). Bài kiểm tra đo lường mức độ Tập Trung và phản xạ cụm từ. Hãy lắng nghe và trả lời rõ ràng từng câu.",
          en: "Welcome to the Green Test (Focus). This assessment measures your Focus and language chunk reflexes. Listen carefully and answer each item clearly.",
        },
    part_intro: isRed
      ? {
          1: {
            vi: "Bắt đầu Phần 1: Nhận biết bẫy cấu trúc. Hãy lắng nghe khoảng lặng giữa các cụm.",
            en: "Starting Part 1: Structural Traps. Listen carefully to the gaps between chunks.",
          },
          2: {
            vi: "Bắt đầu Phần 2: Xử lý đa cụm từ và khoảng cách ngữ nghĩa. Duy trì nhận thức cao độ.",
            en: "Starting Part 2: Multi-Chunk Processing & Semantic Gaps. Maintain heightened awareness.",
          },
          3: {
            vi: "Bắt đầu Phần 3: Phục hồi sau bẫy nhận thức phức hợp. Bứt phá giới hạn phản xạ.",
            en: "Starting Part 3: Advanced Trap Recovery. Push through complex cognitive challenges.",
          },
        }
      : {
          1: {
            vi: "Bắt đầu Phần 1: Phản xạ cụm từ cơ bản. Hãy nghe và nói nhanh, chính xác.",
            en: "Starting Part 1: Core Chunk Reflexes. Listen and respond quickly and accurately.",
          },
          2: {
            vi: "Bắt đầu Phần 2: Mở rộng cụm từ câu ghép. Tăng dần tốc độ và độ chuẩn xác.",
            en: "Starting Part 2: Compound Phrase Expansion. Maintain steady speed and precision.",
          },
          3: {
            vi: "Bắt đầu Phần 3: Thử thách tập trung cao độ câu phức. Hoàn thành xuất sắc bài thi.",
            en: "Starting Part 3: High Focus Complex Challenge. Finish the test with confidence.",
          },
        },
    package_end: isRed
      ? {
          vi: "Chúc mừng em đã hoàn thành bài kiểm tra Red Test (Awareness). Em đã vượt qua các thử thách nhận thức rất xuất sắc!",
          en: "Congratulations on completing the Red Test (Awareness). You navigated the cognitive challenges successfully!",
        }
      : {
          vi: "Chúc mừng em đã hoàn thành toàn bộ bài kiểm tra Green Test (Focus). Em đã thể hiện sự tập trung rất tốt!",
          en: "Congratulations on completing the entire Green Test (Focus). Excellent focus and effort!",
        },
  };

  return {
    packageCode,
    title,
    slug,
    description,
    versionLabel: input.versionLabel?.trim() || "v1",
    testType,
    targetQuestions,
    targetCpd,
    sessionLayout: input.sessionLayout ?? (is7x3 ? "7x3" : targetQuestions === 21 ? "3x7" : undefined),
    sessionLanguages: activeSessionLanguages,
    lifecycleNarration,
    sections,
    totalItems: globalItemNumber,
    previewItems,
  };
}

export async function persistDraftPackage(
  structure: GeneratedPackageStructure,
  actorUserId: string,
  admin: SupabaseClientLike,
): Promise<{
  packageId: string;
  packageVersionId: string;
  title: string;
  itemsCount: number;
  previewItems: GeneratedPackageStructure["previewItems"];
}> {
  // 1. Resolve Organization Context
  const { data: memberOrg } = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", actorUserId)
    .limit(1)
    .maybeSingle();

  const { data: defaultOrg } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const organizationId = memberOrg?.organization_id ?? defaultOrg?.id;
  if (!organizationId) {
    throw new Error("No organization found to create test package.");
  }

  // 2. Insert into test_packages
  const { data: pkgRow, error: pkgError } = await admin
    .from("test_packages")
    .insert({
      organization_id: organizationId,
      title: structure.title,
      slug: structure.slug,
      description: structure.description,
      created_by_user_id: actorUserId,
      source_metadata: {
        generator: "live-test-generation",
        packageCode: structure.packageCode,
        testType: structure.testType,
        targetQuestions: structure.targetQuestions,
        targetCpd: structure.targetCpd,
        sessionLayout: structure.sessionLayout,
        sessionLanguages: structure.sessionLanguages,
        generatedAt: new Date().toISOString(),
      },
    })
    .select("id, title")
    .single();
  if (pkgError) {
    throw new Error(`Test package creation failed: ${pkgError.message}`);
  }

  // 3. Insert into test_package_versions
  const { data: verRow, error: verError } = await admin
    .from("test_package_versions")
    .insert({
      package_id: pkgRow.id,
      version_label: structure.versionLabel || "v1",
      status: "draft",
      created_by_user_id: actorUserId,
      source_metadata: {
        generator: "live-test-generation",
        packageCode: structure.packageCode,
        testType: structure.testType,
        targetQuestions: structure.targetQuestions,
        targetCpd: structure.targetCpd,
        sessionLayout: structure.sessionLayout,
        sessionLanguages: structure.sessionLanguages,
        lifecycleNarration: structure.lifecycleNarration,
      },
    })
    .select("id")
    .single();
  if (verError) {
    throw new Error(`Test package version creation failed: ${verError.message}`);
  }

  // 4. Insert sections and items
  for (const sec of structure.sections) {
    const { data: secRow, error: secError } = await admin
      .from("test_sections")
      .insert({
        package_version_id: verRow.id,
        section_order: sec.sectionOrder,
        title: sec.title,
        target_cvr_ohm: sec.targetCvrOhm,
        intro_text_vi: sec.introTextVi,
        intro_text_en: sec.introTextEn,
        metadata: {
          part: sec.part,
          cciAmpe: sec.cciAmpe,
          cpd: sec.cpd,
          sessionLanguage: sec.sessionLanguage,
          hintCount: sec.hintCount,
        },
      })
      .select("id")
      .single();
    if (secError) {
      throw new Error(`Test section creation failed: ${secError.message}`);
    }

    const itemRows = sec.items.map((it) => ({
      package_version_id: verRow.id,
      section_id: secRow.id,
      item_order: it.itemOrder,
      source_day: structure.packageCode,
      source_stt: String(it.globalItemNumber),
      term_vi: it.termVi,
      term_en: it.termEn,
      prompt_vi: it.promptVi,
      prompt_en: it.promptEn,
      spoken_script_vi: it.spokenScriptVi,
      spoken_script_en: it.spokenScriptEn,
      tc: it.tc,
      lc: it.lc,
      tl: it.tl,
      cvr_breakdown: it.cvrBreakdown ?? {
        tc: it.tc,
        lc: it.lc,
        tl: it.tl,
        cvr: it.measuredCvr,
        cci: sec.cciAmpe,
        cpd: sec.cpd,
      },
      source_metadata: {
        chunkIds: it.chunkIds,
        testType: structure.testType,
      },
    }));

    const { error: itemsError } = await admin.from("test_items").insert(itemRows);
    if (itemsError) {
      throw new Error(`Test items creation failed: ${itemsError.message}`);
    }
  }

  return {
    packageId: pkgRow.id,
    packageVersionId: verRow.id,
    title: pkgRow.title,
    itemsCount: structure.totalItems,
    previewItems: structure.previewItems,
  };
}
