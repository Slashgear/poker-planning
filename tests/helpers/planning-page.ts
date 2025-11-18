import { Page, expect } from '@playwright/test'

export class PlanningPage {
  constructor(private page: Page) {}

  // Select a user
  async selectUser(userName: string) {
    await this.page.getByRole('button', { name: userName }).click()
    await expect(this.page.getByText('Choose your estimate')).toBeVisible()
  }

  // Vote with a specific value
  async vote(value: string | number) {
    const cardButton = this.page.getByLabel(value.toString(), { exact: true })
    await cardButton.click()

    // Wait for the card to be selected (optional, may cause timeouts)
    await this.page.waitForTimeout(300)
  }

  // Verify that a participant has voted
  async expectParticipantVoted(userName: string) {
    const participantCard = this.page.locator('.grid > div').filter({ hasText: userName })
    await expect(participantCard).toContainText('✓')
  }

  // Verify that a participant has not voted
  async expectParticipantNotVoted(userName: string) {
    const participantCard = this.page.locator('.grid > div').filter({ hasText: userName })
    await expect(participantCard).toContainText('?')
  }

  // Reveal the votes
  async revealVotes() {
    await this.page.getByRole('button', { name: /Reveal votes/ }).click()
  }

  // Verify the result of a revealed vote
  async expectRevealedVote(userName: string, value: string | number) {
    const participantCard = this.page.locator('.grid > div').filter({ hasText: userName })
    await expect(participantCard).toContainText(value.toString())
  }

  // Verify the statistics
  async expectStatistics(average: string, mode: string, votes: string) {
    await expect(this.page.getByText('Results')).toBeVisible()

    const avgSection = this.page.locator('div:has-text("Average")').first()
    await expect(avgSection).toContainText(average)

    const modeSection = this.page.locator('div:has-text("Mode")').first()
    await expect(modeSection).toContainText(mode)

    const votesSection = this.page.locator('div:has-text("Votes")').nth(1)
    await expect(votesSection).toContainText(votes)
  }

  // New estimate
  async resetSession() {
    await this.page.getByRole('button', { name: 'New estimate' }).click()
    await expect(this.page.getByText('Choose your estimate')).toBeVisible()
  }

  // Verify the vote count
  async expectVoteCount(voted: number, total: number) {
    await expect(this.page.getByText(`Participants (${voted}/${total})`)).toBeVisible()
  }

  // Wait for SSE synchronization
  async waitForSync(timeoutMs: number = 1000) {
    await this.page.waitForTimeout(timeoutMs)
  }
}