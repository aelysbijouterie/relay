import { NextResponse, type NextRequest } from 'next/server'
import { sendEmail } from '@/lib/email'
import { emailAssigned, emailCrossTeam } from '@/emails/templates'

export async function POST(request: NextRequest) {
  const { assignees, task, department, createdByName, fromDept } = await request.json()

  console.log('[notify/assign] reçu —', assignees?.length, 'assigné(s)', assignees?.map((a: {email: string}) => a.email))
  console.log('[notify/assign] RESEND_API_KEY présente ?', !!process.env.RESEND_API_KEY)
  console.log('[notify/assign] RESEND_TEST_EMAIL ?', process.env.RESEND_TEST_EMAIL)

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
  console.log('[notify/assign] résultat —', sent, 'envoyés,', failed, 'échecs')
  return NextResponse.json({ sent, failed })
}
