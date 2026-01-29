import { chromium } from "@playwright/test";
import { PlanningPage } from "../tests/helpers/planning-page";
import sharp from "sharp";
import { readdir, stat } from "fs/promises";

const SCREENSHOTS_DIR = "./public";

const SCREENSHOT_FILES = [
  "01-homepage.png",
  "02-join-room.png",
  "03-voting-session.png",
  "04-results.png",
  "05-consensus.png",
];

async function optimizeScreenshots() {
  console.log("🗜️  Optimizing screenshots...");

  for (const file of SCREENSHOT_FILES) {
    const filePath = `${SCREENSHOTS_DIR}/${file}`;
    const originalSize = (await stat(filePath)).size;

    await sharp(filePath)
      .png({ compressionLevel: 9, palette: true })
      .toBuffer()
      .then((buffer) => sharp(buffer).toFile(filePath));

    const optimizedSize = (await stat(filePath)).size;
    const savings = (((originalSize - optimizedSize) / originalSize) * 100).toFixed(1);
    console.log(`   ${file}: ${(originalSize / 1024).toFixed(0)}KB → ${(optimizedSize / 1024).toFixed(0)}KB (-${savings}%)`);
  }
}

async function generateScreenshots() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  try {
    // Screenshot 1: Homepage
    console.log("📸 Generating homepage screenshot...");
    const homePage = await context.newPage();
    await homePage.goto("http://localhost:5173");
    await homePage.waitForLoadState("networkidle");
    await homePage.screenshot({
      path: `${SCREENSHOTS_DIR}/01-homepage.png`,
      fullPage: false,
    });
    await homePage.close();

    // Screenshot 2: Room with join form
    console.log("📸 Generating join form screenshot...");
    const joinPage = await context.newPage();
    await joinPage.goto("http://localhost:5173");
    await joinPage.waitForLoadState("networkidle");
    await joinPage.getByRole("button", { name: "Create a Room" }).click();
    await joinPage.waitForURL(/\/room\/[A-Z0-9]+/);

    const url = joinPage.url();
    const roomCode = url.split("/room/")[1];

    await joinPage.screenshot({
      path: `${SCREENSHOTS_DIR}/02-join-room.png`,
      fullPage: false,
    });

    // Screenshot 3: Room with multiple members voting
    console.log("📸 Generating voting session screenshot...");
    const helper1 = new PlanningPage(joinPage);
    await helper1.joinRoom("Alice");

    // Add more members
    const context2 = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page2 = await context2.newPage();
    const helper2 = new PlanningPage(page2);
    await page2.goto(`http://localhost:5173/room/${roomCode}`);
    await helper2.joinRoom("Bob");

    const context3 = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page3 = await context3.newPage();
    const helper3 = new PlanningPage(page3);
    await page3.goto(`http://localhost:5173/room/${roomCode}`);
    await helper3.joinRoom("Charlie");

    const context4 = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page4 = await context4.newPage();
    const helper4 = new PlanningPage(page4);
    await page4.goto(`http://localhost:5173/room/${roomCode}`);
    await helper4.joinRoom("Diana");

    // Vote with different values
    await helper1.vote(5);
    await helper2.vote(8);
    await helper3.vote(5);

    await helper1.waitForSync();
    await joinPage.screenshot({
      path: `${SCREENSHOTS_DIR}/03-voting-session.png`,
      fullPage: false,
    });

    // Screenshot 4: Revealed votes with statistics
    console.log("📸 Generating results screenshot...");
    await helper4.vote(13);
    await helper1.waitForSync();
    await helper1.revealVotes();
    await helper1.waitForSync(1000);

    await joinPage.screenshot({
      path: `${SCREENSHOTS_DIR}/04-results.png`,
      fullPage: false,
    });

    // Screenshot 5: Consensus with confetti
    console.log("📸 Generating consensus screenshot...");
    await helper1.resetSession();
    await helper1.waitForSync();

    await helper1.vote(8);
    await helper2.vote(8);
    await helper3.vote(8);
    await helper4.vote(8);
    await helper1.waitForSync();

    await helper1.revealVotes();
    await helper1.waitForSync(500);

    await joinPage.screenshot({
      path: `${SCREENSHOTS_DIR}/05-consensus.png`,
      fullPage: false,
    });

    await page2.close();
    await page3.close();
    await page4.close();
    await context2.close();
    await context3.close();
    await context4.close();
    await joinPage.close();

    console.log("✅ All screenshots generated!");

    await optimizeScreenshots();

    console.log("✅ Done!");
  } catch (error) {
    console.error("❌ Error generating screenshots:", error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

generateScreenshots();
