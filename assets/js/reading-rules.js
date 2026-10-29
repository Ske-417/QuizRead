(function(root){
  "use strict";

  const phrases={
    "何でしょう":"なんでしょう", "何でしょうか":"なんでしょうか",
    "何ですか":"なんですか", "何だろう":"なんだろう", "何である":"なんである",
    "何という":"なんという", "何と呼":"なんとよ", "何の":"なんの"
  };

  const nanFollower=/^(?:で|だ|と|の|ど|ね|な|日|年|月|時|回|人|本|度|番|曜|階|個|歳|枚|台|分|秒|点|倍|割|万|千|百|十|音|路|桁|鍵|か国|ヶ国|カ国|パーセント|グラム|キロ|メートル|角|乗|種類)/;

  root.QuizReadingRules=Object.freeze({
    phrases:Object.freeze(phrases),
    invariant(surface){
      if(surface==="米") return "こめ";
      if(/^何(?:でしょう|ですか|だろう|である)/.test(surface)) return surface.replace(/^何/,"なん");
      return null;
    },
    questionWord(nextSurface){
      if(nextSurface==="色") return "なに";
      if(!nextSurface || /^(?:を|が|は|も|より)/.test(nextSurface)) return "なに";
      // General nouns stay なに: 何科・何大学・何現象・何コーヒー, etc.
      // Counters are handled separately by the app's counter rules.
      if(nanFollower.test(nextSurface)) return "なん";
      return "なに";
    }
  });
})(typeof window!=="undefined" ? window : globalThis);
