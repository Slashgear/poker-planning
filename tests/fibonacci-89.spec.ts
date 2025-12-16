import { test } from "@playwright/test";
import { PlanningPage } from "./helpers/planning-page";

test.describe("Fibonacci value 89 support", () => {
  test("Users can vote with 89", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const user1 = new PlanningPage(page1);
    const user2 = new PlanningPage(page2);

    // Create room and join
    const roomCode = await user1.createRoom();
    await user1.joinRoom("Alice");

    await user2.goToRoom(roomCode);
    await user2.joinRoom("Bob");
    await user1.waitForSync();

    // Alice votes 89
    await user1.vote(89);
    await user1.waitForSync();

    // Verify Alice has voted
    await user1.expectMemberVoted("Alice");
    await user2.expectMemberVoted("Alice");
    await user1.expectVoteCount(1, 2);

    // Bob votes 55
    await user2.vote(55);
    await user2.waitForSync();

    await user1.expectVoteCount(2, 2);

    // Reveal votes
    await user1.revealVotes();
    await user1.waitForSync();

    // Verify revealed votes
    await user1.expectRevealedVote("Alice", "89");
    await user1.expectRevealedVote("Bob", "55");
    await user2.expectRevealedVote("Alice", "89");
    await user2.expectRevealedVote("Bob", "55");

    // Verify average: (89 + 55) / 2 = 72.0
    await user1.expectAverage("72.0");

    // Cleanup
    await context1.close();
    await context2.close();
  });

  test("Multiple users vote 89 and reach consensus", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const user1 = new PlanningPage(page1);
    const user2 = new PlanningPage(page2);

    // Create room and join
    const roomCode = await user1.createRoom();
    await user1.joinRoom("Alice");

    await user2.goToRoom(roomCode);
    await user2.joinRoom("Bob");
    await user1.waitForSync();

    // Both vote 89
    await user1.vote(89);
    await user2.vote(89);
    await user1.waitForSync();

    // Reveal votes - should trigger confetti on consensus
    await user1.revealVotes();
    await user1.waitForSync();

    // Verify revealed votes match
    await user1.expectRevealedVote("Alice", "89");
    await user1.expectRevealedVote("Bob", "89");

    // Cleanup
    await context1.close();
    await context2.close();
  });

  test("Mix of all Fibonacci values including 89, 55, and 34", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();

    const user1 = new PlanningPage(page1);
    const user2 = new PlanningPage(page2);
    const user3 = new PlanningPage(page3);

    // Create room and join
    const roomCode = await user1.createRoom();
    await user1.joinRoom("Alice");

    await user2.goToRoom(roomCode);
    await user2.joinRoom("Bob");

    await user3.goToRoom(roomCode);
    await user3.joinRoom("Charlie");
    await user1.waitForSync();

    // Vote with different Fibonacci values
    await user1.vote(89);
    await user2.vote(55);
    await user3.vote(34);
    await user1.waitForSync();

    await user1.expectVoteCount(3, 3);

    // Reveal votes
    await user1.revealVotes();
    await user1.waitForSync();

    // Verify all votes
    await user1.expectRevealedVote("Alice", "89");
    await user1.expectRevealedVote("Bob", "55");
    await user1.expectRevealedVote("Charlie", "34");

    // Verify average: (89 + 55 + 34) / 3 = 59.3
    await user1.expectAverage("59.3");

    // Cleanup
    await context1.close();
    await context2.close();
    await context3.close();
  });
});
