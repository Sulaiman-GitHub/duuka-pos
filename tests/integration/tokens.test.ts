import { beforeEach, describe, expect, it } from "vitest";
import { consumeToken, issueLink, peekToken } from "@/lib/tokens";
import { dbAvailable, makeShop, makeUser, resetDb, asPlatform, withShop } from "../helpers/db";

const up = await dbAvailable();
process.env.APP_URL = "https://duuka.example";
const tokenOf = (url: string) => new URL(url).searchParams.get("token")!;

describe.skipIf(!up)("one-time password links", () => {
  beforeEach(resetDb);

  it("issues a link that can be used exactly once, and stores only a hash", async () => {
    const shop = await makeShop();
    const u = await makeUser(shop.id, "CASHIER");
    const { url, sent } = await issueLink(u.id, "INVITE", u, shop.name);
    expect(sent).toBe(false); // no email provider configured in tests
    expect(url.startsWith("https://duuka.example/set-password?token=")).toBe(true);
    const t = tokenOf(url);
    const stored = await asPlatform((tx) => tx.authToken.findFirstOrThrow());
    expect(stored.tokenHash).not.toContain(t);

    expect((await peekToken(t))?.user.id).toBe(u.id);
    expect((await consumeToken(t, "new-hash"))?.id).toBe(u.id);
    expect((await asPlatform((tx) => tx.user.findUniqueOrThrow({ where: { id: u.id } }))).passwordHash).toBe("new-hash");
    expect(await consumeToken(t, "other-hash")).toBeNull(); // second use fails
    expect(await peekToken(t)).toBeNull();
  });

  it("rejects expired, forged and deactivated-user tokens", async () => {
    const shop = await makeShop();
    const u = await makeUser(shop.id);
    const t = tokenOf((await issueLink(u.id, "RESET", u, shop.name)).url);
    await asPlatform((tx) => tx.authToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } }));
    expect(await consumeToken(t, "h")).toBeNull();
    expect(await consumeToken("totally-forged-token-value-123456", "h")).toBeNull();

    const t2 = tokenOf((await issueLink(u.id, "RESET", u, shop.name)).url);
    await asPlatform((tx) => tx.user.update({ where: { id: u.id }, data: { isActive: false } }));
    expect(await consumeToken(t2, "h")).toBeNull();
  });

  it("a newer link replaces the older unused one", async () => {
    const shop = await makeShop();
    const u = await makeUser(shop.id);
    const a = tokenOf((await issueLink(u.id, "RESET", u, shop.name)).url);
    const b = tokenOf((await issueLink(u.id, "RESET", u, shop.name)).url);
    expect(await peekToken(a)).toBeNull();
    expect(await peekToken(b)).not.toBeNull();
  });

  it("is invisible to shop-scoped access", async () => {
    const shop = await makeShop();
    const u = await makeUser(shop.id);
    await issueLink(u.id, "INVITE", u, shop.name);
    expect(await withShop(shop.id, (tx) => tx.authToken.count())).toBe(0);
    await expect(withShop(shop.id, (tx) => tx.authToken.create({ data: { userId: u.id, purpose: "RESET", tokenHash: "x", expiresAt: new Date() } }))).rejects.toThrow();
  });
});
