export function baseHtml({
  title,
  preheader,
  content,
  deptColor = '#FF6B35',
}: {
  title: string
  preheader: string
  content: string
  deptColor?: string
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'DM Sans',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:${deptColor};border-radius:16px 16px 0 0;padding:28px 32px;">
          <span style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#fff;letter-spacing:2px;">RELAYS</span>
          <span style="display:block;color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px;">Aelys · Gestion de tâches</span>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#fff;padding:32px;border-radius:0 0 16px 16px;">
          ${content}
          <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0;" />
          <p style="color:#71717a;font-size:12px;margin:0;text-align:center;">
            Cet email a été envoyé automatiquement par RELAYS · Aelys<br/>
            <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://relays.vercel.app'}/kanban"
               style="color:${deptColor};text-decoration:none;">Ouvrir RELAYS →</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function taskBlock({
  task,
  deptColor,
}: {
  task: { title: string; priority: string; status: string; deadline?: string | null; description?: string | null }
  deptColor: string
}): string {
  const PRIORITY_COLOR: Record<string, string> = {
    Urgent:  '#ef4444',
    Élevée:  '#f97316',
    Moyenne: '#eab308',
    Faible:  '#22c55e',
  }
  const pc = PRIORITY_COLOR[task.priority] ?? '#94a3b8'

  return `
  <table width="100%" cellpadding="0" cellspacing="0"
    style="background:#f9fafb;border:1px solid #e4e4e7;border-left:4px solid ${deptColor};border-radius:10px;margin:16px 0;">
    <tr><td style="padding:16px 20px;">
      <p style="margin:0 0 8px;font-size:17px;font-weight:600;color:#18181b;">${task.title}</p>
      ${task.description ? `<p style="margin:0 0 12px;font-size:14px;color:#52525b;">${task.description}</p>` : ''}
      <span style="display:inline-block;background:${pc}22;color:${pc};border:1px solid ${pc}55;
        border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600;margin-right:8px;">${task.priority}</span>
      <span style="display:inline-block;background:#f1f5f9;color:#475569;
        border-radius:20px;padding:2px 10px;font-size:12px;">${task.status}</span>
      ${task.deadline ? `<span style="display:inline-block;margin-left:8px;color:#71717a;font-size:12px;">📅 ${new Date(task.deadline).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}</span>` : ''}
    </td></tr>
  </table>`
}
