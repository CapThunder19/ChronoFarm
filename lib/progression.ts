import { EVENTS } from "@/lib/events";

type PrismaLike = {
  farm: {
    findMany: () => Promise<Array<{ id: string; xp: number | null; level: number | null }>>;
    update: (args: { where: { id: string }; data: { level?: number } }) => Promise<unknown>;
  };
  timeline: {
    findFirst: () => Promise<{ id: number; year: number } | null>;
    update: (args: { where: { id: number }; data: { year: number; lastAdvanced: Date } }) => Promise<unknown>;
  };
};

export function getLevelForXp(xp: number) {
  return Math.floor(xp / 100) + 1;
}

export function getYearForLevel(level: number) {
  const eventYears = Object.keys(EVENTS)
    .map((year) => parseInt(year, 10))
    .sort((a, b) => a - b);

  if (eventYears.length === 0) {
    return 1910;
  }

  const index = Math.max(0, Math.min(eventYears.length - 1, level - 1));
  return eventYears[index];
}

export async function syncProgression(db: PrismaLike) {
  const farms = await db.farm.findMany();
  let highestLevel = 1;

  for (const farm of farms) {
    const xp = farm.xp ?? 0;
    const newLevel = getLevelForXp(xp);

    if ((farm.level ?? 1) !== newLevel) {
      await db.farm.update({ where: { id: farm.id }, data: { level: newLevel } });
    }

    highestLevel = Math.max(highestLevel, newLevel);
  }

  const timeline = await db.timeline.findFirst();
  const mappedYear = getYearForLevel(highestLevel);

  if (timeline && timeline.year !== mappedYear) {
    await db.timeline.update({
      where: { id: timeline.id },
      data: { year: mappedYear, lastAdvanced: new Date() },
    });
  }

  return { level: highestLevel, year: mappedYear };
}

export async function syncProgressionForFarm(db: PrismaLike, farmId: string) {
  const farms = await db.farm.findMany();
  let targetFarm = farms.find((farm) => farm.id === farmId) ?? farms[0];
  let targetLevel = 1;

  if (targetFarm) {
    const xp = targetFarm.xp ?? 0;
    const newLevel = getLevelForXp(xp);

    if ((targetFarm.level ?? 1) !== newLevel) {
      await db.farm.update({ where: { id: targetFarm.id }, data: { level: newLevel } });
      targetFarm = { ...targetFarm, level: newLevel };
    }

    targetLevel = targetFarm.level ?? 1;
  }

  const timeline = await db.timeline.findFirst();
  const mappedYear = getYearForLevel(targetLevel);

  if (timeline && timeline.year !== mappedYear) {
    await db.timeline.update({
      where: { id: timeline.id },
      data: { year: mappedYear, lastAdvanced: new Date() },
    });
  }

  return { level: targetLevel, year: mappedYear };
}