import type { DeliveryTarget, Job } from '@shared/types'
import { postAgentMessageToGeneral } from '../agent'
import { pushToWeChat } from '../wechat'
import { pushToTelegram } from '../telegram'
import { pushToSlack } from '../slack'
import { pushToDiscord } from '../discord'
import { pushToWhatsApp } from '../whatsapp'

/**
 * A delivery channel knows how to push a job's result somewhere. New channels
 * only need to register here — the rest of the job pipeline stays untouched.
 */
interface DeliveryChannel {
  /** Send the job summary. Throw to signal failure; the dispatcher isolates it. */
  send(summary: string, job: Job): Promise<void>
}

const channels: Record<DeliveryTarget, DeliveryChannel> = {
  desktop: {
    async send(summary, job) {
      postAgentMessageToGeneral(`**${job.name}**\n\n${summary}`)
    }
  },
  wechat: {
    async send(summary) {
      await pushToWeChat(summary)
    }
  },
  telegram: {
    async send(summary) {
      await pushToTelegram(summary)
    }
  },
  slack: {
    async send(summary) {
      await pushToSlack(summary)
    }
  },
  discord: {
    async send(summary) {
      await pushToDiscord(summary)
    }
  },
  whatsapp: {
    async send(summary) {
      await pushToWhatsApp(summary)
    }
  }
}

/**
 * Fan out a finished job's summary to every configured delivery target.
 * Targets are independent: one failing (e.g. WeChat not connected) never blocks
 * the others, and delivery never throws back into the job runner.
 */
export async function deliverJobResult(job: Job, summary: string): Promise<void> {
  if (!summary || job.deliveryTargets.length === 0) return

  console.log(`[Job delivery] ${job.id} → targets: [${job.deliveryTargets.join(', ')}]`)

  await Promise.all(
    job.deliveryTargets.map(async (target) => {
      const channel = channels[target]
      if (!channel) return
      try {
        await channel.send(summary, job)
        console.log(`[Job delivery] ${job.id} → ${target} OK`)
      } catch (err) {
        console.error(`[Job delivery] ${job.id} → ${target} failed:`, err)
      }
    })
  )
}
