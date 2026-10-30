import fs from "node:fs";

const files=[
  {name:"みんはや",url:new URL("../data/questions.json",import.meta.url)},
  {name:"ChatGPT",url:new URL("../data/questions-chatgpt.json",import.meta.url)}
];
const batches=files.map(file=>({name:file.name,questions:JSON.parse(fs.readFileSync(file.url,"utf8"))}));
const questions=batches.flatMap(batch=>batch.questions.map(question=>({...question,__source:batch.name})));
const requiredFields = ["id", "question", "answer", "genre"];
const errors = [];
const seen = new Map();
const seenIds = new Map();

for(const batch of batches) if(!Array.isArray(batch.questions)) errors.push(`${batch.name}: ルートは配列にしてください`);
if(!errors.length){
  questions.forEach((question, index) => {
    const label = `${question.__source} ${index + 1}問目`;
    for (const field of requiredFields) {
      if (typeof question[field] !== "string" || !question[field].trim()) {
        errors.push(`${label}: ${field} は空でない文字列にしてください`);
      }
    }
    const scopedId=`${question.__source}:${question.id}`;
    if (seenIds.has(scopedId)) {
      errors.push(`${label}: ${seenIds.get(scopedId)}と id が重複しています`);
    } else {
      seenIds.set(scopedId,label);
    }

    const key = `${question.question?.trim()}\u0000${question.answer?.trim()}`;
    if (seen.has(key)) {
      errors.push(`${label}: ${seen.get(key)}問目と問題文・答えが重複しています`);
    } else {
      seen.set(key, index + 1);
    }
  });
}

if (errors.length) {
  console.error(`問題データに ${errors.length} 件のエラーがあります`);
  errors.slice(0, 30).forEach(error => console.error(`- ${error}`));
  if (errors.length > 30) console.error(`- ほか ${errors.length - 30} 件`);
  process.exitCode = 1;
} else {
  const genres = new Set(questions.map(question => question.genre));
  console.log(`問題データ: ${batches.map(batch=>`${batch.name} ${batch.questions.length}問`).join(" / ")} / 合計${questions.length}問 / ${genres.size}ジャンル / エラーなし`);
}
