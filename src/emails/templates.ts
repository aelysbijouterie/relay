import { baseHtml, taskBlock } from './baseHtml'

type TaskInfo = {
  title: string
  priority: string
  status: string
  deadline?: string | null
  description?: string | null
  is_cross_team?: boolean
}

type DeptInfo = { name: string; color: string }

// ── 1. Assignation ─────────────────────────────────────────────────────────────
export function emailAssigned({
  assigneeName, createdByName, task, department,
}: {
  assigneeName: string
  createdByName: string
  task: TaskInfo
  department: DeptInfo
}) {
  return {
    subject: `📌 Tu as été assigné·e — ${task.title}`,
    html: baseHtml({
      title: `Nouvelle tâche assignée`,
      preheader: `${createdByName} t'a assigné·e à "${task.title}"`,
      deptColor: department.color,
      content: `
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Nouvelle tâche assignée</h2>
        <p style="margin:0 0 20px;color:#52525b;font-size:15px;">
          Bonjour <strong>${assigneeName}</strong>,<br/>
          <strong>${createdByName}</strong> t'a assigné·e à la tâche suivante dans le département <strong>${department.name}</strong>.
        </p>
        ${taskBlock({ task, deptColor: department.color })}
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://relays.vercel.app'}/kanban"
           style="display:inline-block;margin-top:20px;background:${department.color};color:#fff;
           padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
          Voir la tâche →
        </a>
      `,
    }),
  }
}

// ── 2. Tâche inter-équipes ─────────────────────────────────────────────────────
export function emailCrossTeam({
  assigneeName, createdByName, task, fromDept, toDept,
}: {
  assigneeName: string
  createdByName: string
  task: TaskInfo
  fromDept: DeptInfo
  toDept: DeptInfo
}) {
  return {
    subject: `🤝 Tâche inter-équipes — ${task.title}`,
    html: baseHtml({
      title: `Tâche inter-équipes`,
      preheader: `${fromDept.name} → ${toDept.name} : "${task.title}"`,
      deptColor: fromDept.color,
      content: `
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Tâche inter-équipes</h2>
        <p style="margin:0 0 20px;color:#52525b;font-size:15px;">
          Bonjour <strong>${assigneeName}</strong>,<br/>
          <strong>${createdByName}</strong> t'a inclus·e dans une tâche qui implique
          <strong style="color:${fromDept.color}">${fromDept.name}</strong> et
          <strong style="color:${toDept.color}">${toDept.name}</strong>.
        </p>
        ${taskBlock({ task, deptColor: fromDept.color })}
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://relays.vercel.app'}/kanban"
           style="display:inline-block;margin-top:20px;background:${fromDept.color};color:#fff;
           padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
          Voir la tâche →
        </a>
      `,
    }),
  }
}

// ── 3. Changement de statut ────────────────────────────────────────────────────
export function emailStatusChange({
  assigneeName, changedByName, task, oldStatus, department,
}: {
  assigneeName: string
  changedByName: string
  task: TaskInfo
  oldStatus: string
  department: DeptInfo
}) {
  return {
    subject: `🔄 Statut mis à jour — ${task.title}`,
    html: baseHtml({
      title: `Statut mis à jour`,
      preheader: `${task.title} : ${oldStatus} → ${task.status}`,
      deptColor: department.color,
      content: `
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Statut mis à jour</h2>
        <p style="margin:0 0 20px;color:#52525b;font-size:15px;">
          Bonjour <strong>${assigneeName}</strong>,<br/>
          <strong>${changedByName}</strong> a modifié le statut de ta tâche.
        </p>
        <p style="margin:0 0 16px;font-size:15px;">
          <span style="background:#f1f5f9;padding:4px 12px;border-radius:20px;color:#64748b;">${oldStatus}</span>
          <span style="margin:0 12px;color:#94a3b8;">→</span>
          <span style="background:${department.color}22;padding:4px 12px;border-radius:20px;
            color:${department.color};font-weight:600;border:1px solid ${department.color}44;">${task.status}</span>
        </p>
        ${taskBlock({ task, deptColor: department.color })}
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://relays.vercel.app'}/kanban"
           style="display:inline-block;margin-top:20px;background:${department.color};color:#fff;
           padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
          Ouvrir le kanban →
        </a>
      `,
    }),
  }
}

// ── 4. Rappel d'échéance ───────────────────────────────────────────────────────
export function emailDeadlineReminder({
  assigneeName, task, department, daysLeft,
}: {
  assigneeName: string
  task: TaskInfo
  department: DeptInfo
  daysLeft: 1 | 3
}) {
  const urgency  = daysLeft === 1 ? '🔴 Demain !' : '🟡 Dans 3 jours'
  const subject  = daysLeft === 1
    ? `🔴 Échéance demain — ${task.title}`
    : `🟡 Échéance dans 3 jours — ${task.title}`

  return {
    subject,
    html: baseHtml({
      title: `Rappel d'échéance`,
      preheader: `${urgency} · ${task.title}`,
      deptColor: daysLeft === 1 ? '#ef4444' : '#f97316',
      content: `
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Rappel d'échéance</h2>
        <p style="margin:0 0 20px;color:#52525b;font-size:15px;">
          Bonjour <strong>${assigneeName}</strong>,<br/>
          La tâche suivante arrive à échéance <strong>${daysLeft === 1 ? 'demain' : 'dans 3 jours'}</strong>.
        </p>
        <div style="background:${daysLeft === 1 ? '#fef2f2' : '#fff7ed'};border:1px solid ${daysLeft === 1 ? '#fecaca' : '#fed7aa'};
          border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:14px;font-weight:600;
          color:${daysLeft === 1 ? '#dc2626' : '#ea580c'};">
          ${urgency}
        </div>
        ${taskBlock({ task, deptColor: department.color })}
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://relays.vercel.app'}/kanban"
           style="display:inline-block;margin-top:20px;background:${department.color};color:#fff;
           padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
          Mettre à jour le statut →
        </a>
      `,
    }),
  }
}

// ── 5. Récap hebdo ─────────────────────────────────────────────────────────────
export function emailWeeklyRecap({
  name, tasks, department,
}: {
  name: string
  tasks: TaskInfo[]
  department: DeptInfo
}) {
  const taskRows = tasks.map(t => taskBlock({ task: t, deptColor: department.color })).join('')
  const urgent   = tasks.filter(t => t.priority === 'Urgent').length
  const enCours  = tasks.filter(t => t.status === 'En cours').length

  return {
    subject: `📋 Récap hebdo — ${tasks.length} tâche${tasks.length > 1 ? 's' : ''} en cours`,
    html: baseHtml({
      title: `Récap hebdomadaire`,
      preheader: `${tasks.length} tâches · ${urgent} urgentes · ${enCours} en cours`,
      deptColor: department.color,
      content: `
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Récap de la semaine</h2>
        <p style="margin:0 0 20px;color:#52525b;font-size:15px;">
          Bonjour <strong>${name}</strong>, voici tes tâches en cours pour cette semaine.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr>
            <td style="text-align:center;background:#f9fafb;border-radius:10px;padding:16px;">
              <span style="font-size:28px;font-weight:700;color:#18181b;">${tasks.length}</span>
              <span style="display:block;font-size:12px;color:#71717a;">tâches totales</span>
            </td>
            <td width="12"></td>
            <td style="text-align:center;background:#fef2f2;border-radius:10px;padding:16px;">
              <span style="font-size:28px;font-weight:700;color:#dc2626;">${urgent}</span>
              <span style="display:block;font-size:12px;color:#71717a;">urgentes</span>
            </td>
            <td width="12"></td>
            <td style="text-align:center;background:#eff6ff;border-radius:10px;padding:16px;">
              <span style="font-size:28px;font-weight:700;color:#2563eb;">${enCours}</span>
              <span style="display:block;font-size:12px;color:#71717a;">en cours</span>
            </td>
          </tr>
        </table>
        ${taskRows}
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://relays.vercel.app'}/kanban"
           style="display:inline-block;margin-top:20px;background:${department.color};color:#fff;
           padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
          Ouvrir RELAYS →
        </a>
      `,
    }),
  }
}

// ── 6. Commentaire ─────────────────────────────────────────────────────────────
export function emailComment({
  assigneeName, authorName, comment, task, department,
}: {
  assigneeName: string
  authorName: string
  comment: string
  task: TaskInfo
  department: DeptInfo
}) {
  return {
    subject: `💬 Nouveau commentaire — ${task.title}`,
    html: baseHtml({
      title: `Nouveau commentaire`,
      preheader: `${authorName} a commenté "${task.title}"`,
      deptColor: department.color,
      content: `
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;">Nouveau commentaire</h2>
        <p style="margin:0 0 20px;color:#52525b;font-size:15px;">
          Bonjour <strong>${assigneeName}</strong>,<br/>
          <strong>${authorName}</strong> a commenté une tâche qui te concerne.
        </p>
        <div style="background:#f9fafb;border-left:4px solid ${department.color};border-radius:0 10px 10px 0;
          padding:16px 20px;margin-bottom:16px;">
          <p style="margin:0;font-size:15px;color:#18181b;line-height:1.6;">${comment}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#71717a;">— ${authorName}</p>
        </div>
        ${taskBlock({ task, deptColor: department.color })}
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://relays.vercel.app'}/kanban"
           style="display:inline-block;margin-top:20px;background:${department.color};color:#fff;
           padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
          Répondre →
        </a>
      `,
    }),
  }
}
