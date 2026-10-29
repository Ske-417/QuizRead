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
const compound=rules.applyLongest([{t:"txt",s:"日本語と日本書紀"}],[
  {map:{"日本":"にほんかたり"},src:"dict"},
  {map:{"日本語":"にほんご","日本書紀":"にほんしょき"},src:"core"}
]);
assert.deepEqual(compound.map(piece=>[piece.s,piece.r||null]),[
  ["日本語","にほんご"],["と",null],["日本書紀","にほんしょき"]
]);
const sameSurface=rules.applyLongest([{t:"txt",s:"日本語"}],[
  {map:{"日本語":"ユーザー"},src:"dict"},{map:{"日本語":"内蔵"},src:"core"}
]);
assert.equal(sameSurface[0].r,"ユーザー","同じ表記ではユーザー辞書を優先");

const tokenizer=await globalThis.QuizTokenizer.build("dict/");
const tokens=tokenizer.tokenize("小麦・米・トウモロコシは何科の植物でしょう？");
const rice=tokens.find(token=>token.surface_form==="米");
const what=tokens.find(token=>token.surface_form==="何");
assert.equal(rules.invariant(rice.surface_form),"こめ");
assert.equal(rules.questionWord(tokens[tokens.indexOf(what)+1].surface_form),"なに");

const questions=JSON.parse(fs.readFileSync("data/questions.json","utf8"));
assert.ok(!questions.some(item=>String(item.id)==="42620"),"削除対象の問題が残っています");
const standardEndings=questions.filter(item=>item.question.includes("何でしょう"));
assert.ok(standardEndings.length>100,"「何でしょう」を含む問題が監査対象にありません");
for(const item of standardEndings) assert.ok(rules.phrases["何でしょう"],item.id);

const dictionary=JSON.parse(fs.readFileSync("data/dictionary.json","utf8"));
const dictionaryKeys=Object.keys(dictionary).sort((a,b)=>b.length-a.length);
const historicalReadings={
  "公卿":"くぎょう","文武天皇":"もんむてんのう","元明天皇":"げんめいてんのう",
  "元正天皇":"げんしょうてんのう","日本書紀":"にほんしょき"
};
const historyQuestion=questions.find(item=>String(item.id)==="15702").question;
for(const [surface,reading] of Object.entries(historicalReadings)){
  assert.equal(dictionary[surface],reading,`${surface} の読み`);
  const offset=historyQuestion.indexOf(surface);
  assert.ok(offset>=0,`${surface} が監査対象の問題にありません`);
  assert.equal(dictionaryKeys.find(key=>historyQuestion.startsWith(key,offset)),surface,`${surface} が最長一致になっていません`);
}
const unresolved=[];
for(const item of questions){
  const plain=[]; let buffer="", offset=0;
  while(offset<item.question.length){
    const key=dictionaryKeys.find(candidate=>item.question.startsWith(candidate,offset));
    if(key){ if(buffer){ plain.push(buffer); buffer=""; } offset+=key.length; }
    else buffer+=item.question[offset++];
  }
  if(buffer) plain.push(buffer);
  for(const text of plain) for(const token of tokenizer.tokenize(text)){
    const unknown=!token.reading||token.word_type==="UNKNOWN";
    const alpha=token.surface_form;
    const handledAcronym=/^[A-Z]{2,}$/.test(alpha)||(/^[A-Za-z]+$/.test(alpha)&&alpha.length<=2);
    if(unknown&&/[㐀-鿿々〆ヵヶ]/.test(alpha)) unresolved.push(`${item.id}:${alpha}`);
    if(unknown&&/^[A-Za-z]+$/.test(alpha)&&!handledAcronym) unresolved.push(`${item.id}:${alpha}`);
  }
}
assert.deepEqual(unresolved,[],`未解決の読み: ${unresolved.join(", ")}`);
assert.match(fs.readFileSync("assets/js/app.js","utf8"),/add\("km ｋｍ",\{t:"U"/);

console.log(`読みルール: 全${questions.length}問の漢字・英字・単位と「何」の文脈を確認`);
