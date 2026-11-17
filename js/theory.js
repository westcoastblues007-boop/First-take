// 音楽理論ヘルパー（度数→半音数、正しい綴りの音名、移調）
const TUNING = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4（6弦→1弦）
const ROOTS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const BASE_SEMIS = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 2, 11: 5, 13: 9 };

function parseDegree(label) {
  if (label === 'R') return { acc: 0, num: 1 };
  const m = /^(bb|b|##|#)?(\d+)$/.exec(label);
  if (!m) throw new Error('bad degree ' + label);
  const acc = { bb: -2, b: -1, '': 0, '#': 1, '##': 2 }[m[1] || ''];
  return { acc, num: parseInt(m[2], 10) };
}

function degreeSemis(label) {
  const { acc, num } = parseDegree(label);
  return (((BASE_SEMIS[num] + acc) % 12) + 12) % 12;
}

// 度数のスケール内での番号（1〜7）
function degreeStep(label) {
  return ((parseDegree(label).num - 1) % 7) + 1;
}

function prettyDegree(label) {
  return label.replace(/bb/g, '𝄫').replace(/b/g, '♭').replace(/##/g, '𝄪').replace(/#/g, '♯');
}

// ルート(pc)と度数から、正しく綴った音名を返す（例: E♭ の ♯11 → A）
function spellNote(rootPc, label) {
  const rootLetter = LETTERS.indexOf(ROOTS[rootPc][0]);
  const step = degreeStep(label) - 1;
  const letterIdx = (rootLetter + step) % 7;
  const target = (rootPc + degreeSemis(label)) % 12;
  const diff = ((target - LETTER_PC[letterIdx] + 18) % 12) - 6;
  const acc = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' }[diff];
  return LETTERS[letterIdx] + (acc === undefined ? '?' : acc);
}

// C 基準のボイシングを rootPc へ移調
function transposeFrets(frets, rootPc) {
  const shifted = frets.map((f) => (f === null ? null : f + rootPc));
  const played = shifted.filter((f) => f !== null);
  const min = Math.min(...played);
  const max = Math.max(...played);
  if (min - 12 >= 1 || max > 15) return shifted.map((f) => (f === null ? null : f - 12));
  return shifted;
}

if (typeof module !== 'undefined') {
  module.exports = { TUNING, ROOTS, degreeSemis, degreeStep, spellNote, transposeFrets, prettyDegree };
}
