import { test } from '@playwright/test'
import { PlanningPage } from './helpers/planning-page'

test.describe('Poker Planning Session - Dynamic Rooms', () => {
  test('Complete session with 3 users voting', async ({ browser }) => {
    // Create 3 independent browser contexts (simulates 3 users)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    const context3 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    const page3 = await context3.newPage()

    const user1 = new PlanningPage(page1)
    const user2 = new PlanningPage(page2)
    const user3 = new PlanningPage(page3)

    // Step 1: User 1 creates a room
    const roomCode = await user1.createRoom()
    await user1.joinRoom('Alice')
    await user1.expectLoggedInAs('Alice')

    // Step 2: Users 2 and 3 join the same room
    await user2.goToRoom(roomCode)
    await user2.joinRoom('Bob')
    await user2.expectLoggedInAs('Bob')

    await user3.goToRoom(roomCode)
    await user3.joinRoom('Charlie')
    await user3.expectLoggedInAs('Charlie')

    // Wait for synchronization
    await user1.waitForSync()

    // Verify that all see 3 members
    await user1.expectVoteCount(0, 3)
    await user2.expectVoteCount(0, 3)
    await user3.expectVoteCount(0, 3)

    // Step 3: Alice votes 5
    await user1.vote(5)
    await user1.waitForSync()

    // Verify that all others see that Alice has voted
    await user1.expectMemberVoted('Alice')
    await user2.expectMemberVoted('Alice')
    await user3.expectMemberVoted('Alice')

    await user1.expectVoteCount(1, 3)
    await user2.expectVoteCount(1, 3)

    // Step 4: Bob votes 8
    await user2.vote(8)
    await user2.waitForSync()

    await user1.expectMemberVoted('Bob')
    await user3.expectMemberVoted('Bob')
    await user1.expectVoteCount(2, 3)

    // Step 5: Charlie votes 5
    await user3.vote(5)
    await user3.waitForSync()

    // All 3 have voted
    await user1.expectVoteCount(3, 3)
    await user2.expectVoteCount(3, 3)

    // Step 6: Alice reveals the votes
    await user1.revealVotes()
    await user1.waitForSync()

    // All see the revealed results
    await user1.expectRevealedVote('Alice', '5')
    await user1.expectRevealedVote('Bob', '8')
    await user1.expectRevealedVote('Charlie', '5')

    await user2.expectRevealedVote('Alice', '5')
    await user2.expectRevealedVote('Bob', '8')

    await user3.expectRevealedVote('Charlie', '5')
    await user3.expectRevealedVote('Alice', '5')

    // Verify average: (5 + 8 + 5) / 3 = 6.0
    await user1.expectAverage('6.0')
    await user2.expectAverage('6.0')

    // Step 7: Reset for new estimate
    await user1.resetSession()
    await user1.waitForSync()

    // All see the reset
    await user1.expectVoteCount(0, 3)
    await user2.expectVoteCount(0, 3)
    await user3.expectVoteCount(0, 3)

    await user1.expectMemberNotVoted('Alice')
    await user2.expectMemberNotVoted('Bob')
    await user3.expectMemberNotVoted('Charlie')

    // Cleanup
    await context1.close()
    await context2.close()
    await context3.close()
  })

  test('Reveal before everyone has voted', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    const user1 = new PlanningPage(page1)
    const user2 = new PlanningPage(page2)

    // Create room and join
    const roomCode = await user1.createRoom()
    await user1.joinRoom('Alice')

    await user2.goToRoom(roomCode)
    await user2.joinRoom('Bob')
    await user1.waitForSync()

    // Only Alice votes
    await user1.vote(8)
    await user1.waitForSync()

    await user1.expectVoteCount(1, 2)

    // Alice reveals even though not everyone has voted
    await user1.revealVotes()
    await user1.waitForSync()

    // Revealed votes show actual value for Alice, null for Bob
    await user1.expectRevealedVote('Alice', '8')
    await user2.expectRevealedVote('Alice', '8')

    // Cleanup
    await context1.close()
    await context2.close()
  })

  test('New user joins an ongoing session', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    const user1 = new PlanningPage(page1)
    const user2 = new PlanningPage(page2)

    // Alice creates room and votes
    const roomCode = await user1.createRoom()
    await user1.joinRoom('Alice')
    await user1.vote(5)
    await user1.waitForSync()

    // Bob joins afterwards
    await user2.goToRoom(roomCode)
    await user2.joinRoom('Bob')
    await user2.waitForSync()

    // Bob sees that Alice has already voted
    await user2.expectMemberVoted('Alice')
    await user2.expectVoteCount(1, 2)

    // Bob also votes
    await user2.vote(8)
    await user2.waitForSync()

    // Alice sees Bob's vote
    await user1.expectMemberVoted('Bob')
    await user1.expectVoteCount(2, 2)

    // Cleanup
    await context1.close()
    await context2.close()
  })

  test('Remove member from room', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    const user1 = new PlanningPage(page1)
    const user2 = new PlanningPage(page2)

    // Create room with two users
    const roomCode = await user1.createRoom()
    await user1.joinRoom('Alice')

    await user2.goToRoom(roomCode)
    await user2.joinRoom('Bob')
    await user1.waitForSync()

    await user1.expectVoteCount(0, 2)

    // Alice removes Bob
    await user1.removeMember('Bob')
    await user1.waitForSync()

    // Bob is no longer visible to Alice
    await user1.expectMemberNotPresent('Bob')
    await user1.expectVoteCount(0, 1)

    // Cleanup
    await context1.close()
    await context2.close()
  })

  test('Consensus triggers confetti', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    const user1 = new PlanningPage(page1)
    const user2 = new PlanningPage(page2)

    // Create room
    const roomCode = await user1.createRoom()
    await user1.joinRoom('Alice')

    await user2.goToRoom(roomCode)
    await user2.joinRoom('Bob')
    await user1.waitForSync()

    // Both vote the same value
    await user1.vote(5)
    await user2.vote(5)
    await user1.waitForSync()

    // Reveal - should show same votes
    await user1.revealVotes()
    await user1.waitForSync()

    await user1.expectRevealedVote('Alice', '5')
    await user1.expectRevealedVote('Bob', '5')

    // Cleanup
    await context1.close()
    await context2.close()
  })

  test('Duplicate name is rejected', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    const user1 = new PlanningPage(page1)

    // Create room and join as Alice
    const roomCode = await user1.createRoom()
    await user1.joinRoom('Alice')

    // Try to join with same name
    await page2.goto(`/room/${roomCode}`)
    await page2.getByPlaceholder('Enter your name').fill('Alice')
    await page2.getByRole('button', { name: 'Join Room' }).click()

    // Should show error
    await page2.waitForTimeout(500)
    await page2.getByText('Name already taken').waitFor({ state: 'visible' })

    // Cleanup
    await context1.close()
    await context2.close()
  })
})
