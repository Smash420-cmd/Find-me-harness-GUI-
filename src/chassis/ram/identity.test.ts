/** RAM SKU identity ladder — the logic that keeps Search 2 binary and stops a
 *  spec-identical-but-different product (or a massager) from wearing the crown. */
import { describe, expect, it } from "vitest";
import { skuIdentityOf, identityMatches, identityInBody, pseudoSpecFromTitle } from "./identity.js";

const CHOSEN = "G.Skill Trident Z RGB F4-3200C16D-16GTZR 16GB (2x8GB) 3200MHz DDR4";

describe("skuIdentityOf", () => {
  it("pulls the part number and the brand+line tokens", () => {
    const id = skuIdentityOf(CHOSEN);
    expect(id.part).toBe("F4-3200C16D-16GTZR");
    expect(id.tokens).toEqual(["gskill", "trident", "rgb"]);
  });
});

describe("identityMatches — the three verdicts", () => {
  const id = skuIdentityOf(CHOSEN);
  it("part-number containment wins through punctuation mangling", () => {
    expect(identityMatches(id, "[F4-3200C16D-16GTZR] G.Skill TridentZ RGB 16GB (2x8GB) DDR4 3200 - Scorptec")).toBe("part");
    expect(identityMatches(id, "gskill trident z rgb 16gb 2x8gb ddr4 3200 f4 3200c16d 16gtzr")).toBe("part");
  });
  it("brand+line tokens carry a no-MPN title", () => {
    expect(identityMatches(id, "G.Skill Trident Z RGB 16GB (2x8GB) DDR4 3200MHz CL16 Desktop RAM - Centre Com")).toBe("line");
  });
  it("rejects the spec-identical WRONG line, the non-RGB sibling, and a massager", () => {
    expect(identityMatches(id, "G.Skill Ripjaws V 16GB (2x8GB) DDR4 3200MHz CL16")).toBeNull();
    expect(identityMatches(id, "G.Skill Trident Z 16GB (2x8GB) DDR4 3200MHz")).toBeNull(); // no "rgb"
    expect(identityMatches(id, "Homedics Quattro Mini Handheld Massager")).toBeNull();
  });
});

describe("identityInBody — the escalation tier", () => {
  const id = skuIdentityOf(CHOSEN);
  it("finds the MPN in the page body when the title hid it", async () => {
    const body = async () => "<table><tr><td>Model#</td><td>F4-3200C16D-16GTZR</td></tr></table>";
    expect(await identityInBody(id, "https://x", body)).toBe(true);
  });
  it("false when the MPN is absent, and never throws on a fetch error", async () => {
    expect(await identityInBody(id, "https://x", async () => "no part number here")).toBe(false);
    expect(await identityInBody(id, "https://x", async () => { throw new Error("403"); })).toBe(false);
  });
  it("no part → can't escalate", async () => {
    expect(await identityInBody({ tokens: ["gskill"] }, "https://x", async () => "gskill")).toBe(false);
  });
});

describe("pseudoSpecFromTitle", () => {
  it("turns a chosen title into the identity gate spec", () => {
    const s = pseudoSpecFromTitle(CHOSEN);
    expect(s).toMatchObject({ generation: "DDR4", capacityGb: 16, kitCount: 2, perStickGb: 8, dataRateMtps: 3200 });
  });
  it("undefined when the title isn't RAM (a massager can't gate)", () => {
    expect(pseudoSpecFromTitle("Homedics Quattro Mini Handheld Massager")).toBeUndefined();
  });
});
