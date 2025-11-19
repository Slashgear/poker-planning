import { Page, expect } from '@playwright/test'

export class PlanningPage {
  constructor(private page: Page) {}

  // Create a new room and return the room code
  async createRoom(): Promise<string> {
    await this.page.goto('/')
    await this.page.getByRole('button', { name: 'Create a Room' }).click()

    // Wait for navigation to room page
    await expect(this.page).toHaveURL(/\/room\/[A-Z0-9]+/)

    // Extract room code from URL
    const url = this.page.url()
    const code = url.split('/room/')[1]
    return code
  }

  // Go to a specific room
  async goToRoom(code: string) {
    await this.page.goto(`/room/${code}`)
  }

  // Join the room with a name
  async joinRoom(name: string) {
    await this.page.getByPlaceholder('Enter your name').fill(name)
    await this.page.getByRole('button', { name: 'Join Room' }).click()

    // Wait for voting interface to appear
    await expect(this.page.getByText('Your vote:')).toBeVisible()
  }

  // Vote with a specific value
  async vote(value: string | number) {
    // Target the voting cards section specifically
    const votingSection = this.page.locator('div').filter({ hasText: 'Your vote:' }).first()
    const voteButton = votingSection.locator('button').filter({ hasText: new RegExp(`^${value}$`) })
    await voteButton.click()
    await this.page.waitForTimeout(300)
  }

  // Verify that a member has voted (shows '?' before reveal)
  async expectMemberVoted(userName: string) {
    const memberCard = this.page.locator('.grid > div').filter({ hasText: userName })
    const voteDisplay = memberCard.locator('.text-3xl')
    await expect(voteDisplay).toHaveText('?')
  }

  // Verify that a member has not voted (shows '-')
  async expectMemberNotVoted(userName: string) {
    const memberCard = this.page.locator('.grid > div').filter({ hasText: userName })
    const voteDisplay = memberCard.locator('.text-3xl')
    await expect(voteDisplay).toHaveText('-')
  }

  // Reveal the votes
  async revealVotes() {
    await this.page.getByRole('button', { name: /Reveal Votes/ }).click()
  }

  // Verify the result of a revealed vote
  async expectRevealedVote(userName: string, value: string | number) {
    const memberCard = this.page.locator('.grid > div').filter({ hasText: userName })
    const voteDisplay = memberCard.locator('.text-3xl')
    await expect(voteDisplay).toHaveText(value.toString())
  }

  // Verify the average statistic
  async expectAverage(average: string) {
    await expect(this.page.getByText(`Average: ${average}`)).toBeVisible()
  }

  // Reset the session
  async resetSession() {
    await this.page.getByRole('button', { name: 'Reset' }).click()
  }

  // Verify the vote count in reveal button
  async expectVoteCount(voted: number, total: number) {
    await expect(this.page.getByRole('button', { name: `Reveal Votes (${voted}/${total})` })).toBeVisible()
  }

  // Wait for SSE synchronization
  async waitForSync(timeoutMs: number = 500) {
    await this.page.waitForTimeout(timeoutMs)
  }

  // Check if logged in as specific user
  async expectLoggedInAs(name: string) {
    await expect(this.page.getByText(`Logged in as: ${name}`)).toBeVisible()
  }

  // Remove a member from the room
  async removeMember(userName: string) {
    const memberCard = this.page.locator('.grid > div').filter({ hasText: userName })
    await memberCard.locator('button').click()
  }

  // Verify a member is no longer in the room
  async expectMemberNotPresent(userName: string) {
    const memberCard = this.page.locator('.grid > div').filter({ hasText: userName })
    await expect(memberCard).not.toBeVisible()
  }

  // Get the current room code from the page
  async getRoomCode(): Promise<string> {
    const codeText = await this.page.locator('text=Room:').locator('..').innerText()
    const match = codeText.match(/Room:\s*([A-Z0-9]+)/)
    return match ? match[1] : ''
  }
}
