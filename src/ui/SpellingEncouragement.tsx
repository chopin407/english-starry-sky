import { useState } from "react";

const messages = [
  "有几个字母走岔路了，看看它们该站在哪儿。",
  "拼写侦探出动，找找你的答案和原词哪里不同。",
  "这颗星还在眨眼，看看它的名字怎么拼。",
  "让耳朵当队友，听一遍再看看拼写。",
  "给字母排个队，看看谁该站前面。",
  "这个词值得再见一面，先看一眼它的拼法。",
  "把这个词拆成两小段，记起来可能更顺手。",
  "休息一秒，看看词尾是不是藏着一个小细节。",
  "试试读着记，把这个词的声音和字母连起来。",
  "再认识一次这个词，下次见面就更熟了。",
];

export function SpellingEncouragement() {
  const [message] = useState(() => messages[Math.floor(Math.random() * messages.length)]);
  return <span className="spelling-encouragement">{message}</span>;
}
