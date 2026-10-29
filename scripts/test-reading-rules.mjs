import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

globalThis.window=globalThis;
window.QUIZ_DICT_RAW=true;
globalThis.fetch=async path=>{
  const data=fs.readFileSync(path);
  return {ok:true,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
};

vm.runInThisContext(fs.readFileSync("assets/js/reading-rules.js","utf8"));
vm.runInThisContext(fs.readFileSync("vendor/kuromoji.min.js","utf8"));

const rules=globalThis.QuizReadingRules;
assert.equal(rules.invariant("米"),"こめ");
assert.equal(rules.invariant("米国"),null);
assert.equal(rules.questionWord("でしょ"),"なん");
assert.equal(rules.questionWord("科"),"なに");
assert.equal(rules.questionWord("大学"),"なに");
assert.equal(rules.questionWord("現象"),"なに");
assert.equal(rules.questionWord("コーヒー"),"なに");
assert.equal(rules.questionWord("色"),"なに");
assert.equal(rules.phrases["何でしょう"],"なんでしょう");

const tokenizer=await globalThis.QuizTokenizer.build("dict/");
const tokens=tokenizer.tokenize("小麦・米・トウモロコシは何科の植物でしょう？");
const rice=tokens.find(token=>token.surface_form==="米");
const what=tokens.find(token=>token.surface_form==="何");
assert.equal(rules.invariant(rice.surface_form),"こめ");
assert.equal(rules.questionWord(tokens[tokens.indexOf(what)+1].surface_form),"なに");

const questions=JSON.parse(fs.readFileSync("data/questions.json","utf8"));
const standardEndings=questions.filter(item=>item.question.includes("何でしょう"));
assert.ok(standardEndings.length>100,"「何でしょう」を含む問題が監査対象にありません");
for(const item of standardEndings) assert.ok(rules.phrases["何でしょう"],item.id);

console.log(`読みルール: ${standardEndings.length}問の「何でしょう」+「米」+「何＋一般名詞」4例を確認`);
