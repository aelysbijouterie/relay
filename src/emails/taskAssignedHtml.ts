// Génère le HTML de l'email d'assignation sans React (compatible App Router)
const PRIORITY_COLORS: Record<string, string> = {
  'Urgent':  '#EF4444',
  'Élevée':  '#F97316',
  'Moyenne': '#EAB308',
  'Faible':  '#6B7280',
}

interface TaskAssignedEmailProps {
  assigneeName: string
  taskTitle: string
  taskDescription?: string | null
  priority: string
  deadline?: string | null
  departmentName: string
  departmentColor: string
  createdByName: string
  isCrossTeam: boolean
  appUrl: string
}

export function taskAssignedHtml(p: TaskAssignedEmailProps): string {
  const priorityColor = PRIORITY_COLORS[p.priority] ?? '#6B7280'
  const deadlineStr = p.deadline
    ? new Date(p.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Nouvelle tâche assignée — RELAYS</title>
</head>
<body style="margin:0;padding:0;background:#f8f7f5;font-family:Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f5;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,${p.departmentColor},${p.departmentColor}99);padding:28px 32px">
            <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:10px;padding:6px 12px;margin-bottom:12px">
              <span style="color:#fff;font-size:12px;font-weight:600;letter-spacing:1px">RELAYS — ${esc(p.departmentName)}</span>
            </div>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;line-height:1.3;font-family:Georgia,serif">
              Vous avez été assigné(e) à une tâche
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px">
            <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6">
              Bonjour <strong>${esc(p.assigneeName)}</strong>,<br/>
              <strong>${esc(p.createdByName)}</strong> vous a assigné(e) à la tâche suivante :
            </p>

            <!-- Task card -->
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid ${p.departmentColor};border-radius:12px;padding:20px 24px;margin-bottom:24px">
              <h2 style="margin:0 0 12px;color:#111827;font-size:17px;font-weight:600;line-height:1.4">
                ${esc(p.taskTitle)}
              </h2>
              ${p.taskDescription ? `<p style="margin:0 0 16px;color:#6b7280;font-size:14px;line-height:1.6">${esc(p.taskDescription)}</p>` : ''}
              <span style="display:inline-block;background:${priorityColor};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-right:8px">
                ${esc(p.priority)}
              </span>
              ${p.isCrossTeam ? `<span style="display:inline-block;border:1px solid #d1d5db;color:#6b7280;font-size:11px;font-weight:500;padding:3px 10px;border-radius:999px">🌐 Inter-équipes</span>` : ''}
              ${deadlineStr ? `<p style="margin:12px 0 0;color:#6b7280;font-size:13px">📅 Échéance : <strong style="color:#374151">${deadlineStr}</strong></p>` : ''}
            </div>

            <!-- CTA -->
            <div style="text-align:center;margin-bottom:24px">
              <a href="${p.appUrl}/kanban"
                style="display:inline-block;background:linear-gradient(135deg,${p.departmentColor},${p.departmentColor}bb);color:#fff;text-decoration:none;padding:13px 32px;border-radius:12px;font-size:14px;font-weight:600">
                Voir la tâche dans RELAYS →
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:16px 32px;border-top:1px solid #e5e7eb">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center">
              RELAYS · Gestion de tâches Aelys · Message automatique.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
