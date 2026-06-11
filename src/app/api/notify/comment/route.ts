import { NextResponse, type NextRequest } from 'next/server'
import { sendEmail } from '@/lib/email'
import { emailComment } from '@/emails/templates'

export async function POST(request: NextRequest) {
  const { assignees, comment, task, department, authorName } = await request.json()

  if (!assignees?.length) return NextResponse.json({ sent: 0 })

  const results = await Promise.allSettled(
    assignees.map(async (a: { name: string; email: string }) => {
      const tpl = emailComment({ assigneeName: a.name, authorName, comment, task, department })
      await sendEmail({ to: a.email, subject: tpl.subject, html: tpl.html })
    })
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ sent })
}
