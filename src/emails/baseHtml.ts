// ─────────────────────────────────────────────────────────────────────────────
// Gabarit HTML commun à tous les emails RELAYS (charte 2026).
// Header blanc épuré (logo « cartes translucides » + wordmark), fine barre
// d'accent dans la couleur de l'espace, carte de tâche claire, footer discret
// rappelant la préférence et le lien de désinscription.
// Styles 100% inline + tableaux : compatibilité maximale avec les clients mail.
// ─────────────────────────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aelys-relays.vercel.app'

// Logo « 3 cartes translucides » reconstruit en HTML/CSS inline (les SVG
// passent mal dans certains clients mail, on empile 3 carrés positionnés).
function logoMarkup(): string {
  return `
  <table cellpadding="0" cellspacing="0" style="display:inline-block;vertical-align:middle;"><tr><td>
    <div style="position:relative;width:30px;height:30px;">
      <span style="position:absolute;left:7px;top:1px;width:15px;height:15px;border-radius:4px;background:rgba(72,145,190,0.45);"></span>
      <span style="position:absolute;left:4px;top:5px;width:15px;height:15px;border-radius:4px;background:rgba(126,111,176,0.70);"></span>
      <span style="position:absolute;left:1px;top:9px;width:15px;height:15px;border-radius:4px;background:rgba(209,96,143,0.95);"></span>
    </div>
  </td></tr></table>`
}

export function baseHtml({
  title,
  preheader,
  content,
  deptColor = '#E0596A',
  accentBar,            // optionnel : dégradé custom (ex. inter-équipes)
  prefLabel,            // ex. « Tâche assignée » — affiché dans le footer
}: {
  title: string
  preheader: string
  content: string
  deptColor?: string
  accentBar?: string
  prefLabel?: string
}): string {
  const bar = accentBar ?? deptColor
  const prefLine = prefLabel
    ? `Tu reçois cet email car la notification «&nbsp;${prefLabel}&nbsp;» est activée.<br/>`
    : ''
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#EDEFF4;font-family:'Inter',-apple-system,'Segoe UI',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#EDEFF4;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(20,22,40,0.10);">

        <!-- Header blanc épuré -->
        <tr><td style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #EFF1F5;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:11px;">${logoMarkup()}</td>
            <td style="vertical-align:middle;">
              <div style="font-size:19px;font-weight:800;letter-spacing:-0.02em;color:#1C1E26;line-height:1.1;">relays</div>
              <div style="font-size:11px;font-weight:500;color:#9AA0AE;">Aelys · Gestion de tâches</div>
            </td>
          </tr></table>
        </td></tr>

        <!-- Barre d'accent -->
        <tr><td style="height:3px;background:${bar};font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Corps -->
        <tr><td style="background:#ffffff;padding:30px 32px 32px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F7F8FA;padding:20px 32px;text-align:center;">
          <p style="margin:0;color:#9AA0AE;font-size:11.5px;line-height:1.6;">
            ${prefLine}
            <a href="${APP_URL}/kanban" style="color:${deptColor};text-decoration:none;font-weight:600;">Ouvrir RELAYS</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/compte" style="color:#9AA0AE;text-decoration:none;font-weight:600;">Gérer mes notifications</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// Bloc « carte de tâche » réutilisable — style identique aux cartes de l'app.
export function taskBlock({
  task,
  deptColor,
}: {
  task: { title: string; priority: string; status: string; deadline?: string | null; description?: string | null }
  deptColor: string
}): string {
  const PRIORITY_COLOR: Record<string, string> = {
    Urgent:  '#EF4444',
    Élevée:  '#F97316',
    Moyenne: '#64748B',
    Faible:  '#22C55E',
  }
  const pc = PRIORITY_COLOR[task.priority] ?? '#94A3B8'

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #EAEDF2;border-radius:12px;margin:0 0 20px;">
    <tr>
      <td style="width:4px;background:${deptColor};border-radius:12px 0 0 12px;font-size:0;line-height:0;">&nbsp;</td>
      <td style="padding:15px 18px;">
        <p style="margin:0 0 5px;font-size:16px;font-weight:600;color:#1C1E26;">${task.title}</p>
        ${task.description ? `<p style="margin:0 0 11px;font-size:13.5px;color:#6A7180;line-height:1.5;">${task.description}</p>` : ''}
        <span style="display:inline-block;background:${pc}1A;color:${pc};border-radius:20px;padding:3px 10px;font-size:11.5px;font-weight:700;margin-right:6px;">${task.priority}</span>
        <span style="display:inline-block;background:#EEF1F5;color:#5A6276;border-radius:20px;padding:3px 10px;font-size:11.5px;margin-right:6px;">${task.status}</span>
        ${task.deadline ? `<span style="display:inline-block;color:#8089A0;font-size:11.5px;">📅 ${new Date(task.deadline).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}</span>` : ''}
      </td>
    </tr>
  </table>`
}

// Bouton d'action principal.
export function button({ label, color, href }: { label: string; color: string; href?: string }): string {
  const url = href ?? `${APP_URL}/kanban`
  return `<a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:12px 26px;border-radius:11px;text-decoration:none;font-weight:700;font-size:14px;">${label}</a>`
}