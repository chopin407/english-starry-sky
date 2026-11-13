export const EXTENSION_UNIT = "拓展词汇";
export const CORE_VOCAB_UNIT = "核心短语与词汇";

/** 课本单元的短名："Starter Unit 1" → "S1"，"Unit 7" → "U7" */
export const unitShort = (title: string) => {
  if (title === EXTENSION_UNIT) return "拓展";
  if (title === CORE_VOCAB_UNIT) return "核心词汇";
  return title.replace("Starter Unit ", "S").replace(/^Unit /, "U");
};

/** "Starter Unit 1" → "starter-unit-1"，和考点数据里的单元 id 一致 */
export const unitId = (title: string) => title.toLowerCase().replace(/\s+/g, "-");

export const APP_NAME = "英语星穹";

/** 单元宝箱的记录名：七上沿用「Unit 1」（老存档不变），其他册加册号「8a Unit 1」，免得各册的 Unit 1 撞名 */
export const unitKey = (book: string | undefined, title: string) => (!book || book === "7a" ? title : `${book} ${title}`);

const BOOK_SHORT: Record<string, string> = { "6a": "六上", "7b": "七下", "8a": "八上", "8b": "八下", "9": "九年级", fltrp9a: "外研九" };
/** 显示用：「8a Unit 1」→「八上 Unit 1」 */
export const unitLabel = (key: string) => key.replace(/^(6a|7b|8a|8b|9|fltrp9a) /, (_, book: string) => `${BOOK_SHORT[book]} `);
