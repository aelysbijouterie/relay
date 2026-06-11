import { NextResponse, type NextRequest } from 'next/server'
import { sendEmail } from '@/lib/email'
import { emailAssigned, emailCrossTeam } from '@/emails/templates'

export async function POST(request: NextRequest) {
  const { assignees, task, department, createdByName, fromDept } = await request.json()

  if (!assignees?.length) return NextResponse.json({ sent: 0 })

  const results = await Promise.allSettled(
    assignees.map(async (a: { name: string; email: string }) => {
      const tpl = task.is_cross_team && fromDept
        ? emailCrossTeam({ assigneeName: a.name, createdByName, task, fromDept, toDept: department })
        : emailAssigned({ assigneeName: a.name, createdByName, task, department })
      await sendEmail({ to: a.email, subject: tpl.subject, html: tpl.html })
    })
  )

  const sent   = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  return NextResponse.json({ sent, failed })
}
