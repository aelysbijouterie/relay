import { baseHtml, taskBlock, button } from './baseHtml'

type TaskInfo = {
  title: string
  priority: string
  status: string
  deadline?: string | null
  description?: string | null
  is_cross_team?: boolean
}
type DeptInfo = { name: string; color: string }

const H2 = 'margin:0 0 10px;font-size:21px;font-weight:700;color:#1C1E26;letter-spacing:-0.01em;'
const INTRO = 'margin:0 0 20px;color:#5A6072;font-size:14.5px;line-height:1.6;'

// ── 1. Assignation ─────────────────────────────────────────────────────────────
export function emailAssigned({
  assigneeName, createdByName, task, department,
}: { assigneeName: string; createdByName: string; task: TaskInfo; department: DeptInfo }) {
  return {
    subject: `📌 Tu as été assigné·e — ${task.title}`,
    html: baseHtml({
      title: 'Nouvelle tâche assignée',
      preheader: `${createdByName} t'a assigné·e à « ${task.title} »`,
      deptColor: department.color,
      prefLabel: 'Tâche assignée',
      content: `
        <h2 style="${H2}">Nouvelle tâche assignée</h2>
        <p style="${INTRO}">
          Bonjour <strong>${assigneeName}</strong>,<br/>
          <strong>${createdByName}</strong> t'a assigné·e à une tâche dans l'espace
          <strong style="color:${department.color}">${department.name}</strong>.
        </p>
        ${taskBlock({ task, deptColor: department.color })}
        ${button({ label: 'Voir la tâche →', color: department.color })}
      `,
    }),
  }
}

// ── 2. Tâche inter-équipes ─────────────────────────────────────────────────────
export function emailCrossTeam({
  assigneeName, createdByName, task, fromDept, toDept,
}: { assigneeName: string; createdByName: string; task: TaskInfo; fromDept: DeptInfo; toDept: DeptInfo }) {
  return {
    subject: `🤝 Tâche inter-équipes — ${task.title}`,
    html: baseHtml({
      title: 'Tâche inter-équipes',
      preheader: `${fromDept.name} → ${toDept.name} : « ${task.title} »`,
      deptColor: toDept.color,
      accentBar: `linear-gradient(90deg, ${fromDept.color}, ${toDept.color})`,
      prefLabel: 'Tâche assignée',
      content: `
        <h2 style="${H2}">Tâche inter-équipes</h2>
        <p style="${INTRO}">
          Bonjour <strong>${assigneeName}</strong>,<br/>
          <strong>${createdByName}</strong> t'a inclus·e dans une tâche commune à deux espaces :
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
          <td><span style="display:inline-block;background:${fromDept.color};color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;">${fromDept.name}</span></td>
          <td style="padding:0 8px;color:#B0B6C2;font-size:15px;">→</td>
          <td><span style="display:inline-block;background:${toDept.color};color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;">${toDept.name}</span></td>
        </tr></table>
        ${taskBlock({ task, deptColor: toDept.color })}
        ${button({ label: 'Voir la tâche →', color: toDept.color })}
      `,
    }),
  }
}

// ── 3. Changement de statut ────────────────────────────────────────────────────
export function emailStatusChange({
  assigneeName, changedByName, task, oldStatus, department,
}: { assigneeName: string; changedByName: string; task: TaskInfo; oldStatus: string; department: DeptInfo }) {
  return {
    subject: `🔄 Statut mis à jour — ${task.title}`,
    html: baseHtml({
      title: 'Statut mis à jour',
      preheader: `${oldStatus} → ${task.status} · ${task.title}`,
      deptColor: department.color,
      prefLabel: 'Changement de statut',
      content: `
        <h2 style="${H2}">Statut mis à jour</h2>
        <p style="${INTRO}">
          Bonjour <strong>${assigneeName}</strong>,<br/>
          <strong>${changedByName}</strong> a changé le statut d'une tâche dans
          <strong style="color:${department.color}">${department.name}</strong>.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
          <td><span style="display:inline-block;background:#EEF1F5;color:#8089A0;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;">${oldStatus}</span></td>
          <td style="padding:0 10px;color:#B0B6C2;font-size:15px;">→</td>
          <td><span style="display:inline-block;background:${department.color}1A;color:${department.color};font-size:12px;font-weight:700;padding:5px 12px;border-radius:20px;">${task.status}</span></td>
        </tr></table>
        ${taskBlock({ task, deptColor: department.color })}
        ${button({ label: 'Voir la tâche →', color: department.color })}
      `,
    }),
  }
}

// ── 4. Rappel d'échéance ───────────────────────────────────────────────────────
export function emailDeadlineReminder({
  assigneeName, task, department, daysLeft,
}: { assigneeName: string; task: TaskInfo; department: DeptInfo; daysLeft: 1 | 3 }) {
  const isJ1 = daysLeft === 1
  const urgColor = isJ1 ? '#EF4444' : '#F97316'
  const urgBg    = isJ1 ? '#FEF2F2' : '#FFF7ED'
  const urgText  = isJ1 ? 'Échéance demain' : 'Échéance dans 3 jours'
  return {
    subject: isJ1 ? `🔴 Échéance demain — ${task.title}` : `🟡 Échéance dans 3 jours — ${task.title}`,
    html: baseHtml({
      title: "Rappel d'échéance",
      preheader: `${urgText} · ${task.title}`,
      deptColor: department.color,
      accentBar: urgColor,
      prefLabel: "Rappels d'échéance",
      content: `
        <h2 style="${H2}">Rappel d'échéance</h2>
        <p style="${INTRO}">
          Bonjour <strong>${assigneeName}</strong>,<br/>
          Une de tes tâches arrive à échéance <strong>${isJ1 ? 'demain' : 'dans 3 jours'}</strong>.
        </p>
        <div style="background:${urgBg};border:1px solid ${urgColor}44;border-radius:10px;padding:11px 16px;margin-bottom:18px;font-size:13.5px;font-weight:700;color:${urgColor};">
          ${isJ1 ? '🔴' : '🟡'}&nbsp; ${urgText}
        </div>
        ${taskBlock({ task, deptColor: department.color })}
        ${button({ label: 'Mettre à jour le statut →', color: department.color })}
      `,
    }),
  }
}

// ── 5. Récap hebdo ─────────────────────────────────────────────────────────────
export function emailWeeklyRecap({
  name, tasks, department,
}: { name: string; tasks: TaskInfo[]; department: DeptInfo }) {
  const urgent  = tasks.filter(t => t.priority === 'Urgent').length
  const enCours = tasks.filter(t => t.status === 'En cours').length
  const taskRows = tasks.map(t => taskBlock({ task: t, deptColor: department.color })).join('')
  return {
    subject: `📋 Récap hebdo — ${tasks.length} tâche${tasks.length > 1 ? 's' : ''} en cours`,
    html: baseHtml({
      title: 'Récap hebdomadaire',
      preheader: `${tasks.length} tâches · ${urgent} urgentes · ${enCours} en cours`,
      deptColor: department.color,
      prefLabel: 'Résumé hebdomadaire',
      content: `
        <h2 style="${H2}">Ton récap de la semaine</h2>
        <p style="${INTRO}">
          Bonjour <strong>${name}</strong>, voici un aperçu de tes tâches en cours pour bien démarrer la semaine.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;"><tr>
          <td style="text-align:center;background:#F7F8FA;border-radius:12px;padding:16px;">
            <span style="font-size:26px;font-weight:800;color:#1C1E26;">${tasks.length}</span>
            <span style="display:block;font-size:11.5px;color:#9098A8;">au total</span></td>
          <td width="12"></td>
          <td style="text-align:center;background:#FEF2F2;border-radius:12px;padding:16px;">
            <span style="font-size:26px;font-weight:800;color:#EF4444;">${urgent}</span>
            <span style="display:block;font-size:11.5px;color:#9098A8;">urgentes</span></td>
          <td width="12"></td>
          <td style="text-align:center;background:#EFF6FF;border-radius:12px;padding:16px;">
            <span style="font-size:26px;font-weight:800;color:#3E8FCC;">${enCours}</span>
            <span style="display:block;font-size:11.5px;color:#9098A8;">en cours</span></td>
        </tr></table>
        ${taskRows}
        ${button({ label: 'Ouvrir mon tableau →', color: department.color })}
      `,
    }),
  }
}

// ── 6. Mention dans un commentaire ─────────────────────────────────────────────
// (Remplace l'ancien email « commentaire » : on n'envoie QUE si la personne
//  est explicitement mentionnée avec @.)
export function emailMention({
  mentionedName, authorName, comment, task, department,
}: { mentionedName: string; authorName: string; comment: string; task: TaskInfo; department: DeptInfo }) {
  return {
    subject: `💬 ${authorName} t'a mentionné·e — ${task.title}`,
    html: baseHtml({
      title: 'Tu as été mentionné·e',
      preheader: `${authorName} t'a mentionné·e dans « ${task.title} »`,
      deptColor: department.color,
      prefLabel: 'Mentions',
      content: `
        <h2 style="${H2}">Tu as été mentionné·e</h2>
        <p style="${INTRO}">
          Bonjour <strong>${mentionedName}</strong>,<br/>
          <strong>${authorName}</strong> t'a mentionné·e dans un commentaire.
        </p>
        <div style="background:#F9FAFB;border-left:4px solid ${department.color};border-radius:0 10px 10px 0;padding:15px 18px;margin-bottom:18px;">
          <p style="margin:0;font-size:14.5px;color:#2C313D;line-height:1.6;">${comment}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#9098A8;">— ${authorName}</p>
        </div>
        ${taskBlock({ task, deptColor: department.color })}
        ${button({ label: 'Répondre →', color: department.color })}
      `,
    }),
  }
}
// ── 7. Assignation à une sous-tâche ────────────────────────────────────────────
export function emailSubtaskAssigned({
  assigneeName, createdByName, subtaskTitle, task, department, deadline,
}: { assigneeName: string; createdByName: string; subtaskTitle: string; task: TaskInfo; department: DeptInfo; deadline?: string | null }) {
  const deadlineLine = deadline
    ? `<p style="margin:0 0 18px;color:#8089A0;font-size:13px;">📅 À faire pour le ${new Date(deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>`
    : ''
  return {
    subject: `✅ Sous-tâche assignée — ${subtaskTitle}`,
    html: baseHtml({
      title: 'Sous-tâche assignée',
      preheader: `${createdByName} t'a confié une sous-tâche : ${subtaskTitle}`,
      deptColor: department.color,
      prefLabel: 'Tâche assignée',
      content: `
        <h2 style="${H2}">Une sous-tâche pour toi</h2>
        <p style="${INTRO}">
          Bonjour <strong>${assigneeName}</strong>,<br/>
          <strong>${createdByName}</strong> t'a assigné·e à une sous-tâche dans
          <strong style="color:${department.color}">${department.name}</strong>.
        </p>
        <div style="background:#F9FAFB;border-left:4px solid ${department.color};border-radius:0 10px 10px 0;padding:15px 18px;margin-bottom:14px;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#1C1E26;">${subtaskTitle}</p>
          <p style="margin:6px 0 0;font-size:12.5px;color:#9098A8;">dans la carte « ${task.title} »</p>
        </div>
        ${deadlineLine}
        ${button({ label: 'Voir la tâche →', color: department.color })}
      `,
    }),
  }
}

// ── Rappel « tâche qui stagne » (doux) ─────────────────────────────────────────
export function emailStaleReminder({
  assigneeName, task, department, days,
}: { assigneeName: string; task: TaskInfo; department: DeptInfo; days: number }) {
  const color = '#D97706'
  return {
    subject: `Un petit point sur « ${task.title} » ?`,
    html: baseHtml({
      title: 'Une tâche en pause',
      preheader: `Pas de mouvement depuis ${days} jours · ${task.title}`,
      deptColor: department.color,
      accentBar: color,
      prefLabel: 'Rappels de tâches',
      content: `
        <h2 style="${H2}">Une tâche semble en pause</h2>
        <p style="${INTRO}">
          Bonjour <strong>${assigneeName}</strong>,<br/>
          La tâche ci-dessous n'a pas bougé depuis <strong>${days} jours</strong>.
          Pas d'inquiétude — c'est juste un petit rappel au cas où elle t'était sortie de la tête.
          Si elle avance, pense à mettre à jour son statut ; sinon, tu peux l'ignorer.
        </p>
        ${taskBlock({ task, deptColor: department.color })}
        ${button({ label: 'Voir la tâche →', color: department.color })}
      `,
    }),
  }
}
