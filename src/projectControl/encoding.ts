const utf8DecoderStrict = new TextDecoder("utf-8", { fatal: true });
const utf8Decoder = new TextDecoder("utf-8");
const cp1251Decoder = new TextDecoder("windows-1251");
const cp1251EncodeMap = new Map<string, number>();

for (let i = 0; i < 256; i += 1) {
  const ch = cp1251Decoder.decode(Uint8Array.from([i]));
  if (!cp1251EncodeMap.has(ch)) {
    cp1251EncodeMap.set(ch, i);
  }
}

function cyrillicCount(text: string): number {
  const matches = text.match(/[А-Яа-яЁё]/g);
  return matches ? matches.length : 0;
}

function mojibakeCount(text: string): number {
  const seqMatches = text.match(/[РС][^\s]/g);
  const replacementMatches = text.match(/�/g);
  return (seqMatches ? seqMatches.length : 0) + (replacementMatches ? replacementMatches.length : 0) * 3;
}

function scoreRussianReadability(text: string): number {
  return cyrillicCount(text) * 2 - mojibakeCount(text) * 3;
}

export function repairCommonMojibake(text: string): string {
  // Typical case: UTF-8 text displayed as cp1251 (`РџСЂ...`).
  const bytes: number[] = [];
  for (const ch of text) {
    const mapped = cp1251EncodeMap.get(ch);
    if (mapped === undefined) {
      return text;
    }
    bytes.push(mapped);
  }
  const repaired = utf8Decoder.decode(Uint8Array.from(bytes));
  const sourceScore = scoreRussianReadability(text);
  const repairedScore = scoreRussianReadability(repaired);
  if (repairedScore >= sourceScore + 4 && cyrillicCount(repaired) > 0) {
    return repaired;
  }
  return text;
}

export function decodeTextBytes(bytes: Uint8Array): string {
  let utf8Text = "";
  let utf8Ok = true;
  try {
    utf8Text = utf8DecoderStrict.decode(bytes);
  } catch {
    utf8Ok = false;
    utf8Text = utf8Decoder.decode(bytes);
  }

  const cp1251Text = cp1251Decoder.decode(bytes);
  const repairedUtf8 = repairCommonMojibake(utf8Text);

  const utf8Score = scoreRussianReadability(repairedUtf8);
  const cp1251Score = scoreRussianReadability(cp1251Text);
  if (!utf8Ok && cp1251Score > utf8Score) {
    return cp1251Text;
  }
  if (cp1251Score >= utf8Score + 4 && cyrillicCount(cp1251Text) > 0) {
    return cp1251Text;
  }
  return repairedUtf8;
}
