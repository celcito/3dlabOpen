import { describe, expect, it } from "vitest";
import { paintStateToHex } from "../threeMfExporter";

/**
 * Reference decoder mirroring Bambu Studio's TriangleSelector bitstream
 * (bbs_3mf.cpp): the hex string is read RIGHT-TO-LEFT, one nibble at a time.
 * Only whole-triangle leaves are decoded here (the case our exporter emits).
 */
function decodePaintColor(hex: string): number {
  const nibbles = hex.split("").reverse();
  let i = 0;
  const next = () => parseInt(nibbles[i++], 16);
  const code = next();
  const splitSides = code & 3;
  if (splitSides !== 0) {
    throw new Error(`split node não suportado neste decoder: ${hex}`);
  }
  const s2 = code >> 2;
  if (s2 !== 3) return s2; // slots 1-2 encode directly
  return 3 + next(); // marker C → escape, value nibble follows
}

describe("paintStateToHex", () => {
  it("codifica os slots 1..16 na tabela do Bambu", () => {
    expect(paintStateToHex(1)).toBe("4");
    expect(paintStateToHex(2)).toBe("8");
    expect(paintStateToHex(3)).toBe("0C");
    expect(paintStateToHex(4)).toBe("1C");
    expect(paintStateToHex(10)).toBe("7C");
    expect(paintStateToHex(16)).toBe("DC");
    for (let state = 3; state <= 16; state++) {
      expect(paintStateToHex(state)).toBe(`${(state - 3).toString(16).toUpperCase()}C`);
    }
  });

  it("faz round-trip contra o decoder de referência (bitstream lido da direita)", () => {
    for (let state = 1; state <= 16; state++) {
      expect(decodePaintColor(paintStateToHex(state))).toBe(state);
    }
  });

  it("lança RangeError para estado fora da faixa", () => {
    expect(() => paintStateToHex(0)).toThrow(RangeError);
    expect(() => paintStateToHex(-1)).toThrow(RangeError);
    expect(() => paintStateToHex(17)).toThrow(RangeError);
    expect(() => paintStateToHex(1.5)).toThrow(RangeError);
    expect(() => paintStateToHex(NaN)).toThrow(RangeError);
  });
});
